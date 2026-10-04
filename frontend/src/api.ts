export type Role = 'user' | 'assistant'

export interface ChatMessage {
  role: Role
  content: string
  /** Set on assistant replies produced in this session. */
  model?: string
  elapsedMs?: number
  firstTokenMs?: number | null
  /** True while tokens for this reply are still arriving. */
  streaming?: boolean
}

export interface StreamStart {
  thread_id: string
  model: string
  title: string
}

export interface StreamDone {
  thread_id: string
  reply: string
  model: string
  elapsed_ms: number
  first_token_ms: number | null
  title: string
}

export interface StreamHandlers {
  onStart?: (info: StreamStart) => void
  onToken: (content: string) => void
}

export interface ThreadSummary {
  thread_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ServerConfig {
  models: string[]
  default_model: string
  default_temperature: number
  checkpointer: string
}

export interface RunOptions {
  model: string
  temperature: number
}

/** Error raised for any failed API call; carries what the error card displays. */
export class ApiError extends Error {
  status: number
  errorType: string | null
  detail: string | null
  threadId: string | null
  model: string | null
  elapsedMs: number | null

  constructor(message: string, status: number, body: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorType = typeof body.error_type === 'string' ? body.error_type : null
    this.detail = typeof body.detail === 'string' ? body.detail : null
    this.threadId = typeof body.thread_id === 'string' ? body.thread_id : null
    this.model = typeof body.model === 'string' ? body.model : null
    this.elapsedMs = typeof body.elapsed_ms === 'number' ? body.elapsed_ms : null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch (err) {
    throw new ApiError('Could not reach the backend', 0, {
      error_type: 'NetworkError',
      detail: err instanceof Error ? err.message : String(err),
    })
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (body === null && res.status >= 500) {
    // A non-JSON 5xx comes from the dev proxy (or a gateway) when Flask itself is down.
    throw new ApiError('Could not reach the backend', 0, {
      error_type: 'NetworkError',
      detail: `${res.status} ${res.statusText}`.trim(),
    })
  }
  if (!res.ok || body === null) {
    const message = typeof body?.error === 'string' ? body.error : `Request failed (${res.status})`
    throw new ApiError(message, res.status, body ?? {})
  }
  return body as T
}

export function getConfig(): Promise<ServerConfig> {
  return request('/config')
}

export async function listThreads(): Promise<ThreadSummary[]> {
  const data = await request<{ threads: ThreadSummary[] }>('/threads')
  return data.threads
}

export async function getHistory(threadId: string): Promise<ChatMessage[]> {
  const data = await request<{ messages: ChatMessage[] }>(`/chat/${encodeURIComponent(threadId)}`)
  return data.messages
}

/**
 * POST to a streaming endpoint and dispatch its server-sent events.
 * Resolves with the `done` payload; rejects with an ApiError on an `error` event.
 */
async function streamRequest(
  path: string,
  payload: unknown,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<StreamDone> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (err) {
    if (signal.aborted) throw err
    throw new ApiError('Could not reach the backend', 0, {
      error_type: 'NetworkError',
      detail: err instanceof Error ? err.message : String(err),
    })
  }

  // Validation errors (and a downed backend behind the dev proxy) come back before any stream starts.
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (body === null && res.status >= 500) {
      throw new ApiError('Could not reach the backend', 0, {
        error_type: 'NetworkError',
        detail: `${res.status} ${res.statusText}`.trim(),
      })
    }
    const message = typeof body?.error === 'string' ? body.error : `Request failed (${res.status})`
    throw new ApiError(message, res.status, body ?? {})
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let threadId: string | null = null
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value

    // Events are separated by a blank line; keep any trailing partial event in the buffer.
    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)

      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      const parsed = JSON.parse(data) as Record<string, unknown>

      if (event === 'start') {
        threadId = parsed.thread_id as string
        handlers.onStart?.(parsed as unknown as StreamStart)
      } else if (event === 'token') {
        handlers.onToken(parsed.content as string)
      } else if (event === 'done') {
        return parsed as unknown as StreamDone
      } else if (event === 'error') {
        throw new ApiError(String(parsed.error ?? 'The model call failed'), 502, parsed)
      }
    }
  }

  throw new ApiError('The connection closed before the reply finished', 0, {
    error_type: 'StreamInterrupted',
    detail: 'The event stream ended without a done event.',
    thread_id: threadId,
  })
}

export function streamMessage(
  message: string,
  threadId: string | null,
  options: RunOptions,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<StreamDone> {
  return streamRequest('/chat/stream', { message, thread_id: threadId, ...options }, handlers, signal)
}

/** Resume a thread whose last model call failed, without re-sending the user message. */
export function streamRetry(
  threadId: string,
  options: RunOptions,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<StreamDone> {
  return streamRequest(`/chat/${encodeURIComponent(threadId)}/retry/stream`, options, handlers, signal)
}

export async function deleteThread(threadId: string): Promise<void> {
  await request(`/chat/${encodeURIComponent(threadId)}`, { method: 'DELETE' })
}

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  role: Role
  content: string
  /** Set on assistant replies produced in this session. */
  model?: string
  elapsedMs?: number
}

export interface ChatResponse {
  thread_id: string
  reply: string
  model: string
  elapsed_ms: number
  title: string
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

export function sendMessage(message: string, threadId: string | null, options: RunOptions): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, thread_id: threadId, ...options }),
  })
}

/** Resume a thread whose last model call failed, without re-sending the user message. */
export function retryThread(threadId: string, options: RunOptions): Promise<ChatResponse> {
  return request(`/chat/${encodeURIComponent(threadId)}/retry`, {
    method: 'POST',
    body: JSON.stringify(options),
  })
}

export async function deleteThread(threadId: string): Promise<void> {
  await request(`/chat/${encodeURIComponent(threadId)}`, { method: 'DELETE' })
}

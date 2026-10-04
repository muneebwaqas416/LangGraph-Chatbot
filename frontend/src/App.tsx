import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  deleteThread,
  getConfig,
  getHistory,
  listThreads,
  streamMessage,
  streamRetry,
  type ChatMessage,
  type RunOptions,
  type ServerConfig,
  type StreamDone,
  type StreamHandlers,
  type ThreadSummary,
} from './api'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { ErrorCard } from './components/ErrorCard'
import { Header } from './components/Header'
import { AssistantMessage, ThinkingMessage, UserMessage } from './components/Messages'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { useStoredSettings } from './lib/settings'

const FALLBACK_MODEL = 'gpt-4o-mini'
const isDesktop = () => window.matchMedia('(min-width: 768px)').matches

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(err instanceof Error ? err.message : String(err), -1)
}

function App() {
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [stored, saveSettings] = useStoredSettings()

  const composerRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Bumped whenever the visible thread changes, so late responses for another thread are ignored.
  const viewRef = useRef(0)
  // The in-flight stream, aborted when the user leaves the thread it belongs to.
  const abortRef = useRef<AbortController | null>(null)

  const options: RunOptions = {
    model:
      stored.model && (!config || config.models.includes(stored.model))
        ? stored.model
        : (config?.default_model ?? FALLBACK_MODEL),
    temperature: stored.temperature ?? config?.default_temperature ?? 0,
  }

  const refreshThreads = useCallback(async () => {
    try {
      setThreads(await listThreads())
    } catch {
      // The sidebar keeps its last known list; the connection state is tracked separately.
    }
  }, [])

  // Load server config, and keep retrying every few seconds while the backend is down.
  useEffect(() => {
    if (backendOnline) return
    let cancelled = false
    async function connect() {
      try {
        const cfg = await getConfig()
        if (cancelled) return
        setConfig(cfg)
        setBackendOnline(true)
        refreshThreads()
      } catch {
        if (!cancelled) setBackendOnline(false)
      }
    }
    connect()
    const timer = setInterval(connect, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [backendOnline, refreshThreads])

  useEffect(() => {
    // Jump instantly while tokens stream in; smooth scrolling on every frame lags behind.
    const streaming = messages.at(-1)?.streaming === true
    bottomRef.current?.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' })
  }, [messages, loading, error])

  const resetView = useCallback(() => {
    viewRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setThreadId(null)
    setMessages([])
    setError(null)
    setLoading(false)
    setRetrying(false)
  }, [])

  const newChat = useCallback(() => {
    resetView()
    setInput('')
    if (!isDesktop()) setSidebarOpen(false)
    composerRef.current?.focus()
  }, [resetView])

  // ⌘K / Ctrl+K starts a new chat, as advertised on the sidebar button.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        newChat()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newChat])

  function handleFailure(err: unknown) {
    const apiError = toApiError(err)
    if (apiError.threadId) setThreadId(apiError.threadId)
    if (apiError.status === 0) setBackendOnline(false)
    setError(apiError)
  }

  /**
   * Run one streamed graph turn: tokens grow a placeholder assistant message, `done` finalizes it,
   * and a failure drops the partial reply (the server never checkpointed it) and shows the error card.
   */
  async function runStream(start: (handlers: StreamHandlers, signal: AbortSignal) => Promise<StreamDone>) {
    const view = viewRef.current
    const controller = new AbortController()
    abortRef.current = controller
    const current = () => view === viewRef.current

    // Tokens are buffered and flushed once per frame so long replies don't re-render per token.
    let pending = ''
    let frame = 0
    const flush = () => {
      frame = 0
      if (!pending || !current()) return
      const text = pending
      pending = ''
      setMessages((prev) => {
        const last = prev.at(-1)
        if (last?.role === 'assistant' && last.streaming) {
          return [...prev.slice(0, -1), { ...last, content: last.content + text }]
        }
        return [...prev, { role: 'assistant', content: text, model: options.model, streaming: true }]
      })
    }

    try {
      const done = await start(
        {
          onStart: (info) => {
            if (!current()) return
            setThreadId(info.thread_id)
            refreshThreads()
          },
          onToken: (content) => {
            pending += content
            if (!frame) frame = requestAnimationFrame(flush)
          },
        },
        controller.signal,
      )
      cancelAnimationFrame(frame)
      if (!current()) return
      setThreadId(done.thread_id)
      setMessages((prev) => [
        ...prev.filter((m) => !m.streaming),
        {
          role: 'assistant',
          content: done.reply,
          model: done.model,
          elapsedMs: done.elapsed_ms,
          firstTokenMs: done.first_token_ms,
        },
      ])
    } catch (err) {
      cancelAnimationFrame(frame)
      if (!current()) return
      setMessages((prev) => prev.filter((m) => !m.streaming))
      handleFailure(err)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      if (current()) {
        setLoading(false)
        setRetrying(false)
      }
      refreshThreads()
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || retrying) return

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setError(null)
    setLoading(true)
    await runStream((handlers, signal) => streamMessage(text, threadId, options, handlers, signal))
  }

  async function handleRetry() {
    if (!threadId) return
    const id = threadId
    setError(null)
    setRetrying(true)
    await runStream((handlers, signal) => streamRetry(id, options, handlers, signal))
  }

  async function selectThread(id: string) {
    if (!isDesktop()) setSidebarOpen(false)
    if (id === threadId) return
    resetView()
    const view = viewRef.current
    setThreadId(id)
    setLoading(true)
    try {
      const history = await getHistory(id)
      if (view === viewRef.current) setMessages(history)
    } catch (err) {
      if (view === viewRef.current) handleFailure(err)
    } finally {
      if (view === viewRef.current) setLoading(false)
    }
  }

  async function removeThread(id: string) {
    try {
      await deleteThread(id)
      if (id === threadId) newChat()
    } catch (err) {
      handleFailure(err)
    } finally {
      refreshThreads()
    }
  }

  async function copyTranscript() {
    const transcript = messages
      .map((m) => `**${m.role === 'user' ? 'You' : 'Assistant'}:**\n\n${m.content}`)
      .join('\n\n---\n\n')
    await navigator.clipboard.writeText(transcript)
  }

  const lastIsUser = messages.at(-1)?.role === 'user'
  const streamingStarted = messages.at(-1)?.streaming === true
  const showEmpty = messages.length === 0 && !loading && !error

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        open={sidebarOpen}
        threads={threads}
        activeThreadId={threadId}
        backendOnline={backendOnline}
        checkpointer={config ? `${config.checkpointer} · 127.0.0.1:5001` : null}
        onClose={() => setSidebarOpen(false)}
        onNewChat={newChat}
        onSelectThread={selectThread}
        onDeleteThread={removeThread}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className={`flex min-h-screen flex-col transition-[padding] duration-200 ${sidebarOpen ? 'md:pl-[260px]' : ''}`}>
        <Header
          sidebarOpen={sidebarOpen}
          threadId={threadId}
          model={options.model}
          turnCount={messages.filter((m) => m.role === 'user').length}
          canExport={messages.length > 0}
          onToggleSidebar={() => setSidebarOpen(true)}
          onCopyTranscript={copyTranscript}
          onClear={() => threadId && removeThread(threadId)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main
          className={`mx-auto w-full flex-1 px-4 pt-20 pb-52 sm:px-8 ${showEmpty ? 'max-w-[840px]' : 'max-w-[760px] space-y-6'}`}
        >
          {showEmpty ? (
            <EmptyState
              backendOnline={backendOnline}
              model={options.model}
              temperature={options.temperature}
              checkpointer={config?.checkpointer ?? null}
              onPickPrompt={(prompt) => {
                setInput(prompt)
                composerRef.current?.focus()
              }}
            />
          ) : (
            <>
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <UserMessage key={i} content={m.content} />
                ) : (
                  <AssistantMessage key={i} message={m} />
                ),
              )}
              {(loading || retrying) && !streamingStarted && <ThinkingMessage model={options.model} />}
              {error && (
                <ErrorCard
                  error={error}
                  // A 502 means the user message is checkpointed and the graph can resume.
                  onRetry={error.status === 502 && threadId && lastIsUser ? handleRetry : null}
                  onDismiss={() => setError(null)}
                />
              )}
            </>
          )}
          <div ref={bottomRef} />
        </main>

        <Composer
          ref={composerRef}
          value={input}
          disabled={loading || retrying}
          threadId={threadId}
          sidebarOpen={sidebarOpen}
          onChange={setInput}
          onSubmit={handleSend}
        />
      </div>

      {settingsOpen && (
        <SettingsModal
          models={config?.models ?? [options.model]}
          defaultModel={config?.default_model ?? FALLBACK_MODEL}
          current={options}
          threadId={threadId}
          onApply={saveSettings}
          onPurgeThread={async () => {
            if (threadId) await removeThread(threadId)
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

export default App

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  deleteThread,
  getConfig,
  getHistory,
  listThreads,
  retryThread,
  sendMessage,
  type ChatMessage,
  type ChatResponse,
  type RunOptions,
  type ServerConfig,
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, error])

  const resetView = useCallback(() => {
    viewRef.current += 1
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

  function appendReply(data: ChatResponse) {
    setThreadId(data.thread_id)
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: data.reply, model: data.model, elapsedMs: data.elapsed_ms },
    ])
  }

  function handleFailure(err: unknown) {
    const apiError = toApiError(err)
    if (apiError.threadId) setThreadId(apiError.threadId)
    if (apiError.status === 0) setBackendOnline(false)
    setError(apiError)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const view = viewRef.current
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const data = await sendMessage(text, threadId, options)
      if (view === viewRef.current) appendReply(data)
    } catch (err) {
      if (view === viewRef.current) handleFailure(err)
    } finally {
      if (view === viewRef.current) setLoading(false)
      refreshThreads()
    }
  }

  async function handleRetry() {
    if (!threadId) return
    const view = viewRef.current
    setRetrying(true)
    try {
      const data = await retryThread(threadId, options)
      if (view === viewRef.current) {
        setError(null)
        appendReply(data)
      }
    } catch (err) {
      if (view === viewRef.current) handleFailure(err)
    } finally {
      if (view === viewRef.current) setRetrying(false)
      refreshThreads()
    }
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
              {(loading || retrying) && <ThinkingMessage model={options.model} />}
              {error && !retrying && (
                <ErrorCard
                  error={error}
                  retrying={retrying}
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

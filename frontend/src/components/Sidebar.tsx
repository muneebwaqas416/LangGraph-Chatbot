import type { ThreadSummary } from '../api'
import { groupThreads } from '../lib/format'
import { Icon } from './Icon'

interface SidebarProps {
  open: boolean
  threads: ThreadSummary[]
  activeThreadId: string | null
  backendOnline: boolean | null
  checkpointer: string | null
  onClose: () => void
  onNewChat: () => void
  onSelectThread: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
  onOpenSettings: () => void
}

export function Sidebar({
  open,
  threads,
  activeThreadId,
  backendOnline,
  checkpointer,
  onClose,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  onOpenSettings,
}: SidebarProps) {
  const groups = groupThreads(threads)

  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen w-[260px] flex-col border-r border-line bg-white select-none transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="LangGraph logo" className="h-7 w-7 shrink-0 rounded-md" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-tight text-ink">LangGraph Chatbot</span>
              <span className="font-mono text-[10px] leading-tight text-muted">StateGraph · Flask API</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted transition-colors hover:bg-tag hover:text-ink"
            title="Collapse sidebar"
          >
            <Icon name="dock_to_left" className="text-[18px]" />
          </button>
        </div>

        {/* New chat */}
        <div className="border-b border-line/60 p-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex h-9 w-full items-center justify-between rounded-md bg-navy px-3 text-xs font-medium text-white shadow-sm transition-colors hover:bg-navy-hover"
          >
            <span className="flex items-center gap-2">
              <Icon name="add" className="text-[16px]" />
              New chat
            </span>
            <kbd className="rounded bg-white/10 px-1 py-0.5 font-mono text-[10px] opacity-70">⌘K</kbd>
          </button>
        </div>

        {/* Thread history */}
        <div className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
          {groups.length === 0 && (
            <p className="px-2.5 text-xs leading-relaxed text-muted">
              No conversations yet. Threads you start appear here until the server restarts.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-2.5 pb-1.5 font-mono text-[10px] font-semibold tracking-wider text-muted uppercase">
                {group.label}
              </div>
              <nav className="space-y-0.5">
                {group.threads.map((thread) => {
                  const active = thread.thread_id === activeThreadId
                  return (
                    <div
                      key={thread.thread_id}
                      className={`group flex items-center justify-between rounded-md border text-xs transition-colors ${
                        active
                          ? 'border-line bg-tag font-medium text-ink'
                          : 'border-transparent text-muted hover:bg-tag hover:text-ink'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectThread(thread.thread_id)}
                        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 text-left"
                        title={thread.title}
                      >
                        <Icon
                          name="account_tree"
                          className={`shrink-0 text-[16px] ${active ? 'text-user' : 'text-muted'}`}
                        />
                        <span className="truncate">{thread.title}</span>
                      </button>
                      {active && <span className="mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-mint group-hover:hidden" />}
                      <button
                        type="button"
                        onClick={() => onDeleteThread(thread.thread_id)}
                        className="mr-1 shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-crimson-600 focus:opacity-100"
                        title="Delete thread"
                      >
                        <Icon name="delete" className="text-[15px]" />
                      </button>
                    </div>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Runtime footer */}
        <div className="flex items-center justify-between border-t border-line bg-white p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-tag">
              <Icon name="dns" className="text-[16px] text-user" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-ink">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    backendOnline === null ? 'bg-slate-300' : backendOnline ? 'bg-mint' : 'bg-crimson-600'
                  }`}
                />
                {backendOnline === null ? 'Connecting…' : backendOnline ? 'Backend online' : 'Backend offline'}
              </div>
              <div className="truncate font-mono text-[11px] text-muted">{checkpointer ?? '127.0.0.1:5001'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded p-1 text-muted transition-colors hover:bg-tag hover:text-ink"
            title="Settings"
          >
            <Icon name="settings" className="text-[18px]" />
          </button>
        </div>
      </aside>
    </>
  )
}

import { useState } from 'react'
import { shortId } from '../lib/format'
import { Icon } from './Icon'

interface HeaderProps {
  sidebarOpen: boolean
  threadId: string | null
  model: string
  turnCount: number
  canExport: boolean
  onToggleSidebar: () => void
  onCopyTranscript: () => Promise<void>
  onClear: () => void
  onOpenSettings: () => void
}

export function Header({
  sidebarOpen,
  threadId,
  model,
  turnCount,
  canExport,
  onToggleSidebar,
  onCopyTranscript,
  onClear,
  onOpenSettings,
}: HeaderProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await onCopyTranscript()
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-white/95 px-4 backdrop-blur transition-[left] duration-200 sm:px-6 ${
        sidebarOpen ? 'md:left-[260px]' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded p-1 text-muted transition-colors hover:bg-tag hover:text-ink"
            title="Open sidebar"
          >
            <Icon name="dock_to_right" className="text-[18px]" />
          </button>
        )}
        <span className="text-xs font-semibold whitespace-nowrap text-ink">LangGraph Chatbot</span>
        <span className="text-sm text-line">/</span>
        <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-xs text-muted">
          {threadId ? shortId(threadId) : 'new thread'}
          <span className="text-[11px] font-medium text-ink">(StateGraph)</span>
        </span>
        <span className="ml-1 hidden items-center gap-1 rounded-full border border-line bg-tag px-2 py-0.5 font-mono text-[11px] text-muted md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {model}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {threadId && (
          <div className="hidden items-center gap-2 rounded border border-line bg-tag px-2.5 py-1 font-mono text-[11px] text-muted lg:flex">
            <Icon name="forum" className="text-[13px] text-emerald-600" />
            <span>Turns: {turnCount}</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleCopy}
          disabled={!canExport}
          className="flex h-8 items-center gap-1.5 rounded border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-tag disabled:cursor-not-allowed disabled:opacity-50"
          title="Copy the conversation as Markdown"
        >
          <Icon name={copied ? 'check' : 'share'} className="text-[15px]" />
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!threadId}
          className="flex h-8 items-center gap-1.5 rounded border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-tag disabled:cursor-not-allowed disabled:opacity-50"
          title="Delete this thread's checkpoints and start over"
        >
          <Icon name="cleaning_services" className="text-[15px]" />
          <span className="hidden sm:inline">Clear</span>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded border border-line p-1.5 text-muted transition-colors hover:bg-tag hover:text-ink"
          title="Model settings"
        >
          <Icon name="tune" className="text-[18px]" />
        </button>
      </div>
    </header>
  )
}

import { forwardRef, type KeyboardEvent } from 'react'
import { shortId } from '../lib/format'
import { Icon } from './Icon'

interface ComposerProps {
  value: string
  disabled: boolean
  threadId: string | null
  sidebarOpen: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, disabled, threadId, sidebarOpen, onChange, onSubmit },
  ref,
) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline. ⌘/Ctrl+Enter also sends.
    if (e.key === 'Enter' && (!e.shiftKey || e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div
      className={`pointer-events-none fixed right-0 bottom-0 left-0 z-20 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-4 pt-6 pb-5 transition-[left] duration-200 sm:px-8 ${
        sidebarOpen ? 'md:left-[260px]' : ''
      }`}
    >
      <div className="pointer-events-auto mx-auto max-w-[760px] space-y-2">
        <div className="rounded-lg border border-input bg-white p-3 shadow-md transition-all focus-within:border-navy focus-within:ring-1 focus-within:ring-navy">
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            autoFocus
            placeholder="Ask about graph compilation, state reducers, or anything else…"
            className="max-h-48 w-full resize-none bg-transparent text-sm leading-relaxed text-navy placeholder:text-slate-400 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <Icon name="history_toggle_off" className="text-[17px] text-slate-500" />
              <span className="hidden sm:inline">Thread ID: {threadId ? shortId(threadId) : 'assigned on send'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="hidden font-mono text-[11px] text-slate-400 sm:inline">↵ Send · ⇧↵ Newline</span>
              <button
                type="button"
                onClick={onSubmit}
                disabled={disabled || !value.trim()}
                className="flex h-8 items-center gap-1.5 rounded-md bg-navy px-4 text-xs font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="send" className="text-[15px]" />
                Send
              </button>
            </div>
          </div>
        </div>
        <p className="text-center font-mono text-[11px] text-slate-400">
          LangGraph Chatbot · Conversation memory is kept in server memory and resets when the backend restarts.
        </p>
      </div>
    </div>
  )
})

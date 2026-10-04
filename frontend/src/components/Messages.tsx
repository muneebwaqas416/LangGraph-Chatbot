import type { ReactNode } from 'react'
import type { ChatMessage } from '../api'
import { formatElapsed } from '../lib/format'
import { Icon } from './Icon'
import { Markdown } from './Markdown'

export function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="pr-1 text-[11px] font-medium text-ink">You</div>
      <div className="max-w-[85%] rounded-lg bg-user p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-white shadow-sm">
        {content}
      </div>
    </div>
  )
}

function AssistantHeader({ badge }: { badge: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-tag/40 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-user font-mono text-[11px] font-bold text-white">
          LG
        </div>
        <span className="text-xs font-semibold text-ink">LangGraph Assistant</span>
      </div>
      {badge}
    </div>
  )
}

export function AssistantMessage({ message }: { message: ChatMessage }) {
  let badge: ReactNode
  if (message.streaming) {
    badge = (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-mint-border bg-mint-bg px-2 py-0.5 font-mono text-[11px] text-mint">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
        {message.model} · streaming…
      </div>
    )
  } else if (message.elapsedMs !== undefined) {
    const firstToken =
      message.firstTokenMs != null ? ` · first token ${formatElapsed(message.firstTokenMs)}` : ''
    badge = (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-mint-border bg-mint-bg px-2 py-0.5 font-mono text-[11px] text-mint">
        <span className="h-1.5 w-1.5 rounded-full bg-mint" />
        {message.model} · responded in {formatElapsed(message.elapsedMs)}
        {firstToken}
      </div>
    )
  } else {
    badge = (
      <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <Icon name="history" className="text-[14px]" />
        Restored from checkpoint
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <AssistantHeader badge={badge} />
      <div className="p-5">
        <Markdown content={message.content} />
        {message.streaming && (
          <span aria-hidden="true" className="mt-1 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-user align-middle" />
        )}
      </div>
    </div>
  )
}

export function ThinkingMessage({ model }: { model: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-sm">
      <AssistantHeader
        badge={
          <div className="inline-flex items-center gap-1.5 rounded-full border border-mint-border bg-mint-bg px-2 py-0.5 font-mono text-[11px] text-mint">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            Running graph on {model} · waiting for first token…
          </div>
        }
      />
      <div className="space-y-2 p-5">
        <div className="h-3 w-3/4 animate-pulse rounded bg-tag" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-tag" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-tag" />
      </div>
    </div>
  )
}

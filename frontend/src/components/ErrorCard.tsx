import { useState } from 'react'
import type { ApiError } from '../api'
import { formatElapsed } from '../lib/format'
import { Icon } from './Icon'

interface ErrorCardProps {
  error: ApiError
  retrying: boolean
  /** Only offered when the failed turn is still checkpointed on the server. */
  onRetry: (() => void) | null
  onDismiss: () => void
}

function describe(error: ApiError) {
  if (error.status === 0) {
    return {
      title: 'Backend unreachable',
      badge: 'Network error',
      summary: 'The Flask API did not respond. Make sure the backend is running on 127.0.0.1:5001.',
    }
  }
  if (error.status === 502) {
    return {
      title: `Model call failed${error.errorType ? `: ${error.errorType}` : ''}`,
      badge: 'HTTP 502 / Upstream model error',
      summary: 'The graph started but the LLM call raised an exception. Your message is saved in the thread checkpoint.',
    }
  }
  return {
    title: 'Request rejected',
    badge: `HTTP ${error.status}`,
    summary: error.message,
  }
}

export function ErrorCard({ error, retrying, onRetry, onDismiss }: ErrorCardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [copied, setCopied] = useState(false)
  const { title, badge, summary } = describe(error)

  const metrics = [
    { label: 'Elapsed Time', value: error.elapsedMs !== null ? formatElapsed(error.elapsedMs) : '—' },
    { label: 'Model', value: error.model ?? '—' },
    { label: 'HTTP Status', value: error.status === 0 ? 'No response' : String(error.status), danger: true },
    { label: 'Error Type', value: error.errorType ?? 'Error', danger: true },
  ]

  async function copyDiagnostics() {
    await navigator.clipboard.writeText(JSON.stringify({ ...error, message: error.message }, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex items-start gap-3.5">
      <div className="mt-0.5 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-2xs sm:flex">
        <img src="/logo.svg" alt="" className="h-4 w-4 rounded-xs" />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-semibold text-slate-900">LangGraph Runtime</span>
          <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600">
            error
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-l-4 border-crimson-300 border-l-crimson-600 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-crimson-200 bg-crimson-50">
                <Icon name="error_outline" className="text-[20px] text-crimson-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h3>
                {error.threadId && (
                  <p className="mt-0.5 truncate font-mono text-[12px] text-slate-500">Thread ID: {error.threadId}</p>
                )}
              </div>
            </div>
            <span className="self-start rounded border border-crimson-200 bg-crimson-50 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-tight whitespace-nowrap text-crimson-700">
              {badge}
            </span>
          </div>

          <p className="py-4 text-[13.5px] leading-relaxed text-slate-700">{summary}</p>

          <div className="my-1 rounded-lg border border-slate-200/80 bg-tag p-3.5">
            <div className="mb-2 flex items-center gap-1.5 border-b border-slate-200/60 pb-2 font-mono text-[11px] font-semibold tracking-wider text-slate-600 uppercase">
              <Icon name="speed" className="text-[14px] text-slate-500" />
              Diagnostic Metrics
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {metrics.map((m) => (
                <div key={m.label} className="rounded-md border border-slate-200 bg-white p-2.5 shadow-2xs">
                  <div className="text-[11px] font-medium text-slate-500">{m.label}</div>
                  <div
                    className={`mt-0.5 truncate font-mono text-[13px] font-semibold ${
                      m.danger ? 'text-crimson-600' : 'text-slate-900'
                    }`}
                    title={m.value}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error.detail && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                className="group flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100"
              >
                <div className="flex min-w-0 items-center gap-2 truncate font-mono text-[12px]">
                  <Icon
                    name="chevron_right"
                    className={`shrink-0 text-[16px] text-crimson-600 transition-transform ${showDetail ? 'rotate-90' : ''}`}
                  />
                  <span className="shrink-0 font-semibold text-crimson-600">{error.errorType ?? 'Error'}</span>
                  <span className="truncate text-slate-500">{error.detail}</span>
                </div>
                <span className="ml-2 shrink-0 rounded border border-slate-200 bg-white px-2 py-0.5 font-sans text-[11px] font-medium text-slate-600 shadow-2xs group-hover:text-slate-900">
                  {showDetail ? 'Hide details' : 'Inspect details'}
                </span>
              </button>
              {showDetail && (
                <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-slate-50 p-4 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-crimson-700">
                  {error.detail}
                </pre>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="flex h-9 items-center gap-2 rounded-lg bg-navy px-4 text-[13px] font-medium text-white shadow-xs transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60"
              >
                <Icon name="refresh" className={`text-[17px] ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying…' : 'Retry Execution'}
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
            >
              <Icon name="close" className="text-[17px] text-slate-600" />
              Dismiss
            </button>
            <button
              type="button"
              onClick={copyDiagnostics}
              className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name={copied ? 'check' : 'content_copy'} className="text-[16px] text-slate-500" />
              {copied ? 'Copied' : 'Export Diagnostic Trace'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

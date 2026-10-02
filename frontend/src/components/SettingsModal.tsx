import { useEffect, useState } from 'react'
import type { RunOptions } from '../api'
import { Icon } from './Icon'

interface SettingsModalProps {
  models: string[]
  defaultModel: string
  current: RunOptions
  threadId: string | null
  onApply: (options: RunOptions) => void
  onPurgeThread: () => Promise<void>
  onClose: () => void
}

function temperatureNote(value: number) {
  if (value === 0) return 'Deterministic'
  if (value <= 0.3) return 'Precise'
  if (value <= 0.7) return 'Balanced'
  return 'Creative'
}

export function SettingsModal({
  models,
  defaultModel,
  current,
  threadId,
  onApply,
  onPurgeThread,
  onClose,
}: SettingsModalProps) {
  const [model, setModel] = useState(current.model)
  const [temperature, setTemperature] = useState(current.temperature)
  const [purging, setPurging] = useState(false)
  const [confirmPurge, setConfirmPurge] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function purge() {
    if (!confirmPurge) {
      setConfirmPurge(true)
      return
    }
    setPurging(true)
    try {
      await onPurgeThread()
      onClose()
    } finally {
      setPurging(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-line bg-white text-slate-900 shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="tune" className="text-[20px] text-slate-900" />
              <h2 id="settings-title" className="text-base font-semibold tracking-tight">
                Model Configuration
              </h2>
            </div>
            <p className="text-xs leading-normal text-slate-500">
              Choose the model and sampling temperature used by the chat node.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-6 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="model-select" className="text-xs font-semibold text-slate-800">
                Execution LLM
              </label>
              <span className="rounded border border-teal-200 bg-teal-50 px-2 py-0.5 font-mono text-[11px] text-teal-700">
                OpenAI
              </span>
            </div>
            <div className="relative">
              <select
                id="model-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-line bg-white px-3 pr-8 text-xs font-medium text-slate-900 shadow-xs transition-colors focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                    {m === defaultModel ? ' (server default)' : ''}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[18px] text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="temp-slider" className="text-xs font-semibold text-slate-800">
                Sampling Temperature
              </label>
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-800">
                {temperature.toFixed(2)} ({temperatureNote(temperature)})
              </span>
            </div>
            <input
              id="temp-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-navy focus:outline-none"
            />
            <div className="flex justify-between font-mono text-[11px] text-slate-400">
              <span>0.00 Formal</span>
              <span>0.50 Balanced</span>
              <span>1.00 Creative</span>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/40 p-4">
            <div className="flex items-start gap-2.5">
              <Icon name="warning" className="mt-0.5 shrink-0 text-[20px] text-crimson-600" />
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-900">Purge Thread State History</span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {threadId
                    ? 'Permanently deletes this thread’s checkpoints and conversation memory on the server. Irreversible.'
                    : 'Open a conversation to purge its checkpoints.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={purge}
                disabled={!threadId || purging}
                className="flex h-8 items-center gap-1.5 rounded-md bg-crimson-600 px-3 text-xs font-medium text-white shadow-xs transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="delete_forever" className="text-[15px]" />
                {purging ? 'Purging…' : confirmPurge ? 'Click again to confirm' : 'Purge Thread Checkpoints'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-line bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onApply({ model, temperature })
              onClose()
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-navy px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <Icon name="check" className="text-[15px] text-teal-400" />
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  )
}

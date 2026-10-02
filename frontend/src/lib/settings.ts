import { useState } from 'react'
import type { RunOptions } from '../api'

const STORAGE_KEY = 'langgraph-chatbot:settings'

function load(): Partial<RunOptions> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<RunOptions>) : {}
  } catch {
    return {}
  }
}

/**
 * Model settings chosen in the settings modal, remembered in this browser.
 * `null` fields mean "use the server default".
 */
export function useStoredSettings() {
  const [settings, setSettings] = useState<Partial<RunOptions>>(load)

  function save(next: RunOptions) {
    setSettings(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage can be unavailable (private mode); settings still apply for this session.
    }
  }

  return [settings, save] as const
}

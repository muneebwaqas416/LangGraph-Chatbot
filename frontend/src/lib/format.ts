import type { ThreadSummary } from '../api'

export interface ThreadGroup {
  label: string
  threads: ThreadSummary[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Bucket threads into the sidebar's Today / Yesterday / Previous 7 days / Older sections. */
export function groupThreads(threads: ThreadSummary[], now = new Date()): ThreadGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const groups: ThreadGroup[] = [
    { label: 'Today', threads: [] },
    { label: 'Yesterday', threads: [] },
    { label: 'Previous 7 days', threads: [] },
    { label: 'Older', threads: [] },
  ]
  for (const thread of threads) {
    const t = new Date(thread.updated_at).getTime()
    if (t >= startOfToday) groups[0].threads.push(thread)
    else if (t >= startOfToday - DAY_MS) groups[1].threads.push(thread)
    else if (t >= startOfToday - 7 * DAY_MS) groups[2].threads.push(thread)
    else groups[3].threads.push(thread)
  }
  return groups.filter((g) => g.threads.length > 0)
}

export function formatElapsed(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`
}

export function shortId(threadId: string): string {
  return threadId.split('-')[0]
}

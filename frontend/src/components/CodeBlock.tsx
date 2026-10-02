import { useState } from 'react'
import { Icon } from './Icon'

interface CodeBlockProps {
  code: string
  language: string | null
}

/** Code block styled like the design's file panel, with line numbers and a copy button. */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const lines = code.replace(/\n$/, '').split('\n')

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="overflow-hidden rounded border border-line bg-slate-50 font-mono text-xs">
      <div className="flex h-8 items-center justify-between border-b border-line bg-white px-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="ml-1 text-[11px] text-muted uppercase">{language ?? 'text'}</span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded border border-line bg-white px-2 py-0.5 text-[11px] text-ink transition-colors hover:bg-tag"
        >
          <Icon name={copied ? 'check' : 'content_copy'} className="text-[13px]" />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto p-3.5 leading-5 text-slate-800">
        <pre>
          <code className="table w-full">
            {lines.map((line, i) => (
              <span key={i} className="table-row">
                <span className="table-cell w-6 pr-3 text-right text-slate-400 select-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="table-cell whitespace-pre">{line}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}

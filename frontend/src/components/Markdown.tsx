import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'

const components: Components = {
  // Fenced blocks render through CodeBlock; react-markdown wraps them in <pre>, which we drop.
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const language = /language-(\S+)/.exec(className ?? '')?.[1] ?? null
    const text = String(children)
    if (language || text.includes('\n')) return <CodeBlock code={text} language={language} />
    return <code>{children}</code>
  },
  table: ({ children }) => (
    <div className="overflow-x-auto rounded border border-line">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-line bg-tag font-mono text-[10px] text-muted uppercase">{children}</thead>
  ),
  tbody: ({ children }) => <tbody className="divide-y divide-line bg-white">{children}</tbody>,
  th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

import { Icon } from './Icon'

const PROMPTS = [
  {
    icon: 'account_tree',
    title: 'StateGraph Architecture',
    description: 'Typed state schemas, conditional routing and subgraphs.',
    prompt: 'Design a LangGraph StateGraph with a typed state schema and conditional routing between nodes.',
  },
  {
    icon: 'database',
    title: 'Checkpoint Persistence',
    description: 'How thread checkpoints let a graph remember and rewind.',
    prompt: 'Explain how LangGraph checkpointers persist thread state, and compare MemorySaver with PostgresSaver.',
  },
  {
    icon: 'verified_user',
    title: 'Human-in-the-Loop Gateways',
    description: 'Pause execution with interrupts for human review.',
    prompt: 'Show how to add human-in-the-loop approval to a LangGraph agent using interrupts.',
  },
  {
    icon: 'sensors',
    title: 'Real-time Streaming',
    description: 'Stream tokens and node updates to a web client.',
    prompt: 'How do I stream LangGraph node updates and LLM tokens to a React frontend over SSE?',
  },
]

interface EmptyStateProps {
  backendOnline: boolean | null
  model: string
  temperature: number
  checkpointer: string | null
  onPickPrompt: (prompt: string) => void
}

export function EmptyState({ backendOnline, model, temperature, checkpointer, onPickPrompt }: EmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="mt-4 mb-9 flex flex-col items-center text-center">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white p-2 shadow-sm">
          <img src="/logo.svg" alt="LangGraph logo" className="h-full w-full rounded-md" />
        </div>

        {backendOnline === false ? (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-crimson-200 bg-crimson-50 px-3 py-1 font-mono text-[11px] font-medium text-crimson-700">
            <span className="h-1.5 w-1.5 rounded-full bg-crimson-600" />
            Backend unreachable · start it with python run.py
          </div>
        ) : (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-mono text-[11px] font-medium text-teal-800">
            <span className={`h-1.5 w-1.5 rounded-full ${backendOnline ? 'bg-mint' : 'bg-slate-300'}`} />
            {backendOnline ? `Runtime online · ${model}` : 'Connecting to runtime…'}
          </div>
        )}

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-navy">LangGraph Chatbot</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted">
          A stateful chat agent built on a LangGraph StateGraph. Every thread is checkpointed, so the assistant
          remembers the conversation.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <Icon name="lan" className="text-[15px] text-slate-400" />
            StateGraph Core
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1.5">
            <Icon name="database" className="text-[15px] text-slate-400" />
            {checkpointer ?? 'MemorySaver'} Checkpointer
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1.5">
            <Icon name="forum" className="text-[15px] text-slate-400" />
            Thread Memory
          </span>
        </div>
      </div>

      <div className="mb-6 grid w-full grid-cols-1 gap-3.5 md:grid-cols-2">
        {PROMPTS.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onPickPrompt(card.prompt)}
            className="group flex flex-col justify-between rounded-lg border border-line bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-xs"
          >
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-user transition-colors group-hover:bg-slate-900 group-hover:text-white">
                  <Icon name={card.icon} className="text-[18px]" />
                </div>
                <span className="flex items-center gap-1 font-mono text-xs text-slate-400 transition-colors group-hover:text-navy">
                  Insert <Icon name="arrow_forward" className="text-[13px]" />
                </span>
              </div>
              <h2 className="mb-1 text-sm font-semibold text-navy transition-colors group-hover:text-mint">
                {card.title}
              </h2>
              <p className="text-xs leading-relaxed text-muted">{card.description}</p>
            </div>
            <div className="mt-3 flex w-full items-center gap-1.5 truncate border-t border-slate-100 pt-2.5 font-mono text-[11px] text-slate-500">
              <span className="font-sans text-slate-400">Prompt:</span>
              <span className="truncate">“{card.prompt}”</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex w-full flex-col items-center justify-between gap-3 rounded-lg border border-line bg-white p-3 px-4 text-xs shadow-xs sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${backendOnline ? 'bg-mint' : 'bg-slate-300'}`} />
          <span className="font-medium text-navy">Runtime:</span>
          <span className="font-mono text-slate-500">Flask API · LangGraph · OpenAI</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5">{model}</span>
          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5">
            Temperature: {temperature.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}

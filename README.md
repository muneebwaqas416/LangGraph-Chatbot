# LangGraph Chatbot

Monorepo for a LangGraph-powered chatbot, grown out of `notebooks/ChatBot_Workflow.ipynb`.

```
backend/    Flask API wrapping the LangGraph chat graph
frontend/   React + TypeScript (Vite) chat UI
notebooks/  Original prototype notebook
```

## Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then set OPENAI_API_KEY
python run.py          # http://127.0.0.1:5001
```

Endpoints:

| Method | Path                          | Body / notes                                                                 |
| ------ | ----------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/health`                 | Health check                                                                 |
| GET    | `/api/config`                 | Selectable models, default model/temperature, checkpointer name              |
| GET    | `/api/threads`                | Threads seen since startup (title, timestamps), newest first                 |
| POST   | `/api/chat`                   | `{ message, thread_id?, model?, temperature? }` → `{ thread_id, reply, model, elapsed_ms, title }` |
| POST   | `/api/chat/<thread_id>/retry` | `{ model?, temperature? }` — resume a thread whose last model call failed    |
| GET    | `/api/chat/<thread_id>`       | Full message history for a thread                                            |
| DELETE | `/api/chat/<thread_id>`       | Delete a thread's checkpoints                                                |

A failed model call returns `502` with `{ error, error_type, detail, thread_id, model, elapsed_ms }`; the user message stays checkpointed so `/retry` can resume without re-sending it.

Conversation memory uses LangGraph's `MemorySaver`, so it is in-process and resets on server restart.

## Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5180
npm run lint           # ESLint
```

The Vite dev server proxies `/api` to the Flask backend on port 5001.

The UI (React + TypeScript + Tailwind CSS v4) implements the light "Enterprise" screens from the Stitch project *LangGraph Chatbot Web App*: new chat, chat, error state and settings modal. Design tokens live in `src/index.css`.

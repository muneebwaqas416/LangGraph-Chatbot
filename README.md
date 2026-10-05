# LangGraph Chatbot

Monorepo for a LangGraph-powered chatbot, grown out of `notebooks/ChatBot_Workflow.ipynb`.

<img width="1920" height="928" alt="Screenshot 2026-10-06 at 1 56 51 AM" src="https://github.com/user-attachments/assets/0e32dfd8-2da3-48a1-86a5-acc2927ed1ea" />

```
backend/    Flask API wrapping the LangGraph chat graph
frontend/   React + TypeScript (Vite) chat UI
notebooks/  Original prototype notebook
```

## Backend

Chats are persisted in PostgreSQL, so start a database first (values must match `POSTGRES_URI` in `.env`):

```bash
docker run -d --name chatbot-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=chatbot \
  -p 5432:5432 -v chatbot-pgdata:/var/lib/postgresql/data postgres:16
```

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then set OPENAI_API_KEY and POSTGRES_URI
python run.py          # http://127.0.0.1:5001
```

Backend layout (each layer only calls the one below it):

```
app/
  routes.py         HTTP only: parse requests, call ChatService, map errors to status codes, format SSE
  services/         ChatService (validation, chat turns, streaming, retry, history) + domain errors
  repositories/     ThreadRepository: all SQL for the threads table
  models/           Dataclasses shared across layers (Thread, RunOptions, ChatResult, stream events)
  graph.py          LangGraph StateGraph
  checkpointer.py   Postgres connection pool + PostgresSaver
```

Endpoints:

| Method | Path                          | Body / notes                                                                 |
| ------ | ----------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/api/health`                 | Health check                                                                 |
| GET    | `/api/config`                 | Selectable models, default model/temperature, checkpointer name              |
| GET    | `/api/threads`                | Threads seen since startup (title, timestamps), newest first                 |
| POST   | `/api/chat`                   | `{ message, thread_id?, model?, temperature? }` → `{ thread_id, reply, model, elapsed_ms, title }` |
| POST   | `/api/chat/stream`            | Same body as `/api/chat`; streams the reply as server-sent events (below)    |
| POST   | `/api/chat/<thread_id>/retry` | `{ model?, temperature? }` — resume a thread whose last model call failed    |
| POST   | `/api/chat/<thread_id>/retry/stream` | Streaming version of `/retry`                                         |
| GET    | `/api/chat/<thread_id>`       | Full message history for a thread                                            |
| DELETE | `/api/chat/<thread_id>`       | Delete a thread's checkpoints                                                |

A failed model call returns `502` with `{ error, error_type, detail, thread_id, model, elapsed_ms }`; the user message stays checkpointed so `/retry` can resume without re-sending it.

The streaming endpoints run `chatbot.stream(..., stream_mode="messages")` and emit:

| Event   | Data                                                                      |
| ------- | ------------------------------------------------------------------------- |
| `start` | `{ thread_id, model, title }`                                             |
| `token` | `{ content }` — one LLM text delta                                        |
| `done`  | `{ thread_id, reply, model, elapsed_ms, first_token_ms, title }`          |
| `error` | Same fields as the `502` body above (the HTTP status is already `200`)    |

The UI uses the streaming endpoints and renders tokens as they arrive.

### Persistence

Everything survives a server restart. Two kinds of tables live in the same database, linked by `thread_id`:

| Table(s) | Written by | Holds |
| --- | --- | --- |
| `checkpoints`, `checkpoint_blobs`, `checkpoint_writes` | LangGraph's `PostgresSaver` (`app/checkpointer.py`), automatically on every graph step | Message history and graph state per thread |
| `threads` | `ThreadRepository` (`app/repositories/`), from the routes | Sidebar metadata: title, model, message count, timestamps |

Both are created on startup (`checkpointer.setup()` and `threads_repo.create_schema()`). The `threads` schema and `Thread` model live in `app/models/thread.py`.

## Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5180
npm run lint           # ESLint
```

The Vite dev server proxies `/api` to the Flask backend on port 5001.

The UI (React + TypeScript + Tailwind CSS v4) implements the light "Enterprise" screens from the Stitch project *LangGraph Chatbot Web App*: new chat, chat, error state and settings modal. Design tokens live in `src/index.css`.

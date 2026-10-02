import threading
import time
import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from langchain_core.messages import HumanMessage

from .graph import AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_TEMPERATURE, checkpointer, chatbot

api = Blueprint("api", __name__, url_prefix="/api")

# Thread metadata for the sidebar. Like the MemorySaver checkpointer, it lives in
# process memory and resets on server restart.
_threads: dict[str, dict] = {}
_threads_lock = threading.Lock()


def _config(thread_id: str, model: str = DEFAULT_MODEL, temperature: float = DEFAULT_TEMPERATURE):
    return {"configurable": {"thread_id": thread_id, "model": model, "temperature": temperature}}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _title_from(message: str) -> str:
    title = " ".join(message.split())
    return title if len(title) <= 60 else title[:57].rstrip() + "..."


@api.get("/health")
def health():
    return {"status": "ok"}


@api.get("/config")
def config():
    return jsonify(
        models=AVAILABLE_MODELS,
        default_model=DEFAULT_MODEL,
        default_temperature=DEFAULT_TEMPERATURE,
        checkpointer=type(checkpointer).__name__,
    )


@api.get("/threads")
def threads():
    with _threads_lock:
        items = sorted(_threads.values(), key=lambda t: t["updated_at"], reverse=True)
    return jsonify(threads=items)


def _run_options(data: dict):
    """Validate model/temperature from a request body. Returns (model, temperature, error)."""
    model = data.get("model") or DEFAULT_MODEL
    if model not in AVAILABLE_MODELS:
        return None, None, f"model must be one of: {', '.join(AVAILABLE_MODELS)}"
    try:
        temperature = float(data.get("temperature", DEFAULT_TEMPERATURE))
    except (TypeError, ValueError):
        return None, None, "temperature must be a number"
    if not 0 <= temperature <= 2:
        return None, None, "temperature must be between 0 and 2"
    return model, temperature, None


def _invoke(graph_input, thread_id: str, model: str, temperature: float, title: str):
    """Run the graph and shape the JSON response, recording thread metadata either way."""
    now = _now()
    with _threads_lock:
        meta = _threads.setdefault(
            thread_id, {"thread_id": thread_id, "title": title, "created_at": now, "message_count": 0}
        )
        meta["updated_at"] = now

    started = time.perf_counter()
    try:
        result = chatbot.invoke(graph_input, _config(thread_id, model, temperature))
    except Exception as exc:  # Surface model/provider failures to the UI's error card.
        # The user message stays checkpointed, so POST /chat/<id>/retry can resume the run.
        return (
            jsonify(
                error="The model call failed",
                error_type=type(exc).__name__,
                detail=str(exc),
                thread_id=thread_id,
                model=model,
                elapsed_ms=round((time.perf_counter() - started) * 1000),
            ),
            502,
        )

    with _threads_lock:
        meta["message_count"] = len(result["messages"])
    return jsonify(
        thread_id=thread_id,
        reply=result["messages"][-1].content,
        model=model,
        elapsed_ms=round((time.perf_counter() - started) * 1000),
        title=meta["title"],
    )


@api.post("/chat")
def chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify(error="message is required"), 400
    model, temperature, error = _run_options(data)
    if error:
        return jsonify(error=error), 400

    thread_id = data.get("thread_id") or str(uuid.uuid4())
    return _invoke(
        {"messages": [HumanMessage(content=message)]}, thread_id, model, temperature, _title_from(message)
    )


@api.post("/chat/<thread_id>/retry")
def retry(thread_id):
    data = request.get_json(silent=True) or {}
    model, temperature, error = _run_options(data)
    if error:
        return jsonify(error=error), 400
    if not chatbot.get_state(_config(thread_id)).next:
        return jsonify(error="nothing to retry on this thread"), 409
    # A None input resumes the graph from its last checkpoint instead of re-adding the message.
    return _invoke(None, thread_id, model, temperature, "Untitled chat")


@api.get("/chat/<thread_id>")
def history(thread_id):
    state = chatbot.get_state(_config(thread_id))
    messages = state.values.get("messages", []) if state.values else []
    return jsonify(
        thread_id=thread_id,
        messages=[{"role": "user" if m.type == "human" else "assistant", "content": m.content} for m in messages],
    )


@api.delete("/chat/<thread_id>")
def delete_thread(thread_id):
    checkpointer.delete_thread(thread_id)
    with _threads_lock:
        _threads.pop(thread_id, None)
    return jsonify(thread_id=thread_id, deleted=True)

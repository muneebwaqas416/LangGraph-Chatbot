"""HTTP layer: parse requests, call ChatService, and turn results or errors into responses."""

import json
from collections.abc import Iterator
from dataclasses import asdict

from flask import Blueprint, Response, current_app, jsonify, request, stream_with_context

from .models import ChatResult, StreamEvent, StreamFailed, StreamStarted, StreamToken
from .services import ChatService, InvalidRequestError, ModelCallError, NothingToRetryError

api = Blueprint("api", __name__, url_prefix="/api")

MODEL_FAILED = "The model call failed"


def _service() -> ChatService:
    return current_app.extensions["chat_service"]


def _body() -> dict:
    return request.get_json(silent=True) or {}


# ---- service errors -> HTTP status codes ----------------------------------------


@api.errorhandler(InvalidRequestError)
def _invalid_request(err: InvalidRequestError):
    return jsonify(error=str(err)), 400


@api.errorhandler(NothingToRetryError)
def _nothing_to_retry(err: NothingToRetryError):
    return jsonify(error=str(err)), 409


@api.errorhandler(ModelCallError)
def _model_call_failed(err: ModelCallError):
    return (
        jsonify(
            error=MODEL_FAILED,
            error_type=err.error_type,
            detail=err.detail,
            thread_id=err.thread_id,
            model=err.model,
            elapsed_ms=err.elapsed_ms,
        ),
        502,
    )


# ---- server-sent events -----------------------------------------------------------

_EVENT_NAMES = {StreamStarted: "start", StreamToken: "token", ChatResult: "done", StreamFailed: "error"}


def _sse_response(events: Iterator[StreamEvent]) -> Response:
    """Relay service stream events as `start`, `token`, then `done` or `error`."""

    def body():
        for event in events:
            data = asdict(event)
            if isinstance(event, StreamFailed):
                data["error"] = MODEL_FAILED  # same fields as the JSON 502 body
            yield f"event: {_EVENT_NAMES[type(event)]}\ndata: {json.dumps(data)}\n\n"

    return Response(
        stream_with_context(body()),
        mimetype="text/event-stream",
        # Disable proxy buffering so tokens reach the browser as they are produced.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---- endpoints ----------------------------------------------------------------------


@api.get("/health")
def health():
    return {"status": "ok"}


@api.get("/config")
def config():
    return jsonify(_service().config())


@api.get("/threads")
def threads():
    return jsonify(threads=[t.to_dict() for t in _service().list_threads()])


@api.post("/chat")
def chat():
    data, service = _body(), _service()
    options = service.options(data.get("model"), data.get("temperature"))
    return jsonify(asdict(service.send(data.get("message"), data.get("thread_id"), options)))


@api.post("/chat/stream")
def chat_stream():
    data, service = _body(), _service()
    options = service.options(data.get("model"), data.get("temperature"))
    return _sse_response(service.stream(data.get("message"), data.get("thread_id"), options))


@api.post("/chat/<thread_id>/retry")
def retry(thread_id):
    data, service = _body(), _service()
    options = service.options(data.get("model"), data.get("temperature"))
    return jsonify(asdict(service.retry(thread_id, options)))


@api.post("/chat/<thread_id>/retry/stream")
def retry_stream(thread_id):
    data, service = _body(), _service()
    options = service.options(data.get("model"), data.get("temperature"))
    return _sse_response(service.retry_stream(thread_id, options))


@api.get("/chat/<thread_id>")
def history(thread_id):
    return jsonify(thread_id=thread_id, messages=_service().history(thread_id))


@api.delete("/chat/<thread_id>")
def delete_thread(thread_id):
    _service().delete_thread(thread_id)
    return jsonify(thread_id=thread_id, deleted=True)

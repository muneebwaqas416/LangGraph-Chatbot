import time
import uuid
from collections.abc import Iterator

from langchain_core.messages import AIMessageChunk, HumanMessage
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph.state import CompiledStateGraph

from ..graph import AVAILABLE_MODELS, DEFAULT_MODEL, DEFAULT_TEMPERATURE
from ..models import ChatResult, RunOptions, StreamEvent, StreamFailed, StreamStarted, StreamToken, Thread
from ..repositories import ThreadRepository
from .errors import InvalidRequestError, ModelCallError, NothingToRetryError

RETRY_TITLE = "Untitled chat"


class ChatService:
    """Chat turns, retries, history and threads. Knows nothing about Flask or HTTP."""

    def __init__(self, chatbot: CompiledStateGraph, checkpointer: BaseCheckpointSaver, threads: ThreadRepository):
        self._chatbot = chatbot
        self._checkpointer = checkpointer
        self._threads = threads

    # ---- options / config ----------------------------------------------------

    def config(self) -> dict:
        return {
            "models": AVAILABLE_MODELS,
            "default_model": DEFAULT_MODEL,
            "default_temperature": DEFAULT_TEMPERATURE,
            "checkpointer": type(self._checkpointer).__name__,
        }

    def options(self, model: str | None, temperature: object) -> RunOptions:
        """Validate the model and temperature a client asked for."""
        model = model or DEFAULT_MODEL
        if model not in AVAILABLE_MODELS:
            raise InvalidRequestError(f"model must be one of: {', '.join(AVAILABLE_MODELS)}")
        try:
            value = float(DEFAULT_TEMPERATURE if temperature is None else temperature)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            raise InvalidRequestError("temperature must be a number") from None
        if not 0 <= value <= 2:
            raise InvalidRequestError("temperature must be between 0 and 2")
        return RunOptions(model, value)

    # ---- chat turns ------------------------------------------------------------

    def send(self, message: str | None, thread_id: str | None, options: RunOptions) -> ChatResult:
        graph_input, thread_id, title = self._new_turn(message, thread_id)
        return self._invoke(graph_input, thread_id, title, options)

    def stream(self, message: str | None, thread_id: str | None, options: RunOptions) -> Iterator[StreamEvent]:
        # Validation runs now, so the caller can still answer 400; the graph runs once iterated.
        graph_input, thread_id, title = self._new_turn(message, thread_id)
        return self._stream(graph_input, thread_id, title, options)

    def retry(self, thread_id: str, options: RunOptions) -> ChatResult:
        self._ensure_retryable(thread_id)
        return self._invoke(None, thread_id, RETRY_TITLE, options)

    def retry_stream(self, thread_id: str, options: RunOptions) -> Iterator[StreamEvent]:
        self._ensure_retryable(thread_id)
        return self._stream(None, thread_id, RETRY_TITLE, options)

    # ---- threads -----------------------------------------------------------------

    def list_threads(self) -> list[Thread]:
        return self._threads.list_recent()

    def history(self, thread_id: str) -> list[dict]:
        state = self._chatbot.get_state(self._config(thread_id))
        messages = state.values.get("messages", []) if state.values else []
        return [{"role": "user" if m.type == "human" else "assistant", "content": m.content} for m in messages]

    def delete_thread(self, thread_id: str) -> None:
        self._checkpointer.delete_thread(thread_id)  # LangGraph's checkpoint tables
        self._threads.delete(thread_id)  # the sidebar's threads table

    # ---- internals -----------------------------------------------------------------

    def _new_turn(self, message: str | None, thread_id: str | None):
        message = (message or "").strip()
        if not message:
            raise InvalidRequestError("message is required")
        graph_input = {"messages": [HumanMessage(content=message)]}
        return graph_input, thread_id or str(uuid.uuid4()), self._title_from(message)

    def _ensure_retryable(self, thread_id: str) -> None:
        # A failed run leaves the "chat" node pending; resuming with a None input continues it.
        if not self._chatbot.get_state(self._config(thread_id)).next:
            raise NothingToRetryError("nothing to retry on this thread")

    def _invoke(self, graph_input, thread_id: str, title: str, options: RunOptions) -> ChatResult:
        thread = self._threads.touch(thread_id, title, options.model)
        started = time.perf_counter()
        try:
            result = self._chatbot.invoke(graph_input, self._config(thread_id, options))
        except Exception as exc:  # Provider/model failures; the user message stays checkpointed.
            raise ModelCallError(exc, thread_id, options.model, self._ms(started)) from exc

        self._threads.record_run(thread_id, len(result["messages"]))
        return ChatResult(
            thread_id=thread_id,
            reply=result["messages"][-1].content,
            model=options.model,
            elapsed_ms=self._ms(started),
            title=thread.title,
        )

    def _stream(self, graph_input, thread_id: str, title: str, options: RunOptions) -> Iterator[StreamEvent]:
        thread = self._threads.touch(thread_id, title, options.model)
        config = self._config(thread_id, options)

        def events() -> Iterator[StreamEvent]:
            started = time.perf_counter()
            first_token_ms = None
            yield StreamStarted(thread_id=thread_id, model=options.model, title=thread.title)
            try:
                # stream_mode="messages" yields (message_chunk, metadata) for every LLM token.
                for chunk, metadata in self._chatbot.stream(graph_input, config, stream_mode="messages"):
                    if metadata.get("langgraph_node") != "chat" or not isinstance(chunk, AIMessageChunk):
                        continue
                    if not chunk.content:
                        continue
                    if first_token_ms is None:
                        first_token_ms = self._ms(started)
                    yield StreamToken(content=chunk.content)
            except Exception as exc:  # Headers are already sent, so failures become an event.
                yield StreamFailed(
                    error_type=type(exc).__name__,
                    detail=str(exc),
                    thread_id=thread_id,
                    model=options.model,
                    elapsed_ms=self._ms(started),
                )
                return

            messages = self._chatbot.get_state(config).values.get("messages", [])
            self._threads.record_run(thread_id, len(messages))
            yield ChatResult(
                thread_id=thread_id,
                # The checkpointed message is authoritative, even if the model sent no token chunks.
                reply=messages[-1].content if messages else "",
                model=options.model,
                elapsed_ms=self._ms(started),
                title=thread.title,
                first_token_ms=first_token_ms,
            )

        return events()

    @staticmethod
    def _config(thread_id: str, options: RunOptions | None = None) -> dict:
        options = options or RunOptions(DEFAULT_MODEL, DEFAULT_TEMPERATURE)
        return {"configurable": {"thread_id": thread_id, "model": options.model, "temperature": options.temperature}}

    @staticmethod
    def _title_from(message: str) -> str:
        title = " ".join(message.split())
        return title if len(title) <= 60 else title[:57].rstrip() + "..."

    @staticmethod
    def _ms(started: float) -> int:
        return round((time.perf_counter() - started) * 1000)

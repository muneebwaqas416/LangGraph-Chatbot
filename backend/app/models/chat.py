from dataclasses import dataclass


@dataclass(frozen=True)
class RunOptions:
    model: str
    temperature: float


@dataclass(frozen=True)
class ChatResult:
    """A finished chat turn. Field names match the API's JSON (and the stream's `done` event)."""

    thread_id: str
    reply: str
    model: str
    elapsed_ms: int
    title: str
    first_token_ms: int | None = None


# Events a streamed run produces; the route turns each one into an SSE message.
@dataclass(frozen=True)
class StreamStarted:
    thread_id: str
    model: str
    title: str


@dataclass(frozen=True)
class StreamToken:
    content: str


@dataclass(frozen=True)
class StreamFailed:
    error_type: str
    detail: str
    thread_id: str
    model: str
    elapsed_ms: int


StreamEvent = StreamStarted | StreamToken | ChatResult | StreamFailed

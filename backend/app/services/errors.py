class ChatError(Exception):
    """Base class for errors the chat service raises on purpose. Routes map these to HTTP."""


class InvalidRequestError(ChatError):
    """Bad input, e.g. an empty message or an unknown model."""


class NothingToRetryError(ChatError):
    """The thread has no failed run to resume."""


class ModelCallError(ChatError):
    """The LLM call failed. The user message stays checkpointed, so the turn can be retried."""

    def __init__(self, cause: Exception, thread_id: str, model: str, elapsed_ms: int):
        super().__init__(str(cause))
        self.error_type = type(cause).__name__
        self.detail = str(cause)
        self.thread_id = thread_id
        self.model = model
        self.elapsed_ms = elapsed_ms

from dataclasses import asdict, dataclass
from datetime import datetime

# The threads table backs the sidebar. thread_id is the same value LangGraph stores in
# checkpoints.thread_id, so the two can be joined. Statements run one at a time.
THREADS_SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS threads (
        thread_id     TEXT PRIMARY KEY,
        title         TEXT NOT NULL,
        model         TEXT,
        message_count INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS threads_updated_at_idx ON threads (updated_at DESC)",
)


@dataclass(frozen=True)
class Thread:
    thread_id: str
    title: str
    model: str | None
    message_count: int
    created_at: datetime
    updated_at: datetime

    def to_dict(self) -> dict:
        """JSON shape the frontend's ThreadSummary expects (ISO timestamps)."""
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        data["updated_at"] = self.updated_at.isoformat()
        return data
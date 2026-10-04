from psycopg.rows import class_row
from psycopg_pool import ConnectionPool

from ..models import THREADS_SCHEMA, Thread

# Fixed column list. Only constants go into the SQL text; user values always go in as %s parameters.
_COLUMNS = "thread_id, title, model, message_count, created_at, updated_at"


class ThreadRepository:
    """All SQL for the threads table. Checkpoints stay with LangGraph's PostgresSaver."""

    def __init__(self, pool: ConnectionPool):
        self._pool = pool

    def create_schema(self) -> None:
        with self._pool.connection() as conn:
            for statement in THREADS_SCHEMA:
                conn.execute(statement)

    def touch(self, thread_id: str, title: str, model: str) -> Thread:
        """Insert the thread on its first message, or bump updated_at. The original title is kept."""
        with self._pool.connection() as conn, conn.cursor(row_factory=class_row(Thread)) as cur:
            cur.execute(
                f"""
                INSERT INTO threads (thread_id, title, model)
                VALUES (%s, %s, %s)
                ON CONFLICT (thread_id) DO UPDATE
                    SET updated_at = now(), model = EXCLUDED.model
                RETURNING {_COLUMNS}
                """,
                (thread_id, title, model),
            )
            thread = cur.fetchone()
        assert thread is not None
        return thread

    def record_run(self, thread_id: str, message_count: int) -> None:
        """Store the message count once a reply has been saved."""
        with self._pool.connection() as conn:
            conn.execute(
                "UPDATE threads SET message_count = %s, updated_at = now() WHERE thread_id = %s",
                (message_count, thread_id),
            )

    def list_recent(self, limit: int = 100) -> list[Thread]:
        with self._pool.connection() as conn, conn.cursor(row_factory=class_row(Thread)) as cur:
            cur.execute(f"SELECT {_COLUMNS} FROM threads ORDER BY updated_at DESC LIMIT %s", (limit,))
            return cur.fetchall()

    def get(self, thread_id: str) -> Thread | None:
        with self._pool.connection() as conn, conn.cursor(row_factory=class_row(Thread)) as cur:
            cur.execute(f"SELECT {_COLUMNS} FROM threads WHERE thread_id = %s", (thread_id,))
            return cur.fetchone()

    def delete(self, thread_id: str) -> bool:
        with self._pool.connection() as conn:
            cur = conn.execute("DELETE FROM threads WHERE thread_id = %s", (thread_id,))
            return cur.rowcount > 0

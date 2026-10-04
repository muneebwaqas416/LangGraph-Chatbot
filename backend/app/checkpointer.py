import atexit
import os

from langgraph.checkpoint.postgres import PostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

POSTGRES_URI = os.environ["POSTGRES_URI"]  # fails clearly if it's missing

pool = ConnectionPool(
    conninfo=POSTGRES_URI,
    max_size=10,
    open=True,  # explicit, avoids psycopg-pool's DeprecationWarning
    kwargs={
        "autocommit": True,  # setup() runs commands that can't run inside a transaction
        "prepare_threshold": 0,  # avoids prepared-statement errors behind poolers like PgBouncer
        "row_factory": dict_row,  # PostgresSaver reads rows as dicts
    },
)
pool.wait(timeout=10)  # fail fast with a clear error if Postgres is down
atexit.register(pool.close)  # close connections when the server stops

checkpointer = PostgresSaver(pool)
checkpointer.setup()  # creates LangGraph's checkpoint tables if missing; safe on every start

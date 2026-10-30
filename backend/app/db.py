from contextlib import asynccontextmanager
from typing import Any

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import settings

# prepare_threshold=None keeps this compatible with Supabase's pgbouncer pooler
pool = AsyncConnectionPool(
    settings.database_url,
    min_size=1,
    max_size=10,
    open=False,
    kwargs={"row_factory": dict_row, "autocommit": True, "prepare_threshold": None},
)


@asynccontextmanager
async def lifespan(_app):
    await pool.open()
    yield
    await pool.close()


async def fetch_all(sql: str, params: Any = None) -> list[dict]:
    async with pool.connection() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchall()


async def fetch_one(sql: str, params: Any = None) -> dict | None:
    async with pool.connection() as conn:
        cur = await conn.execute(sql, params)
        return await cur.fetchone()


async def execute(sql: str, params: Any = None) -> int:
    async with pool.connection() as conn:
        cur = await conn.execute(sql, params)
        return cur.rowcount

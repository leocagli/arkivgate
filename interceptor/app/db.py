from collections.abc import AsyncIterator
import ssl
from urllib.parse import urlparse, urlunparse, urlencode, parse_qs

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from .config import settings


# asyncpg does not accept these psycopg2-style query params in the DSN.
_ASYNCPG_UNSUPPORTED_PARAMS = {"sslmode", "sslcert", "sslkey", "sslrootcert"}


def _normalize_url(url: str) -> str:
    """Accept the conventional `postgresql://...` DSN that Supabase, Neon and
    Railway hand out, and rewrite it to the asyncpg driver SQLAlchemy needs.
    Also strips psycopg2-style query params that asyncpg does not understand
    (e.g. sslmode=require) since SSL is handled via connect_args instead."""
    if url.startswith("postgresql://"):
        base = "postgresql+asyncpg://" + url[len("postgresql://") :]
    elif url.startswith("postgres://"):
        base = "postgresql+asyncpg://" + url[len("postgres://") :]
    else:
        base = url

    parsed = urlparse(base)
    qs = parse_qs(parsed.query, keep_blank_values=True)
    filtered = {k: v for k, v in qs.items() if k not in _ASYNCPG_UNSUPPORTED_PARAMS}
    new_query = urlencode(filtered, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _connect_args(url: str) -> dict:
    """Force TLS for public remote hosts only.

    Internal Railway/Fly addresses (`*.railway.internal`, `*.flycast`) live on
    the platform's private network and don't terminate SSL; forcing TLS there
    would fail the handshake. asyncpg accepts a string SSL mode.
    """
    host = urlparse(url).hostname or ""
    is_local = (
        host in {"", "localhost", "127.0.0.1", "host.docker.internal"}
        or host.endswith(".railway.internal")
        or host.endswith(".flycast")
    )
    if is_local:
        return {}
    return {"ssl": "require"}


_url = _normalize_url(settings.database_url)

engine = create_async_engine(
    _url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args(_url),
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with async_session_maker() as session:
        yield session

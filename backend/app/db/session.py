from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy import text
from app.core.config import settings

import os

# Handle sqlite async prefix
db_url = os.getenv("DATABASE_URL") or settings.DATABASE_URL
if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite+aiosqlite:///"):
    db_url = db_url.replace("sqlite:///", "sqlite+aiosqlite:///")

connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

engine = create_async_engine(
    db_url,
    echo=False,
    connect_args=connect_args,
    poolclass=NullPool if "sqlite" in db_url else None,
    future=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


async def ensure_db_schema():
    from app.db import models  # Ensure all ORM models are registered
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate any missing columns in existing SQLite tables
        for table, col, col_type in [
            ("assignments", "assignment_kind", "VARCHAR(32) DEFAULT 'ACTIVE'"),
            ("assignments", "origin", "VARCHAR(32) DEFAULT 'DISPATCHER'")
        ]:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
            except Exception:
                pass

    # Seed canonical physical cards into resource_registry
    from app.services.edge.tag_registry import seed_real_tag_registry
    async with AsyncSessionLocal() as session:
        try:
            await seed_real_tag_registry(session)
        except Exception:
            await session.rollback()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


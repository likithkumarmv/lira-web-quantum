import pytest
import os
import sys

# Ensure backend root is in sys.path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

# Isolated test DB
test_db_path = os.path.join(backend_root, "test_suite.db").replace("\\", "/")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{test_db_path}"
os.environ["APP_ENV"] = "TEST"

from app.db.session import engine, ensure_db_schema, AsyncSessionLocal
from app.seed.live_demo import seed_live_demo_data

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    import asyncio
    async def init():
        await ensure_db_schema()
        async with AsyncSessionLocal() as session:
            await seed_live_demo_data(session)
    asyncio.run(init())
    yield

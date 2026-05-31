import os

import pytest
from dotenv import load_dotenv

load_dotenv(".env.test")


@pytest.fixture(scope="session")
def test_db_url() -> str:
    return (
        f"postgresql://{os.getenv('DATABASE_USERNAME', 'postgres')}"
        f":{os.getenv('DATABASE_PASSWORD', 'postgres')}"
        f"@{os.getenv('DATABASE_HOSTNAME', 'localhost')}"
        f":{os.getenv('DATABASE_PORT', '5432')}"
        f"/{os.getenv('DATABASE_NAME', 'littlefounders_test')}"
    )


@pytest.fixture
def client():
    from httpx import ASGITransport, AsyncClient

    from main import app

    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")

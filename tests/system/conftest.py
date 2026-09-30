import json
import os

import httpx
import psycopg
import pytest

from local_stack import LocalStack


@pytest.fixture(scope="session")
def system(tmp_path_factory):
    path = os.environ.get("FRESHLENS_SYSTEM_CONFIG")
    if path:
        with open(path) as stream:
            yield json.load(stream)
    else:
        with LocalStack(tmp_path_factory.mktemp("freshlens-system")) as stack:
            yield stack.config


@pytest.fixture
def client(system):
    with httpx.Client(base_url=system["base_url"], timeout=15, trust_env=False) as client:
        yield client


@pytest.fixture
def db(system):
    with psycopg.connect(system["owner_dsn"], autocommit=True) as connection:
        yield connection

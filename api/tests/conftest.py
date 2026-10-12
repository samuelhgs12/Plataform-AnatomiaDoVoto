"""Cria um banco DuckDB temporário com o esquema final e uma massa pequena e conhecida."""
from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def banco(tmp_path_factory) -> str:
    caminho = tmp_path_factory.mktemp("bd") / "teste.duckdb"
    con = duckdb.connect(str(caminho))
    con.execute((FIXTURES / "schema.sql").read_text(encoding="utf-8"))
    con.execute((FIXTURES / "seed.sql").read_text(encoding="utf-8"))
    con.close()
    return str(caminho)


@pytest.fixture()
def client(banco, monkeypatch):
    from app import db

    monkeypatch.setenv("DATABASE", banco)
    monkeypatch.delenv("MOTHERDUCK_TOKEN", raising=False)
    db.reiniciar()
    from app.main import app

    with TestClient(app) as c:
        yield c
    db.reiniciar()

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


# o começo de um WebP e de um JPEG basta: a API só olha o tipo e devolve os bytes
WEBP = b"RIFF\x10\x00\x00\x00WEBPVP8 mini"
JPEG = b"\xff\xd8\xff\xe0original"


@pytest.fixture(scope="session")
def banco_fotos(tmp_path_factory) -> str:
    """Banco de fotos como o de load_BDR/fotos_baixar.py: candidatura 3 com as duas imagens, a 7 só com a miniatura."""
    caminho = tmp_path_factory.mktemp("fotos") / "fotos.duckdb"
    con = duckdb.connect(str(caminho))
    con.execute("""CREATE TABLE candidatura_foto (
        ano smallint NOT NULL, ue varchar NOT NULL, sequencial varchar NOT NULL, uf varchar,
        miniatura BLOB, largura smallint, altura smallint, bytes integer,
        foto BLOB, foto_largura smallint, foto_altura smallint, foto_bytes integer,
        PRIMARY KEY (ano, ue, sequencial))""")
    con.execute("INSERT INTO candidatura_foto VALUES (2022, 'MG', 'S3', 'MG', ?, 120, 160, 20, ?, 161, 225, 14), "
                "(2022, 'RJ', 'S7', 'RJ', ?, 120, 160, 20, NULL, NULL, NULL, NULL)", [WEBP, JPEG, WEBP])
    con.close()
    return str(caminho)


@pytest.fixture()
def client(banco, banco_fotos, monkeypatch):
    from app import db

    monkeypatch.setenv("DATABASE", banco)
    monkeypatch.setenv("FOTOS_DATABASE", banco_fotos)
    monkeypatch.delenv("MOTHERDUCK_TOKEN", raising=False)
    db.reiniciar()
    from app.main import app

    with TestClient(app) as c:
        yield c
    db.reiniciar()

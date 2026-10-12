"""Acesso ao banco (DuckDB local ou MotherDuck) e execução das consultas de queries/*.sql.

Regras:
  * o banco é aberto SOMENTE para leitura;
  * toda consulta usa parâmetros (`?`), nunca texto concatenado;
  * cada requisição usa seu próprio cursor (conexões do DuckDB não são seguras entre threads);
  * o token do MotherDuck nunca aparece em mensagens de erro.
"""
import threading
from functools import lru_cache
from pathlib import Path

import duckdb
from cachetools import TTLCache

from .config import get_settings

QUERIES = Path(__file__).parent / "queries"
_lock = threading.Lock()
_con: duckdb.DuckDBPyConnection | None = None
_cache: TTLCache | None = None


class BancoIndisponivel(RuntimeError):
    """O banco não pôde ser aberto (arquivo ausente, token inválido, share sem acesso...)."""


def _abrir() -> duckdb.DuckDBPyConnection:
    s = get_settings()
    alvo = s.database
    try:
        if alvo.startswith("md:"):
            if not s.motherduck_token:
                raise BancoIndisponivel("Falta MOTHERDUCK_TOKEN no servidor.")
            if alvo.startswith("md:_share"):
                con = duckdb.connect(f"md:?motherduck_token={s.motherduck_token}")
                con.execute("ATTACH '" + alvo.replace("'", "''") + "' AS bdr")
                con.execute("USE bdr")
                return con
            sep = "&" if "?" in alvo else "?"
            return duckdb.connect(f"{alvo}{sep}motherduck_token={s.motherduck_token}")
        if not Path(alvo).exists():
            raise BancoIndisponivel(f"Banco não encontrado: {alvo}")
        return duckdb.connect(alvo, read_only=True)
    except BancoIndisponivel:
        raise
    except duckdb.Error as e:
        # a mensagem original pode conter o token da conexão: não a repassamos
        raise BancoIndisponivel(f"Não foi possível abrir o banco ({type(e).__name__}).") from None


def conexao() -> duckdb.DuckDBPyConnection:
    global _con
    with _lock:
        if _con is None:
            _con = _abrir()
        return _con


def reiniciar() -> None:
    """Fecha a conexão e limpa o cache (usado nos testes)."""
    global _con, _cache
    with _lock:
        if _con is not None:
            _con.close()
        _con, _cache = None, None
    get_settings.cache_clear()
    sql.cache_clear()


@lru_cache
def sql(nome: str) -> str:
    return (QUERIES / f"{nome}.sql").read_text(encoding="utf-8")


def _cache_ttl() -> TTLCache:
    global _cache
    if _cache is None:
        _cache = TTLCache(maxsize=2048, ttl=get_settings().cache_ttl_segundos)
    return _cache


def consultar(nome: str, params: tuple | list = (), cache: bool = True) -> list[dict]:
    """Executa queries/<nome>.sql com os parâmetros e devolve uma lista de dicionários."""
    chave = (nome, tuple(params))
    if cache and chave in _cache_ttl():
        return _cache_ttl()[chave]
    cur = conexao().cursor()
    try:
        res = cur.execute(sql(nome), list(params))
        cols = [d[0] for d in res.description]
        linhas = [dict(zip(cols, r)) for r in res.fetchall()]
    finally:
        cur.close()
    if cache:
        _cache_ttl()[chave] = linhas
    return linhas


def um(nome: str, params: tuple | list = ()) -> dict | None:
    linhas = consultar(nome, params)
    return linhas[0] if linhas else None

"""Acesso ao banco (DuckDB local ou MotherDuck) e execução das consultas de queries/*.sql.

Regras:
  * o banco é aberto SOMENTE para leitura;
  * toda consulta usa parâmetros (`?`), nunca texto concatenado;
  * cada requisição usa seu próprio cursor (conexões do DuckDB não são seguras entre threads);
  * o token do MotherDuck nunca aparece em mensagens de erro;
  * se o MotherDuck falhar, usa o arquivo DuckDB local da carga (DATABASE_LOCAL), quando ele existe.

As fotos dos candidatos ficam num banco à parte (FOTOS_DATABASE, com fallback em FOTOS_DATABASE_LOCAL), aberto numa
segunda conexão que fica aberta como a principal; sem ele a API funciona, só não há fotos.
"""
import logging
import re
import threading
import time
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

import duckdb
from cachetools import TTLCache

from .config import get_settings

log = logging.getLogger(__name__)
QUERIES = Path(__file__).parent / "queries"
ANALISES = Path(__file__).parent / "analises"
COPY_RE = re.compile(r"COPY\s*\((.*)\)\s*TO\s*'[^']*?([A-Za-z0-9_]+)\.csv'\s*\(HEADER\)", re.S | re.I)
_lock = threading.Lock()
_con: duckdb.DuckDBPyConnection | None = None
_lock_fotos = threading.Lock()
_con_fotos: duckdb.DuckDBPyConnection | None = None
_falha_fotos: tuple[float, str] | None = None   # (quando, por quê): não tenta reabrir a cada foto pedida
ESPERA_FOTOS = 60                                # segundos até tentar abrir de novo o banco de fotos
_cache: TTLCache | None = None


class BancoIndisponivel(RuntimeError):
    """O banco não pôde ser aberto (arquivo ausente, token inválido, share sem acesso...)."""


def _anexar_share(con: duckdb.DuckDBPyConnection, alvo: str, apelido: str = "bdr") -> str:
    """Anexa o share do MotherDuck como `apelido` e devolve o nome com que ele está anexado.

    No MotherDuck o ATTACH de um share fica salvo na conta (não só na sessão): da segunda
    execução em diante o share já aparece anexado, e anexá-lo de novo dá erro.
    """
    caminho = alvo.removeprefix("md:").split("?")[0]
    ja_anexado = con.execute(
        "SELECT database_name FROM duckdb_databases() WHERE path = ? LIMIT 1", [caminho]
    ).fetchone()
    if ja_anexado:
        return ja_anexado[0]
    if con.execute("SELECT 1 FROM duckdb_databases() WHERE database_name = ?", [apelido]).fetchone():
        raise BancoIndisponivel(
            f"Já existe um banco chamado '{apelido}' na sua conta do MotherDuck que não é este share. "
            f"Use md:{apelido} ou faça DETACH {apelido}."
        )
    con.execute("ATTACH '" + alvo.replace("'", "''") + f"' AS {apelido}")
    return apelido


def _abrir_arquivo(alvo: str) -> duckdb.DuckDBPyConnection:
    if not Path(alvo).exists():
        raise BancoIndisponivel(f"Banco não encontrado: {alvo}")
    try:
        return duckdb.connect(alvo, read_only=True)
    except duckdb.Error as e:
        raise BancoIndisponivel(f"Não foi possível abrir o banco local ({type(e).__name__}).") from None


def _abrir_motherduck(alvo: str, apelido: str = "bdr") -> duckdb.DuckDBPyConnection:
    s = get_settings()
    try:
        if not s.motherduck_token:
            raise BancoIndisponivel("Falta MOTHERDUCK_TOKEN no servidor.")
        if alvo.startswith("md:_share"):
            # Anexa (se preciso) e reabre já apontando para o share: um `USE bdr` não vale
            # para os cursores criados em consultar(), que voltariam ao banco padrão da conta.
            with duckdb.connect(f"md:?motherduck_token={s.motherduck_token}") as con:
                nome = _anexar_share(con, alvo, apelido)
            return duckdb.connect(f"md:{nome}?motherduck_token={s.motherduck_token}")
        sep = "&" if "?" in alvo else "?"
        return duckdb.connect(f"{alvo}{sep}motherduck_token={s.motherduck_token}")
    except BancoIndisponivel:
        raise
    except duckdb.Error as e:
        # a mensagem original pode conter o token da conexão: não a repassamos
        raise BancoIndisponivel(f"Não foi possível abrir o banco ({type(e).__name__}).") from None


def _abrir(alvo: str, alvo_local: str, apelido: str = "bdr", variavel: str = "DATABASE_LOCAL",
           arquivo: str = "bdr_final.duckdb") -> duckdb.DuckDBPyConnection:
    if not alvo.startswith("md:"):
        return _abrir_arquivo(alvo)
    try:
        return _abrir_motherduck(alvo, apelido)
    except BancoIndisponivel as erro_md:
        # o plano gratuito do MotherDuck limita a organização a 3 pessoas: quem ficou de fora lê a carga local
        local = Path(alvo_local).expanduser() if alvo_local else None
        if not local or not local.exists():
            raise BancoIndisponivel(f"{erro_md} Sem fallback local: não há banco em {local or f'({variavel} vazio)'}; "
                                    f"defina {variavel} com o caminho completo do {arquivo} da carga.") from None
        log.warning("MotherDuck indisponível (%s); usando o banco local %s", erro_md, local)
        return _abrir_arquivo(str(local))


def conexao() -> duckdb.DuckDBPyConnection:
    global _con
    with _lock:
        if _con is None:
            s = get_settings()
            _con = _abrir(s.database, s.database_local)
        return _con


def conexao_fotos() -> duckdb.DuckDBPyConnection:
    """Conexão com o banco de fotos. Se ele falhar, as próximas chamadas falham na hora por ESPERA_FOTOS segundos
    (uma página de listagem pede dezenas de fotos; cada tentativa no MotherDuck pode demorar)."""
    global _con_fotos, _falha_fotos
    with _lock_fotos:
        if _con_fotos is None:
            if _falha_fotos and time.monotonic() - _falha_fotos[0] < ESPERA_FOTOS:
                raise BancoIndisponivel(_falha_fotos[1])
            s = get_settings()
            try:
                _con_fotos = _abrir(s.fotos_database, s.fotos_database_local, "bdr_fotos", "FOTOS_DATABASE_LOCAL",
                                    "bdr_fotos.duckdb")
            except BancoIndisponivel as e:
                _falha_fotos = (time.monotonic(), f"Fotos indisponíveis: {e}")
                raise BancoIndisponivel(_falha_fotos[1]) from None
            _falha_fotos = None
        return _con_fotos


def foto(ano: int, ue: str, sequencial: str, tam: str) -> bytes | None:
    """A miniatura (tam="mini", WebP) ou a foto original (tam="ficha", JPEG) da candidatura; sem a pedida, a outra.
    Não guarda no cache da API: são muitas e o navegador já as guarda (Cache-Control longo)."""
    cur = conexao_fotos().cursor()
    try:
        r = cur.execute(sql("foto_candidatura"), [tam, ano, ue, sequencial]).fetchone()
    finally:
        cur.close()
    return bytes(r[0]) if r and r[0] is not None else None


def reiniciar() -> None:
    """Fecha a conexão e limpa o cache (usado nos testes)."""
    global _con, _cache, _con_fotos, _falha_fotos
    with _lock:
        if _con is not None:
            _con.close()
        _con, _cache = None, None
    with _lock_fotos:
        if _con_fotos is not None:
            _con_fotos.close()
        _con_fotos, _falha_fotos = None, None
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
    chave = (nome, tuple(tuple(p) if isinstance(p, list) else p for p in params))   # listas não servem de chave
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


def analises() -> list[str]:
    """Nomes das análises disponíveis: um arquivo analises/<nome>.sql para cada uma."""
    return sorted(p.stem for p in ANALISES.glob("*.sql"))


def _valor(v):
    # somas do DuckDB chegam como Decimal e datas como date: o JSON da resposta só aceita número e texto
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return v


def analise(nome: str) -> dict[str, dict]:
    """Roda analises/<nome>.sql e devolve {tabela: {colunas, linhas}}.

    Os CREATE TEMP preparam a sessão e cada COPY (...) TO '.../x.csv' vira a tabela x. As tabelas temporárias
    ficam no cursor desta execução e somem quando ele fecha. O resultado fica no cache (os dados são históricos).
    """
    chave = ("analise", nome)
    if chave in _cache_ttl():
        return _cache_ttl()[chave]
    texto = re.sub(r"--[^\n]*", "", (ANALISES / f"{nome}.sql").read_text(encoding="utf-8"))
    saida = {}
    cur = conexao().cursor()
    try:
        for comando in (c.strip() for c in re.split(r";\s*\n", texto) if c.strip()):
            m = COPY_RE.match(comando)
            if not m:
                cur.execute(comando)
                continue
            res = cur.execute(m.group(1))
            saida[m.group(2)] = {"colunas": [d[0] for d in res.description],
                                 "linhas": [[_valor(v) for v in r] for r in res.fetchall()]}
    finally:
        cur.close()
    _cache_ttl()[chave] = saida
    return saida

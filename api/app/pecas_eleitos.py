"""Peças de propaganda só dos eleitos, por recorte, para a nuvem da camada Dinheiro do mapa ("Todos" × "Só eleitos").

A nuvem de todos os candidatos já existe (app/pecas_geral.py, pergunta 9) e não muda. Esta é a mesma conta, sobre as
despesas dos eleitos (queries/pecas_eleitos.sql), com a mesma função de agregação (pecas_geral.calcular) e o mesmo
dicionário (app.nuvem): calculada uma vez ao subir a API, em segundo plano. Até terminar, `consultar` devolve None
("em preparação"). Nenhuma descrição original sai daqui: só as peças.

Recortes: (ano, cargo, uf) e (ano, cargo, None) = todos os estados. Presidente (UF 'BR') só no recorte sem UF.
"""
import logging
import threading
import time
from collections.abc import Iterable

from . import db
from .pecas_geral import Recorte, calcular

log = logging.getLogger(__name__)

_lock = threading.Lock()
_pecas: dict[Recorte, list[dict]] | None = None
_erro: str | None = None


def _linhas_do_banco() -> Iterable[dict]:
    cur = db.conexao().cursor()
    try:
        res = cur.execute(db.sql("pecas_eleitos"))
        cols = [d[0] for d in res.description]
        while lote := res.fetchmany(50_000):
            for r in lote:
                yield dict(zip(cols, r))
    finally:
        cur.close()


def preparar() -> None:
    """Calcula as peças dos eleitos em todos os recortes (síncrono; `iniciar` roda em segundo plano)."""
    global _pecas, _erro
    t = time.monotonic()
    try:
        resultado = calcular(_linhas_do_banco())
    except Exception as e:   # o banco pode falhar: a página mostra a seção sem a nuvem
        log.exception("peças dos eleitos: falhou")
        with _lock:
            _erro = str(e)
        return
    with _lock:
        _pecas, _erro = resultado, None
    log.info("peças dos eleitos: %d recortes em %.0f s", len(resultado), time.monotonic() - t)


def iniciar() -> threading.Thread:
    """Começa o pré-cálculo numa thread em segundo plano."""
    th = threading.Thread(target=preparar, name="pecas-eleitos", daemon=True)
    th.start()
    return th


def reiniciar() -> None:
    """Esquece o resultado (testes)."""
    global _pecas, _erro
    with _lock:
        _pecas, _erro = None, None


def consultar(ano: int, cargo: str, uf: str | None) -> list[dict] | None:
    """As peças dos eleitos no recorte (lista vazia se não há propaganda); None enquanto o pré-cálculo não terminou."""
    with _lock:
        if _pecas is None:
            return None
        return _pecas.get((ano, cargo, uf), [])


def falhou() -> str | None:
    with _lock:
        return _erro

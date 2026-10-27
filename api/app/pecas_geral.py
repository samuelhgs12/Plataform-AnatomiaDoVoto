"""Peças de propaganda por recorte, para a visão geral da pergunta 9 (página "Dinheiro nas eleições", aba Propaganda).

A nuvem de um recorte grande (vereador de 2024 nos seis estados: 130 mil descrições) leva de 10 a 30 s se calculada na
hora. Por isso as peças de todos os recortes são calculadas uma vez, ao subir a API, em segundo plano: uma leitura das
despesas (queries/pecas_geral.sql), cada descrição distinta classificada uma vez (app.nuvem.pecas) e somada no recorte
da UF e no de todos os estados. Até terminar, `consultar` devolve None ("em preparação"). Nenhuma descrição original sai
daqui: só as peças, como na nuvem do perfil.

Recortes: (ano, cargo, uf) e (ano, cargo, None) = todos os estados. Presidente (UF 'BR') só no recorte sem UF.
"""
import logging
import threading
import time
from collections.abc import Iterable

from . import db
from .nuvem import acumular, finalizar, pecas

log = logging.getLogger(__name__)
Recorte = tuple[int, str, str | None]

_lock = threading.Lock()
_pecas: dict[Recorte, list[dict]] | None = None
_erro: str | None = None


def calcular(linhas: Iterable[dict]) -> dict[Recorte, list[dict]]:
    """Linhas de pecas_geral.sql (ordenadas pela descrição) -> as peças de cada recorte. Uma descrição repetida em
    sequência é classificada uma vez só."""
    accs: dict[Recorte, dict] = {}
    chave, ps = None, []
    for linha in linhas:
        if (linha["descricao"], linha["origem"]) != chave:
            chave = (linha["descricao"], linha["origem"])
            ps = pecas(*chave)
        ano, cargo, uf = int(linha["ano"]), linha["cargo"], linha["uf"]
        for recorte in [(ano, cargo, None)] + ([] if uf == "BR" else [(ano, cargo, uf)]):
            acumular(accs.setdefault(recorte, {}), linha, ps)
    return {r: finalizar(a) for r, a in accs.items()}


def _linhas_do_banco() -> Iterable[dict]:
    cur = db.conexao().cursor()
    try:
        res = cur.execute(db.sql("pecas_geral"))
        cols = [d[0] for d in res.description]
        while lote := res.fetchmany(50_000):
            for r in lote:
                yield dict(zip(cols, r))
    finally:
        cur.close()


def preparar() -> None:
    """Calcula as peças de todos os recortes (síncrono; `iniciar` roda em segundo plano)."""
    global _pecas, _erro
    t = time.monotonic()
    try:
        resultado = calcular(_linhas_do_banco())
    except Exception as e:   # o banco pode falhar: a página mostra a aba sem as peças
        log.exception("peças da visão geral: falhou")
        with _lock:
            _erro = str(e)
        return
    with _lock:
        _pecas, _erro = resultado, None
    log.info("peças da visão geral: %d recortes em %.0f s", len(resultado), time.monotonic() - t)


def iniciar() -> threading.Thread:
    """Começa o pré-cálculo numa thread em segundo plano."""
    th = threading.Thread(target=preparar, name="pecas-geral", daemon=True)
    th.start()
    return th


def reiniciar() -> None:
    """Esquece o resultado (testes)."""
    global _pecas, _erro
    with _lock:
        _pecas, _erro = None, None


def consultar(ano: int, cargo: str, uf: str | None) -> list[dict] | None:
    """As peças do recorte (lista vazia se ele não tem propaganda); None enquanto o pré-cálculo não terminou."""
    with _lock:
        if _pecas is None:
            return None
        return _pecas.get((ano, cargo, uf), [])


def falhou() -> str | None:
    with _lock:
        return _erro

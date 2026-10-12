from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from .. import db
from ..schemas import CategoriaGasto, Despesas, Listagem, Palavra, Receitas
from .util import contar_palavras

router = APIRouter(tags=["candidaturas"])


@router.get("/candidaturas", response_model=Listagem)
def listar(
    cargo: int | None = Query(None, description="id_cargo (ver /api/meta)"),
    ano: int | None = None,
    uf: str | None = Query(None, min_length=2, max_length=2),
    eleito: bool | None = None,
    ordem: Literal["votos", "nome"] = "votos",
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(48, ge=1, le=100),
    incluir_suplementares: bool = False,
):
    """Listagem de titulares por cargo, ano e UF (inspirada no especial do G1). Padrão: só eleição ordinária."""
    uf = uf.upper() if uf else None
    params = (incluir_suplementares, cargo, cargo, ano, ano, uf, uf, eleito, eleito, ordem, tamanho, (pagina - 1) * tamanho)
    linhas = db.consultar("candidaturas_lista", params)
    total = linhas[0]["total"] if linhas else 0
    return Listagem(total=total, pagina=pagina, tamanho=tamanho, itens=linhas)


def _contexto(id_candidatura: int) -> dict:
    c = db.um("candidatura_contexto", (id_candidatura,))
    if not c:
        raise HTTPException(404, "Candidatura não encontrada")
    return c


@router.get("/candidaturas/{id_candidatura}/despesas", response_model=Despesas)
def despesas(id_candidatura: int):
    """Gasto de campanha por categoria (pergunta 9), com a mediana do mesmo cargo, ano e UF."""
    ctx = _contexto(id_candidatura)
    cats = db.consultar("despesas_categoria", (id_candidatura,))
    ref = {r["categoria"]: r for r in db.consultar("despesas_referencia", (id_candidatura,))}
    total = float(sum(c["valor"] or 0 for c in cats))
    propaganda = float(sum(c["valor"] or 0 for c in cats if c["publicidade"]))
    itens = [
        CategoriaGasto(categoria=c["categoria"], publicidade=c["publicidade"], valor=float(c["valor"] or 0),
                       pct=(float(c["valor"] or 0) / total) if total else 0.0,
                       mediana_cargo=float(ref[c["categoria"]]["mediana"]) if c["categoria"] in ref else None)
        for c in cats
    ]
    n = max((int(r["n_candidaturas"]) for r in ref.values()), default=0)
    return Despesas(id_candidatura=id_candidatura, ano=ctx["ano"], cargo=ctx["cargo"], uf=ctx["uf"], total=total,
                    propaganda=propaganda, pct_propaganda=(propaganda / total) if total else 0.0, categorias=itens,
                    n_comparaveis=n)


@router.get("/candidaturas/{id_candidatura}/palavras", response_model=list[Palavra])
def palavras(id_candidatura: int, limite: int = Query(50, ge=1, le=100)):
    """Termos mais frequentes nas descrições das despesas de propaganda (para a nuvem de palavras)."""
    _contexto(id_candidatura)
    descricoes = [r["descricao_despesa"] for r in db.consultar("despesas_descricoes", (id_candidatura,))]
    return [Palavra(termo=t, freq=f) for t, f in contar_palavras(descricoes, limite)]


@router.get("/candidaturas/{id_candidatura}/receitas", response_model=Receitas)
def receitas(id_candidatura: int):
    """Receita pública x privada (pergunta 8), sem repasses entre candidatos."""
    _contexto(id_candidatura)
    r = db.um("receitas", (id_candidatura,)) or {"publica": 0, "privada": 0, "total": 0}
    ref = db.um("receitas_referencia", (id_candidatura,))
    total = float(r["total"] or 0)
    return Receitas(id_candidatura=id_candidatura, publica=float(r["publica"] or 0), privada=float(r["privada"] or 0), total=total,
                    pct_publica=(float(r["publica"] or 0) / total) if total else None,
                    mediana_pct_publica_cargo=float(ref["mediana_pct_publica"]) if ref and ref["mediana_pct_publica"] is not None else None)

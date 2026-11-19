from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from .. import db, pecas_eleitos, pecas_geral
from ..nuvem import nuvem
from ..schemas import CategoriaGasto, DespesasCandidato, TermoPropaganda

router = APIRouter(tags=["dinheiro"])


@router.get("/dinheiro/candidaturas/{id_candidatura}/despesas", response_model=DespesasCandidato)
def despesas_candidato(id_candidatura: int):
    """Despesas por categoria original do TSE, carregadas ao abrir um candidato na seção Dinheiro."""
    if not db.um("candidatura_contexto", (id_candidatura,)):
        raise HTTPException(404, "Candidatura não encontrada")
    prestou = db.um("dinheiro_contas_candidato", (id_candidatura,))["prestou"]
    if not prestou:
        return DespesasCandidato(id_candidatura=id_candidatura, prestou=False, total=None,
                                 propaganda=None, categorias=[])
    cats = db.consultar("dinheiro_despesas_candidato", (id_candidatura,))
    total = float(sum(c["valor"] for c in cats))
    return DespesasCandidato(
        id_candidatura=id_candidatura, prestou=True, total=total,
        propaganda=float(sum(c["valor"] for c in cats if c["publicidade"])),
        categorias=[CategoriaGasto(categoria=c["categoria"], publicidade=c["publicidade"],
                                   valor=float(c["valor"]), pct=float(c["valor"]) / total if total > 0 else 0)
                    for c in cats],
    )


@router.get("/dinheiro/pecas", response_model=list[TermoPropaganda],
            responses={202: {"description": "em preparação"}, 503: {"description": "o pré-cálculo falhou"}})
def pecas_dinheiro(ano: int, cargo: str = Query(..., max_length=40, description="nome do cargo, como em /api/meta"),
                   uf: str | None = Query(None, min_length=2, max_length=2),
                   mun: int | None = Query(None, description="id_municipio: só as campanhas da cidade (prefeito e vereador)"),
                   eleitos: bool = Query(False, description="true: só as campanhas dos eleitos")):
    """Nuvem de palavras da camada Dinheiro do mapa: o que as campanhas compraram em propaganda, no recorte ano + cargo +
    estado (ou os seis, sem `uf`) ou numa cidade (`mun`), de todos os candidatos ou só dos eleitos. Todos os candidatos
    de um estado: as mesmas peças de /api/propaganda/pecas. Só eleitos: pré-calculadas ao subir a API (até lá, 202 "em
    preparação"). Numa cidade: calculadas na hora (são poucas despesas). Só as peças saem daqui, nunca as descrições."""
    if mun is not None:
        return nuvem(db.consultar("pecas_municipio", (mun, ano, cargo, eleitos)))
    fonte = pecas_eleitos if eleitos else pecas_geral
    lista = fonte.consultar(ano, cargo, uf.upper() if uf else None)
    if lista is None:
        erro = fonte.falhou()
        return JSONResponse(status_code=503 if erro else 202, content={"estado": "erro" if erro else "preparando"})
    return lista

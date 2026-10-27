from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .. import pecas_geral
from ..schemas import TermoPropaganda

router = APIRouter(tags=["propaganda"])


@router.get("/propaganda/pecas", response_model=list[TermoPropaganda],
            responses={202: {"description": "em preparação"}, 503: {"description": "o pré-cálculo falhou"}})
def pecas_do_recorte(ano: int, cargo: str = Query(..., max_length=40, description="nome do cargo, como em /api/meta"),
                     uf: str | None = Query(None, min_length=2, max_length=2)):
    """Peças de propaganda de um recorte (visão geral da pergunta 9): ano + cargo + UF, ou todos os estados sem `uf`.
    Calculadas ao subir a API; até lá, 202 "em preparação" (o Next não guarda em cache respostas que não são 200).
    Presidente só sem UF. Só as peças saem daqui, nunca as descrições."""
    lista = pecas_geral.consultar(ano, cargo, uf.upper() if uf else None)
    if lista is None:
        erro = pecas_geral.falhou()
        return JSONResponse(status_code=503 if erro else 202, content={"estado": "erro" if erro else "preparando"})
    return lista

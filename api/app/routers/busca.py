from fastapi import APIRouter, Query

from .. import db
from ..schemas import CandidatoBusca
from .util import padrao_like

router = APIRouter(tags=["busca"])


@router.get("/busca", response_model=list[CandidatoBusca])
def busca(q: str = Query(..., min_length=3, max_length=80, description="parte do nome civil ou do nome de urna")):
    """Até 20 pessoas, com a candidatura mais recente de cada uma. A busca ignora acentos e maiúsculas."""
    p = padrao_like(q)
    return db.consultar("busca", (p, p, 20))

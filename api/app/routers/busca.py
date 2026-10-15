from fastapi import APIRouter, Query

from .. import db
from ..schemas import CandidatoBusca
from .util import padrao_like, palavras_busca

router = APIRouter(tags=["busca"])


@router.get("/busca", response_model=list[CandidatoBusca])
def busca(q: str = Query(..., min_length=3, max_length=80, description="parte do nome civil ou do nome de urna")):
    """Até 20 pessoas, com a candidatura mais recente de cada uma, das mais relevantes para as menos.
    O texto digitado precisa aparecer inteiro, na mesma ordem, começando numa palavra do nome. Ignora acentos,
    maiúsculas e pontuação."""
    palavras = palavras_busca(q)
    if not palavras:
        return []
    return db.consultar("busca", (" ".join(palavras), padrao_like(max(palavras, key=len)), 20))

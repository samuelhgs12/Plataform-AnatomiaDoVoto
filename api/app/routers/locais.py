from fastapi import APIRouter, Query

from .. import db
from ..schemas import Eleito

router = APIRouter(tags=["locais"])


@router.get("/municipios/{id_municipio}/eleitos", response_model=list[Eleito])
def eleitos_municipio(id_municipio: int, ano: int = Query(..., description="ano de eleição municipal (2000, 2004, ..., 2024)")):
    """Prefeito, vice e vereadores eleitos no município (eleição ordinária), com votos do 1º turno, gasto e recebido."""
    return db.consultar("eleitos_municipio", (id_municipio, ano))


@router.get("/estados/{uf}/eleitos", response_model=list[Eleito])
def eleitos_estado(uf: str, ano: int = Query(..., description="ano de eleição geral (1998, 2002, ..., 2022)")):
    """Governador, vice, senadores e deputados federais e estaduais eleitos no estado (eleição ordinária)."""
    return db.consultar("eleitos_estado", (uf.upper()[:2], ano))

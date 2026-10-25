from typing import Literal

from fastapi import APIRouter, Query

from .. import db
from ..schemas import CandidatoLocal, Eleito

router = APIRouter(tags=["locais"])


@router.get("/municipios/{id_municipio}/eleitos", response_model=list[Eleito])
def eleitos_municipio(id_municipio: int, ano: int = Query(..., description="ano de eleição municipal (2000, 2004, ..., 2024)")):
    """Prefeito, vice e vereadores eleitos no município (eleição ordinária), com votos do 1º turno, gasto e recebido."""
    return db.consultar("eleitos_municipio", (id_municipio, ano))


@router.get("/municipios/{id_municipio}/candidatos", response_model=list[CandidatoLocal])
def candidatos_municipio(id_municipio: int, ano: int = Query(..., description="ano de eleição municipal"),
                         cargo: Literal["Prefeito", "Vereador"] = Query("Prefeito")):
    """Todos os candidatos do cargo no município (eleitos primeiro, depois por votos), com resultado e prestação de contas."""
    return db.consultar("candidatos_municipio", (id_municipio, ano, cargo))


@router.get("/estados/{uf}/eleitos", response_model=list[Eleito])
def eleitos_estado(uf: str, ano: int = Query(..., description="ano de eleição geral (1998, 2002, ..., 2022)")):
    """Governador, vice, senadores e deputados federais e estaduais eleitos no estado (eleição ordinária)."""
    return db.consultar("eleitos_estado", (uf.upper()[:2], ano))

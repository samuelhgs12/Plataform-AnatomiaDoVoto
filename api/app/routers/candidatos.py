from fastapi import APIRouter, HTTPException

from .. import db
from ..schemas import Perfil, Pessoa, Resumo
from .util import NIVEL_CARGO

router = APIRouter(tags=["candidatos"])


@router.get("/candidatos/{id_candidato}", response_model=Perfil)
def perfil(id_candidato: int):
    """Cabeçalho, resumo e carreira completa (pergunta 10). O identificador é o id interno, nunca o título eleitoral."""
    pessoa = db.um("candidato_cabecalho", (id_candidato,))
    if not pessoa:
        raise HTTPException(404, "Candidato não encontrado")
    carreira = [dict(r, nivel=NIVEL_CARGO.get(r["id_cargo"], 0)) for r in db.consultar("candidato_carreira", (id_candidato,))]

    # só titulares, eleição ordinária e quem de fato disputou entram no resumo e nas trocas
    validas = [r for r in carreira if r["eh_titular"] and r["tipo_eleicao"] == "ORDINARIA" and r["disputou"]]
    partidos: list[str] = []
    trocas = []
    for r in validas:
        if not r["partido"]:
            continue
        if partidos and partidos[-1] != r["partido"]:
            trocas.append({"ano": r["ano"], "de": partidos[-1], "para": r["partido"]})
        if not partidos or partidos[-1] != r["partido"]:
            partidos.append(r["partido"])
    resumo = Resumo(
        eleicoes_disputadas=len({r["ano"] for r in validas}),
        vitorias=sum(1 for r in validas if r["eleito"]),
        partidos=list(dict.fromkeys(partidos)),
        primeiro_ano=validas[0]["ano"] if validas else None,
        ultimo_ano=validas[-1]["ano"] if validas else None,
    )
    return Perfil(candidato=Pessoa(**pessoa), resumo=resumo, carreira=carreira, trocas=trocas)

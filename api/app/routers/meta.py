from fastapi import APIRouter

from .. import db
from ..schemas import Meta

router = APIRouter(tags=["filtros"])


@router.get("/meta", response_model=Meta)
def meta():
    """Cargos, anos de eleição ordinária e UFs, para montar os filtros do front-end."""
    return Meta(
        cargos=db.consultar("meta_cargos"),
        anos=[r["ano"] for r in db.consultar("meta_anos")],
        ufs=[r["uf"] for r in db.consultar("meta_ufs")],
    )

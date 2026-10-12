from fastapi import APIRouter, Response

from .. import db
from ..schemas import Saude

router = APIRouter(tags=["saúde"])


@router.get("/health", response_model=Saude)
def health(resp: Response):
    try:
        db.consultar("meta_anos", cache=False)
        return Saude(status="ok", db="ok")
    except db.BancoIndisponivel as e:
        resp.status_code = 503
        return Saude(status="erro", db=str(e))

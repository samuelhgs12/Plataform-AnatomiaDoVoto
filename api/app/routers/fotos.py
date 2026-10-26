from typing import Literal

from fastapi import APIRouter, HTTPException, Path, Query, Response

from .. import db

router = APIRouter(tags=["fotos"])

# a foto de uma candidatura não muda: o navegador pode guardá-la por um ano; a falta dela, por um dia
CACHE_FOTO = "public, max-age=31536000, immutable"
CACHE_SEM_FOTO = "public, max-age=86400"


def _tipo(dados: bytes) -> str:
    """WebP (miniatura) ou JPEG (original do TSE), pelo começo do arquivo."""
    return "image/webp" if dados[:4] == b"RIFF" and dados[8:12] == b"WEBP" else "image/jpeg"


@router.get("/fotos/{ano}/{ue}/{sequencial}", response_class=Response,
            responses={200: {"content": {"image/webp": {}, "image/jpeg": {}}}, 404: {"description": "Sem foto"}})
def foto(
    ano: int,
    ue: str = Path(..., pattern=r"^[A-Z0-9]{2,5}$", description="'BR', sigla da UF ou código TSE do município"),
    sequencial: str = Path(..., pattern=r"^[A-Za-z0-9]{1,20}$", description="sequencial do candidato no TSE"),
    tam: Literal["mini", "ficha"] = Query("mini", description="mini: WebP 120×160 para listas; ficha: original 161×225"),
):
    """Foto da candidatura (TSE, Portal de Dados Abertos, CC BY), pela chave natural (ano, ue, sequencial)."""
    dados = db.foto(ano, ue, sequencial, tam)
    if dados is None:
        raise HTTPException(404, "Candidatura sem foto", headers={"Cache-Control": CACHE_SEM_FOTO})
    return Response(content=dados, media_type=_tipo(dados), headers={"Cache-Control": CACHE_FOTO})

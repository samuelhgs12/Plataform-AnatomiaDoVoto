"""API da plataforma Anatomia do Voto. Rodar: uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db, pecas_geral
from .config import get_settings
from .routers import analises, busca, candidaturas, candidatos, fotos, locais, meta, propaganda, saude


@asynccontextmanager
async def ciclo(_: FastAPI):
    # peças de propaganda de cada recorte (visão geral da pergunta 9): calculadas em segundo plano, sem atrasar a subida
    if get_settings().pecas_ao_subir:
        pecas_geral.iniciar()
    yield


app = FastAPI(title="Anatomia do Voto", version="0.1.0", lifespan=ciclo,
              description="Dados eleitorais do TSE (1998–2024) para AP, ES, MG, PE, RJ e RR. Somente leitura.")

app.add_middleware(CORSMiddleware, allow_origins=get_settings().origens, allow_methods=["GET"], allow_headers=["*"])


@app.middleware("http")
async def cache_http(request: Request, call_next):
    """Os dados são históricos: o navegador e a CDN podem guardar as respostas."""
    resp = await call_next(request)
    if request.method == "GET" and request.url.path.startswith("/api/") and request.url.path != "/api/health" and resp.status_code == 200:
        resp.headers.setdefault("Cache-Control", "public, max-age=3600, s-maxage=86400")   # as fotos trazem o seu
    return resp


@app.exception_handler(db.BancoIndisponivel)
async def banco_indisponivel(_: Request, exc: db.BancoIndisponivel):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


for r in (saude.router, meta.router, busca.router, candidaturas.router, candidatos.router, fotos.router, analises.router, locais.router, propaganda.router):
    app.include_router(r, prefix="/api")

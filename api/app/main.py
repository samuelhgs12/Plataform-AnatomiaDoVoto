"""API da plataforma Anatomia do Voto. Rodar: uvicorn app.main:app --reload"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db
from .config import get_settings
from .routers import busca, candidaturas, candidatos, meta, saude

app = FastAPI(title="Anatomia do Voto", version="0.1.0",
              description="Dados eleitorais do TSE (1998–2024) para AP, ES, MG, PE, RJ e RR. Somente leitura.")

app.add_middleware(CORSMiddleware, allow_origins=get_settings().origens, allow_methods=["GET"], allow_headers=["*"])


@app.middleware("http")
async def cache_http(request: Request, call_next):
    """Os dados são históricos: o navegador e a CDN podem guardar as respostas."""
    resp = await call_next(request)
    if request.method == "GET" and request.url.path.startswith("/api/") and request.url.path != "/api/health" and resp.status_code == 200:
        resp.headers["Cache-Control"] = "public, max-age=3600, s-maxage=86400"
    return resp


@app.exception_handler(db.BancoIndisponivel)
async def banco_indisponivel(_: Request, exc: db.BancoIndisponivel):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


for r in (saude.router, meta.router, busca.router, candidaturas.router, candidatos.router):
    app.include_router(r, prefix="/api")

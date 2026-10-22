from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from .. import db

router = APIRouter(tags=["análises"])


@router.get("/analises")
def listar() -> list[str]:
    """Análises agregadas disponíveis (uma para cada arquivo app/analises/<nome>.sql)."""
    return db.analises()


@router.get("/analises/{nome}")
def analise(nome: str, tabela: list[str] = Query(default=[])):
    """Tabelas de uma análise, no formato {tabela: {colunas: [...], linhas: [[...]]}}.

    Cada COPY (...) TO 'x.csv' do SQL vira a tabela x. Passe ?tabela=x (pode repetir) para receber só as que a
    página usa: a q10 inteira passa de 3 MB.
    """
    if nome not in db.analises():
        raise HTTPException(404, f"Análise não encontrada: {nome}")
    dados = db.analise(nome)
    faltando = [t for t in tabela if t not in dados]
    if faltando:
        raise HTTPException(404, f"Tabela não encontrada em {nome}: {', '.join(faltando)}")
    # JSONResponse direto: os valores já são JSON puros, e o jsonable_encoder seria lento com dezenas de milhares de linhas
    return JSONResponse({t: dados[t] for t in tabela} if tabela else dados)

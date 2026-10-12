#!/usr/bin/env python3
"""Gera os JSONs estáticos das páginas agregadas (perguntas 5 e 10) para o front-end.

Os dados são históricos: calcule uma vez e sirva como arquivo (CDN), em vez de consultar o banco a cada visita.

Uso (a partir da pasta pipeline/):
  python export_static.py                                    # usa DATABASE e MOTHERDUCK_TOKEN do api/.env
  python export_static.py --banco /caminho/bdr_final.duckdb  # arquivo local
  python export_static.py --banco md:_share/bdr/<codigo>     # MotherDuck (token no .env ou no ambiente)
Saída: ../web/public/data/q5.json e q10.json, no formato {tabela: {colunas: [...], linhas: [[...]]}}.
"""
import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import duckdb

RAIZ = Path(__file__).resolve().parent
COPY_RE = re.compile(r"COPY\s*\((.*)\)\s*TO\s*'[^']*?([A-Za-z0-9_]+)\.csv'\s*\(HEADER\)", re.S | re.I)
IGNORAR = {"politicos", "trajetorias"}      # volumosos: a busca por pessoa usa a API


def carregar_env() -> None:
    """Lê KEY=VALOR dos arquivos .env (sem sobrescrever o que já está no ambiente do terminal).

    Procura, nesta ordem: pipeline/.env, .env na raiz do repositório e api/.env. Assim o mesmo api/.env
    (DATABASE e MOTHERDUCK_TOKEN) serve para a API e para este script. Valores vazios são ignorados.
    """
    for caminho in (RAIZ / ".env", RAIZ.parent / ".env", RAIZ.parent / "api" / ".env"):
        if not caminho.exists():
            continue
        for linha in caminho.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, valor = linha.split("=", 1)
            chave, valor = chave.strip(), valor.strip().strip('"').strip("'")
            if valor and chave not in os.environ:
                os.environ[chave] = valor


def conectar(banco: str):
    token = os.environ.get("MOTHERDUCK_TOKEN") or os.environ.get("motherduck_token")
    if banco.startswith("md:_share"):
        if not token:
            sys.exit("Falta MOTHERDUCK_TOKEN.")
        con = duckdb.connect(f"md:?motherduck_token={token}")
        con.execute("ATTACH '" + banco.replace("'", "''") + "' AS bdr")
        con.execute("USE bdr")
        return con
    if banco.startswith("md:"):
        if not token:
            sys.exit("Falta MOTHERDUCK_TOKEN.")
        return duckdb.connect(f"{banco}{'&' if '?' in banco else '?'}motherduck_token={token}")
    if not Path(banco).exists():
        sys.exit(f"Banco não encontrado: {banco}")
    return duckdb.connect(banco, read_only=True)


def executar(con, arquivo: Path) -> dict:
    """Roda o SQL: os CREATE TEMP preparam a sessão e cada COPY ... TO 'x.csv' vira um resultado em memória."""
    comandos = [c.strip() for c in re.split(r";\s*\n", re.sub(r"--[^\n]*", "", arquivo.read_text(encoding="utf-8"))) if c.strip()]
    saida = {}
    for c in comandos:
        m = COPY_RE.match(c)
        if not m:
            con.execute(c)
        elif m.group(2) not in IGNORAR:
            cur = con.execute(m.group(1))
            saida[m.group(2)] = {"colunas": [d[0] for d in cur.description], "linhas": cur.fetchall()}
    return saida


def _json(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))


def main():
    carregar_env()      # antes do parser: o padrão de --banco vem de DATABASE
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--banco", default=os.environ.get("DATABASE", "md:bdr"))
    p.add_argument("--saida", default=str(RAIZ.parent / "web" / "public" / "data"))
    a = p.parse_args()
    con = conectar(a.banco)
    destino = Path(a.saida)
    destino.mkdir(parents=True, exist_ok=True)
    for q in ("q5", "q10"):
        dados = executar(con, RAIZ / "sql" / f"{q}.sql")
        arq = destino / f"{q}.json"
        arq.write_text(json.dumps(dados, default=_json, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{arq.name}: " + ", ".join(f"{k} ({len(v['linhas']):,})" for k, v in dados.items()) + f"  [{arq.stat().st_size / 1e3:,.0f} KB]")


if __name__ == "__main__":
    main()
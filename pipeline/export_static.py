#!/usr/bin/env python3
"""Gera os JSONs estáticos das páginas agregadas (perguntas 5, 8 e 10) para o front-end.

Os dados são históricos: calcule uma vez e sirva como arquivo (CDN), em vez de consultar o banco a cada visita.

Uso (a partir da pasta pipeline/):
  python export_static.py                                    # usa DATABASE e MOTHERDUCK_TOKEN do api/.env
  python export_static.py --banco /caminho/bdr_final.duckdb  # arquivo local
  python export_static.py --banco md:_share/bdr/<codigo>     # MotherDuck (token no .env ou no ambiente)
Se o MotherDuck falhar (sem token, fora da organização...), usa o banco local da carga: DATABASE_LOCAL ou, por padrão,
../load_BDR/dados_bdr/bdr_final.duckdb (repositórios lado a lado).
Saída: ../web/public/data/q5.json, q8.json e q10.json, no formato {tabela: {colunas: [...], linhas: [[...]]}}.
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
BANCO_DA_CARGA = RAIZ.parents[1] / "load_BDR" / "dados_bdr" / "bdr_final.duckdb"


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


class SemBanco(RuntimeError):
    pass


def _conectar(banco: str):
    token = os.environ.get("MOTHERDUCK_TOKEN") or os.environ.get("motherduck_token")
    if banco.startswith("md:_share"):
        if not token:
            raise SemBanco("Falta MOTHERDUCK_TOKEN.")
        con = duckdb.connect(f"md:?motherduck_token={token}")
        try:
            con.execute("ATTACH '" + banco.replace("'", "''") + "' AS bdr")
        except duckdb.InvalidInputException as e:
            if "already attached" not in str(e):    # o MotherDuck guarda shares anexados na conta: reaproveita
                raise
        con.execute("USE bdr")
        return con
    if banco.startswith("md:"):
        if not token:
            raise SemBanco("Falta MOTHERDUCK_TOKEN.")
        return duckdb.connect(f"{banco}{'&' if '?' in banco else '?'}motherduck_token={token}")
    if not Path(banco).exists():
        raise SemBanco(f"Banco não encontrado: {banco}")
    return duckdb.connect(banco, read_only=True)


def conectar(banco: str):
    """Conecta ao banco pedido; se for o MotherDuck e falhar, cai para o arquivo local da carga."""
    try:
        return _conectar(banco)
    except (SemBanco, duckdb.Error) as e:
        # a mensagem do duckdb pode conter o token: mostramos só o tipo do erro
        motivo = str(e) if isinstance(e, SemBanco) else type(e).__name__
        local = str(Path(os.environ.get("DATABASE_LOCAL") or BANCO_DA_CARGA).expanduser())
        if not banco.startswith("md:"):
            sys.exit(f"Não foi possível abrir o banco ({motivo}).")
        if not Path(local).exists():
            sys.exit(f"Não foi possível abrir o MotherDuck ({motivo}) e não há banco local em {local}: defina DATABASE_LOCAL.")
        print(f"MotherDuck indisponível ({motivo}); usando o banco local {local}", file=sys.stderr)
        return duckdb.connect(local, read_only=True)


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
    for q in ("q5", "q8", "q10"):
        dados = executar(con, RAIZ / "sql" / f"{q}.sql")
        arq = destino / f"{q}.json"
        arq.write_text(json.dumps(dados, default=_json, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{arq.name}: " + ", ".join(f"{k} ({len(v['linhas']):,})" for k, v in dados.items()) + f"  [{arq.stat().st_size / 1e3:,.0f} KB]")


if __name__ == "__main__":
    main()
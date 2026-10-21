#!/usr/bin/env python3
"""Gera os JSONs estáticos das análises (perguntas 5, 8, 9 e 10 e o mapa da página inicial) para o front-end.

Os dados são históricos: calcule uma vez e sirva como arquivo (CDN), em vez de consultar o banco a cada visita.

Uso (a partir da pasta pipeline/):
  python export_static.py                                    # usa DATABASE e MOTHERDUCK_TOKEN do api/.env
  python export_static.py --banco /caminho/bdr_final.duckdb  # arquivo local
  python export_static.py --banco md:_share/bdr/<codigo>     # MotherDuck (token no .env ou no ambiente)
  python export_static.py mapa                               # só algumas consultas
Se o MotherDuck falhar (sem token, fora da organização...), usa o banco local da carga: DATABASE_LOCAL ou, por padrão,
../load_BDR/dados_bdr/bdr_final.duckdb (repositórios lado a lado).
Saída: ../web/public/data/q5.json, q8.json, q10.json e mapa.json, no formato {tabela: {colunas: [...], linhas: [[...]]}}.
A pergunta 9 é por candidatura (centenas de milhares de linhas): vai para ../web/public/data/q9/, com um índice e um
arquivo por eleição e UF no mesmo formato (gravar_q9), para a página ler só o recorte escolhido.
"""
import argparse
import csv
import io
import json
import os
import re
import shutil
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

import duckdb

RAIZ = Path(__file__).resolve().parent
COPY_RE = re.compile(r"COPY\s*\((.*)\)\s*TO\s*'[^']*?([A-Za-z0-9_]+)\.csv'\s*\(HEADER\)", re.S | re.I)
IGNORAR = {"politicos", "trajetorias"}      # volumosos: a busca por pessoa usa a API
BANCO_DA_CARGA = RAIZ.parents[1] / "load_BDR" / "dados_bdr" / "bdr_final.duckdb"
# O banco só tem participação de 2018 em diante; 2008 a 2016 vêm dos dados abertos do TSE (baixados uma vez para .cache/)
# TODO: provisório (decisão 10 em docs/DECISOES.md). Quando o load_BDR carregar 2008-2016 e os indicadores no banco,
# apagar ANOS_TSE, URL_TSE, CACHE, carregar_tse e o USE bdr_v2 em main().
ANOS_TSE = (2008, 2010, 2012, 2014, 2016)
URL_TSE = "https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_munzona/detalhe_votacao_munzona_{ano}.zip"
CACHE = RAIZ / ".cache"


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


def gravar_q9(dados: dict, destino: Path, origem: str = "banco") -> dict:
    """Divide a pergunta 9 em destino/q9/<ano>-<UF>.json + destino/q9/indice.json e confere tudo antes de gravar.

    Conferências (param a exportação, sem tocar nos arquivos anteriores): (ano, sequencial) único; toda categoria
    pertence a uma candidatura do recorte; as categorias somam exatamente a propaganda de cada candidatura (centavos);
    propaganda <= total. `origem` vai para o índice: "banco" (exportação real) ou "sintetico" (dados de exemplo).
    """
    cand, cats = dados["candidaturas"], dados["categorias"]
    ic = {c: i for i, c in enumerate(cand["colunas"])}
    ik = {c: i for i, c in enumerate(cats["colunas"])}
    chave = lambda l, i: (int(l[i["ano"]]), str(l[i["sequencial"]]))   # noqa: E731
    por_chave = {}
    for l in cand["linhas"]:
        k = chave(l, ic)
        if k in por_chave:
            raise SystemExit(f"q9: candidatura repetida (ano, sequencial) = {k}")
        if l[ic["propaganda_centavos"]] > l[ic["total_centavos"]] or l[ic["propaganda_centavos"]] < 0:
            raise SystemExit(f"q9: propaganda maior que o total ou negativa em {k}")
        por_chave[k] = l
    soma = {}
    for l in cats["linhas"]:
        k = chave(l, ik)
        if k not in por_chave or l[ik["uf"]] != por_chave[k][ic["uf"]]:
            raise SystemExit(f"q9: categoria sem candidatura no recorte: {k}")
        soma[k] = soma.get(k, 0) + l[ik["centavos"]]
    for k, l in por_chave.items():
        if soma.get(k, 0) != l[ic["propaganda_centavos"]]:
            raise SystemExit(f"q9: as categorias de {k} somam {soma.get(k, 0)} centavos; a propaganda é {l[ic['propaganda_centavos']]}")

    # Cada recorte em tabelas enxutas (ano e UF ficam no nome do arquivo): o nome do município e a categoria original
    # (com o grupo) viram tabelas de consulta, para não repetir texto em centenas de milhares de linhas.
    origens = sorted({(l[ik["origem"]], l[ik["grupo"]]) for l in cats["linhas"]}, key=lambda o: (o[1], o[0] or ""))
    cod_origem = {o: i for i, o in enumerate(origens)}
    recortes: dict[tuple[int, str], dict] = {}
    for l in cand["linhas"]:
        r = recortes.setdefault((int(l[ic["ano"]]), l[ic["uf"]]), {"candidaturas": [], "categorias": [], "municipios": {}})
        r["candidaturas"].append(l)
        if l[ic["cod_municipio"]] is not None:
            r["municipios"][l[ic["cod_municipio"]]] = l[ic["municipio"]]
    for l in cats["linhas"]:
        recortes[(int(l[ik["ano"]]), l[ik["uf"]])]["categorias"].append(l)

    tmp = destino / "q9.tmp"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    escrever = lambda arq, obj: arq.write_text(json.dumps(obj, default=_json, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")  # noqa: E731
    col_c = ["id_candidatura", "sequencial", "cargo", "cod_municipio", "nome_urna", "numero_urna", "partido", "lancamentos",
             "total_centavos", "propaganda_centavos"]
    col_k = ["sequencial", "origem", "lancamentos", "centavos"]
    linhas_indice = []
    for (ano, uf), r in sorted(recortes.items()):
        arquivo = f"{ano}-{uf}"
        escrever(tmp / f"{arquivo}.json", {
            "candidaturas": {"colunas": col_c, "linhas": [[l[ic[c]] for c in col_c] for l in r["candidaturas"]]},
            "municipios": {"colunas": ["cod_municipio", "municipio"],
                           "linhas": sorted(([k, v] for k, v in r["municipios"].items()), key=lambda x: (x[1] or "", x[0]))},
            "categorias": {"colunas": col_k, "linhas": [[l[ik["sequencial"]], cod_origem[(l[ik["origem"]], l[ik["grupo"]])],
                                                         l[ik["lancamentos"]], l[ik["centavos"]]] for l in r["categorias"]]},
            "origens": {"colunas": ["origem", "grupo"], "linhas": [list(o) for o in origens]},
        })
        cs = r["candidaturas"]
        linhas_indice.append([ano, uf, arquivo, len(cs), sum(1 for l in cs if l[ic["lancamentos"]] > 0),
                              sum(1 for l in cs if l[ic["propaganda_centavos"]] > 0),
                              sum(l[ic["total_centavos"]] for l in cs), sum(l[ic["propaganda_centavos"]] for l in cs)])
    indice = {
        "meta": {"colunas": ["origem", "versao", "candidaturas", "categorias"],
                 "linhas": [[origem, 1, len(cand["linhas"]), len(cats["linhas"])]]},
        "recortes": {"colunas": ["ano", "uf", "arquivo", "candidaturas", "com_despesas", "com_propaganda", "total_centavos",
                                 "propaganda_centavos"], "linhas": linhas_indice},
    }
    escrever(tmp / "indice.json", indice)
    # troca a pasta inteira de uma vez: a página nunca vê um índice novo com recortes antigos (ou o contrário)
    final, velho = destino / "q9", destino / "q9.old"
    if velho.exists():
        shutil.rmtree(velho)
    if final.exists():
        final.rename(velho)
    tmp.rename(final)
    if velho.exists():
        shutil.rmtree(velho)
    return {"recortes": len(linhas_indice), "candidaturas": len(cand["linhas"]), "categorias": len(cats["linhas"]),
            "bytes": sum(f.stat().st_size for f in final.iterdir())}


def carregar_tse(con) -> None:
    """Cria a tabela temporária tse_participacao (cod_tse, ano, totais do 1º turno) com o detalhe de votação do TSE.

    Mesma regra da tabela participacao_eleitoral: eleição ordinária, 1º turno, governador nos anos gerais e prefeito
    nos municipais (o eleitorado é o mesmo para todos os cargos do turno). Só as UFs que o banco cobre.
    """
    ufs = {u for (u,) in con.execute("SELECT DISTINCT uf FROM municipio WHERE cod_ibge IS NOT NULL").fetchall()}
    somas: dict[tuple[str, int], list[int]] = {}
    CACHE.mkdir(exist_ok=True)
    for ano in ANOS_TSE:
        arq = CACHE / f"munzona_{ano}.zip"
        if not arq.exists():
            print(f"baixando {URL_TSE.format(ano=ano)}", file=sys.stderr)
            with urlopen(URL_TSE.format(ano=ano), timeout=120) as r:
                arq.write_bytes(r.read())
        cargo = "11" if ano % 4 == 0 else "3"
        with ZipFile(arq) as z:
            for uf in sorted(ufs):
                with z.open(f"detalhe_votacao_munzona_{ano}_{uf}.csv") as f:
                    for l in csv.DictReader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";"):
                        if l["NR_TURNO"] != "1" or l["CD_TIPO_ELEICAO"] != "2" or l["CD_CARGO"] != cargo or l["ST_VOTO_EM_TRANSITO"] == "S":
                            continue
                        s = somas.setdefault((l["CD_MUNICIPIO"].zfill(5), ano), [0, 0, 0, 0, 0])
                        for i, c in enumerate(("QT_APTOS", "QT_COMPARECIMENTO", "QT_ABSTENCOES", "QT_VOTOS_BRANCOS", "QT_VOTOS_NULOS")):
                            s[i] += int(l[c])
    con.execute("CREATE OR REPLACE TEMP TABLE tse_participacao (cod_tse VARCHAR, ano SMALLINT, aptos BIGINT, comparecimento BIGINT,"
                " abstencoes BIGINT, brancos BIGINT, nulos BIGINT)")
    con.executemany("INSERT INTO tse_participacao VALUES (?, ?, ?, ?, ?, ?, ?)", [[*k, *v] for k, v in somas.items()])


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
    p.add_argument("consultas", nargs="*", choices=["q5", "q8", "q9", "q10", "mapa"], default=["q5", "q8", "q9", "q10", "mapa"])
    a = p.parse_args()
    con = conectar(a.banco)
    destino = Path(a.saida)
    destino.mkdir(parents=True, exist_ok=True)
    for q in a.consultas:
        banco = con.execute("SELECT current_database()").fetchone()[0]
        if q == "mapa":
            # código IBGE e indicadores municipais só existem na versão 2 do banco (anexada junto no MotherDuck)
            if con.execute("SELECT count(*) FROM duckdb_databases() WHERE database_name = 'bdr_v2'").fetchone()[0]:
                con.execute("USE bdr_v2")
            carregar_tse(con)
        dados = executar(con, RAIZ / "sql" / f"{q}.sql")
        con.execute(f'USE "{banco}"')   # as consultas seguintes voltam ao banco pedido em --banco
        if q == "q9":
            r = gravar_q9(dados, destino)
            print(f"q9/: {r['recortes']} recortes, candidaturas ({r['candidaturas']:,}), categorias ({r['categorias']:,})"
                  f"  [{r['bytes'] / 1e3:,.0f} KB]")
            continue
        arq = destino / f"{q}.json"
        arq.write_text(json.dumps(dados, default=_json, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{arq.name}: " + ", ".join(f"{k} ({len(v['linhas']):,})" for k, v in dados.items()) + f"  [{arq.stat().st_size / 1e3:,.0f} KB]")


if __name__ == "__main__":
    main()
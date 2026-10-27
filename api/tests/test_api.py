import json

import pytest
from fastapi.testclient import TestClient


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json() == {"status": "ok", "db": "ok"}


def test_health_sem_banco(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient
    from app import db

    monkeypatch.setenv("DATABASE", str(tmp_path / "nao_existe.duckdb"))
    db.reiniciar()
    from app.main import app

    r = TestClient(app).get("/api/health")
    assert r.status_code == 503 and r.json()["status"] == "erro"
    db.reiniciar()


def test_fallback_local_quando_motherduck_falha(monkeypatch, banco):
    from fastapi.testclient import TestClient
    from app import db

    monkeypatch.setenv("DATABASE", "md:bdr")
    monkeypatch.setenv("MOTHERDUCK_TOKEN", "")      # vazio vence o api/.env: sem token o MotherDuck falha...
    monkeypatch.setenv("DATABASE_LOCAL", banco)     # ...e a API lê o arquivo local
    db.reiniciar()
    from app.main import app

    c = TestClient(app)
    assert c.get("/api/health").json() == {"status": "ok", "db": "ok"}
    assert c.get("/api/meta").json()["ufs"] == ["MG", "PE", "RJ"]
    db.reiniciar()


def test_sem_motherduck_e_sem_fallback(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient
    from app import db

    monkeypatch.setenv("DATABASE", "md:bdr")
    monkeypatch.setenv("MOTHERDUCK_TOKEN", "")
    monkeypatch.setenv("DATABASE_LOCAL", str(tmp_path / "nao_existe.duckdb"))
    db.reiniciar()
    from app.main import app

    r = TestClient(app).get("/api/health")
    assert r.status_code == 503 and "DATABASE_LOCAL" in r.json()["db"]
    db.reiniciar()


def test_meta(client):
    m = client.get("/api/meta").json()
    assert {c["nome"] for c in m["cargos"]} >= {"Vereador", "Prefeito", "Deputado federal", "Deputado estadual"}
    assert m["anos"] == [2016, 2018, 2020, 2022, 2024]
    assert m["ufs"] == ["MG", "PE", "RJ"]


def test_busca_ignora_acento_e_caixa(client):
    r = client.get("/api/busca", params={"q": "joao"}).json()
    assert [x["id_candidato"] for x in r] == [2]
    r = client.get("/api/busca", params={"q": "MARIA"}).json()
    assert {x["id_candidato"] for x in r} == {1, 4}          # MARIA e MARIANA
    maria = next(x for x in r if x["id_candidato"] == 1)
    assert maria["ultimo_ano"] == 2022 and maria["ultimo_cargo"] == "Deputado estadual" and maria["ultimo_eleito"] is False


def test_busca_casa_inicio_de_palavra_e_ordena_por_relevancia(client):
    assert [x["id_candidato"] for x in client.get("/api/busca", params={"q": "comer"}).json()] == [2]   # COMERCIO
    assert client.get("/api/busca", params={"q": "ercio"}).json() == []      # trecho no meio da palavra não conta
    r = client.get("/api/busca", params={"q": "maria"}).json()
    assert [x["id_candidato"] for x in r] == [1, 4]       # palavra inteira (MARIA) antes do início de palavra (MARIANA)


def test_busca_exige_o_trecho_inteiro_e_na_ordem(client):
    ids = lambda q: [x["id_candidato"] for x in client.get("/api/busca", params={"q": q}).json()]
    assert ids("maria da silva") == [1]          # nome de urna igual
    assert ids("silva santos") == [1]            # trecho do meio do nome civil
    assert ids("maria silva") == []              # MARIA DA SILVA: palavras soltas não contam
    assert ids("silva maria") == []              # nem fora de ordem
    assert ids("mariana sil") == [4]             # a última palavra pode estar incompleta
    assert ids("joao do com") == [2]


def test_busca_informa_nome_de_urna_antigo_que_casou(client):
    # a pessoa 1 foi MARIA PROFESSORA em 2016 e 2020 e MARIA DA SILVA em 2022: mostra a de 2022 e o nome que casou
    for q in ("maria professora", "maria prof"):     # independe da palavra usada no pré-filtro
        r = client.get("/api/busca", params={"q": q}).json()
        assert [x["id_candidato"] for x in r] == [1]
        assert r[0]["ultimo_ano"] == 2022 and r[0]["nome_urna"] == "MARIA DA SILVA" and r[0]["nome_urna_casado"] == "MARIA PROFESSORA"
    assert client.get("/api/busca", params={"q": "maria da silva"}).json()[0]["nome_urna_casado"] is None


def test_busca_por_estado(client):
    ids = lambda **p: [x["id_candidato"] for x in client.get("/api/busca", params={"q": "maria", **p}).json()]
    assert ids(uf="RJ") == [4]                    # MARIANA disputou no RJ; MARIA, só em MG
    assert ids(uf="mg") == [1]
    assert ids(uf="PE") == []
    assert client.get("/api/busca", params={"q": "maria", "uf": "M1"}).status_code == 422


def test_busca_exige_3_letras_e_nao_aceita_coringa(client):
    assert client.get("/api/busca", params={"q": "ab"}).status_code == 422
    assert client.get("/api/busca", params={"q": "%%%"}).json() == []      # o % digitado não vira coringa


def test_listagem_padrao_so_ordinaria(client):
    r = client.get("/api/candidaturas", params={"cargo": 11, "ano": 2020}).json()
    assert r["total"] == 1 and r["itens"][0]["nome_urna"] == "JOÃO DO COMERCIO"
    r = client.get("/api/candidaturas", params={"cargo": 11, "ano": 2020, "incluir_suplementares": True}).json()
    assert r["total"] == 2


def test_listagem_filtros_ordem_e_paginacao(client):
    r = client.get("/api/candidaturas", params={"ano": 2022}).json()
    assert [i["nome_urna"] for i in r["itens"]] == ["ANA ADVOGADA", "MARIA DA SILVA", "ZÉ DA SERRA"]     # por votos
    r = client.get("/api/candidaturas", params={"ano": 2022, "ordem": "nome"}).json()
    assert [i["nome_urna"] for i in r["itens"]] == ["ANA ADVOGADA", "MARIA DA SILVA", "ZÉ DA SERRA"]
    r = client.get("/api/candidaturas", params={"ano": 2022, "eleito": True}).json()
    assert r["total"] == 1 and r["itens"][0]["eleito"] is True
    r = client.get("/api/candidaturas", params={"ano": 2022, "tamanho": 1, "pagina": 2}).json()
    assert r["total"] == 3 and len(r["itens"]) == 1 and r["itens"][0]["nome_urna"] == "MARIA DA SILVA"
    assert client.get("/api/candidaturas", params={"uf": "pe"}).json()["total"] == 2        # 2016 e 2020 do João


def test_listagem_filtra_por_partido(client):
    r = client.get("/api/candidaturas", params={"ano": 2022, "partido": "PSD"}).json()
    assert r["total"] == 1 and r["itens"][0]["nome_urna"] == "MARIA DA SILVA"
    assert client.get("/api/candidaturas", params={"ano": 2022, "partido": "PT"}).json()["total"] == 0


def test_partidos_da_eleicao(client):
    assert client.get("/api/partidos", params={"ano": 2020, "cargo": 13}).json() == ["PSB"]
    assert client.get("/api/partidos", params={"ano": 2020, "cargo": 11}).json() == ["PT"]     # sem a suplementar
    assert client.get("/api/partidos", params={"ano": 2022, "cargo": 7, "uf": "rj"}).json() == []
    assert client.get("/api/partidos", params={"ano": 2022}).status_code == 422                # cargo é obrigatório


def test_perfil_carreira_resumo_e_trocas(client):
    p = client.get("/api/candidatos/1").json()
    assert p["candidato"]["nome_civil"] == "MARIA DA SILVA SANTOS"
    assert [(c["ano"], c["cargo"], c["eleito"], c["partido"]) for c in p["carreira"]] == [
        (2016, "Vereador", True, "PSB"), (2020, "Vereador", True, "PSB"), (2022, "Deputado estadual", False, "PSD")]
    assert p["carreira"][0]["nivel"] == 1 and p["carreira"][2]["nivel"] == 4
    assert p["resumo"] == {"eleicoes_disputadas": 3, "vitorias": 2, "partidos": ["PSB", "PSD"], "primeiro_ano": 2016, "ultimo_ano": 2022}
    assert p["trocas"] == [{"ano": 2022, "de": "PSB", "para": "PSD"}]


def test_perfil_ignora_suplementar_no_resumo(client):
    p = client.get("/api/candidatos/2").json()
    assert len(p["carreira"]) == 3                         # a suplementar aparece na carreira...
    assert p["resumo"]["eleicoes_disputadas"] == 2 and p["resumo"]["vitorias"] == 2   # ...mas não conta no resumo


def test_perfil_inexistente(client):
    assert client.get("/api/candidatos/9999").status_code == 404


def test_despesas_regras_do_projeto(client):
    d = client.get("/api/candidaturas/2/despesas").json()
    por = {c["categoria"]: c["valor"] for c in d["categorias"]}
    # PARCIAL (500) e transferência (700) ficam de fora; só FINAL e sem transferências
    assert por == {"propaganda_fisica": 3000, "propaganda_digital": 1500, "outros": 1000}
    assert d["total"] == 5500 and d["propaganda"] == 4500 and round(d["pct_propaganda"], 3) == 0.818
    fisica = next(c for c in d["categorias"] if c["categoria"] == "propaganda_fisica")
    assert fisica["publicidade"] is True and fisica["mediana_cargo"] == 3000 and d["n_comparaveis"] == 1


def test_propaganda_por_categoria_em_centavos(client):
    p = client.get("/api/candidaturas/2/propaganda").json()
    # PARCIAL (500) e transferência (700) ficam de fora; categorias só de propaganda, da maior para a menor
    assert (p["lancamentos"], p["total_centavos"], p["propaganda_centavos"]) == (3, 550_000, 450_000)
    assert p["categorias"] == [
        {"origem": "Publicidade por materiais impressos", "grupo": "propaganda_fisica", "lancamentos": 1, "centavos": 300_000},
        {"origem": "Publicidade por mídia digital", "grupo": "propaganda_digital", "lancamentos": 1, "centavos": 150_000},
    ]


def test_propaganda_termos_da_nuvem(client):
    termos = client.get("/api/candidaturas/2/propaganda").json()["termos"]
    # "santinhos e adesivos" (R$ 3.000) divide o valor entre as duas peças; "impulsionamento ... redes sociais" vira só
    # "redes" (impulsionamento é genérico). Empate no valor: ordem alfabética. A descrição original não sai.
    assert [(t["termo"], t["grupo"], t["centavos"], t["despesas"], t["generico"]) for t in termos] == [
        ("adesivo", "propaganda_fisica", 150_000, 1, False),
        ("redes", "propaganda_digital", 150_000, 1, False),
        ("santinho", "propaganda_fisica", 150_000, 1, False),
    ]
    assert termos[1]["explicacao"] == "gestão e conteúdo de redes sociais"
    assert termos[2]["detalhes"] == [{"termo": "santinho", "centavos": 150_000}]
    assert sum(t["centavos"] for t in termos) == 450_000 and all(t["pela_categoria_centavos"] == 0 for t in termos)
    assert "descricao" not in json.dumps(termos)


def test_propaganda_por_tipo_bate_com_o_total_oficial_de_cada_grupo(client):
    """Para cada campanha, a soma do por_tipo das peças de um grupo = total das categorias desse grupo, em centavos."""
    vistas = 0
    for idc in range(1, 10):
        r = client.get(f"/api/candidaturas/{idc}/propaganda")
        if r.status_code == 404:
            continue
        p = r.json()
        oficial, pecas = {}, {}
        for k in p["categorias"]:
            oficial[k["grupo"]] = oficial.get(k["grupo"], 0) + k["centavos"]
        for t in p["termos"]:
            for x in t["por_tipo"]:
                pecas[x["grupo"]] = pecas.get(x["grupo"], 0) + x["centavos"]
        assert pecas == oficial, idc
        assert sum(oficial.values()) == p["propaganda_centavos"]
        vistas += bool(oficial)
    assert vistas >= 2          # as candidaturas 2 e 5 do seed têm propaganda


def test_q9_referencia_mediana_da_parcela_de_cada_tipo(client):
    """Mediana da parcela de cada tipo na propaganda, por cargo + ano + UF (titular, ordinária, que disputou, > 0)."""
    t = client.get("/api/analises/q9?tabela=referencia").json()["referencia"]
    assert t["colunas"] == ["ano", "id_cargo", "cargo", "uf", "grupo", "mediana", "campanhas"]
    linhas = {(r[0], r[1], r[3], r[4]): (round(r[5], 4), r[6]) for r in t["linhas"]}
    # candidatura 2 (vereador, MG, 2020): física 3000 e digital 1500 (o PARCIAL e a transferência ficam de fora)
    assert linhas[(2020, 13, "MG", "propaganda_fisica")] == (0.6667, 1)
    assert linhas[(2020, 13, "MG", "propaganda_digital")] == (0.3333, 1)
    assert linhas[(2020, 13, "MG", "propaganda_audiovisual")] == (0.0, 1)      # sem nada no tipo: parcela 0
    # candidatura 5 (prefeito, PE, 2020): digital 4000 e física 1000
    assert linhas[(2020, 11, "PE", "propaganda_digital")] == (0.8, 1)
    assert all(ano >= 2018 for ano, *_ in linhas)
    # "campanhas" é o tamanho do grupo (cargo + ano + UF): o mesmo número nos três tipos do grupo
    grupos = {}
    for ano, cargo, uf, grupo in linhas:
        grupos.setdefault((ano, cargo, uf), {})[grupo] = linhas[(ano, cargo, uf, grupo)][1]
    assert grupos and all(len(g) == 3 and len(set(g.values())) == 1 for g in grupos.values())


def test_q9_parcelas_de_cada_campanha_dos_grupos_pequenos(client):
    """Parcelas de cada campanha dos grupos com menos de 30 campanhas, para o perfil tirar a própria campanha da típica."""
    r = client.get("/api/analises/q9?tabela=parcelas")
    assert r.status_code == 200 and set(r.json()) == {"parcelas"} and "max-age" in r.headers["cache-control"]
    t = r.json()["parcelas"]
    assert t["colunas"] == ["id_candidatura", "ano", "id_cargo", "cargo", "uf", "propaganda_fisica", "propaganda_audiovisual", "propaganda_digital"]
    por_id = {l[0]: l for l in t["linhas"]}
    # candidatura 2 (vereador, MG, 2020): física 3000 e digital 1500, num grupo de 1 campanha
    assert [round(x, 4) for x in por_id[2][5:]] == [0.6667, 0.0, 0.3333]
    assert all(abs(sum(l[5:]) - 1) < 1e-9 for l in t["linhas"])        # as três parcelas somam 1
    # no banco de teste todo grupo é pequeno: cada linha da referencia é a mediana das parcelas do seu grupo
    ref = client.get("/api/analises/q9?tabela=referencia").json()["referencia"]["linhas"]
    col = {"propaganda_fisica": 5, "propaganda_audiovisual": 6, "propaganda_digital": 7}
    for ano, cargo, _, uf, grupo, mediana, campanhas in ref:
        do_grupo = sorted(l[col[grupo]] for l in t["linhas"] if (l[1], l[2], l[4]) == (ano, cargo, uf))
        assert len(do_grupo) == campanhas
        meio = len(do_grupo) // 2
        esperado = do_grupo[meio] if len(do_grupo) % 2 else (do_grupo[meio - 1] + do_grupo[meio]) / 2
        assert abs(esperado - mediana) < 1e-9


def test_q9_geral_media_parte_com_gasto_e_soma_por_uf_e_todos_os_estados(client):
    """Visão geral da P9: por ano + cargo + UF e por ano + cargo em todos os estados (uf nulo), em cada tipo."""
    t = client.get("/api/analises/q9?tabela=geral").json()["geral"]
    assert t["colunas"] == ["ano", "id_cargo", "cargo", "uf", "grupo", "campanhas", "media", "parte_com_gasto", "soma_centavos", "despesas_centavos"]
    linhas = [dict(zip(t["colunas"], l)) for l in t["linhas"]]
    recortes = {(l["ano"], l["cargo"], l["uf"]) for l in linhas}
    # os dois níveis do GROUPING SETS: a UF e todos os estados
    assert recortes == {(2020, "Vereador", "MG"), (2020, "Vereador", None), (2020, "Prefeito", "PE"), (2020, "Prefeito", None)}
    for r in recortes:   # as médias dos três tipos somam 1 em cada recorte
        assert abs(sum(l["media"] for l in linhas if (l["ano"], l["cargo"], l["uf"]) == r) - 1) < 1e-9
    ver = {l["grupo"]: l for l in linhas if l["cargo"] == "Vereador" and l["uf"] is None}
    # candidatura 2: física 3000 e digital 1500 (a parcial de 500 não entra)
    assert [round(ver[g]["media"], 4) for g in ("propaganda_fisica", "propaganda_audiovisual", "propaganda_digital")] == [0.6667, 0.0, 0.3333]
    assert [ver[g]["parte_com_gasto"] for g in ("propaganda_fisica", "propaganda_audiovisual", "propaganda_digital")] == [1, 0, 1]
    assert (ver["propaganda_fisica"]["soma_centavos"], ver["propaganda_fisica"]["campanhas"]) == (300000, 1)
    assert all(l["uf"] != "BR" for l in linhas)                        # presidente só no recorte sem UF
    # total de TODAS as despesas das campanhas do recorte (o mesmo nas três linhas): candidatura 2 = 3000 + 1500 de propaganda
    # + 1000 de advogado; a transferência de 700 e a parcial de 500 não entram. A propaganda é 4500/5500 = 82% do gasto
    assert {l["despesas_centavos"] for l in linhas if l["cargo"] == "Vereador"} == {550000}
    assert {l["despesas_centavos"] for l in linhas if l["cargo"] == "Prefeito"} == {500000}
    assert sum(ver[g]["soma_centavos"] for g in ver) == 450000


def test_pecas_do_recorte_em_preparacao_e_prontas(client):
    from app import pecas_geral

    pecas_geral.reiniciar()
    r = client.get("/api/propaganda/pecas?ano=2020&cargo=Vereador")
    assert r.status_code == 202 and r.json() == {"estado": "preparando"} and "cache-control" not in r.headers
    pecas_geral.preparar()
    todos = client.get("/api/propaganda/pecas?ano=2020&cargo=Vereador").json()
    mg = client.get("/api/propaganda/pecas?ano=2020&cargo=Vereador&uf=mg").json()
    assert todos == mg and {p["termo"] for p in todos} == {"santinho", "adesivo", "redes"}   # só peças, nunca a descrição
    assert sum(p["centavos"] for p in todos) == 450000                              # a parcial de 500 não entra
    assert "Impressão" not in str(todos)
    assert client.get("/api/propaganda/pecas?ano=2020&cargo=Vereador&uf=RJ").json() == []
    assert {p["termo"] for p in client.get("/api/propaganda/pecas?ano=2020&cargo=Prefeito&uf=PE").json()} == {"anúncios", "santinho", "adesivo"}
    pecas_geral.reiniciar()


def test_pecas_calcular_uf_e_todos_os_estados_presidente_so_sem_uf():
    from app.pecas_geral import calcular

    linha = lambda ano, cargo, uf, d, c: {"ano": ano, "cargo": cargo, "uf": uf, "descricao": d, "origem": None,
                                          "grupo": "propaganda_fisica", "despesas": 1, "centavos": c}
    r = calcular([linha(2022, "Deputado federal", "MG", "ADESIVO", 100), linha(2022, "Deputado federal", "RJ", "ADESIVO", 50),
                  linha(2022, "Deputado federal", "RJ", "SANTINHOS", 30), linha(2022, "Presidente", "BR", "SANTINHOS", 7)])
    assert set(r) == {(2022, "Deputado federal", None), (2022, "Deputado federal", "MG"), (2022, "Deputado federal", "RJ"), (2022, "Presidente", None)}
    assert [(p["termo"], p["centavos"]) for p in r[(2022, "Deputado federal", None)]] == [("adesivo", 150), ("santinho", 30)]
    assert [(p["termo"], p["centavos"]) for p in r[(2022, "Presidente", None)]] == [("santinho", 7)]


def test_propaganda_candidatura_sem_despesa(client):
    p = client.get("/api/candidaturas/1/propaganda").json()
    assert (p["lancamentos"], p["total_centavos"], p["propaganda_centavos"], p["categorias"], p["termos"]) == (0, 0, 0, [], [])


def test_palavras_sem_palavras_vazias(client):
    termos = {p["termo"]: p["freq"] for p in client.get("/api/candidaturas/2/palavras").json()}
    assert termos["santinhos"] == 1 and termos["impulsionamento"] == 1
    assert "para" not in termos and "campanha" not in termos and "advocaticios" not in termos


def test_receitas_publica_x_privada_com_repasses(client):
    r = client.get("/api/candidaturas/2/receitas").json()
    assert (r["publica"], r["privada"], r["total"]) == (4000, 1800, 5800)      # o repasse de 300 entra, pela fonte de origem
    assert round(r["pct_publica"], 3) == 0.69
    fontes = {k: r[k] for k in ("fundo_eleitoral", "fundo_partidario", "doacoes_pessoas", "recursos_proprios", "outros_privados")}
    assert fontes == {"fundo_eleitoral": 4000, "fundo_partidario": 0, "doacoes_pessoas": 1000, "recursos_proprios": 500, "outros_privados": 300}


def test_receitas_candidatura_sem_receita(client):
    r = client.get("/api/candidaturas/1/receitas").json()
    assert r["total"] == 0 and r["pct_publica"] is None and r["fundo_eleitoral"] == 0


@pytest.fixture()
def client_disputa(banco, banco_fotos, tmp_path, monkeypatch):
    """O banco de teste com uma disputa para prefeito em Serra Azul (MG), 2020: eleito com 80% público, um só com dinheiro
    privado, um sem receita, um que não disputou; e um candidato da eleição suplementar (fica de fora)."""
    import shutil

    import duckdb
    from app import db

    caminho = tmp_path / "disputa.duckdb"
    shutil.copy(banco, caminho)
    con = duckdb.connect(str(caminho))
    con.execute("""
        INSERT INTO candidatura (id_candidatura, ano, ue, sequencial, id_eleicao, id_candidato, id_partido, id_municipio, uf, nome_urna, numero_urna, idade_eleicao, id_rotulo_final, disputou) VALUES
          (20, 2020, '44444', 'S20', 5, NULL, 1, 4, 'MG', 'PREFEITA A', '40', 50, 1, true),
          (21, 2020, '44444', 'S21', 5, NULL, 2, 4, 'MG', 'PREFEITO B', '55', 50, 5, true),
          (22, 2020, '44444', 'S22', 5, NULL, 3, 4, 'MG', 'PREFEITO C', '13', 50, 5, true),
          (23, 2020, '44444', 'S23', 5, NULL, 4, 4, 'MG', 'PREFEITO D', '22', 50, 11, false),
          (24, 2020, '44444', 'S24', 9, NULL, 4, 4, 'MG', 'PREFEITO E', '22', 50, 1, true);
        INSERT INTO receita_campanha (id_receita, id_candidatura, id_fonte_recurso, origem_receita, valor_receita, repasse_entre_candidatos, tipo_prestacao_contas) VALUES
          (20, 20, 1, 'Recursos de partido político', 600, false, 'FINAL'), (21, 20, 1, 'Recursos de outros candidatos', 200, true, 'FINAL'),
          (22, 20, 2, 'Recursos de pessoas físicas', 200, false, 'FINAL'), (23, 21, 2, 'Recursos de pessoas físicas', 1000, false, 'FINAL'),
          (24, 21, 1, 'Recursos de partido político', 900, false, 'PARCIAL'), (25, 24, 1, 'Recursos de partido político', 100, false, 'FINAL');
    """)
    con.close()
    monkeypatch.setenv("DATABASE", str(caminho))
    monkeypatch.setenv("FOTOS_DATABASE", banco_fotos)
    monkeypatch.delenv("MOTHERDUCK_TOKEN", raising=False)
    monkeypatch.setenv("PECAS_AO_SUBIR", "false")   # o pré-cálculo das peças roda nos testes que o pedem
    db.reiniciar()
    from app.main import app

    with TestClient(app) as c:
        yield c
    db.reiniciar()


def test_disputa_prefeito_com_percentual_publico(client_disputa):
    linhas = client_disputa.get("/api/candidaturas/21/disputa").json()
    assert linhas == [
        {"id_candidatura": 20, "nome_urna": "PREFEITA A", "eleito": True, "pct_publica": 0.8},   # o repasse público conta
        {"id_candidatura": 21, "nome_urna": "PREFEITO B", "eleito": False, "pct_publica": 0.0},  # a parcial não entra
        {"id_candidatura": 22, "nome_urna": "PREFEITO C", "eleito": False, "pct_publica": None},
    ]   # sem quem não disputou (23) e sem a eleição suplementar (24)
    assert {k for l in linhas for k in l} == {"id_candidatura", "nome_urna", "eleito", "pct_publica"}


def test_disputa_vazia_nos_cargos_proporcionais_e_404(client):
    assert client.get("/api/candidaturas/2/disputa").json() == []      # vereador: a comparação é pela mediana
    assert client.get("/api/candidaturas/5/disputa").json() == [        # prefeito sozinho na disputa
        {"id_candidatura": 5, "nome_urna": "JOÃO DO COMERCIO", "eleito": True, "pct_publica": 0.0}]
    assert client.get("/api/candidaturas/9999/disputa").status_code == 404


def test_candidatura_inexistente(client):
    for rota in ("despesas", "propaganda", "palavras", "receitas"):
        assert client.get(f"/api/candidaturas/9999/{rota}").status_code == 404


def test_analises_listadas_a_partir_dos_arquivos_sql(client):
    assert client.get("/api/analises").json() == ["municipios", "q1", "q10", "q2", "q5", "q8", "q9"]


def test_analise_devolve_cada_copy_como_tabela(client):
    r = client.get("/api/analises/q5")
    assert r.status_code == 200 and set(r.json()) == {"legenda", "eventos", "linhagem"}
    legenda = r.json()["legenda"]
    assert "partido" in legenda["colunas"] and len(legenda["linhas"]) > 0
    assert all(len(l) == len(legenda["colunas"]) for l in legenda["linhas"])
    assert "max-age" in r.headers["cache-control"]


def test_analise_so_as_tabelas_pedidas(client):
    r = client.get("/api/analises/q10?tabela=fluxo&tabela=mapa")
    assert r.status_code == 200 and set(r.json()) == {"fluxo", "mapa"}
    assert "politicos" not in client.get("/api/analises/q10").json()


def test_analise_ou_tabela_inexistente(client):
    assert client.get("/api/analises/q99").status_code == 404
    assert client.get("/api/analises/q8?tabela=nao_existe").status_code == 404


def test_eleitos_do_municipio_so_ordinaria(client):
    r = client.get("/api/municipios/2/eleitos?ano=2020")
    assert r.status_code == 200
    eleitos = r.json()
    # João foi eleito prefeito na ordinária de 2020; a suplementar de 2021 (candidatura 9) não entra
    assert [(e["cargo"], e["nome_urna"], e["id_candidatura"]) for e in eleitos] == [("Prefeito", "JOÃO DO COMERCIO", 5)]
    assert eleitos[0]["votos"] == 11000 and eleitos[0]["partido"] == "PT"
    assert client.get("/api/municipios/2/eleitos?ano=2024").json() == []
    assert client.get("/api/municipios/2/eleitos").status_code == 422   # o ano é obrigatório


def test_candidatos_do_municipio(client):
    todos = client.get("/api/municipios/2/candidatos?ano=2020&cargo=Prefeito").json()
    # só a ordinária (a suplementar de 2021 não entra); resultado e prestação de contas vêm junto
    assert [(c["nome_urna"], c["eleito"], c["resultado"], c["prestou"], c["votos"]) for c in todos] == [("JOÃO DO COMERCIO", True, "ELEITO", True, 11000)]
    assert client.get("/api/municipios/2/candidatos?ano=2020&cargo=Vereador").json() == []
    assert "cpf" not in todos[0] and "titulo_eleitoral" not in todos[0]
    assert client.get("/api/municipios/2/candidatos?ano=2020&cargo=Governador").status_code == 422   # só prefeito e vereador


def test_eleitos_do_estado(client):
    eleitos = client.get("/api/estados/rj/eleitos?ano=2022").json()
    assert [(e["cargo"], e["nome_urna"], e["votos"]) for e in eleitos] == [("Deputado federal", "ANA ADVOGADA", 120000)]
    assert client.get("/api/estados/MG/eleitos?ano=2022").json() == []   # Maria disputou e não se elegeu


def test_analise_municipios(client):
    dados = client.get("/api/analises/municipios").json()
    assert set(dados) == {"municipios", "resumo", "estados"}
    resumo = [dict(zip(dados["resumo"]["colunas"], l)) for l in dados["resumo"]["linhas"]]
    # Alvorada (MG) 2020: Maria eleita vereadora; gasto sem a transferência de 700 nem a prestação parcial
    alvorada = next(r for r in resumo if r["id_municipio"] == 1 and r["ano"] == 2020)
    assert alvorada["vereador_eleitos"] == 1 and alvorada["vereador_gasto"] == 5500
    estados = [dict(zip(dados["estados"]["colunas"], l)) for l in dados["estados"]["linhas"]]
    assert any(e["uf"] == "RJ" and e["cargo"] == "Deputado federal" and e["ano"] == 2022 and e["eleitos"] == 1 for e in estados)
    # porte e cobertura: toda linha do resumo traz o eleitorado e, se a disputa para prefeito ficou de fora, o motivo
    assert {"eleitorado", "maior_excluida"} <= set(dados["resumo"]["colunas"])
    assert alvorada["eleitorado"] is None   # sem participação eleitoral na massa de teste: fica nulo, não zero
    # a única disputa para prefeito de PE em 2020 tem um candidato: sai da comparação e é contada pelo motivo
    pe = next(e for e in estados if e["cargo"] == "Prefeito" and e["uf"] == "PE" and e["ano"] == 2020)
    assert (pe["disputas_maior"], pe["maior_venceu"], pe["excl_um_candidato"], pe["excl_sem_prestacao"], pe["excl_empate"]) == (0, 0, 1, 0, 0)


def test_cabecalho_de_cache_nos_dados_historicos(client):
    assert "max-age" in client.get("/api/meta").headers["cache-control"]
    assert "cache-control" not in client.get("/api/health").headers


def test_privacidade_nenhuma_resposta_expoe_dado_sensivel(client):
    """Título eleitoral, data de nascimento e CPF nunca podem sair pela API."""
    rotas = ["/api/meta", "/api/busca?q=maria", "/api/candidaturas?ano=2022", "/api/candidatos/1", "/api/candidatos/2",
             "/api/candidaturas/2/despesas", "/api/candidaturas/2/propaganda", "/api/candidaturas/2/palavras", "/api/candidaturas/2/receitas", "/api/candidaturas/5/disputa", "/openapi.json",
             "/api/analises/q1", "/api/analises/q2", "/api/analises/q5", "/api/analises/q8", "/api/analises/q9", "/api/analises/q10",
             "/api/analises/municipios", "/api/municipios/2/eleitos?ano=2020", "/api/estados/RJ/eleitos?ano=2022",
             "/api/municipios/2/candidatos?ano=2020&cargo=Prefeito"]
    proibidos = ["000111222333", "000444555666", "000777888999", "1980-05-10", "1971-02-20", "titulo", "cpf", "dt_nascimento"]
    for rota in rotas:
        texto = json.dumps(client.get(rota).json(), ensure_ascii=False).lower()
        for p in proibidos:
            assert p not in texto, f"{rota} expõe '{p}'"


def test_foto_miniatura_e_ficha(client):
    from tests.conftest import JPEG, WEBP

    r = client.get("/api/fotos/2022/MG/S3")   # mini é o padrão
    assert r.status_code == 200 and r.content == WEBP and r.headers["content-type"] == "image/webp"
    assert "immutable" in r.headers["cache-control"]   # o middleware não troca pelo cache de 1 hora
    r = client.get("/api/fotos/2022/MG/S3?tam=ficha")
    assert r.status_code == 200 and r.content == JPEG and r.headers["content-type"] == "image/jpeg"


def test_foto_ficha_sem_original_devolve_miniatura(client):
    from tests.conftest import WEBP

    r = client.get("/api/fotos/2022/RJ/S7?tam=ficha")
    assert r.status_code == 200 and r.content == WEBP


def test_foto_ausente_e_invalida(client):
    r = client.get("/api/fotos/2016/11111/S1")
    assert r.status_code == 404 and r.headers["cache-control"] == "public, max-age=86400"
    assert client.get("/api/fotos/2022/mg/S3").status_code == 422             # ue só em maiúsculas
    assert client.get("/api/fotos/2022/MG/S3?tam=grande").status_code == 422


def test_foto_da_pessoa_e_a_mais_recente(client):
    from tests.conftest import JPEG, WEBP

    r = client.get("/api/candidatos/3/foto")              # Ana: 2018 sem foto, 2022 com a miniatura
    assert r.status_code == 200 and r.content == WEBP
    assert client.get("/api/candidatos/1/foto?tam=ficha").content == JPEG   # Maria: a de 2022
    r = client.get("/api/candidatos/2/foto")              # João: só candidaturas antes de 2018
    assert r.status_code == 404 and r.headers["cache-control"] == "public, max-age=86400"
    assert client.get("/api/candidatos/999/foto").status_code == 404


def test_fotos_fallback_local_quando_motherduck_falha(monkeypatch, banco, banco_fotos):
    from fastapi.testclient import TestClient
    from app import db

    monkeypatch.setenv("DATABASE", banco)
    monkeypatch.setenv("FOTOS_DATABASE", "md:bdr_fotos")
    monkeypatch.setenv("MOTHERDUCK_TOKEN", "")
    monkeypatch.setenv("FOTOS_DATABASE_LOCAL", banco_fotos)
    db.reiniciar()
    from app.main import app

    assert TestClient(app).get("/api/fotos/2022/MG/S3").status_code == 200
    db.reiniciar()


def test_sem_banco_de_fotos_o_resto_funciona(monkeypatch, banco, tmp_path):
    from fastapi.testclient import TestClient
    from app import db

    monkeypatch.setenv("DATABASE", banco)
    monkeypatch.setenv("FOTOS_DATABASE", str(tmp_path / "nao_existe.duckdb"))
    db.reiniciar()
    from app.main import app

    c = TestClient(app)
    assert c.get("/api/fotos/2022/MG/S3").status_code == 503
    assert c.get("/api/health").json() == {"status": "ok", "db": "ok"}
    db.reiniciar()


def test_chave_da_foto_nas_listas(client):
    item = client.get("/api/candidaturas?ano=2022&uf=MG").json()["itens"][0]
    assert (item["ano"], item["ue"], item["sequencial"]) == (2022, "MG", "S3")
    car = client.get("/api/candidatos/1").json()["carreira"]
    assert [(c["ue"], c["sequencial"]) for c in car][-1] == ("MG", "S3")
    b = client.get("/api/busca?q=maria da silva").json()[0]
    assert (b["ultimo_ano"], b["ultimo_ue"], b["ultimo_sequencial"]) == (2022, "MG", "S3")


def test_mapa_do_candidato(client):
    c = client.get("/api/candidatos/1/mapa").json()
    assert [x["id_candidatura"] for x in c] == [3, 2, 1]                  # da mais recente para a mais antiga
    assert [(x["disputas"], x["mandatos"]) for x in c] == [(3, 2), (2, 2), (1, 1)]
    dep = c[0]
    assert (dep["cargo"], dep["uf"], dep["numero"], dep["votos_total"], dep["resultado"]) == ("Deputado estadual", "MG", "55123", 30000, "NAO_ELEITO")
    assert (dep["ue"], dep["sequencial"], dep["gasto_total"]) == ("MG", "S3", None)
    ver = c[1]                                                         # 2020: despesas sem a transferência e sem a parcial
    assert ver["gasto_total"] == 5500 and ver["mediana_gasto_cargo"] == 5500
    assert abs(ver["parte_publica"] - 4000 / 5500) < 1e-9             # sem o repasse entre candidatos
    assert client.get("/api/candidatos/999/mapa").status_code == 404


def test_votos_por_municipio(client):
    v = client.get("/api/candidaturas/3/votos-municipio").json()
    # Alvorada: Maria 30000 + rival 3000 nominais + 70 de legenda; Serra Azul: só o rival votado, ela com 0
    assert [(x["id_municipio"], x["votos"], x["validos_cargo"], x["posicao"]) for x in v] == [(1, 30000, 33070, 1), (4, 0, 2000, 2)]
    assert {x["turno"] for x in v} == {1} and {x["uf"] for x in v} == {"MG"}
    r = client.get("/api/candidaturas/10/votos-municipio").json()
    assert [(x["id_municipio"], x["votos"], x["posicao"]) for x in r] == [(1, 3000, 2), (4, 2000, 1)]
    assert client.get("/api/candidaturas/999/votos-municipio").status_code == 404

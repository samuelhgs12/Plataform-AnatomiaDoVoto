import json


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
    assert [i["nome_urna"] for i in r["itens"]] == ["ANA ADVOGADA", "MARIA DA SILVA"]     # por votos
    r = client.get("/api/candidaturas", params={"ano": 2022, "ordem": "nome"}).json()
    assert [i["nome_urna"] for i in r["itens"]] == ["ANA ADVOGADA", "MARIA DA SILVA"]
    r = client.get("/api/candidaturas", params={"ano": 2022, "eleito": True}).json()
    assert r["total"] == 1 and r["itens"][0]["eleito"] is True
    r = client.get("/api/candidaturas", params={"ano": 2022, "tamanho": 1, "pagina": 2}).json()
    assert r["total"] == 2 and len(r["itens"]) == 1 and r["itens"][0]["nome_urna"] == "MARIA DA SILVA"
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


def test_propaganda_candidatura_sem_despesa(client):
    p = client.get("/api/candidaturas/1/propaganda").json()
    assert (p["lancamentos"], p["total_centavos"], p["propaganda_centavos"], p["categorias"]) == (0, 0, 0, [])


def test_palavras_sem_palavras_vazias(client):
    termos = {p["termo"]: p["freq"] for p in client.get("/api/candidaturas/2/palavras").json()}
    assert termos["santinhos"] == 1 and termos["impulsionamento"] == 1
    assert "para" not in termos and "campanha" not in termos and "advocaticios" not in termos


def test_receitas_publica_x_privada_sem_repasses(client):
    r = client.get("/api/candidaturas/2/receitas").json()
    assert (r["publica"], r["privada"], r["total"]) == (4000, 1500, 5500)      # o repasse de 300 não entra
    assert round(r["pct_publica"], 3) == 0.727
    fontes = {k: r[k] for k in ("fundo_eleitoral", "fundo_partidario", "doacoes_pessoas", "recursos_proprios", "outros_privados")}
    assert fontes == {"fundo_eleitoral": 4000, "fundo_partidario": 0, "doacoes_pessoas": 1000, "recursos_proprios": 500, "outros_privados": 0}


def test_receitas_candidatura_sem_receita(client):
    r = client.get("/api/candidaturas/1/receitas").json()
    assert r["total"] == 0 and r["pct_publica"] is None and r["fundo_eleitoral"] == 0


def test_candidatura_inexistente(client):
    for rota in ("despesas", "propaganda", "palavras", "receitas"):
        assert client.get(f"/api/candidaturas/9999/{rota}").status_code == 404


def test_analises_listadas_a_partir_dos_arquivos_sql(client):
    assert client.get("/api/analises").json() == ["q1", "q10", "q2", "q5", "q8"]


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


def test_cabecalho_de_cache_nos_dados_historicos(client):
    assert "max-age" in client.get("/api/meta").headers["cache-control"]
    assert "cache-control" not in client.get("/api/health").headers


def test_privacidade_nenhuma_resposta_expoe_dado_sensivel(client):
    """Título eleitoral, data de nascimento e CPF nunca podem sair pela API."""
    rotas = ["/api/meta", "/api/busca?q=maria", "/api/candidaturas?ano=2022", "/api/candidatos/1", "/api/candidatos/2",
             "/api/candidaturas/2/despesas", "/api/candidaturas/2/propaganda", "/api/candidaturas/2/palavras", "/api/candidaturas/2/receitas", "/openapi.json",
             "/api/analises/q1", "/api/analises/q2", "/api/analises/q5", "/api/analises/q8", "/api/analises/q10"]
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

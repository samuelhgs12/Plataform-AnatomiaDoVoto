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


def test_perfil_carreira_resumo_e_trocas(client):
    p = client.get("/api/candidatos/1").json()
    assert p["candidato"]["nome_civil"] == "MARIA DA SILVA SANTOS"
    assert [(c["ano"], c["cargo"], c["eleito"], c["partido"]) for c in p["carreira"]] == [
        (2016, "Vereador", True, "PSB"), (2020, "Vereador", True, "PSB"), (2022, "Deputado estadual", False, "PSD")]
    assert p["carreira"][0]["nivel"] == 1 and p["carreira"][2]["nivel"] == 3
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


def test_palavras_sem_palavras_vazias(client):
    termos = {p["termo"]: p["freq"] for p in client.get("/api/candidaturas/2/palavras").json()}
    assert termos["santinhos"] == 1 and termos["impulsionamento"] == 1
    assert "para" not in termos and "campanha" not in termos and "advocaticios" not in termos


def test_receitas_publica_x_privada_sem_repasses(client):
    r = client.get("/api/candidaturas/2/receitas").json()
    assert (r["publica"], r["privada"], r["total"]) == (4000, 1500, 5500)      # o repasse de 300 não entra
    assert round(r["pct_publica"], 3) == 0.727


def test_candidatura_inexistente(client):
    for rota in ("despesas", "palavras", "receitas"):
        assert client.get(f"/api/candidaturas/9999/{rota}").status_code == 404


def test_cabecalho_de_cache_nos_dados_historicos(client):
    assert "max-age" in client.get("/api/meta").headers["cache-control"]
    assert "cache-control" not in client.get("/api/health").headers


def test_privacidade_nenhuma_resposta_expoe_dado_sensivel(client):
    """Título eleitoral, data de nascimento e CPF nunca podem sair pela API."""
    rotas = ["/api/meta", "/api/busca?q=maria", "/api/candidaturas?ano=2022", "/api/candidatos/1", "/api/candidatos/2",
             "/api/candidaturas/2/despesas", "/api/candidaturas/2/palavras", "/api/candidaturas/2/receitas", "/openapi.json"]
    proibidos = ["000111222333", "000444555666", "000777888999", "1980-05-10", "1971-02-20", "titulo", "cpf", "dt_nascimento"]
    for rota in rotas:
        texto = json.dumps(client.get(rota).json(), ensure_ascii=False).lower()
        for p in proibidos:
            assert p not in texto, f"{rota} expõe '{p}'"

import shutil

import duckdb
from fastapi.testclient import TestClient


def test_despesas_originais_e_mesmas_regras_do_total(client):
    r = client.get("/api/dinheiro/candidaturas/2/despesas")
    assert r.status_code == 200
    d = r.json()
    assert d["prestou"] is True
    assert d["total"] == 5500 and d["propaganda"] == 4500
    assert [(c["categoria"], c["valor"]) for c in d["categorias"]] == [
        ("Publicidade por materiais impressos", 3000),
        ("Publicidade por mídia digital", 1500),
        ("Serviços advocatícios", 1000),
    ]
    assert abs(sum(c["pct"] for c in d["categorias"]) - 1) < 1e-10
    # Exclui a prestação parcial e o repasse, como o gasto total da campanha.
    assert d["total"] == client.get("/api/candidaturas/2/despesas").json()["total"]


def test_sem_contas_nao_vira_zero_e_candidatura_inexistente(client):
    d = client.get("/api/dinheiro/candidaturas/7/despesas").json()
    assert d == {"id_candidatura": 7, "prestou": False, "total": None, "propaganda": None, "categorias": []}
    assert client.get("/api/dinheiro/candidaturas/999999/despesas").status_code == 404


def test_comicios_passagens_sem_categoria_e_zero_declarado(banco, banco_fotos, tmp_path, monkeypatch):
    from app import db

    caminho = tmp_path / "detalhes.duckdb"
    shutil.copyfile(banco, caminho)
    with duckdb.connect(str(caminho)) as con:
        con.execute("""INSERT INTO categoria_despesa VALUES
            (5, 'Comícios', 'mobilizacao', false, false),
            (6, 'Passagens aéreas', 'outros', false, false)""")
        con.execute("""INSERT INTO despesa_campanha
            (id_despesa, id_candidatura, id_categoria_despesa, valor_despesa, tipo_prestacao_contas) VALUES
            (100, 2, 5, 200, 'FINAL'), (101, 2, 6, 150, 'REGULARIZACAO_OMISSAO'),
            (102, 2, NULL, 50, 'FINAL'), (103, 8, 1, 0, 'FINAL')""")
    monkeypatch.setenv("DATABASE", str(caminho))
    monkeypatch.setenv("FOTOS_DATABASE", banco_fotos)
    monkeypatch.setenv("PECAS_AO_SUBIR", "false")
    db.reiniciar()
    from app.main import app

    try:
        with TestClient(app) as c:
            d = c.get("/api/dinheiro/candidaturas/2/despesas").json()
            cats = {x["categoria"]: x["valor"] for x in d["categorias"]}
            assert cats["Comícios"] == 200 and cats["Passagens aéreas"] == 150
            assert cats["Sem categoria informada"] == 50
            assert d["total"] == 5900 and d["propaganda"] == 4500
            zero = c.get("/api/dinheiro/candidaturas/8/despesas").json()
            assert zero["prestou"] is True and zero["total"] == 0
            assert zero["categorias"][0]["pct"] == 0
    finally:
        db.reiniciar()


def test_busca_de_candidato_no_recorte_do_dinheiro(client):
    base = "/api/dinheiro/candidatos?ano=2022&cargo=Deputado%20estadual&uf=mg"
    # nome de urna, sem acento e em minúsculas; só o recorte (Ana é do RJ, Maria Professora é de 2020)
    achados = client.get(base + "&q=ze%20da").json()
    assert [a["nome_urna"] for a in achados] == ["ZÉ DA SERRA"]
    # o nome civil também casa, mas só o nome de urna sai (nada de documento ou data de nascimento)
    maria = client.get(base + "&q=Santos").json()
    assert [m["id_candidatura"] for m in maria] == [3]
    assert {"titulo_eleitoral", "dt_nascimento", "nome_civil"}.isdisjoint(maria[0])
    assert maria[0]["votos"] == 30000 and maria[0]["eleito"] is False
    # o texto começa numa palavra: "aria" não acha "Maria"; outro estado não acha nada
    assert client.get(base + "&q=aria").json() == []
    assert client.get("/api/dinheiro/candidatos?ano=2022&cargo=Deputado%20estadual&uf=RJ&q=maria").json() == []
    # nas municipais, a cidade restringe
    vereadora = client.get("/api/dinheiro/candidatos?ano=2020&cargo=Vereador&uf=MG&mun=1&q=maria").json()
    assert [x["id_candidatura"] for x in vereadora] == [2] and vereadora[0]["municipio"] == "Alvorada"
    assert maria[0]["municipio"] is None
    assert client.get("/api/dinheiro/candidatos?ano=2020&cargo=Vereador&uf=MG&mun=4&q=maria").json() == []
    assert client.get(base + "&q=a").status_code == 422

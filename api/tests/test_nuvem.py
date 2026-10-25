"""Dicionário da nuvem de palavras da pergunta 9 (app/nuvem.py). Casos tirados das descrições reais de 2018 a 2024."""
from app.nuvem import PECA, nuvem, pecas, termos


def so(descricao, origem=None):
    return termos(descricao, origem)[0]


def test_variantes_erros_e_abreviacoes_viram_o_mesmo_formato():
    for d in ("SANTINHOS 7X10", "Satinhos", "1 LOTE DE 10 MIL SANTINHOS", "propaganda eleitoral 10x7"):
        assert so(d) == ["santinho"], d
    for d in ("IMPULCIONAMENTO DE CONTEUDO", "impusionamento", "TRAFEGO PAGO"):
        assert so(d) == ["impulsionamento"], d
    assert so("ADES PARACH. LULA/ALCKMIN 30X10") == ["adesivo para-choque"]
    assert so("PANF LULA/ALCKMIN 5X20 04X04 COUCHE") == ["panfleto"]
    assert so("CEDULA 6·8X9·5 LULA/ALCKMIN") == ["colinha"]
    assert so("SEETRHU 80X40") == ["adesivo perfurado"]
    assert so("BOTTONS 9X9") == ["bóton"]
    assert so("CARRO DE SOM PARA MINI CARREATA") == ["carro de som"]


def test_o_especifico_exclui_o_generico_da_mesma_familia():
    assert so("ADESIVO PERFURADO 80X40") == ["adesivo perfurado"]
    assert so("ADESIVO PRAGUINHA 8X8 LULA COM FOTO") == ["praguinha"]
    assert so("CARTÃO COLINHA 9X5") == ["colinha"]
    assert so("VÍDEO DE PROGRAMA ELEITORAL PARA TV") == ["rádio e TV"]


def test_plataforma_substitui_impulsionamento_e_genericos_so_sem_mais_nada():
    assert so("IMPULSIONAMENTO FACEBOOK") == ["Facebook"]
    assert so("IMPULSIONAMENTO INSTAGRAM/FACEBOOK") == ["Instagram"]      # a primeira plataforma da lista
    assert so("PROPAGANDA E PUBLICIDADE GOOGLE ADS") == ["Google e YouTube"]
    assert so("SERV DE MARKETING E ESTRATEG DE COMUNIC· RADIO/TV") == ["rádio e TV"]
    assert so("SERVIÇOS DE MARKETING") == ["marketing e criação"]
    assert so("LONA 3X1,30") == ["lona"]
    assert so("BANDEIRA EM LONA 100X150") == ["bandeira"]


def test_falsos_positivos_conhecidos_nao_casam():
    assert so("SERVIÇOS DE PANFLETAGEM") == []                   # mão de obra, não a peça
    assert so("BANDEIRA PLASTICA LULA C/FOTO 60X40CM") == ["bandeira"]   # "com foto" não é fotografia
    assert so("FOLDER COM 4 PÁGINAS") == ["panfleto"]            # "páginas" do folder não é site
    assert so("PRESTAÇÃO DE SERVIÇOS DE CINEMATOGRÁFICA") == ["vídeo"]   # não é "gráfica"
    assert so("MARIA DA SILVA") == []                            # nome de pessoa nunca vira termo


def test_reserva_pela_categoria_do_tse():
    assert termos("PROPAGANDA E PUBLICIDADE", "Publicidade por jornais e revistas") == (["jornal e revista"], True)
    assert termos("SANTINHOS", "Publicidade por jornais e revistas") == (["santinho"], False)
    assert termos("PROPAGANDA E PUBLICIDADE", "Categoria nova") == ([], False)
    assert termos(None, "Publicidade por adesivos") == (["adesivo"], True)


def test_formatos_viram_pecas_de_uma_palavra():
    assert pecas("ADESIVO PERFURADO 80X40") == [("adesivo", "adesivo perfurado")]
    assert pecas("PRAGUINHAS 7X7") == [("adesivo", "praguinha")]
    assert pecas("CARTÃO COLINHA 9X5") == [("santinho", "colinha")]
    assert pecas("IMPULSIONAMENTO INSTAGRAM") == [("Facebook", "Instagram")]
    assert pecas("IMPULSIONAMENTO DE CONTEUDO") == [("anúncios", "impulsionamento")]
    assert pecas("PROPAGANDA E PUBLICIDADE", "Publicidade por adesivos") == [("adesivo", "sem detalhe")]
    assert pecas("SANTINHOS E ADESIVOS") == [("santinho", "santinho"), ("adesivo", "adesivo")]
    # toda peça é uma palavra curta (a nuvem não comporta rótulos longos); "rádio/TV" é a única com barra
    assert all(len(p) <= 9 and " " not in p for p in PECA.values())


def test_nuvem_soma_por_peca_divide_o_valor_e_guarda_os_formatos():
    linha = lambda d, c, n=1, g="propaganda_fisica", o="Publicidade por materiais impressos": \
        {"descricao": d, "origem": o, "grupo": g, "despesas": n, "centavos": c}
    itens = nuvem([
        linha("SANTINHOS E ADESIVOS", 1001),            # 1001 / 2: o centavo que sobra vai para a primeira peça
        linha("santinho 7x10", 500, n=3),
        linha("COLINHA 5X9", 300),
        linha("ADESIVO PERFURADO", 900, o="Publicidade por adesivos"),
        linha("material de campanha", 200),             # descrição vaga: peça pela categoria
        linha("IMPULSIONAMENTO FACEBOOK", 700, g="propaganda_digital", o="Despesa com Impulsionamento de Conteúdos"),
        linha("MARIA DA SILVA", 99, o="Categoria nova"),  # sem termo nem categoria conhecida: fica de fora
    ])
    por = {i["termo"]: i for i in itens}
    assert [i["termo"] for i in itens] == ["adesivo", "santinho", "Facebook", "impressos"]     # 1400, 1301, 700, 200
    assert (por["santinho"]["centavos"], por["santinho"]["despesas"]) == (1301, 5)
    assert por["santinho"]["detalhes"] == [{"termo": "santinho", "centavos": 1001}, {"termo": "colinha", "centavos": 300}]
    assert por["adesivo"]["detalhes"] == [{"termo": "adesivo perfurado", "centavos": 900}, {"termo": "adesivo", "centavos": 500}]
    assert por["impressos"]["generico"] and por["impressos"]["pela_categoria_centavos"] == 200
    assert por["impressos"]["detalhes"] == [{"termo": "sem detalhe", "centavos": 200}]
    assert por["Facebook"]["grupo"] == "propaganda_digital" and por["Facebook"]["explicacao"].startswith("Facebook, Instagram")
    assert not por["santinho"]["generico"] and por["adesivo"]["explicacao"] is None

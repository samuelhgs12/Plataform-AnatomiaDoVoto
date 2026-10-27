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


def test_propaganda_com_numero_so_vira_santinho_com_tamanho_ou_quantidade():
    assert pecas("CARRO E SOM PARA PROPAGANDA POLITICA 2020") == [("som", "carro de som")]    # o ano não é tamanho
    for d in ("PROPAGANDA ELEITORAL 7X10", "PROPAGANDA ELEITORAL 10 X 15", "PROPAGANDA ELEITORAL 5000 UN",
              "PROPAGANDA ELEITORAL MIL UNIDADES", "PROPAGANDA ELEITORAL 10.000", "PROPAGANDA ELEITORAL 500"):
        assert so(d) == ["santinho"], d
    assert so("PROPAGANDA POLITICA 2022") == []                                               # sem a categoria: nada
    assert termos("PROPAGANDA POLITICA 2022", "Publicidade por materiais impressos") == (["impressos"], True)
    assert so("PROPAGANDA POLITICA 1998") == []
    assert so("PROPAGANDA ELEITORAL ADESIVO 7X10") == ["adesivo"]                             # o específico vem antes
    assert so("PROPAGANDA POLITICA 2022 IMPULSIONAMENTO") == ["impulsionamento"]


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


def test_anuncio_em_jornal_ou_revista_e_peca_jornal():
    jornais, impuls = "Publicidade por jornais e revistas", "Despesa com Impulsionamento de Conteúdos"
    assert pecas("VEICULAÇÃO DE ANUNCIO", jornais) == [("jornal", "anúncio")]          # pela categoria
    assert pecas("ANUNCIO 7·3X12·85CM EM 30/09/2022", jornais) == [("jornal", "anúncio")]
    assert pecas("PUBLICAÇÃO DE ANUNCIO NO JORNAL FOLHA", jornais) == [("jornal", "jornal e revista")]  # pela descrição
    assert pecas("PROPAGANDA E PUBLICIDADE", jornais) == [("jornal", "sem detalhe")]   # reserva pela categoria
    assert pecas("INSERÇÃO DE ANUNCIOS NA INTERNET", impuls) == [("anúncios", "anúncio")]
    assert pecas("IMPULSIONAMENTO DE CONTEUDO", impuls) == [("anúncios", "impulsionamento")]
    assert pecas("IMPULSIONAMENTO DE CONTEUDO") == [("anúncios", "impulsionamento")]


def test_por_tipo_soma_por_grupo_igual_ao_total_das_linhas():
    linha = lambda d, c, g, o: {"descricao": d, "origem": o, "grupo": g, "despesas": 1, "centavos": c}
    fis, av, dig = "propaganda_fisica", "propaganda_audiovisual", "propaganda_digital"
    linhas = [
        linha("SANTINHOS E ADESIVOS", 1001, fis, "Publicidade por materiais impressos"),
        linha("PRODUÇÃO DE VIDEOS PARA REDES SOCIAIS", 777, av, "Produção de programas de rádio, televisão ou vídeo"),
        linha("GESTÃO DE REDES SOCIAIS", 300, dig, "Despesa com Impulsionamento de Conteúdos"),
        linha("VEICULAÇÃO DE ANUNCIO", 250, fis, "Publicidade por jornais e revistas"),
        linha("propaganda e publicidade", 99, dig, "Criação e inclusão de páginas na internet"),
    ]
    itens = nuvem(linhas)
    soma = {}
    for i in itens:
        assert sum(p["centavos"] for p in i["por_tipo"]) == i["centavos"]
        for p in i["por_tipo"]:
            soma[p["grupo"]] = soma.get(p["grupo"], 0) + p["centavos"]
    assert soma == {fis: 1251, av: 777, dig: 399}
    # "vídeos para redes sociais" (777, audiovisual) divide entre vídeo (389) e redes (388): "redes" fica nos dois tipos,
    # com o valor de cada um, e o grupo dominante continua em "grupo"
    redes = next(i for i in itens if i["termo"] == "redes")
    assert redes["por_tipo"] == [{"grupo": av, "centavos": 388, "despesas": 1}, {"grupo": dig, "centavos": 300, "despesas": 1}]
    assert redes["grupo"] == av and redes["despesas"] == 2          # as despesas também separadas por tipo
    video = next(i for i in itens if i["termo"] == "vídeo")
    assert video["por_tipo"] == [{"grupo": av, "centavos": 389, "despesas": 1}]


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

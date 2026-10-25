"""Nuvem de palavras da pergunta 9: o que a campanha comprou em propaganda.

Duas camadas:
  * formato: a descrição da despesa vira um termo de um dicionário fechado ("ADESIVO PERFURADO 80X40" -> adesivo
    perfurado). Plural, erro de digitação e abreviação viram o mesmo termo, medidas e papel ("10x7 cm", "couche") não
    aparecem, e nome de pessoa nunca sai na resposta;
  * peça: os formatos da mesma peça se juntam num rótulo curto, de uma palavra (perfurado, para-choque e praguinha ->
    adesivo). É o rótulo que vai para a nuvem: assim uma peça comprada em vários formatos não se espalha em várias
    palavras pequenas, e o tamanho de cada palavra compara peças. Os formatos seguem em `detalhes` (dica e tabela).

Três passadas por descrição para achar o formato:
  1. termos específicos: dentro de uma família vale só o primeiro que casar (o específico vem antes do genérico);
  2. termos genéricos (impulsionamento, marketing, anúncio, lona, impressos): só se a passada 1 não achou nada;
  3. reserva pela categoria do TSE (origem_despesa): só se o texto não disse nada ("propaganda e publicidade").
A plataforma, quando dita, substitui "impulsionamento" ("impulsionamento facebook" -> Facebook).
Padrões sem lookahead/lookbehind, para poderem ir para o RE2 do DuckDB sem mudança.

Calibrado nas 1,1 milhão de despesas de propaganda de 2018 a 2024: o texto explica 95% das despesas e 91% do valor.
"""
import re

from .routers.util import sem_acento

# (família, formato, padrão sobre a descrição minúscula e sem acento)
ESPECIFICOS = [
    # impressos de mão
    ("mao", "santão", r"santao|santoes"),
    ("mao", "mosquitinho", r"mosquitinh"),
    ("mao", "colinha", r"colinh|colnh|cedula"),
    ("mao", "cartão de visita", r"cart(ao|oes) (de )?visitas?"),
    ("mao", "santinho", r"santinh|satinh|santnh|santihos|santinos|\bsant\b|propagandas? (eleitora|politic)\w* \d"),
    ("mao", "cartão", r"\bcart(ao|oes)\b"),
    # adesivos
    ("adesivo", "adesivo perfurado", r"perfur|pefurad|prefurad|citru|citro|cithru|sitru|setru|see ?th?ru|seetrhu"),
    ("adesivo", "adesivo para-choque", r"para ?-?choque|parachoq|parachok|parchoque|\bparach\b|\bp ?choque"),
    ("adesivo", "adesivo de porta", r"car ?door"),
    ("adesivo", "adesivo bola", r"adesivos? bola|\bbolas?\b|\bbolao\b"),
    ("adesivo", "pragão", r"pragao|pragoes|pragona"),
    ("adesivo", "praguinha", r"praguin|praquinh|preguinh|pragunh|praginh"),
    ("adesivo", "bóton", r"\bboton|\bbotom|\bbotton|\bbottom|bontons"),
    ("adesivo", "adesivo", r"adesiv|adeviso|adesico|adsivo|\bades\b|vinil (carro|moto)"),
    # outras peças físicas
    ("bandeira", "bandeira", r"bandeir|banderia|banceira"),
    ("folha", "panfleto", r"panfleto|planfleto|planfeto|pafleto|\bpanf\b|folheto|folder|flyer|filipeta|\bvolantes?\b|laminas?\b"),
    ("cartaz", "cartaz", r"cartaz|lamb[ei]? ?-?lamb"),
    ("carta", "carta", r"\bcartas?\b|mala direta"),
    ("jornal", "jornal e revista", r"jornal|jornais|informativo|tabloide|revista"),
    ("faixa", "banner", r"banner|\bbaner|backdrop"),
    ("faixa", "faixa e placa", r"\bfaixa|\bplac[ai]|\bplaquinh|outdoor|minidoor|cavalete|estandarte"),
    ("plano", "plano de governo", r"(planos?|programas?) de governo"),
    ("vestivel", "camiseta", r"camis"),
    ("vestivel", "mochila e pirulito", r"mochila|pirulito"),
    ("som", "carro de som", r"carros? (de )?som|minitrio|trio eletrico|paredao|som automotivo|bicicleta de som|moto ?som|"
                            r"sonoriza|som volante|volante de som|propaganda volante|carro volante"),
    # audiovisual
    ("jingle", "jingle", r"jingl|jungle|jigle|jimgle|jngle|vinheta|musica"),
    ("av", "rádio e TV", r"radio|televis|\btv\b|horario eleitoral|hgpe|programas? eleitora|insercoes|spots?\b|"
                         r"programas? (para|de) divulga|criacao (de )?programas"),
    ("av", "vídeo", r"video|filmag|filme|aud ?i?o? ?visua|gravac\w* de midia|estudio|captacao|cinematograf"),
    ("foto", "fotografia", r"fotograf"),
    # digital: a primeira plataforma citada (na ordem abaixo) é a da despesa
    ("plataforma", "WhatsApp", r"whatsapp"),
    ("plataforma", "Instagram", r"instagra|\binsta\b"),
    ("plataforma", "Facebook", r"faceb|facbook|\bmeta\b"),
    ("plataforma", "Google e YouTube", r"google|youtube"),
    ("redes", "redes sociais", r"redes? socia|midias? socia|social media"),
    ("site", "site", r"\bsite|website|dominio|hospedagem|paginas? (na|da|de) internet|pagina web"),
    ("mensagem", "SMS", r"mensagens? de texto|\bsms\b|disparo"),
]
GENERICOS = [
    ("impuls", "impulsionamento", r"impul|impusion|implusion|trafego pago"),
    ("marketing", "marketing e criação", r"marketing|agencia|designer|\bdesign\b|identidade visual|criacao de arte|"
                                        r"planejamento estrategico|estrategia de comunica|comunicacao|\bartes?\b"),
    ("anuncio", "anúncio", r"anuncio"),
    ("faixa", "lona", r"\blonas?\b"),
    ("impresso", "impressos", r"material (impresso|grafico)|materiais (impressos|graficos)|\bimpress|servicos? graficos|\bgrafica|"
                              r"material publicitario|material para uso publicitario"),
]
# quando a descrição não diz o que foi comprado, a peça sai da categoria do TSE
POR_CATEGORIA = {
    "Publicidade por materiais impressos": "impressos",
    "Publicidade por adesivos": "adesivo",
    "Publicidade por jornais e revistas": "jornal e revista",
    "Publicidade por carros de som": "carro de som",
    "Produção de programas de rádio, televisão ou vídeo": "rádio e TV",
    "Produção de jingles, vinhetas e slogans": "jingle",
    "Despesa com Impulsionamento de Conteúdos": "impulsionamento",
    "Criação e inclusão de páginas na internet": "site",
}
SEM_DETALHE = "sem detalhe"   # formato de quem veio pela categoria do TSE

# formato -> peça (rótulo da nuvem: uma palavra, no máximo 9 letras)
PECA = {
    "santão": "santinho", "mosquitinho": "santinho", "colinha": "santinho", "cartão de visita": "santinho",
    "santinho": "santinho", "cartão": "santinho",
    "adesivo perfurado": "adesivo", "adesivo para-choque": "adesivo", "adesivo de porta": "adesivo", "adesivo bola": "adesivo",
    "pragão": "adesivo", "praguinha": "adesivo", "adesivo": "adesivo",
    "bóton": "bóton",
    "bandeira": "bandeira", "panfleto": "panfleto", "cartaz": "cartaz", "carta": "carta", "jornal e revista": "jornal",
    "banner": "faixa", "faixa e placa": "faixa", "lona": "faixa", "plano de governo": "impressos", "camiseta": "camiseta",
    "mochila e pirulito": "pirulito", "carro de som": "som",
    "jingle": "jingle", "rádio e TV": "rádio/TV", "vídeo": "vídeo", "fotografia": "foto",
    "WhatsApp": "Facebook", "Instagram": "Facebook", "Facebook": "Facebook", "Google e YouTube": "Google",
    "redes sociais": "redes", "site": "site", "SMS": "SMS",
    "impulsionamento": "anúncios", "anúncio": "anúncios", "marketing e criação": "marketing", "impressos": "impressos",
}
# peças que não dizem qual peça foi comprada: entram na nuvem, em cor neutra
GENERICAS = {"impressos", "marketing"}
# explicação para a dica, quando a palavra sozinha não basta
EXPLICACAO = {
    "anúncios": "impulsionamento sem a plataforma informada",
    "Facebook": "Facebook, Instagram e WhatsApp (Meta)",
    "Google": "Google e YouTube",
    "bóton": "adesivo de roupa ou broche",
    "som": "carro de som e sonorização",
    "rádio/TV": "programas de rádio e TV",
    "faixa": "faixa, banner, placa e lona",
    "foto": "fotografia",
    "redes": "gestão e conteúdo de redes sociais",
    "pirulito": "mochila e pirulito",
    "santinho": "santinho, colinha, santão e cartão",
    "jornal": "jornal e revista",
    "impressos": "material impresso sem a peça especificada",
    "marketing": "marketing, criação e design",
}
_ESPECIFICOS = [(f, t, re.compile(p)) for f, t, p in ESPECIFICOS]
_GENERICOS = [(f, t, re.compile(p)) for f, t, p in GENERICOS]


def _passar(lista, texto: str) -> list[str]:
    familias, termos = set(), []
    for familia, termo, padrao in lista:
        if familia not in familias and padrao.search(texto):
            familias.add(familia)
            if termo not in termos:
                termos.append(termo)
    return termos


def termos(descricao: str | None, origem: str | None = None) -> tuple[list[str], bool]:
    """Formatos de uma descrição e se vieram da categoria do TSE (reserva) em vez do texto."""
    texto = sem_acento(descricao or "").lower()
    achados = _passar(_ESPECIFICOS, texto) or _passar(_GENERICOS, texto)
    if achados:
        return achados, False
    reserva = POR_CATEGORIA.get(origem or "")
    return ([reserva], True) if reserva else ([], False)


def pecas(descricao: str | None, origem: str | None = None) -> list[tuple[str, str]]:
    """(peça, formato) de uma descrição; uma peça aparece uma vez (o primeiro formato dela). Formato "sem detalhe" quando
    a peça veio da categoria do TSE."""
    formatos, pela_categoria = termos(descricao, origem)
    saida: dict[str, str] = {}
    for f in formatos:
        saida.setdefault(PECA[f], SEM_DETALHE if pela_categoria else f)
    return list(saida.items())


def nuvem(linhas: list[dict]) -> list[dict]:
    """Linhas de propaganda_descricoes.sql -> uma palavra por peça, do maior para o menor valor.

    O valor de uma descrição com mais de uma peça é dividido entre elas em centavos inteiros (o resto vai para as
    primeiras), para a soma da nuvem bater com o total de propaganda. `grupo` é o tipo de propaganda com mais valor na
    peça; `detalhes` são os formatos da peça, do maior para o menor valor.
    """
    acc: dict[str, dict] = {}
    for linha in linhas:
        ps = pecas(linha["descricao"], linha["origem"])
        if not ps:
            continue
        base, resto = divmod(int(linha["centavos"] or 0), len(ps))
        for i, (peca, formato) in enumerate(ps):
            parte = base + (1 if i < resto else 0)
            item = acc.setdefault(peca, {"termo": peca, "centavos": 0, "despesas": 0, "pela_categoria_centavos": 0,
                                         "grupos": {}, "formatos": {}})
            item["centavos"] += parte
            item["despesas"] += int(linha["despesas"])
            item["pela_categoria_centavos"] += parte if formato == SEM_DETALHE else 0
            item["grupos"][linha["grupo"]] = item["grupos"].get(linha["grupo"], 0) + parte
            item["formatos"][formato] = item["formatos"].get(formato, 0) + parte
    saida = []
    for item in acc.values():
        grupos, formatos = item.pop("grupos"), item.pop("formatos")
        item["grupo"] = max(sorted(grupos), key=lambda g: grupos[g])
        item["generico"] = item["termo"] in GENERICAS
        item["explicacao"] = EXPLICACAO.get(item["termo"])
        item["detalhes"] = [{"termo": f, "centavos": c} for f, c in sorted(formatos.items(), key=lambda kv: (-kv[1], kv[0]))]
        saida.append(item)
    return sorted(saida, key=lambda x: (-x["centavos"], x["termo"]))

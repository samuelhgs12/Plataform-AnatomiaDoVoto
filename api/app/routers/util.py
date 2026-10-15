"""Funções de apoio dos endpoints."""
import re
import unicodedata

# nível do cargo na linha do tempo do perfil: 1 vereador, 2 vice-prefeito, 3 prefeito, 4 dep. estadual, 5 dep. federal,
# 6 senador, 7 governador, 8 presidente (vice-governador, vice-presidente e suplentes ficam no nível do titular).
# Igual a NIVEL_CARGO em web/src/lib/carreira.ts. Difere da escala do q10.sql, que põe governador e senador juntos no nível 5.
NIVEL_CARGO = {13: 1, 12: 2, 11: 3, 7: 4, 8: 4, 6: 5, 5: 6, 9: 6, 10: 6, 3: 7, 4: 7, 1: 8, 2: 8}


def sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def padrao_like(texto: str) -> str:
    """Texto digitado -> padrão LIKE seguro (sem acento, minúsculo, com % e escape de \\ % _)."""
    t = sem_acento(texto).lower().strip()
    t = t.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{t}%"


def palavras_busca(texto: str) -> list[str]:
    """Texto digitado -> palavras sem acento e minúsculas (só letras e números; o resto separa palavras)."""
    return re.findall(r"[a-z0-9]+", sem_acento(texto).lower())


STOPWORDS = set("""
para com por uma uns umas dos das nos nas aos como mais menos entre sobre sem ate apos ante desde pela pelo pelas pelos
este esta estes estas esse essa esses essas isso isto aquele aquela seu sua seus suas nosso nossa que quem qual quais
servico servicos prestacao despesa despesas campanha eleitoral eleicao eleicoes candidato candidata candidatura
pagamento referente valor conforme nota fiscal contrato material materiais producao
""".split())
PALAVRA = re.compile(r"[a-z]{4,}")


def contar_palavras(descricoes: list[str], limite: int = 50) -> list[tuple[str, int]]:
    """Frequência de termos nas descrições. Descarta números (CPF/CNPJ) e palavras vazias."""
    freq: dict[str, int] = {}
    for d in descricoes:
        for w in PALAVRA.findall(sem_acento(d).lower()):
            if w not in STOPWORDS:
                freq[w] = freq.get(w, 0) + 1
    return sorted(freq.items(), key=lambda kv: (-kv[1], kv[0]))[:limite]

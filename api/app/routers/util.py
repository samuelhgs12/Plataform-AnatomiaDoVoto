"""Funções de apoio dos endpoints."""
import re
import unicodedata

# nível do cargo na linha do tempo (1 vereador ... 6 presidente), igual ao projeto de carga
NIVEL_CARGO = {13: 1, 11: 2, 12: 2, 7: 3, 8: 3, 6: 4, 9: 4, 10: 4, 3: 5, 4: 5, 5: 5, 1: 6, 2: 6}


def sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def padrao_like(texto: str) -> str:
    """Texto digitado -> padrão LIKE seguro (sem acento, minúsculo, com % e escape de \\ % _)."""
    t = sem_acento(texto).lower().strip()
    t = t.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{t}%"


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

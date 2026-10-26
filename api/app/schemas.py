"""Modelos de resposta. SÓ o que está aqui sai pela API (a regra de privacidade é esta lista).

Nunca inclua título eleitoral, CPF, data de nascimento ou documentos de doadores.
"""
from pydantic import BaseModel


class Cargo(BaseModel):
    id_cargo: int
    nome: str
    unidade: str
    sistema: str
    eh_titular: bool


class Meta(BaseModel):
    cargos: list[Cargo]
    anos: list[int]
    ufs: list[str]


class CandidatoBusca(BaseModel):
    id_candidato: int
    nome_civil: str | None
    nome_urna: str | None
    uf: str | None
    ultimo_ano: int
    partido: str | None
    ultimo_cargo: str
    ultimo_eleito: bool
    nome_urna_casado: str | None = None   # nome de urna de outra eleição em que a busca casou
    ultimo_ue: str | None = None          # com ultimo_ano e ultimo_sequencial, a chave da foto (/api/fotos/...)
    ultimo_sequencial: str | None = None


class CandidaturaItem(BaseModel):
    id_candidatura: int
    id_candidato: int | None
    nome_urna: str | None
    numero_urna: str | None
    uf: str | None
    ano: int
    ue: str              # ano, ue e sequencial: chave natural da candidatura no TSE (e da foto)
    sequencial: str
    partido: str | None
    cargo: str
    resultado: str
    eleito: bool
    votos: int


class Listagem(BaseModel):
    total: int
    pagina: int
    tamanho: int
    itens: list[CandidaturaItem]


class CarreiraItem(BaseModel):
    id_candidatura: int
    ano: int
    cargo: str
    id_cargo: int
    nivel: int
    eh_titular: bool
    uf: str | None
    municipio: str | None
    partido: str | None
    nome_urna: str | None
    numero_urna: str | None
    ue: str
    sequencial: str
    tipo_eleicao: str
    resultado: str
    eleito: bool
    disputou: bool
    votos_1t: int


class Troca(BaseModel):
    ano: int
    de: str
    para: str


class Resumo(BaseModel):
    eleicoes_disputadas: int
    vitorias: int
    partidos: list[str]
    primeiro_ano: int | None
    ultimo_ano: int | None


class Pessoa(BaseModel):
    id_candidato: int
    nome_civil: str | None
    genero: str | None
    ocupacao: str | None


class Perfil(BaseModel):
    candidato: Pessoa
    resumo: Resumo
    carreira: list[CarreiraItem]
    trocas: list[Troca]


class CandidaturaMapa(BaseModel):
    """Uma candidatura na visão Candidato do mapa, com os números do verso da ficha."""
    id_candidato: int
    id_candidatura: int
    ano: int
    cargo: str
    uf: str                              # "BR" para presidente
    partido: str | None
    numero: str | None
    nome_urna: str                       # o nome civil quando não há nome de urna
    resultado: str                       # categoria de rotulo_resultado (ELEITO, NAO_ELEITO...)
    votos_total: int                     # 1º turno, na abrangência inteira do cargo
    gasto_total: float | None            # despesas contratadas (FINAL, sem transferências); None antes de 2018
    mediana_gasto_cargo: float | None    # mediana de quem disputou a mesma eleição na mesma UF
    parte_publica: float | None          # fundos eleitoral e partidário / receita total (0 a 1)
    disputas: int                        # eleições disputadas até esta, contando esta
    mandatos: int
    ue: str
    sequencial: str


class VotoMunicipio(BaseModel):
    id_candidatura: int
    id_municipio: int
    uf: str
    turno: int
    votos: int
    validos_cargo: int                   # nominais da disputa + legenda (a legenda só existe de 2018 em diante)
    posicao: int                         # colocação no município e turno (1 = mais votado)


class CategoriaGasto(BaseModel):
    categoria: str
    publicidade: bool
    valor: float
    pct: float
    mediana_cargo: float | None = None     # mediana de quem gastou nessa categoria (mesmo cargo, ano e UF)


class Despesas(BaseModel):
    id_candidatura: int
    ano: int
    cargo: str
    uf: str | None
    total: float
    propaganda: float
    pct_propaganda: float
    categorias: list[CategoriaGasto]
    n_comparaveis: int


class CategoriaPropaganda(BaseModel):
    origem: str          # categoria original do TSE (origem_despesa)
    grupo: str           # propaganda_fisica, propaganda_audiovisual ou propaganda_digital
    lancamentos: int
    centavos: int


class Propaganda(BaseModel):
    """Pergunta 9: onde a campanha investiu em propaganda. Valores em centavos inteiros (valor contratado)."""
    id_candidatura: int
    lancamentos: int            # despesas consideradas (todas as categorias, sem transferências); 0 = sem dados
    total_centavos: int
    propaganda_centavos: int
    categorias: list[CategoriaPropaganda]


class Palavra(BaseModel):
    termo: str
    freq: int


class Receitas(BaseModel):
    id_candidatura: int
    publica: float
    privada: float
    total: float
    pct_publica: float | None
    mediana_pct_publica_cargo: float | None = None
    # as 5 fontes da pergunta 8 (públicas: fundo eleitoral e partidário; o resto é privado)
    fundo_eleitoral: float = 0
    fundo_partidario: float = 0
    doacoes_pessoas: float = 0
    recursos_proprios: float = 0
    outros_privados: float = 0


class Saude(BaseModel):
    status: str
    db: str

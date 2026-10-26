// Tipos que espelham os modelos de resposta da API (api/app/schemas.py). Se mudar lá, mude aqui.

export interface Cargo { id_cargo: number; nome: string; unidade: string; sistema: string; eh_titular: boolean }
export interface Meta { cargos: Cargo[]; anos: number[]; ufs: string[] }

export interface CandidatoBusca {
  id_candidato: number; nome_civil: string | null; nome_urna: string | null; uf: string | null;
  ultimo_ano: number; partido: string | null; ultimo_cargo: string; ultimo_eleito: boolean;
  nome_urna_casado?: string | null;   // nome de urna de outra eleição em que a busca casou
  ultimo_ue?: string | null; ultimo_sequencial?: string | null;   // com ultimo_ano, a chave da foto
}

export interface CandidaturaItem {
  id_candidatura: number; id_candidato: number | null; nome_urna: string | null; numero_urna: string | null;
  uf: string | null; ano: number; ue: string; sequencial: string; partido: string | null; cargo: string; resultado: string; eleito: boolean; votos: number;
}
export interface Listagem { total: number; pagina: number; tamanho: number; itens: CandidaturaItem[] }

export interface CarreiraItem {
  id_candidatura: number; ano: number; cargo: string; id_cargo: number; nivel: number; eh_titular: boolean;
  uf: string | null; municipio: string | null; partido: string | null; nome_urna: string | null; numero_urna: string | null;
  ue: string; sequencial: string; tipo_eleicao: string; resultado: string; eleito: boolean; disputou: boolean; votos_1t: number;
}
export interface Troca { ano: number; de: string; para: string }
export interface Resumo { eleicoes_disputadas: number; vitorias: number; partidos: string[]; primeiro_ano: number | null; ultimo_ano: number | null }
export interface Pessoa { id_candidato: number; nome_civil: string | null; genero: string | null; ocupacao: string | null }
export interface Perfil { candidato: Pessoa; resumo: Resumo; carreira: CarreiraItem[]; trocas: Troca[] }

export interface CategoriaGasto { categoria: string; publicidade: boolean; valor: number; pct: number; mediana_cargo: number | null }
export interface Despesas {
  id_candidatura: number; ano: number; cargo: string; uf: string | null; total: number; propaganda: number;
  pct_propaganda: number; categorias: CategoriaGasto[]; n_comparaveis: number;
}
export interface Palavra { termo: string; freq: number }
export interface Receitas {
  id_candidatura: number; publica: number; privada: number; total: number; pct_publica: number | null; mediana_pct_publica_cargo: number | null;
  fundo_eleitoral: number; fundo_partidario: number; doacoes_pessoas: number; recursos_proprios: number; outros_privados: number;
}

/** Formato das tabelas de /api/analises/<nome> e do JSON estático do mapa (pipeline/export_static.py) */
export interface TabelaEstatica { colunas: string[]; linhas: (string | number | boolean | null)[][] }

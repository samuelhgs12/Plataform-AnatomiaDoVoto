// Municípios, estados e eleitos da camada Dinheiro do mapa (porte da cidade, resumo por município, disputa de prefeito),
// sem React: fácil de testar. Os dados vêm de /api/analises/municipios (tabelas municipios, resumo e estados) e das
// listas de candidatos de /api/municipios/<id>/candidatos.

/** Um município dos seis estados, com o código IBGE que o desenho do mapa usa. */
export interface LinhaMunicipio { id_municipio: number; uf: string; nome: string; cod_ibge: string }

/** Um município numa eleição municipal (2020 ou 2024). maior_venceu: o candidato a prefeito que mais gastou venceu? */
export interface LinhaResumo {
  ano: number; id_municipio: number; uf: string;
  vereador_candidatos: number; vereador_eleitos: number; vereador_vagas: number;
  vereador_gasto: number; vereador_receita: number; vereador_publica: number;
  /** Candidatos sem prestação de contas final: entram com zero nas somas (valor desconhecido). */
  vereador_sem_prestacao: number; prefeito_sem_prestacao: number;
  prefeito_candidatos: number; prefeito_gasto: number; prefeito_receita: number; prefeito_publica: number;
  prefeito_id_candidato: number | null; prefeito_nome: string | null; prefeito_partido: string | null;
  prefeito_votos: number | null; prefeito_gasto_eleito: number | null;
  maior_venceu: boolean | null;
  /** Por que a disputa para prefeito ficou fora da P2 (null = comparável). */
  maior_excluida?: "um_candidato" | "sem_prestacao" | "sem_gasto" | "empate" | null;
  /** Eleitores aptos no ano: o porte da cidade. */
  eleitorado?: number | null;
  /** Vereadores em grupos (recursos considerados e dinheiro público): "mais" = cerca de 1/4 de maior valor na cidade. */
  rec_mais_cand?: number | null; rec_mais_eleitos?: number | null; rec_demais_cand?: number | null; rec_demais_eleitos?: number | null;
  pub_mais_cand?: number | null; pub_mais_eleitos?: number | null; pub_demais_cand?: number | null; pub_demais_eleitos?: number | null;
  /** Receita de fonte marcada como privada (o resto, fora a pública, é de origem não classificada). */
  vereador_privada?: number | null; prefeito_privada?: number | null;
  /** Campanhas da cidade que não chegaram a disputar e gastaram, e quanto (o que a pergunta 1 soma a mais). */
  vereador_nao_disputou_n?: number | null; vereador_nao_disputou_gasto?: number | null;
  prefeito_nao_disputou_n?: number | null; prefeito_nao_disputou_gasto?: number | null;
}

/** Um cargo num estado e ano. disputas_maior/maior_venceu: só para prefeito (P2). */
export interface LinhaEstado {
  ano: number; uf: string; cargo: string; candidatos: number; eleitos: number; vagas: number;
  gasto: number; receita: number; receita_publica: number; disputas_maior: number | null; maior_venceu: number | null;
  sem_prestacao: number;
  /** Prefeito: disputas que ficaram fora da P2, por motivo. */
  excl_um_candidato?: number | null; excl_sem_prestacao?: number | null; excl_sem_gasto?: number | null; excl_empate?: number | null;
  /** Eleitores aptos do estado no ano (gasto por eleitor). */
  eleitorado?: number | null;
  /** Campanhas ao cargo que não chegaram a disputar e gastaram, e quanto: a pergunta 1 soma isso; aqui fica fora. */
  nao_disputou_com_gasto?: number | null; gasto_nao_disputou?: number | null;
  /** Receita de fonte marcada como privada. */
  receita_privada?: number | null;
}

/** Um eleito (resposta de /api/municipios/<id>/eleitos ou /api/estados/<uf>/eleitos). */
export interface Eleito {
  cargo: string; id_cargo: number; id_candidato: number | null; id_candidatura: number; nome_urna: string | null; partido: string | null;
  votos: number; gasto: number; receita: number; receita_publica: number;
}

/** Um candidato (eleito ou não) a prefeito ou vereador (resposta de /api/municipios/<id>/candidatos). */
export interface CandidatoLocal extends Eleito { eleito: boolean; resultado: string; prestou: boolean }

/** O que colore o mapa: uma pergunta de cada vez. */
export type Indicador = "custo" | "publico" | "maior";

/** Cargos na ordem em que aparecem nas listas de eleitos. */
export const ORDEM_ELEITOS = ["Governador", "Vice-governador", "Senador", "Deputado federal", "Deputado estadual", "Prefeito", "Vice-prefeito", "Vereador"];
const PLURAL: Record<string, string> = {
  Governador: "Governador", "Vice-governador": "Vice-governador", Senador: "Senadores", "Deputado federal": "Deputados federais",
  "Deputado estadual": "Deputados estaduais", Prefeito: "Prefeito", "Vice-prefeito": "Vice-prefeito", Vereador: "Vereadores",
};
export const nomeDoGrupo = (cargo: string, n: number) => (n === 1 ? cargo : PLURAL[cargo] ?? cargo);

/** Valor de um município para o indicador (null: sem dado). "maior" vira 1 (venceu) ou 0 (perdeu). */
export function valorMunicipio(r: LinhaResumo | undefined, ind: Indicador): number | null {
  if (!r) return null;
  if (ind === "custo") return r.vereador_vagas > 0 ? r.vereador_gasto / r.vereador_vagas : null;
  if (ind === "publico") {
    const receita = r.vereador_receita + r.prefeito_receita;
    return receita > 0 ? (r.vereador_publica + r.prefeito_publica) / receita : null;
  }
  return r.maior_venceu === null ? null : r.maior_venceu ? 1 : 0;
}

/**
 * A disputa para prefeito numa cidade: os candidatos do mais ao menos votado, a parte dos votos de cada um e quem gastou
 * mais. `maisGastou` só aparece se todos entregaram a prestação final (senão não se sabe quem gastou mais).
 */
export function disputaPrefeito(cands: CandidatoLocal[]) {
  const total = cands.reduce((a, c) => a + c.votos, 0);
  const todosPrestaram = cands.length > 0 && cands.every((c) => c.prestou);
  const topo = todosPrestaram ? [...cands].sort((a, b) => b.gasto - a.gasto || a.id_candidatura - b.id_candidatura)[0] : undefined;
  return {
    total, todosPrestaram,
    candidatos: [...cands].sort((a, b) => b.votos - a.votos || a.id_candidatura - b.id_candidatura).map((c) => ({
      ...c, parteVotos: total > 0 ? c.votos / total : null, maisGastou: !!topo && topo.gasto > 0 && topo.id_candidatura === c.id_candidatura,
    })),
  };
}

/**
 * Porte da cidade pelo eleitorado apto do ano: não faz sentido comparar uma cidade de 5 mil eleitores com uma de 500 mil.
 * Faixas escolhidas pela distribuição dos 1.238 municípios dos seis estados (em 2024: 253, 365, 301, 190, 98 e 31).
 */
export const PORTES = [
  { chave: "ate5", ate: 5_000, rotulo: "até 5 mil eleitores" },
  { chave: "ate10", ate: 10_000, rotulo: "5 a 10 mil eleitores" },
  { chave: "ate20", ate: 20_000, rotulo: "10 a 20 mil eleitores" },
  { chave: "ate50", ate: 50_000, rotulo: "20 a 50 mil eleitores" },
  { chave: "ate200", ate: 200_000, rotulo: "50 a 200 mil eleitores" },
  { chave: "mais200", ate: Infinity, rotulo: "200 mil eleitores ou mais" },
] as const;
export type Porte = (typeof PORTES)[number]["chave"];

/** O porte de uma cidade (null sem eleitorado). */
export function porteDe(eleitorado: number | null | undefined): (typeof PORTES)[number] | null {
  if (eleitorado == null || eleitorado <= 0) return null;
  return PORTES.find((p) => eleitorado < p.ate) ?? null;
}

/** Mediana (a referência de "cidade típica": não é puxada pelas capitais como a média). null sem valores. */
export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b), meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

/**
 * Referência de comparação de uma cidade: as cidades do mesmo porte no mesmo ano (nos seis estados, ou só no estado).
 * Para "maior" (sim/não), a parte das cidades do grupo em que quem mais gastou venceu. `n` = cidades com o dado.
 */
export function referenciaPorte(resumo: LinhaResumo[], ano: number, porte: Porte, ind: Indicador, uf?: string): { valor: number | null; n: number } {
  const valores = resumo
    .filter((r) => r.ano === ano && porteDe(r.eleitorado)?.chave === porte && (!uf || r.uf === uf))
    .flatMap((r) => valorMunicipio(r, ind) ?? []);
  if (ind === "maior") return { valor: valores.length ? valores.reduce((a, v) => a + v, 0) / valores.length : null, n: valores.length };
  return { valor: mediana(valores), n: valores.length };
}

/**
 * Como mostrar um valor que pode faltar, sem transformar ausência em zero:
 * "zero" (declarou R$ 0), "ausente" (não informado, ex.: sem prestação de contas), "nao_se_aplica" (o indicador não
 * existe nesse recorte, ex.: prefeito numa eleição geral) e "valor". A falha de carregamento é tratada na página.
 */
export type SituacaoDado = "valor" | "zero" | "ausente" | "nao_se_aplica";
export function situacaoDado(v: number | null | undefined, aplica = true): SituacaoDado {
  if (!aplica) return "nao_se_aplica";
  if (v == null || Number.isNaN(v)) return "ausente";
  return v === 0 ? "zero" : "valor";
}
export const TEXTO_SITUACAO: Record<Exclude<SituacaoDado, "valor">, string> = { zero: "R$ 0", ausente: "Não informado", nao_se_aplica: "Não se aplica" };

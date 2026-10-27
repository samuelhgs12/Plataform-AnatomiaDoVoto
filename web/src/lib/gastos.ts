// Lógica da página "recursos de campanha e sucesso eleitoral" (pergunta 2), sem dependência do React: fácil de testar.
// Os dados vêm de GET /api/analises/q2 (api/app/analises/q2.sql), em três medidas (coluna "medida"): o gasto, a
// receita (inclusive material doado por outros candidatos) e "recursos" (o maior dos dois).

import { compararGrupos, responder, zContagem, type Resposta } from "./estatistica";
import { passa, type Filtros } from "./financiamento";

export type Medida = "recursos" | "gasto" | "receita";
export const MEDIDAS: { chave: Medida; rotulo: string; explicacao: string }[] = [
  { chave: "recursos", rotulo: "Recursos de campanha considerados", explicacao: "Usamos o maior valor entre receitas e despesas declaradas, para considerar também campanhas que receberam material." },
  { chave: "gasto", rotulo: "Só gasto", explicacao: "o que o candidato gastou (despesas declaradas)" },
  { chave: "receita", rotulo: "Só receita", explicacao: "o que o candidato recebeu, inclusive material doado por outros candidatos" },
];
/** Só as linhas de uma medida. */
export const daMedida = <T extends { medida: Medida }>(linhas: T[], medida: Medida) => linhas.filter((l) => l.medida === medida);

/** faixa -1 = sem prestação final (fora dos grupos); 0 = nada declarado; 1 a 4 = cerca de um quarto cada de quem declarou, comparando só com a mesma disputa (4 = os que mais têm). */
export interface LinhaGastoFaixa { medida: Medida; ano: number; cargo: string; uf: string; tinha_cargo: boolean; faixa: number; candidaturas: number; eleitos: number }
/** Disputas com poucos candidatos: quantas vezes o que teve mais recursos venceu, e quantas vitórias teria por sorteio. */
export interface LinhaMaiorGasto {
  medida: Medida; ano: number; cargo: string; uf: string; disputas: number; maior_venceu: number; maior_tinha_cargo: number; chance_sorteio: number; var_sorteio: number;
  /** Disputas que ficaram de fora, por motivo (a cobertura que a página mostra). */
  excl_um_candidato?: number; excl_sem_prestacao?: number; excl_sem_gasto?: number; excl_empate?: number;
}
/** Correlação (de -1 a 1) entre a posição nos recursos e a posição nos votos dentro da disputa. uf null = todas as UFs. */
export interface LinhaCorrelacao { medida: Medida; ano: number; cargo: string; uf: string | null; n: number; correlacao: number }

export const GRUPOS_GASTO = [
  { chave: "nada", faixas: [0], rotulo: "Nada declarado", detalhe: "prestou contas com valor zero", classe: "fx5" },
  { chave: "pouco", faixas: [1], rotulo: "Pouco", detalhe: "cerca de 1/4, os que menos têm", classe: "fx2" },
  { chave: "medio", faixas: [2, 3], rotulo: "Médio", detalhe: "cerca da metade, no meio", classe: "fx2" },
  { chave: "muito", faixas: [4], rotulo: "Muito", detalhe: "cerca de 1/4, os que mais têm", classe: "" },
] as const;
export type ChaveGrupo = (typeof GRUPOS_GASTO)[number]["chave"];

/** Cargos com poucos candidatos por disputa: dividir em quartos não faz sentido; a pergunta vira "o que teve mais recursos venceu?". */
export const MAJORITARIOS = ["Presidente", "Governador", "Senador", "Prefeito"];
export const ehMajoritario = (cargo?: string) => !!cargo && MAJORITARIOS.includes(cargo);

export interface GrupoGasto { chave: ChaveGrupo; rotulo: string; detalhe: string; classe: string; candidaturas: number; eleitos: number; taxa: number }

/**
 * Taxa de eleição nos quatro grupos de recursos.
 * `tinhaCargo`: undefined = todos; true/false = só quem já tinha (ou não) o cargo.
 * `cargos`: limita a esses cargos (na visão "todos os cargos", só os de muitos candidatos por disputa).
 */
export function sucessoPorGasto(linhas: LinhaGastoFaixa[], f: Filtros, op: { tinhaCargo?: boolean; cargos?: string[] } = {}): GrupoGasto[] {
  return GRUPOS_GASTO.map((g) => {
    let candidaturas = 0, eleitos = 0;
    for (const l of linhas) {
      if (!passa(l, f) || !(g.faixas as readonly number[]).includes(l.faixa)) continue;
      if (op.tinhaCargo !== undefined && l.tinha_cargo !== op.tinhaCargo) continue;
      if (op.cargos && !op.cargos.includes(l.cargo)) continue;
      candidaturas += l.candidaturas;
      eleitos += l.eleitos;
    }
    return { chave: g.chave, rotulo: g.rotulo, detalhe: g.detalhe, classe: g.classe, candidaturas, eleitos, taxa: candidaturas ? eleitos / candidaturas : 0 };
  });
}

export const grupo = (grupos: GrupoGasto[], chave: ChaveGrupo) => grupos.find((g) => g.chave === chave)!;

/**
 * A resposta curta. Compara quem tem muito com quem tem pouco (cerca de 1/4 de cada ponta); se "pouco" estiver vazio,
 * com quem não declarou nada. A mesma comparação vale para a frase e para o gráfico; a resposta usa teste estatístico.
 */
export function respostaGasto(grupos: GrupoGasto[]): { muito: GrupoGasto; base: GrupoGasto; curta: Resposta | null; vezes: number | null } {
  const muito = grupo(grupos, "muito"), pouco = grupo(grupos, "pouco"), nada = grupo(grupos, "nada");
  const base = pouco.candidaturas > 0 ? pouco : nada;
  const curta = muito.candidaturas === 0 || base.candidaturas === 0 ? null : compararGrupos(muito, base).resposta;
  return { muito, base, curta, vezes: base.taxa > 0 ? muito.taxa / base.taxa : null };
}

/** "O que teve mais recursos venceu?": soma das disputas majoritárias que passam no filtro. */
export function maiorGastador(linhas: LinhaMaiorGasto[], f: Filtros) {
  let disputas = 0, venceu = 0, tinhaCargo = 0, sorteio = 0, variancia = 0;
  const excluidas = { um_candidato: 0, sem_prestacao: 0, sem_gasto: 0, empate: 0 };
  for (const l of linhas) {
    if (!passa(l, f)) continue;
    disputas += l.disputas; venceu += l.maior_venceu; tinhaCargo += l.maior_tinha_cargo; sorteio += l.chance_sorteio; variancia += l.var_sorteio;
    excluidas.um_candidato += l.excl_um_candidato ?? 0; excluidas.sem_prestacao += l.excl_sem_prestacao ?? 0;
    excluidas.sem_gasto += l.excl_sem_gasto ?? 0; excluidas.empate += l.excl_empate ?? 0;
  }
  return {
    disputas, venceu, tinhaCargo, sorteio, variancia, excluidas,
    pct: disputas ? venceu / disputas : 0,
    pctSorteio: disputas ? sorteio / disputas : 0,
    pctTinhaCargo: disputas ? tinhaCargo / disputas : 0,
  };
}

/** Motivos de exclusão de uma disputa, como aparecem na página. */
export const MOTIVOS_EXCLUSAO: Record<keyof ReturnType<typeof maiorGastador>["excluidas"], string> = {
  um_candidato: "só um candidato", sem_prestacao: "prestação de contas incompleta", sem_gasto: "ninguém declarou valor", empate: "empate no maior valor",
};

/**
 * A cobertura da comparação "quem tinha mais venceu?": "Análise de 1.178 disputas; 60 excluídas (46 só um candidato,
 * 14 prestação de contas incompleta)". Os motivos zerados não aparecem.
 */
export function coberturaDisputas(m: ReturnType<typeof maiorGastador>): { analisadas: number; excluidas: number; motivos: { motivo: string; n: number }[] } {
  const motivos = (Object.keys(MOTIVOS_EXCLUSAO) as (keyof typeof MOTIVOS_EXCLUSAO)[])
    .map((k) => ({ motivo: MOTIVOS_EXCLUSAO[k], n: m.excluidas[k] })).filter((x) => x.n > 0);
  return { analisadas: m.disputas, excluidas: motivos.reduce((a, x) => a + x.n, 0), motivos };
}

/**
 * A resposta curta das disputas majoritárias: as vitórias de quem tinha mais, comparadas com as de um sorteio
 * (teste z da contagem, com a variância do sorteio). Com poucas disputas, em geral "Sem diferença clara.".
 */
export function respostaMaior(m: ReturnType<typeof maiorGastador>): Resposta | null {
  if (m.disputas === 0) return null;
  return responder(m.pct, m.pctSorteio, zContagem(m.venceu, m.sorteio, m.variancia));
}

/**
 * Já ter o cargo × recursos. Entre os que tiveram mais recursos, a taxa de quem já tinha o cargo e de quem não tinha,
 * e que parte de quem já tinha o cargo estava entre os que tiveram mais recursos.
 */
export function efeitoDoCargo(linhas: LinhaGastoFaixa[], f: Filtros, cargos?: string[]) {
  const com = grupo(sucessoPorGasto(linhas, f, { tinhaCargo: true, cargos }), "muito");
  const sem = grupo(sucessoPorGasto(linhas, f, { tinhaCargo: false, cargos }), "muito");
  let tinha = 0, tinhaNoTopo = 0;
  for (const l of linhas) {
    if (!passa(l, f) || !l.tinha_cargo || (cargos && !cargos.includes(l.cargo))) continue;
    tinha += l.candidaturas;
    if (l.faixa === 4) tinhaNoTopo += l.candidaturas;
  }
  return { com, sem, quemTinha: tinha, parteNoTopo: tinha ? tinhaNoTopo / tinha : 0 };
}

/** A correlação de um cargo num ano (uf ausente = a linha pré-calculada para todas as UFs). */
export function correlacaoDe(linhas: LinhaCorrelacao[], ano: number, cargo: string, uf?: string): LinhaCorrelacao | undefined {
  return linhas.find((l) => l.ano === ano && l.cargo === cargo && (l.uf ?? undefined) === uf);
}

/** Força da correlação em palavras (faixas usuais: 0,1 / 0,3 / 0,5 / 0,7). */
export function forcaCorrelacao(r: number): string {
  const a = Math.abs(r);
  const forca = a < 0.1 ? "nenhuma relação" : a < 0.3 ? "relação fraca" : a < 0.5 ? "relação moderada" : a < 0.7 ? "relação forte" : "relação muito forte";
  return a >= 0.1 && r < 0 ? `${forca}, inversa` : forca;
}

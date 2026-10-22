// Lógica da página "recursos de campanha e sucesso eleitoral" (pergunta 2), sem dependência do React: fácil de testar.
// Os dados vêm de public/data/q2.json, gerado por pipeline/sql/q2.sql. "Recursos" = o maior valor entre o que o
// candidato recebeu (inclusive material doado por outros candidatos) e o que gastou.

import { passa, type Filtros } from "./financiamento";

/** faixa 0 = sem recursos declarados; 1 a 4 = quartos de quem declarou, comparando só com a mesma disputa (4 = os 25% com mais). */
export interface LinhaGastoFaixa { ano: number; cargo: string; uf: string; tinha_cargo: boolean; faixa: number; candidaturas: number; eleitos: number }
/** Disputas com poucos candidatos: quantas vezes o que teve mais recursos venceu, e quantas vitórias teria por sorteio. */
export interface LinhaMaiorGasto { ano: number; cargo: string; uf: string; disputas: number; maior_venceu: number; maior_tinha_cargo: number; chance_sorteio: number }
/** Correlação (de -1 a 1) entre a posição nos recursos e a posição nos votos dentro da disputa. uf null = todas as UFs. */
export interface LinhaCorrelacao { ano: number; cargo: string; uf: string | null; n: number; correlacao: number }

export const GRUPOS_GASTO = [
  { chave: "nada", faixas: [0], rotulo: "Sem recursos", detalhe: "nada declarado", classe: "fx5" },
  { chave: "pouco", faixas: [1], rotulo: "Poucos recursos", detalhe: "os 25% com menos", classe: "fx2" },
  { chave: "medio", faixas: [2, 3], rotulo: "Recursos médios", detalhe: "a metade do meio", classe: "fx2" },
  { chave: "muito", faixas: [4], rotulo: "Muitos recursos", detalhe: "os 25% com mais", classe: "" },
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
 * A resposta curta. Compara quem teve muitos recursos com quem teve poucos (os 25% com menos); se esse grupo
 * estiver vazio, com quem não declarou nada.
 */
export function respostaGasto(grupos: GrupoGasto[]) {
  const muito = grupo(grupos, "muito"), pouco = grupo(grupos, "pouco"), nada = grupo(grupos, "nada");
  const base = pouco.candidaturas > 0 ? pouco : nada;
  const curta = muito.candidaturas === 0 || base.candidaturas === 0 ? null
    : muito.taxa > base.taxa * 1.2 ? "Sim." : muito.taxa * 1.2 < base.taxa ? "Não." : "Quase não faz diferença.";
  return { muito, base, curta, vezes: base.taxa > 0 ? muito.taxa / base.taxa : null };
}

/** "O que teve mais recursos venceu?": soma das disputas majoritárias que passam no filtro. */
export function maiorGastador(linhas: LinhaMaiorGasto[], f: Filtros) {
  let disputas = 0, venceu = 0, tinhaCargo = 0, sorteio = 0;
  for (const l of linhas) {
    if (!passa(l, f)) continue;
    disputas += l.disputas; venceu += l.maior_venceu; tinhaCargo += l.maior_tinha_cargo; sorteio += l.chance_sorteio;
  }
  return {
    disputas, venceu, tinhaCargo,
    pct: disputas ? venceu / disputas : 0,
    pctSorteio: disputas ? sorteio / disputas : 0,
    pctTinhaCargo: disputas ? tinhaCargo / disputas : 0,
  };
}

/** A resposta curta das disputas majoritárias: comparar com o sorteio. */
export function respostaMaior(m: ReturnType<typeof maiorGastador>): string | null {
  if (m.disputas === 0) return null;
  return m.pct > m.pctSorteio * 1.2 ? "Sim." : m.pct * 1.2 < m.pctSorteio ? "Não." : "Quase não faz diferença.";
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

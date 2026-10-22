// Lógica da página "gastos de campanha e sucesso eleitoral" (pergunta 2), sem dependência do React: fácil de testar.
// Os dados vêm de public/data/q2.json, gerado por pipeline/sql/q2.sql.

import { passa, type Filtros } from "./financiamento";

/** faixa 0 = não gastou; 1 a 4 = quartos de quem gastou, comparando só com a mesma disputa (4 = os 25% que mais gastaram). */
export interface LinhaGastoFaixa { ano: number; cargo: string; uf: string; tinha_cargo: boolean; faixa: number; candidaturas: number; eleitos: number }
/** Disputas com poucos candidatos: quantas vezes o que mais gastou venceu, e quantas vitórias teria por sorteio. */
export interface LinhaMaiorGasto { ano: number; cargo: string; uf: string; disputas: number; maior_venceu: number; maior_tinha_cargo: number; chance_sorteio: number }

export const GRUPOS_GASTO = [
  { chave: "nada", faixas: [0], rotulo: "Não gastou", detalhe: "nenhuma despesa declarada", classe: "fx5" },
  { chave: "pouco", faixas: [1], rotulo: "Gastou pouco", detalhe: "os 25% que menos gastaram", classe: "fx2" },
  { chave: "medio", faixas: [2, 3], rotulo: "Gastou médio", detalhe: "a metade do meio", classe: "fx2" },
  { chave: "muito", faixas: [4], rotulo: "Gastou muito", detalhe: "os 25% que mais gastaram", classe: "" },
] as const;
export type ChaveGrupo = (typeof GRUPOS_GASTO)[number]["chave"];

/** Cargos com poucos candidatos por disputa: dividir em quartos não faz sentido; a pergunta vira "o que mais gastou venceu?". */
export const MAJORITARIOS = ["Presidente", "Governador", "Senador", "Prefeito"];
export const ehMajoritario = (cargo?: string) => !!cargo && MAJORITARIOS.includes(cargo);

export interface GrupoGasto { chave: ChaveGrupo; rotulo: string; detalhe: string; classe: string; candidaturas: number; eleitos: number; taxa: number }

/** Taxa de eleição nos quatro grupos de gasto. `tinhaCargo` undefined = todos; true/false = só quem já tinha (ou não) o cargo. */
export function sucessoPorGasto(linhas: LinhaGastoFaixa[], f: Filtros, tinhaCargo?: boolean): GrupoGasto[] {
  return GRUPOS_GASTO.map((g) => {
    let candidaturas = 0, eleitos = 0;
    for (const l of linhas) {
      if (!passa(l, f) || !(g.faixas as readonly number[]).includes(l.faixa)) continue;
      if (tinhaCargo !== undefined && l.tinha_cargo !== tinhaCargo) continue;
      candidaturas += l.candidaturas;
      eleitos += l.eleitos;
    }
    return { chave: g.chave, rotulo: g.rotulo, detalhe: g.detalhe, classe: g.classe, candidaturas, eleitos, taxa: candidaturas ? eleitos / candidaturas : 0 };
  });
}

export const grupo = (grupos: GrupoGasto[], chave: ChaveGrupo) => grupos.find((g) => g.chave === chave)!;

/**
 * A resposta curta. Compara quem gastou muito com quem gastou pouco (os 25% que menos gastaram); se esse grupo
 * estiver vazio, com quem não gastou nada.
 */
export function respostaGasto(grupos: GrupoGasto[]) {
  const muito = grupo(grupos, "muito"), pouco = grupo(grupos, "pouco"), nada = grupo(grupos, "nada");
  const base = pouco.candidaturas > 0 ? pouco : nada;
  const curta = muito.candidaturas === 0 || base.candidaturas === 0 ? null
    : muito.taxa > base.taxa * 1.2 ? "Sim." : muito.taxa * 1.2 < base.taxa ? "Não." : "Quase não faz diferença.";
  return { muito, base, curta, vezes: base.taxa > 0 ? muito.taxa / base.taxa : null };
}

/** "O que mais gastou venceu?": soma das disputas majoritárias que passam no filtro. */
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

/**
 * Já ter o cargo × dinheiro. Entre os que gastaram muito, a taxa de quem já tinha o cargo e de quem não tinha,
 * e que parte de quem já tinha o cargo estava entre os que mais gastaram.
 */
export function efeitoDoCargo(linhas: LinhaGastoFaixa[], f: Filtros) {
  const com = grupo(sucessoPorGasto(linhas, f, true), "muito");
  const sem = grupo(sucessoPorGasto(linhas, f, false), "muito");
  let tinha = 0, tinhaNoTopo = 0;
  for (const l of linhas) {
    if (!passa(l, f) || !l.tinha_cargo) continue;
    tinha += l.candidaturas;
    if (l.faixa === 4) tinhaNoTopo += l.candidaturas;
  }
  return { com, sem, quemTinha: tinha, parteNoTopo: tinha ? tinhaNoTopo / tinha : 0 };
}

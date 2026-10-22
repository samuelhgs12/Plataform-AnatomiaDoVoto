// Lógica da página "quanto custa uma cadeira/mandato?" (pergunta 1), sem dependência do React: fácil de testar.
// Os dados vêm de public/data/q1.json, gerado por pipeline/sql/q1.sql (somas por ano, cargo e UF; presidente na UF "BR").

import { ordenarCargos, passa, type Filtros } from "./financiamento";

export interface LinhaCusto {
  ano: number; cargo: string; uf: string; candidatos: number; com_gasto: number; eleitos: number; vagas: number;
  gasto_total: number; gasto_eleitos: number;
}

/** Somas de um cargo e as duas divisões do gasto: por cadeira (÷ vagas) e por candidato (÷ candidatos). */
export interface Custo {
  ano: number; cargo: string; candidatos: number; eleitos: number; vagas: number; gasto: number; gastoEleitos: number;
  porCadeira: number | null; porCandidato: number | null; parteEleitos: number | null; candidatosPorVaga: number | null;
}

function somar(linhas: LinhaCusto[], ano: number, cargo: string): Custo {
  let candidatos = 0, eleitos = 0, vagas = 0, gasto = 0, gastoEleitos = 0;
  for (const l of linhas) {
    candidatos += l.candidatos; eleitos += l.eleitos; vagas += l.vagas; gasto += l.gasto_total; gastoEleitos += l.gasto_eleitos;
  }
  return {
    ano, cargo, candidatos, eleitos, vagas, gasto, gastoEleitos,
    porCadeira: vagas > 0 ? gasto / vagas : null,
    porCandidato: candidatos > 0 ? gasto / candidatos : null,
    parteEleitos: gasto > 0 ? gastoEleitos / gasto : null,
    candidatosPorVaga: vagas > 0 ? candidatos / vagas : null,
  };
}

/** Custo de um cargo num ano (todas as UFs, ou só uma). null se o cargo não teve eleição nesse recorte. */
export function custoDoCargo(linhas: LinhaCusto[], f: Required<Pick<Filtros, "ano" | "cargo">> & Pick<Filtros, "uf">): Custo | null {
  const sel = linhas.filter((l) => passa(l, f));
  return sel.length ? somar(sel, f.ano, f.cargo) : null;
}

/** Um custo por cargo do ano, do cargo mais alto ao mais baixo. Com UF escolhida, o presidente (UF "BR") sai. */
export function custoPorCargo(linhas: LinhaCusto[], ano: number, uf?: string): Custo[] {
  const cargos = ordenarCargos([...new Set(linhas.filter((l) => passa(l, { ano, uf })).map((l) => l.cargo))]);
  return cargos.map((cargo) => custoDoCargo(linhas, { ano, cargo, uf })!);
}

/** O mesmo cargo em cada eleição em que foi disputado (para ver como o custo mudou). */
export function custoPorAno(linhas: LinhaCusto[], cargo: string, uf?: string): Custo[] {
  const anos = [...new Set(linhas.filter((l) => passa(l, { cargo, uf })).map((l) => l.ano))].sort();
  return anos.map((ano) => custoDoCargo(linhas, { ano, cargo, uf })!);
}

/** O cargo em cada UF, da cadeira mais cara para a mais barata (sem o presidente, que é nacional). */
export function custoPorUf(linhas: LinhaCusto[], ano: number, cargo: string): (Custo & { uf: string })[] {
  const ufs = [...new Set(linhas.filter((l) => l.ano === ano && l.cargo === cargo && l.uf !== "BR").map((l) => l.uf))];
  return ufs.map((uf) => ({ ...custoDoCargo(linhas, { ano, cargo, uf })!, uf }))
    .filter((c) => c.porCadeira !== null)
    .sort((a, b) => (b.porCadeira ?? 0) - (a.porCadeira ?? 0) || a.uf.localeCompare(b.uf));
}

/** Variação entre dois valores ("subiu 138%"); null se não dá para comparar. */
export function variacao(antes: number | null, depois: number | null): number | null {
  return antes && depois !== null ? depois / antes - 1 : null;
}

/** Cargo mostrado em destaque quando nenhum é escolhido: deputado federal nas eleições gerais, prefeito nas municipais. */
export function cargoPadrao(cargos: string[], ano: number): string | undefined {
  const preferido = ano % 4 === 2 ? "Deputado federal" : "Prefeito";
  return cargos.includes(preferido) ? preferido : cargos[0];
}

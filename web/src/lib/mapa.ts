// Indicadores por estado para o mapa da página inicial.

import { porUf, type LinhaFontes } from "./financiamento";
import { proporcao, type LinhaLegenda } from "./legenda";

export const INDICADORES = [
  { chave: "publico", rotulo: "Dinheiro público nas campanhas", curto: "dinheiro público", unidade: "da receita das campanhas veio de fundos públicos" },
  { chave: "legenda", rotulo: "Votos só no partido", curto: "voto de legenda", unidade: "dos votos para deputado e vereador foram só na sigla" },
] as const;
export type Indicador = (typeof INDICADORES)[number]["chave"];

/** valor: proporção de 0 a 1; base: o denominador (reais ou votos), para o leitor saber o tamanho do que foi medido. */
export interface ValorUf { uf: string; valor: number; base: number }

/** Parte pública da receita de campanha de cada estado no ano (sem as campanhas nacionais). */
export function publicoPorUf(linhas: LinhaFontes[], ano: number): ValorUf[] {
  return porUf(linhas, { ano }).map(({ uf, soma }) => ({ uf, valor: soma.publico / soma.total, base: soma.total }));
}

/** Parte dos votos de deputado e vereador dados só à legenda, por estado, no ano. */
export function legendaPorUf(linhas: LinhaLegenda[], ano: number): ValorUf[] {
  const somas = new Map<string, { legenda: number; nominais: number }>();
  for (const l of linhas) {
    if (l.ano !== ano) continue;
    const s = somas.get(l.uf) ?? { legenda: 0, nominais: 0 };
    s.legenda += l.votos_legenda;
    s.nominais += l.votos_nominais;
    somas.set(l.uf, s);
  }
  return [...somas.entries()].filter(([, s]) => s.legenda + s.nominais > 0)
    .map(([uf, s]) => ({ uf, valor: proporcao(s.legenda, s.nominais), base: s.legenda + s.nominais }))
    .sort((a, b) => b.valor - a.valor || a.uf.localeCompare(b.uf));
}

/** Quatro faixas de mesma largura entre o menor e o maior valor; 1 = faixa mais alta (cor mais escura, --w1). */
export function faixasCor(valores: number[]): { faixa: (v: number) => 1 | 2 | 3 | 4; limites: [number, number][] } {
  const min = Math.min(...valores), max = Math.max(...valores);
  const passo = (max - min) / 4;
  const limites = [3, 2, 1, 0].map((i) => [min + passo * i, min + passo * (i + 1)] as [number, number]);
  const faixa = (v: number) => (passo === 0 ? 1 : (4 - Math.min(3, Math.floor((v - min) / passo))) as 1 | 2 | 3 | 4);
  return { faixa, limites };
}

/** O indicador para os estados juntos: média ponderada pela base (reais ou votos), não média simples dos estados. */
export function conjunto(valores: ValorUf[]): ValorUf | null {
  const base = valores.reduce((s, v) => s + v.base, 0);
  return base > 0 ? { uf: "todos", valor: valores.reduce((s, v) => s + v.valor * v.base, 0) / base, base } : null;
}

/** Dinheiro de todas as campanhas dos seis estados, somando todos os anos (sem as campanhas nacionais). */
export function dinheiroTotal(linhas: LinhaFontes[]): { total: number; publico: number; anos: [number, number] } | null {
  const anos = [...new Set(linhas.map((l) => l.ano))].sort((a, b) => a - b);
  if (!anos.length) return null;
  const somas = anos.flatMap((ano) => porUf(linhas, { ano }));
  return { total: somas.reduce((s, u) => s + u.soma.total, 0), publico: somas.reduce((s, u) => s + u.soma.publico, 0), anos: [anos[0], anos[anos.length - 1]] };
}

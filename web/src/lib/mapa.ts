// Números por estado da página inicial (voto de legenda e dinheiro das campanhas).

import { porUf, type LinhaFontes } from "./financiamento";
import { cicloDoAno, proporcao, type CargoCiclo, type LinhaLegenda } from "./legenda";

/** O que o mapa da página inicial pinta: a abstenção (padrão), o voto de legenda ou os votos de um candidato. */
export const VISOES = ["abstencao", "legenda", "candidato"] as const;
export type Visao = (typeof VISOES)[number];

/**
 * Ano da visão de legenda a partir do ano escolhido na abstenção: o mesmo, se houver legenda nele; senão o mais perto
 * do mesmo tipo de eleição (2012, municipal → 2020; 2010, geral → 2018). Sem anos de legenda, undefined.
 */
export function anoNaLegenda(ano: number, anos: number[]): number | undefined {
  if (anos.includes(ano)) return ano;
  const mesmoCiclo = anos.filter((a) => cicloDoAno(a) === cicloDoAno(ano));
  const lista = mesmoCiclo.length ? mesmoCiclo : anos;
  return lista.reduce<number | undefined>((m, a) => (m === undefined || Math.abs(a - ano) < Math.abs(m - ano) ? a : m), undefined);
}

/** Recorta o cargo nas eleições gerais (deputado federal, estadual ou os dois); nas municipais só há vereador. */
export const doCargo = (linhas: LinhaLegenda[], cargo: CargoCiclo) =>
  cargo === "ambos" ? linhas : linhas.filter((l) => cicloDoAno(l.ano) === "municipal" || l.cargo.toLowerCase().includes(cargo));

/** valor = legenda / total; null sem votos ou, com partido, se ele não disputou ali. */
export interface MedidaLegenda { valor: number | null; legenda: number; total: number }

/**
 * Voto de legenda num recorte (ano e, se houver, estado). Sem partido: a parte de todos os votos (nominais + legenda)
 * dada só à legenda, de qualquer partido. Com partido: a parte dos votos de legenda que foi para ele (a "força" do
 * partido na legenda); o total passa a ser só os votos de legenda.
 */
export function medirLegenda(linhas: LinhaLegenda[], { ano, uf, partido }: { ano: number; uf?: string; partido?: string }): MedidaLegenda {
  let legenda = 0, total = 0, disputou = !partido;
  for (const l of linhas) {
    if (l.ano !== ano || (uf && l.uf !== uf)) continue;
    total += partido ? l.votos_legenda : l.votos_legenda + l.votos_nominais;
    if (!partido || l.partido === partido) { legenda += l.votos_legenda; disputou = true; }
  }
  return { valor: total > 0 && disputou ? legenda / total : null, legenda, total };
}

/** Cada item com `p`, a fração do maior valor da lista (o primeiro de um ranking vale 1): o tamanho da barra. */
export function escalaDoMaior<T extends { valor: number }>(lista: T[]): (T & { p: number })[] {
  const topo = Math.max(0, ...lista.map((x) => x.valor));
  return lista.map((x) => ({ ...x, p: topo > 0 ? x.valor / topo : 0 }));
}

/** Partidos por votos de legenda no recorte, do maior para o menor; valor: a parte de cada um nos votos de legenda. */
export function rankingPartidos(linhas: LinhaLegenda[], { ano, uf }: { ano: number; uf?: string }): { partido: string; legenda: number; valor: number }[] {
  const porPartido = new Map<string, number>();
  let total = 0;
  for (const l of linhas) {
    if (l.ano !== ano || (uf && l.uf !== uf)) continue;
    total += l.votos_legenda;
    porPartido.set(l.partido, (porPartido.get(l.partido) ?? 0) + l.votos_legenda);
  }
  return [...porPartido].filter(([, v]) => v > 0)
    .map(([partido, legenda]) => ({ partido, legenda, valor: legenda / total }))
    .sort((a, b) => b.legenda - a.legenda || a.partido.localeCompare(b.partido));
}

/**
 * Cortes de n faixas iguais de 0 até o maior valor, com passo "redondo" (1; 1,5; 2; 2,5; 3; 4; 5; 6 ou 8 × 10^k). Com seis estados,
 * quintos não fazem sentido (um estado e pouco por cor): faixas fixas deixam ver a distância entre eles.
 */
export function faixasFixas(maior: number, n = 5): number[] {
  if (!(maior > 0)) return [];
  const bruto = maior / n, potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((f) => f * potencia >= bruto - 1e-12)! * potencia;
  return Array.from({ length: n - 1 }, (_, i) => Number(((i + 1) * passo).toPrecision(12)));
}

/** Casas decimais (em pontos percentuais) para escrever os cortes sem arredondar nenhum: 0,025 → 1 ("2,5%"). */
export function casasDosCortes(cortes: number[]): number {
  for (let k = 0; k < 3; k++) if (cortes.every((c) => Math.abs(c * 100 * 10 ** k - Math.round(c * 100 * 10 ** k)) < 1e-6)) return k;
  return 3;
}

/** valor: proporção de 0 a 1; base: o denominador (reais ou votos), para o leitor saber o tamanho do que foi medido. */
export interface ValorUf { uf: string; valor: number; base: number }

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

/**
 * A camada "Comparativos" (abstenção × um indicador do Censo 2010) no ano e recorte do mapa: só existe nos anos
 * comparados com o Censo; ligada sem um estado aberto, guarda a escolha mas ainda não pinta (o cruzamento é por
 * município, em terços dentro do estado). `motivo` diz ao leitor por que ela não pinta.
 */
export function situacaoComparativo({ ano, anosCenso, uf }: { ano: number; anosCenso: number[]; uf?: string }): { disponivel: boolean; pinta: boolean; motivo: string | null } {
  if (!anosCenso.includes(ano)) return { disponivel: false, pinta: false, motivo: `O Censo 2010 só é comparado com as eleições de ${new Intl.ListFormat("pt-BR").format(anosCenso.map(String))}.` };
  if (!uf) return { disponivel: true, pinta: false, motivo: "Abra um estado no mapa para pintar os municípios com o cruzamento." };
  return { disponivel: true, pinta: true, motivo: null };
}

/** O que o mapa está mostrando, em poucas palavras, para o botão do submenu: "Abstenção × IDHM", "Voto de legenda · PT". */
export function resumoCamadas({ ver, partido, comparativo }: { ver: Visao; partido?: string; comparativo?: string }): string {
  if (ver === "candidato") return "Votos de um candidato";
  if (ver === "legenda") return partido ? `Voto de legenda · ${partido}` : "Voto de legenda";
  return comparativo ? `Abstenção × ${comparativo}` : "Abstenção";
}

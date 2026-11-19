// Evolução do patrimônio declarado de uma pessoa entre as candidaturas dela, no perfil (/candidato/[id]). Lógica pura
// sobre GET /api/candidatos/<id>/patrimonio (api/app/queries/candidato_patrimonio.sql): uma linha por candidatura e tipo
// de bem; quem não declarou nada vem numa linha só, com cd_tipo_bem nulo e valor 0. Valores em reais da época, sem
// correção pela inflação.

import { pct, pctSinal, reais } from "./format";

/** Uma linha da API: a soma de um tipo de bem numa candidatura. */
export interface LinhaPatrimonio {
  id_candidatura: number; ano: number; cargo: string; uf: string | null; municipio: string | null; eleito: boolean;
  /** código do tipo de bem na declaração do Imposto de Renda; null quando a candidatura não declarou nenhum bem */
  cd_tipo_bem: number | null; valor: number; bens: number;
}

export type GrupoBem = "imoveis" | "veiculos" | "empresas" | "aplicacoes" | "outros";

/** Os grupos de bens, na ordem dos pedaços da barra, com a classe de cor (tokens --f1 a --f5 de globals.css). */
export const GRUPOS_BENS: { chave: GrupoBem; rotulo: string; classe: string }[] = [
  { chave: "imoveis", rotulo: "Imóveis", classe: "f1" },
  { chave: "veiculos", rotulo: "Veículos", classe: "f2" },
  { chave: "empresas", rotulo: "Empresas e ações", classe: "f3" },
  { chave: "aplicacoes", rotulo: "Dinheiro e aplicações", classe: "f4" },
  { chave: "outros", rotulo: "Outros bens", classe: "f5" },
];

/**
 * O grupo de um tipo de bem, pelas faixas de código da declaração do Imposto de Renda: 1–19 imóveis; 21–23 veículos
 * (terrestre, aeronave, embarcação); 31–39 participações em empresas e ações; 41–79 aplicações, créditos, depósitos,
 * dinheiro em espécie e fundos; o resto (outros bens móveis, direitos, consórcio, "outros bens e direitos") é "outros".
 */
export function grupoDoBem(cd: number | null): GrupoBem {
  if (cd == null) return "outros";
  if (cd >= 1 && cd <= 19) return "imoveis";
  if (cd >= 21 && cd <= 23) return "veiculos";
  if (cd >= 31 && cd <= 39) return "empresas";
  if (cd >= 41 && cd <= 79) return "aplicacoes";
  return "outros";
}

/** Uma candidatura na evolução, com o total, a composição e a variação desde a candidatura anterior. */
export interface PontoPatrimonio {
  id_candidatura: number; ano: number; cargo: string; lugar: string | null; eleito: boolean;
  total: number; bens: number;
  /** a soma de cada grupo, na ordem de GRUPOS_BENS (grupos sem valor ficam com 0) */
  grupos: { chave: GrupoBem; rotulo: string; classe: string; valor: number }[];
  /** a candidatura anterior (de ano menor) e a variação até esta; null na primeira */
  antes: { ano: number; total: number } | null;
  /** (total − anterior) ÷ anterior; null na primeira ou quando a anterior não tinha bens */
  variacao: number | null;
}

/** Junta as linhas da API numa candidatura por ponto, da mais antiga para a mais recente. */
export function evolucaoPatrimonio(linhas: LinhaPatrimonio[]): PontoPatrimonio[] {
  const porCand = new Map<number, PontoPatrimonio>();
  for (const l of linhas) {
    let p = porCand.get(l.id_candidatura);
    if (!p) {
      p = {
        id_candidatura: l.id_candidatura, ano: l.ano, cargo: l.cargo, lugar: l.municipio ?? l.uf, eleito: l.eleito, total: 0, bens: 0,
        grupos: GRUPOS_BENS.map((g) => ({ ...g, valor: 0 })), antes: null, variacao: null,
      };
      porCand.set(l.id_candidatura, p);
    }
    const valor = Number(l.valor) || 0;
    p.total += valor;
    p.bens += l.bens;
    p.grupos.find((g) => g.chave === grupoDoBem(l.cd_tipo_bem))!.valor += valor;
  }
  const pontos = [...porCand.values()].sort((a, b) => a.ano - b.ano || a.id_candidatura - b.id_candidatura);
  // a variação compara com a última candidatura de um ano anterior (duas no mesmo ano usam a mesma declaração)
  pontos.forEach((p) => {
    const anterior = pontos.filter((q) => q.ano < p.ano).at(-1);
    if (!anterior) return;
    p.antes = { ano: anterior.ano, total: anterior.total };
    p.variacao = anterior.total > 0 ? (p.total - anterior.total) / anterior.total : null;
  });
  return pontos;
}

/** Um múltiplo legível: 2,4; 12; 38 (uma casa só abaixo de 10). */
const vezes = (x: number) => (x < 10 ? Math.round(x * 10) / 10 : Math.round(x)).toLocaleString("pt-BR");

/** "+120%", "−30%"; partindo de zero, "de nada declarado"; sem candidatura anterior, null. */
export function textoVariacao(p: Pick<PontoPatrimonio, "antes" | "variacao" | "total">): string | null {
  if (!p.antes) return null;
  if (p.variacao != null) return `${pctSinal(p.variacao)} desde ${p.antes.ano}`;
  return p.total > 0 ? `nada declarado em ${p.antes.ano}` : `nada declarado também em ${p.antes.ano}`;
}

/**
 * A frase do topo do bloco, da primeira à última candidatura: "De R$ 1,5 milhão em 2018 para R$ 1 milhão em 2026:
 * diminuiu 32%."; acima do dobro, "De R$ 25 mil em 2016 para R$ 957 mil em 2026: multiplicou por 38." Com uma candidatura só, só o valor dela. Sem candidaturas, null.
 */
export function frasePatrimonio(pontos: PontoPatrimonio[]): string | null {
  const primeiro = pontos[0], ultimo = pontos.at(-1);
  if (!primeiro || !ultimo) return null;
  const valor = (t: number) => (t > 0 ? reais(t) : "nenhum bem");
  if (primeiro.ano === ultimo.ano) return `${valor(ultimo.total)} declarado${ultimo.total > 0 ? "s" : ""} em ${ultimo.ano}.`;
  const de = `De ${valor(primeiro.total)} em ${primeiro.ano} para ${valor(ultimo.total)} em ${ultimo.ano}`;
  if (primeiro.total <= 0) return `${de}.`;
  const v = (ultimo.total - primeiro.total) / primeiro.total;
  const r = Math.round(v * 100);
  // acima do dobro, "multiplicou por 38" é mais fácil de ler que "aumentou 3.726%"
  if (v >= 1) return `${de}: multiplicou por ${vezes(ultimo.total / primeiro.total)}.`;
  return r === 0 ? `${de}: praticamente igual.` : `${de}: ${r > 0 ? "aumentou" : "diminuiu"} ${pct(Math.abs(v), 0)}.`;
}

// Abstenção por município e indicadores do Censo 2010, para o mapa da página inicial (web/public/data/mapa.json,
// gerado por pipeline/sql/mapa.sql). Puro: recebe linhas e devolve números.

export interface LinhaMunicipio { id_municipio: number; cod_ibge: string; nome: string; uf: string }
export interface LinhaParticipacao { id_municipio: number; ano: number; aptos: number; comparecimento: number; abstencoes: number; brancos: number; nulos: number }
export interface LinhaIndicador { id_municipio: number; indicador: string; valor: number }

/** Eleições municipais em volta do Censo 2010: só nelas a abstenção é comparada com os indicadores do Censo. */
export const ANOS_CENSO = [2008, 2012];

export const INDICADORES_CENSO = [
  { chave: "idhm", rotulo: "IDHM", formato: "indice" },
  { chave: "rdpc", rotulo: "Renda por pessoa", formato: "reais" },
  { chave: "pmpob", rotulo: "Pobres", formato: "pct" },
  { chave: "t_analf18m", rotulo: "Analfabetismo (18 anos ou mais)", formato: "pct" },
  { chave: "t_med18m", rotulo: "Ensino médio completo (18 ou mais)", formato: "pct" },
  { chave: "gini", rotulo: "Desigualdade de renda (Gini)", formato: "indice" },
  { chave: "espvida", rotulo: "Esperança de vida", formato: "anos" },
  { chave: "t_des18m", rotulo: "Desocupação (18 ou mais)", formato: "pct" },
  { chave: "p_formal", rotulo: "Trabalho formal", formato: "pct" },
  { chave: "t_agua", rotulo: "Água encanada", formato: "pct" },
] as const;
export type ChaveIndicador = (typeof INDICADORES_CENSO)[number]["chave"];

/** Indicador do Atlas no formato de leitura: índices com 3 casas, porcentagens (já em 0–100) com 1, renda em reais. */
export function formatarIndicador(chave: ChaveIndicador, v: number): string {
  const formato = INDICADORES_CENSO.find((i) => i.chave === chave)!.formato;
  const n = (casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  if (formato === "indice") return n(3);
  if (formato === "reais") return `R$ ${n(0)}`;
  if (formato === "anos") return `${n(1)} anos`;
  return `${n(1)}%`;
}

export interface Total { aptos: number; abstencoes: number; comparecimento: number; brancos: number; nulos: number; taxa: number }

/** Soma as linhas e calcula a taxa de abstenção do conjunto (abstenções / aptos, não a média das taxas). */
export function somarParticipacao(linhas: LinhaParticipacao[]): Total {
  const t = { aptos: 0, abstencoes: 0, comparecimento: 0, brancos: 0, nulos: 0 };
  for (const l of linhas) {
    t.aptos += l.aptos; t.abstencoes += l.abstencoes; t.comparecimento += l.comparecimento; t.brancos += l.brancos; t.nulos += l.nulos;
  }
  return { ...t, taxa: t.aptos > 0 ? t.abstencoes / t.aptos : 0 };
}

/** Taxa de abstenção de uma linha; null se não há linha ou eleitorado. */
export const taxaDe = (l: { aptos: number; abstencoes: number } | undefined) => (l && l.aptos > 0 ? l.abstencoes / l.aptos : null);

export const anosDe =(linhas: LinhaParticipacao[]) => [...new Set(linhas.map((l) => l.ano))].sort((a, b) => a - b);

/** Taxa de abstenção de cada ano para um conjunto de municípios (todos, se `ids` for null). */
export function serieAbstencao(linhas: LinhaParticipacao[], ids: Set<number> | null): { ano: number; taxa: number }[] {
  return anosDe(linhas).map((ano) => ({ ano, taxa: somarParticipacao(linhas.filter((l) => l.ano === ano && (!ids || ids.has(l.id_municipio)))).taxa }));
}

/** Valores dos indicadores por município: id → { idhm: 0.7, ... }. */
export function indicadoresPorMunicipio(linhas: LinhaIndicador[]): Map<number, Record<string, number>> {
  const m = new Map<number, Record<string, number>>();
  for (const l of linhas) m.set(l.id_municipio, { ...m.get(l.id_municipio), [l.indicador]: l.valor });
  return m;
}

/** Média de um indicador nos municípios, ponderada pela população de 2010 (pesotot): um retrato do estado, não o índice oficial dele. */
export function mediaPonderada(ids: number[], ind: Map<number, Record<string, number>>, chave: string): number | null {
  let soma = 0, peso = 0;
  for (const id of ids) {
    const v = ind.get(id);
    if (v?.[chave] == null || !v.pesotot) continue;
    soma += v[chave] * v.pesotot;
    peso += v.pesotot;
  }
  return peso > 0 ? soma / peso : null;
}

/** Cortes que dividem os valores em `n` grupos de mesmo tamanho (quantis); devolve os n − 1 cortes. */
export function quantis(valores: number[], n: number): number[] {
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return [];
  return Array.from({ length: n - 1 }, (_, i) => v[Math.min(v.length - 1, Math.floor(((i + 1) * v.length) / n))]);
}

/** Grupo do valor (0 = menor) dados os cortes de `quantis`. */
export const classe = (v: number, cortes: number[]) => cortes.filter((c) => v >= c).length;

/** Rótulos da legenda a partir dos cortes: "até 10%", "10%–13%", …, "18% ou mais". */
export function rotulosFaixas(cortes: number[], fmt: (v: number) => string): string[] {
  if (!cortes.length) return [];
  return [`até ${fmt(cortes[0])}`, ...cortes.slice(0, -1).map((c, i) => `${fmt(c)}–${fmt(cortes[i + 1])}`), `${fmt(cortes[cortes.length - 1])} ou mais`];
}

/**
 * Classe de cor de um município no mapa: "q0".."q4" pelo quinto da abstenção; no cruzamento, "b<i><a>" com o terço do
 * indicador (i) e o da abstenção (a); "sem" quando falta um dos dados usados.
 */
export function corMunicipio(taxa: number | null, valor: number | undefined, c: { quintos: number[]; tercosAbst: number[]; tercosInd: number[] }, cruzar: boolean): string {
  if (taxa == null || (cruzar && valor == null)) return "sem";
  return cruzar ? `b${classe(valor!, c.tercosInd)}${classe(taxa, c.tercosAbst)}` : `q${classe(taxa, c.quintos)}`;
}

/** Correlação de Pearson; null com menos de 3 pontos ou sem variação. */
export function correlacao(pares: { x: number; y: number }[]): number | null {
  const n = pares.length;
  if (n < 3) return null;
  const mx = pares.reduce((s, p) => s + p.x, 0) / n, my = pares.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const { x, y } of pares) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Reta de mínimos quadrados y = a + b·x. */
export function tendencia(pares: { x: number; y: number }[]): { a: number; b: number } | null {
  const n = pares.length;
  if (n < 2) return null;
  const mx = pares.reduce((s, p) => s + p.x, 0) / n, my = pares.reduce((s, p) => s + p.y, 0) / n;
  const sxx = pares.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const b = pares.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  return { a: my - b * mx, b };
}

/** A correlação em palavras, para quem não lê "r": força pelo tamanho de |r| e sentido pelo sinal. */
export function lerCorrelacao(r: number, indicador: string): string {
  const f = Math.abs(r);
  if (f < 0.1) return `Quase nenhuma relação entre ${indicador} e abstenção`;
  const forca = f < 0.3 ? "fraca" : f < 0.5 ? "moderada" : "forte";
  return `Relação ${forca}: onde ${indicador} é maior, a abstenção tende a ser ${r > 0 ? "maior" : "menor"}`;
}

/** Posição de 0 a 1 do valor entre os valores (0 = o menor, 1 = o maior). */
export function posicao(v: number, valores: number[]): number {
  if (valores.length < 2) return 0.5;
  return valores.filter((x) => x < v).length / (valores.length - 1);
}

const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);
/** "SÃO JOSÉ DO EGITO" → "São José do Egito"; "SANT'ANA DO LIVRAMENTO" → "Sant'Ana do Livramento". */
export function nomeProprio(nome: string): string {
  return nome.toLocaleLowerCase("pt-BR").split(" ").map((p, i) =>
    i > 0 && MINUSCULAS.has(p) ? p : p.replace(/(^|['-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase("pt-BR")),
  ).join(" ");
}

/** Câmera do mapa: escala e deslocamento que põem a caixa [x0, y0, x1, y1] no centro de uma tela larg × alt, com folga. */
export function enquadrar(caixa: readonly number[], larg: number, alt: number, folga = 0.1): { x: number; y: number; k: number } {
  const [x0, y0, x1, y1] = caixa;
  const k = Math.min(larg / ((x1 - x0) * (1 + 2 * folga)), alt / ((y1 - y0) * (1 + 2 * folga)));
  return { x: larg / 2 - k * ((x0 + x1) / 2), y: alt / 2 - k * ((y0 + y1) / 2), k };
}

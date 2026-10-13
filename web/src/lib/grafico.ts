// Geometria dos gráficos em SVG feitos à mão. Puro: recebe números e devolve números ou o atributo `d` de um path.

export interface Ponto { x: number; y: number }

/** Escala linear do domínio [d0, d1] para a faixa [r0, r1]. */
export const escala = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);

/** Teto "redondo" para um eixo de proporção (0 a 1) e as marcas, com passo de 2, 5 ou 10 pontos percentuais. */
export function eixoPct(max: number): { teto: number; marcas: number[] } {
  const passo = max <= 0.1 ? 0.02 : max <= 0.3 ? 0.05 : 0.1;
  const n = Math.max(1, Math.ceil(max / passo - 1e-9));
  const marcas = Array.from({ length: n + 1 }, (_, i) => Math.round(i * passo * 1000) / 1000);
  return { teto: marcas[n], marcas };
}

/** Afasta rótulos verticais que se sobreporiam, mantendo a ordem: distância mínima `gap`, dentro de [min, max]. */
export function espalhar(ys: number[], gap: number, min = -Infinity, max = Infinity): number[] {
  const ordem = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const out = ordem.map((o) => o.y);
  for (let k = 0; k < out.length; k++) out[k] = Math.max(out[k], k ? out[k - 1] + gap : min);
  for (let k = out.length - 1; k >= 0; k--) out[k] = Math.min(out[k], k < out.length - 1 ? out[k + 1] - gap : max);
  const res: number[] = new Array(ys.length);
  ordem.forEach((o, k) => { res[o.i] = out[k]; });
  return res;
}

/** Distribui intervalos [x, x + largura] em linhas sem sobreposição (o primeiro que cabe); devolve a linha de cada item. */
export function empilhar(itens: { x: number; largura: number }[], folga = 8): number[] {
  const fimDaLinha: number[] = [];
  const res: number[] = new Array(itens.length);
  for (const { x, largura, i } of itens.map((it, i) => ({ ...it, i })).sort((a, b) => a.x - b.x || a.i - b.i)) {
    let linha = fimDaLinha.findIndex((fim) => fim + folga <= x);
    if (linha < 0) linha = fimDaLinha.push(0) - 1;
    fimDaLinha[linha] = x + largura;
    res[i] = linha;
  }
  return res;
}

/** y da linha poligonal (pontos em ordem de x) na posição x, por interpolação linear; null fora dela. */
export function yEm(pts: Ponto[], x: number): number | null {
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].x === x) return pts[i].y;
    if (i && pts[i - 1].x < x && x < pts[i].x) return pts[i - 1].y + ((x - pts[i - 1].x) / (pts[i].x - pts[i - 1].x)) * (pts[i].y - pts[i - 1].y);
  }
  return null;
}

/** Divide a linha em x: o trecho antes e o trecho depois; o ponto do corte entra nos dois. */
export function cortar(pts: Ponto[], x: number): [Ponto[], Ponto[]] {
  const y = yEm(pts, x);
  if (y == null) return pts.length && x < pts[0].x ? [[], pts] : [pts, []];
  const meio = { x, y };
  return [[...pts.filter((p) => p.x < x), meio], [meio, ...pts.filter((p) => p.x > x)]];
}

/** Atributo `d` de um path que liga os pontos. */
export const caminho = (pts: Ponto[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

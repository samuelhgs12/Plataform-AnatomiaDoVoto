// Zoom livre do mapa (a "lupa"): escala e deslocamento por cima do enquadramento da câmera. Puro: recebe e devolve números.

/** Tamanho da tela do mapa, em unidades do viewBox do SVG. */
export const TELA = { larg: 800, alt: 640 };
export const LUPA_MAX = 12;

/** k: escala (1 = enquadramento do servidor); x, y: deslocamento em unidades do viewBox. */
export interface Lupa { k: number; x: number; y: number }
export const LUPA_INICIAL: Lupa = { k: 1, x: 0, y: 0 };

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Mantém a tela dentro do desenho: com escala k, o deslocamento vai de tela·(1 − k) a 0. */
function limitar(l: Lupa): Lupa {
  return { k: l.k, x: entre(l.x, TELA.larg * (1 - l.k), 0), y: entre(l.y, TELA.alt * (1 - l.k), 0) };
}

/** Multiplica a escala por `fator` (entre 1 e LUPA_MAX) mantendo parado o ponto `p` (o cursor, em unidades do viewBox). */
export function aproximar(l: Lupa, fator: number, p: { x: number; y: number }): Lupa {
  const k = entre(l.k * fator, 1, LUPA_MAX);
  const r = k / l.k;
  return limitar({ k, x: p.x - (p.x - l.x) * r, y: p.y - (p.y - l.y) * r });
}

/** Move a lupa de (dx, dy) unidades do viewBox, a partir de onde o arrasto começou. */
export const arrastar = (inicio: Lupa, dx: number, dy: number): Lupa => limitar({ k: inicio.k, x: inicio.x + dx, y: inicio.y + dy });

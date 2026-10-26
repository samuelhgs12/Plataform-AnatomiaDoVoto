// Dica do mapa (o cartão que segue o cursor): o conteúdo de cada município ou estado e onde o cartão cabe na janela.
// Puro: recebe números e devolve números.

import { classe } from "./abstencao";

/** Uma linha da dica: rótulo, valor já formatado e, se houver, a régua da escala de cores do mapa. */
export interface MedidaDica {
  rotulo: string;
  valor: string;
  /** classes de cor de cada faixa da régua, da menor à maior (q0…q4 nos quintos; b00 b01 b02 num eixo do 3 × 3) */
  cores?: string[];
  /** onde o valor cai na régua, de 0 a 1 (sempre dentro da faixa da cor que ele tem no mapa) */
  p?: number;
}

/** O que a dica mostra: nome, recorte e medidas; `celula` é a casa da legenda 3 × 3 (b<indicador><abstenção>). */
export interface FichaDica { titulo: string; sub: string; medidas: MedidaDica[]; celula?: string }

/**
 * Posição de 0 a 1 do valor numa régua de faixas iguais (uma por cor): a faixa vem de `classe`, como a cor do mapa,
 * e dentro dela o valor é interpolado entre os cortes vizinhos (as pontas são o menor e o maior valor).
 */
export function naRegua(v: number, cortes: number[], min: number, max: number): number {
  const n = cortes.length + 1;
  const c = classe(v, cortes);
  const lo = c === 0 ? min : cortes[c - 1];
  const hi = c === cortes.length ? max : cortes[c];
  const f = hi > lo ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : 0.5;
  return (c + f) / n;
}

interface Caixa { larg: number; alt: number }

/**
 * Canto superior esquerdo da dica, em px da janela: abaixo e à direita do cursor; vira para a esquerda se passaria da
 * borda direita e para cima se passaria da de baixo. No fim, fica sempre a `margem` px das bordas (janela pequena).
 */
export function posicionarDica(cursor: { x: number; y: number }, dica: Caixa, janela: Caixa, folga = 16, margem = 8): { x: number; y: number; esquerda: boolean; acima: boolean } {
  const esquerda = cursor.x + folga + dica.larg > janela.larg - margem;
  const acima = cursor.y + folga + dica.alt > janela.alt - margem;
  const x = esquerda ? cursor.x - folga - dica.larg : cursor.x + folga;
  const y = acima ? cursor.y - folga - dica.alt : cursor.y + folga;
  const prender = (v: number, tam: number, lim: number) => Math.max(margem, Math.min(v, lim - margem - tam));
  return { x: prender(x, dica.larg, janela.larg), y: prender(y, dica.alt, janela.alt), esquerda, acima };
}

/** Lê a ficha gravada em `data-ficha`; null se faltar ou não for uma ficha. */
export function lerFicha(texto: string | null): FichaDica | null {
  if (!texto) return null;
  try {
    const f = JSON.parse(texto);
    return f && typeof f.titulo === "string" && Array.isArray(f.medidas) ? f : null;
  } catch {
    return null;
  }
}

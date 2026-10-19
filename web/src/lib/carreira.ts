import type { CarreiraItem } from "./types";
import { empilhar } from "./grafico";

/** Níveis do eixo Y da linha do tempo, do mais alto para o mais baixo. Vice-prefeito tem nível próprio. */
export const NIVEIS_CARREIRA: [number, string][] = [
  [8, "Presidente"], [7, "Governador"], [6, "Senador"], [5, "Dep. federal"], [4, "Dep. estadual"],
  [3, "Prefeito"], [2, "Vice-prefeito"], [1, "Vereador"],
];

const VICE_PREFEITO = 12;

// nível pelo id_cargo (vice-governador e vice-presidente no nível do titular, suplentes no de senador). É a mesma
// escala de NIVEL_CARGO em api/app/routers/util.py, mas calculada aqui para o gráfico não depender de respostas antigas em cache.
const NIVEL_CARGO: Record<number, number> = { 13: 1, 12: 2, 11: 3, 7: 4, 8: 4, 6: 5, 5: 6, 9: 6, 10: 6, 3: 7, 4: 7, 1: 8, 2: 8 };

export const nivelDoCargo = (c: Pick<CarreiraItem, "id_cargo" | "nivel">) => NIVEL_CARGO[c.id_cargo] ?? c.nivel;

/** Candidaturas da linha do tempo: titulares e vice-prefeito, em eleição ordinária e que de fato disputaram, por ano. */
export function naLinhaDoTempo(carreira: CarreiraItem[]): (CarreiraItem & { nivel: number })[] {
  return carreira
    .filter((c) => (c.eh_titular || c.id_cargo === VICE_PREFEITO) && c.tipo_eleicao === "ORDINARIA" && c.disputou)
    .map((c) => ({ ...c, nivel: nivelDoCargo(c) }))
    .sort((a, b) => a.ano - b.ano || a.nivel - b.nivel);
}

/** Largura aproximada de um texto em px (fonte sem serifa, maiúsculas e números). */
export const larguraTexto = (texto: string, fonte: number) => texto.length * fonte * 0.66;

export interface RotuloPartido { x: number; xPonto: number; partido: string; linha: number; largura: number }   // x: centro da etiqueta; xPonto: x do ponto

/**
 * Etiquetas de partido da faixa de baixo: uma por ano e partido (duas candidaturas no mesmo ano e partido dividem a
 * etiqueta), centradas em x mas sem passar de [min, max]. As que se sobreporiam vão para a linha de baixo (`linha` 0, 1, …).
 */
export function rotulosPartido(
  pontos: { x: number; partido: string | null }[], fonte: number,
  { folga = 6, margem = 14, min = -Infinity, max = Infinity }: { folga?: number; margem?: number; min?: number; max?: number } = {},
): RotuloPartido[] {
  const vistos = new Set<string>();
  const unicos = pontos.filter((p) => {
    const chave = `${p.x}|${p.partido}`;
    if (!p.partido || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  }) as { x: number; partido: string }[];
  const comLargura = unicos.map((p) => {
    const largura = larguraTexto(p.partido, fonte) + margem;
    return { partido: p.partido, xPonto: p.x, largura, x: Math.min(Math.max(p.x, min + largura / 2), max - largura / 2) };
  });
  const linhas = empilhar(comLargura.map((p) => ({ x: p.x - p.largura / 2, largura: p.largura })), folga);
  return comLargura.map((p, i) => ({ ...p, linha: linhas[i] }));
}

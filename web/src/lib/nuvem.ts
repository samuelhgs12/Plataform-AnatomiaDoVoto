// Nuvem de palavras da pergunta 9 (o que a campanha comprou em propaganda). Os termos vêm prontos da API
// (GET /api/candidaturas/<id>/propaganda, campo `termos`, dicionário em api/app/nuvem.py); aqui só se decide o tamanho
// de cada termo e onde ele fica. Puro: sem React, sem medir texto no navegador (o desenho é SVG feito no servidor).

import { reais } from "./format";

/** Um formato de uma peça ("adesivo perfurado", "praguinha"; "sem detalhe" = veio da categoria do TSE). */
export interface DetalheTermo { termo: string; centavos: number }
/**
 * Uma palavra da resposta da API: uma peça de propaganda ("adesivo", "santinho", "Facebook"...). Valores em centavos
 * inteiros (valor contratado). `generico`: não diz qual peça foi comprada ("impressos", "marketing"), vai em cor neutra.
 */
export interface TermoNuvem {
  termo: string; grupo: string; centavos: number; despesas: number; pela_categoria_centavos: number;
  generico: boolean; explicacao: string | null; detalhes: DetalheTermo[];
}
export interface Caixa { x: number; y: number; largura: number; altura: number }
/** `x`/`y` são o centro do termo; `parte` é a fração da propaganda (0 a 1). */
export interface PalavraNaNuvem extends TermoNuvem { tamanho: number; x: number; y: number; largura: number; altura: number; parte: number }
export interface Nuvem {
  palavras: PalavraNaNuvem[];
  /** Todos os termos com valor, na ordem da nuvem, para a tabela equivalente (inclui os que não couberam). */
  todos: (TermoNuvem & { parte: number })[];
  /** Termos que ficaram de fora do desenho (além do limite ou sem espaço): continuam na tabela. */
  fora: number;
  caixa: Caixa;
  totalCentavos: number;
  /** Valor cujo termo veio da categoria do TSE, porque a descrição não dizia o que foi comprado, e a parte dele (0 a 1). */
  pelaCategoriaCentavos: number;
  pelaCategoriaParte: number;
}

/** Largura média de uma letra da General Sans (peso 600), como fração do tamanho da fonte. Estimativa com folga. */
export const LARGURA_LETRA = 0.58;
export const larguraTexto = (texto: string, tamanho: number) => texto.length * tamanho * LARGURA_LETRA;

/** Tamanho da fonte pela raiz do valor (a área do texto cresce com o valor, não o comprimento), entre `min` e `max`. */
export function tamanhoFonte(valor: number, maior: number, min = 15, max = 48): number {
  if (maior <= 0 || valor <= 0) return min;
  return Math.round((min + (max - min) * Math.sqrt(Math.min(valor / maior, 1))) * 10) / 10;
}

/** Dois retângulos (dados pelo centro) se tocam, com `folga` entre eles? */
export function sobrepoe(a: { x: number; y: number; largura: number; altura: number },
  b: { x: number; y: number; largura: number; altura: number }, folga = 0): boolean {
  return Math.abs(a.x - b.x) * 2 < a.largura + b.largura + 2 * folga && Math.abs(a.y - b.y) * 2 < a.altura + b.altura + 2 * folga;
}

/**
 * Um termo como chegou da API, completado com os padrões do que faltar; null se não tiver nome e valor. A resposta pode
 * vir de uma API de outra versão (ou de um cache antigo do Next) sem `detalhes`, `generico`...: a nuvem perde o detalhe,
 * mas a página não quebra.
 */
export function normalizarTermo(t: Partial<TermoNuvem> | null | undefined): TermoNuvem | null {
  if (!t || typeof t.termo !== "string" || !t.termo || typeof t.centavos !== "number" || !Number.isFinite(t.centavos)) return null;
  const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    termo: t.termo, centavos: t.centavos, grupo: typeof t.grupo === "string" ? t.grupo : "", despesas: numero(t.despesas),
    pela_categoria_centavos: numero(t.pela_categoria_centavos), generico: t.generico === true,
    explicacao: typeof t.explicacao === "string" ? t.explicacao : null,
    detalhes: Array.isArray(t.detalhes)
      ? t.detalhes.filter((d) => d && typeof d.termo === "string" && typeof d.centavos === "number" && Number.isFinite(d.centavos))
      : [],
  };
}

/**
 * Monta a nuvem: os `limite` termos de maior valor, do maior para o menor, cada um no primeiro ponto livre de uma espiral
 * que sai do centro (mais larga que alta, para caber na coluna da página). Determinístico: mesma entrada, mesmo desenho.
 * Um termo que não acha lugar em `passos` tentativas fica só na tabela. A caixa tem um tamanho mínimo, para uma nuvem
 * de dois termos não virar letras gigantes ao esticar o SVG. Os termos passam por `normalizarTermo` antes de tudo.
 */
export function montarNuvem(recebidos: ReadonlyArray<Partial<TermoNuvem> | null | undefined>,
  { limite = 30, min = 15, max = 48, folga = 4, passos = 3000 } = {}): Nuvem {
  const termos = recebidos.map(normalizarTermo).filter((t): t is TermoNuvem => t !== null);
  const comValor = termos.filter((t) => t.centavos > 0)
    .sort((a, b) => b.centavos - a.centavos || a.termo.localeCompare(b.termo, "pt-BR"));
  const totalCentavos = comValor.reduce((s, t) => s + t.centavos, 0);
  const todos = comValor.map((t) => ({ ...t, parte: totalCentavos > 0 ? t.centavos / totalCentavos : 0 }));
  const maior = comValor[0]?.centavos ?? 0;
  const palavras: PalavraNaNuvem[] = [];
  for (const t of todos.slice(0, limite)) {
    const tamanho = tamanhoFonte(t.centavos, maior, min, max);
    const caixa = { largura: larguraTexto(t.termo, tamanho), altura: tamanho * 1.15 };
    for (let i = 0; i < passos; i++) {
      const ang = i * 0.2, raio = i * 0.45;                       // espiral de Arquimedes
      const p = { ...caixa, x: Math.round(raio * Math.cos(ang) * 1.8 * 10) / 10, y: Math.round(raio * Math.sin(ang) * 10) / 10 };
      if (!palavras.some((q) => sobrepoe(p, q, folga))) { palavras.push({ ...t, ...p, tamanho }); break; }
    }
  }
  const pelaCategoriaCentavos = comValor.reduce((s, t) => s + t.pela_categoria_centavos, 0);
  return {
    palavras, todos, fora: todos.length - palavras.length, caixa: caixaDe(palavras, folga * 2), totalCentavos,
    pelaCategoriaCentavos, pelaCategoriaParte: totalCentavos > 0 ? pelaCategoriaCentavos / totalCentavos : 0,
  };
}

/** Menor caixa que contém todas as palavras, com margem, e no mínimo 560 × 200 (centrada). */
export function caixaDe(palavras: { x: number; y: number; largura: number; altura: number }[], margem = 8, minLargura = 560, minAltura = 200): Caixa {
  if (!palavras.length) return { x: -minLargura / 2, y: -minAltura / 2, largura: minLargura, altura: minAltura };
  const x0 = Math.min(...palavras.map((p) => p.x - p.largura / 2)) - margem, x1 = Math.max(...palavras.map((p) => p.x + p.largura / 2)) + margem;
  const y0 = Math.min(...palavras.map((p) => p.y - p.altura / 2)) - margem, y1 = Math.max(...palavras.map((p) => p.y + p.altura / 2)) + margem;
  const largura = Math.max(x1 - x0, minLargura), altura = Math.max(y1 - y0, minAltura);
  const r = (v: number) => Math.round(v * 10) / 10;
  return { x: r((x0 + x1) / 2 - largura / 2), y: r((y0 + y1) / 2 - altura / 2), largura: r(largura), altura: r(altura) };
}

/**
 * Os formatos que a palavra junta, com a parte de cada um no valor dela: "adesivo perfurado 52%, praguinha 23%, adesivo
 * 15% e mais 2". Vazio quando não há o que detalhar (um formato só: "100%" não diz nada que a explicação não diga).
 */
export function textoDetalhes(t: Pick<TermoNuvem, "centavos" | "detalhes">, quantos = 3): string {
  const ds = t.detalhes.filter((d) => d.centavos > 0);
  if (ds.length < 2 || t.centavos <= 0) return "";
  const pct = (c: number) => { const p = (c / t.centavos) * 100; return p > 0 && p < 1 ? "menos de 1%" : `${Math.round(p)}%`; };
  const mostrados = ds.slice(0, quantos).map((d) => `${d.termo} ${pct(d.centavos)}`);
  const resto = ds.length - mostrados.length;
  return resto > 0 ? `${mostrados.join(", ")} e mais ${resto}` : mostrados.length > 1
    ? `${mostrados.slice(0, -1).join(", ")} e ${mostrados.at(-1)}` : mostrados[0];
}

/** Texto para leitor de tela: os termos de maior valor, com o valor de cada um. */
export function descricaoNuvem(n: Nuvem, quantos = 5): string {
  if (!n.palavras.length) return "Nuvem de palavras vazia: nenhuma despesa de propaganda com valor.";
  const top = n.todos.slice(0, quantos).map((t) => `${t.termo}, ${reais(t.centavos / 100)}`);
  return `Nuvem de palavras do que a campanha comprou em propaganda, ${n.todos.length} ${n.todos.length === 1 ? "termo" : "termos"}. `
    + `Maiores valores: ${top.join("; ")}.`;
}

// Testes estatísticos simples para as respostas "Sim / Não" das análises (perguntas 2 e 8), sem dependência do React.
// Em vez de só olhar se uma taxa é 20% maior que a outra, verificam se a diferença é grande demais para ser acaso
// (nível de 95%, |z| >= 1,96). Com poucos candidatos ou poucas disputas, a resposta vira "Não dá para afirmar.".

export const Z_95 = 1.96;
/** Diferença mínima, além de significativa, para responder "Sim" ou "Não" (o grupo com mais é ao menos 20% mais eleito). */
export const RAZAO_MINIMA = 1.2;
/** Abaixo disto (no menor grupo), uma diferença não significativa é tratada como falta de dados, e não como "igual". */
export const AMOSTRA_MINIMA = 100;

export type Resposta = "Sim." | "Não." | "Quase não faz diferença." | "Não dá para afirmar.";

/**
 * Teste z de duas proporções (com a proporção combinada). Devolve z > 0 quando o grupo 1 tem taxa maior.
 * null quando algum grupo está vazio.
 */
export function zProporcoes(eleitos1: number, n1: number, eleitos2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const p1 = eleitos1 / n1, p2 = eleitos2 / n2, p = (eleitos1 + eleitos2) / (n1 + n2);
  const ep = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (ep === 0) return 0;   // as duas taxas são 0% ou as duas 100%: nenhuma diferença
  return (p1 - p2) / ep;
}

/** Teste z de uma contagem contra o esperado (ex.: vitórias do maior gastador × sorteio), com a variância do esperado. */
export function zContagem(observado: number, esperado: number, variancia: number): number | null {
  if (variancia <= 0) return null;
  return (observado - esperado) / Math.sqrt(variancia);
}

/**
 * A resposta curta a partir de duas taxas e do teste:
 * - diferença significativa e ao menos 20% maior (ou menor): "Sim." (ou "Não.");
 * - significativa, mas pequena: "Quase não faz diferença.";
 * - não significativa: "Quase não faz diferença." com amostra grande, "Não dá para afirmar." com amostra pequena.
 */
export function responder(taxa1: number, taxa2: number, z: number | null, menorAmostra: number): Resposta {
  if (z === null) return "Não dá para afirmar.";
  if (Math.abs(z) < Z_95) return menorAmostra >= AMOSTRA_MINIMA ? "Quase não faz diferença." : "Não dá para afirmar.";
  if (taxa1 > taxa2) return taxa1 >= taxa2 * RAZAO_MINIMA ? "Sim." : "Quase não faz diferença.";
  return taxa2 >= taxa1 * RAZAO_MINIMA ? "Não." : "Quase não faz diferença.";
}

/** Compara a taxa de eleição de dois grupos (o "de cima" e o de comparação). */
export function compararGrupos(cima: { eleitos: number; candidaturas: number }, base: { eleitos: number; candidaturas: number }): { resposta: Resposta; z: number | null } {
  const z = zProporcoes(cima.eleitos, cima.candidaturas, base.eleitos, base.candidaturas);
  const t1 = cima.candidaturas ? cima.eleitos / cima.candidaturas : 0, t2 = base.candidaturas ? base.eleitos / base.candidaturas : 0;
  return { resposta: responder(t1, t2, z, Math.min(cima.candidaturas, base.candidaturas)), z };
}

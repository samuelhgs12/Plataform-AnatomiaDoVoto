const nf = new Intl.NumberFormat("pt-BR");

export const inteiro = (n: number) => nf.format(Math.round(n));
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const pct = (v: number, casas = 1) => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
/** Diferença entre duas proporções, em pontos percentuais e com sinal (0,012 → "+1,2 p.p."). */
export const pp = (v: number, casas = 1) => {
  const n = Math.abs(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${n} p.p.`;
};

export function compacto(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return inteiro(n);
}

export function iniciais(nome: string | null): string {
  const p = (nome ?? "?").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : "")).toUpperCase();
}

/** Cor estável por sigla de partido (não há identidade visual oficial nos dados). */
export function corPartido(sigla: string | null): string {
  let h = 0;
  for (const c of sigla ?? "") h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}

export const ROTULO_RESULTADO: Record<string, string> = {
  ELEITO: "Eleito", NAO_ELEITO: "Não eleito", NAO_ASSUMIU: "Não assumiu", NAO_DISPUTOU: "Não disputou", SEM_RESULTADO: "Sem resultado",
};

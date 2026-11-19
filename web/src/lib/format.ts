const nf = new Intl.NumberFormat("pt-BR");

export const inteiro = (n: number) => nf.format(Math.round(n));
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Reais com centavos, para valores pequenos como o gasto por voto: "R$ 4,87". */
export const brlCentavos = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (v: number, casas = 1) => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
/** Porcentagem com sinal, para variações (0,25 → "+25%"; −0,1 → "−10%"). */
export function pctSinal(v: number, casas = 0): string {
  const r = Number((v * 100).toFixed(casas));   // o sinal segue o valor arredondado: −0,4% com 0 casas vira "0%"
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${pct(Math.abs(r) / 100, casas)}`;
}

/** Ainda mais curto, para o selo dos estados no mapa e a legenda: casa decimal só abaixo de 10 ("9,5 mil", "223 mil", "1,2 mi"). */
export function curto(n: number): string {
  const um = (v: number, u: string) => `${(v < 10 ? Math.round(v * 10) / 10 : Math.round(v)).toLocaleString("pt-BR")} ${u}`;
  if (n >= 999_500) return um(n / 1e6, "mi");
  if (n >= 1e3) return um(n / 1e3, "mil");
  return inteiro(n);
}

/**
 * Votos de uma candidatura por escrito, com o 2º turno quando ela disputou: "53,9 mi votos no 1º turno e 64,3 mi no 2º";
 * sem 2º turno, só "21,5 mi votos". `fmt` escolhe o número (compacto, inteiro…).
 */
export function textoVotos(votos1t: number, votos2t: number | null | undefined, fmt: (n: number) => string = compacto): string {
  return votos2t == null ? `${fmt(votos1t)} votos` : `${fmt(votos1t)} votos no 1º turno e ${fmt(votos2t)} no 2º`;
}

export function compacto(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return inteiro(n);
}

/** Valor em reais por extenso curto, para leigos: "R$ 1,7 bilhão", "R$ 120 milhões", "R$ 20 mil", "R$ 950". */
export function reais(n: number): string {
  const curto = (v: number, um: string, varios: string) => {
    const r = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
    return `R$ ${r.toLocaleString("pt-BR")} ${r < 2 ? um : varios}`;
  };
  if (n >= 999_500_000) return curto(n / 1e9, "bilhão", "bilhões");
  if (n >= 999_500) return curto(n / 1e6, "milhão", "milhões");
  if (n >= 1e4) return `R$ ${Math.round(n / 1e3).toLocaleString("pt-BR")} mil`;
  return brl(n);
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

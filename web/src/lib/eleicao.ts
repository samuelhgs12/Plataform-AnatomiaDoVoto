import type { Cargo, Meta } from "./types";

// Eleições gerais (presidente, governador, senador, deputados) caem em anos que deixam resto 2 na divisão por 4
// (1998, 2002, ..., 2022); as municipais (prefeito e vereador), nos demais anos pares (2000, ..., 2024).
export const ehAnoGeral = (ano: number) => ano % 4 === 2;

const ID_PRESIDENTE = 1;
const ID_PREFEITO = 11;

/** Cargos titulares disputados no ano escolhido. */
export function cargosDoAno(meta: Meta, ano: number): Cargo[] {
  const geral = ehAnoGeral(ano);
  return meta.cargos.filter((c) => c.eh_titular && (c.unidade === "MUNICIPIO") !== geral);
}

/** Cargo padrão do ano: presidente nas eleições gerais, prefeito nas municipais. */
export const cargoPadrao = (ano: number) => (ehAnoGeral(ano) ? ID_PRESIDENTE : ID_PREFEITO);

/** Presidente é nacional; os demais cargos só fazem sentido dentro de uma UF. */
export const exigeUf = (cargo: Cargo | undefined) => cargo?.unidade !== "BR";

export interface Selecao { ano: number; cargo: Cargo; uf?: string }

/** Lê ano, cargo e UF da URL e corrige o que estiver faltando ou não combinar (ex.: prefeito em 2022). */
export function resolverSelecao(meta: Meta, ano?: string, cargo?: string, uf?: string): Selecao {
  const ultimoAno = Math.max(...meta.anos);
  const a = ano && meta.anos.includes(Number(ano)) ? Number(ano) : ultimoAno;
  const validos = cargosDoAno(meta, a);
  const c = validos.find((x) => String(x.id_cargo) === cargo) ?? validos.find((x) => x.id_cargo === cargoPadrao(a)) ?? validos[0];
  const u = uf && meta.ufs.includes(uf.toUpperCase()) ? uf.toUpperCase() : undefined;
  return { ano: a, cargo: c, uf: exigeUf(c) ? u : undefined };
}

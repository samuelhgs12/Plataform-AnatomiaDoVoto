// Grau de instrução dos eleitos x o da população (pergunta 4), para a camada Comparar › Instrução do mapa da página
// inicial. Tabelas `eleitos`, `prefeitos` e `populacao` da análise q4 (api/app/analises/q4.sql). Puro: recebe linhas e
// devolve números; a página só desenha.

/** Tabela `eleitos` de q4: ano x cargo (prefeito, vereador) x município x nível. */
export interface LinhaEleitosInstrucao { ano: number; cargo: string; uf: string; cod_ibge: string; nivel: number; eleitos: number }
/** Tabela `prefeitos` de q4: o prefeito eleito de cada município; nivel nulo = não informou. */
export interface LinhaPrefeito { ano: number; uf: string; cod_ibge: string; nome_urna: string | null; nivel: number | null }
/** Tabela `populacao` de q4: pessoas de 18 anos ou mais por município e nível, no Censo 2022. */
export interface LinhaPopulacaoInstrucao { uf: string; cod_ibge: string; nivel: number; populacao: number }

/** A escala comum da carga: as 4 categorias do IBGE (tabela 10061), com os rótulos do TSE dentro delas. */
export const NIVEIS = [
  { nivel: 1, rotulo: "Até fundamental incompleto" },
  { nivel: 2, rotulo: "Fundamental completo" },
  { nivel: 3, rotulo: "Médio completo" },
  { nivel: 4, rotulo: "Superior completo" },
] as const;
export const rotuloNivel = (nivel: number | null | undefined) => NIVEIS.find((n) => n.nivel === nivel)?.rotulo ?? null;

/**
 * O que pinta o mapa: a parte da população em um recorte dos 4 graus, acumulado do menor ao maior degrau da escala (quem
 * não completou o fundamental; quem chegou ao menos ao fundamental, ao médio ou ao superior completo). `niveis` são os
 * graus somados, contornados nas barras e nos cartões. `tem`/`tinham` completam a frase "da população …"/"dos eleitos …".
 */
export const MEDIDAS = [
  { chave: "sem-fundamental", rotulo: "Sem o fundamental completo", tem: "não completou o ensino fundamental", tinham: "não tinham completado o ensino fundamental", niveis: [1] },
  { chave: "fundamental", rotulo: "Fundamental completo ou mais", tem: "tem ao menos o ensino fundamental completo", tinham: "tinham ao menos o ensino fundamental completo", niveis: [2, 3, 4] },
  { chave: "medio", rotulo: "Médio completo ou mais", tem: "tem ao menos o ensino médio completo", tinham: "tinham ao menos o ensino médio completo", niveis: [3, 4] },
  { chave: "superior", rotulo: "Superior completo", tem: "tem ensino superior completo", tinham: "tinham ensino superior completo", niveis: [4] },
] as const;
export type Medida = (typeof MEDIDAS)[number];
/** O grau que o mapa mostra sem `med` na URL. */
export const MEDIDA_PADRAO: Medida = MEDIDAS[3];
export const medidaDe = (chave: string | undefined): Medida => MEDIDAS.find((m) => m.chave === chave) ?? MEDIDA_PADRAO;

/** As eleições municipais em volta do Censo 2022, o único com a instrução por município (o mesmo recorte de q4.sql). */
export const ANOS_INSTRUCAO: readonly number[] = [2020, 2024];

/** Pessoas em cada nível (índice 0 = nível 1) e o total. */
export interface Perfil { total: number; niveis: number[] }

function perfil<T extends { nivel: number }>(linhas: T[], valor: (l: T) => number): Perfil {
  const niveis = [0, 0, 0, 0];
  for (const l of linhas) if (l.nivel >= 1 && l.nivel <= 4) niveis[l.nivel - 1] += valor(l);
  return { total: niveis.reduce((s, n) => s + n, 0), niveis };
}

export interface Lugar { uf?: string; ibge?: string }

/** Eleitos do ano no lugar (sem lugar, os seis estados), por nível; com cargo, só os dele. */
export function perfilEleitos(linhas: LinhaEleitosInstrucao[], { ano, uf, ibge, cargo }: Lugar & { ano: number; cargo?: string }): Perfil {
  return perfil(linhas.filter((l) => l.ano === ano && (!uf || l.uf === uf) && (!ibge || l.cod_ibge === ibge) && (!cargo || l.cargo === cargo)), (l) => l.eleitos);
}

export function perfilPopulacao(linhas: LinhaPopulacaoInstrucao[], { uf, ibge }: Lugar = {}): Perfil {
  return perfil(linhas.filter((l) => (!uf || l.uf === uf) && (!ibge || l.cod_ibge === ibge)), (l) => l.populacao);
}

/** Parte de cada nível no total (0 a 1); zeros sem ninguém. */
export const partes = (p: Perfil) => p.niveis.map((n) => (p.total > 0 ? n / p.total : 0));

/** Parte do perfil nos níveis da medida; null sem ninguém. */
export const parteNaMedida = (p: Perfil, medida: Medida) =>
  p.total > 0 ? medida.niveis.reduce((s, n) => s + p.niveis[n - 1], 0) / p.total : null;

/** O nível com mais gente (empate: o mais baixo); null sem ninguém. */
export function predominante(p: Perfil): number | null {
  if (p.total <= 0) return null;
  return p.niveis.indexOf(Math.max(...p.niveis)) + 1;
}

/** O que a dica de cada município mostra: a taxa da população na medida, o nível mais comum nela e o prefeito eleito. */
export interface Municipio { taxa: number | null; predominante: number | null; prefeito: LinhaPrefeito | null }

/** Cada município pelo cod_ibge: a população (que não muda com o ano) e o prefeito eleito no ano. */
export function porMunicipio(pop: LinhaPopulacaoInstrucao[], prefeitos: LinhaPrefeito[], { ano, medida }: { ano: number; medida: Medida }): Map<string, Municipio> {
  const grupos = new Map<string, LinhaPopulacaoInstrucao[]>();
  for (const l of pop) grupos.set(l.cod_ibge, [...(grupos.get(l.cod_ibge) ?? []), l]);
  const prefeito = new Map(prefeitos.filter((p) => p.ano === ano).map((p) => [p.cod_ibge, p]));
  const saida = new Map<string, Municipio>();
  for (const [ibge, ls] of grupos) {
    const p = perfil(ls, (l) => l.populacao);
    saida.set(ibge, { taxa: parteNaMedida(p, medida), predominante: predominante(p), prefeito: prefeito.get(ibge) ?? null });
  }
  return saida;
}

/** Uma linha das barras de níveis do painel: a população e os eleitos (todos e, fora do município, por cargo). */
export interface LinhaNiveis { chave: string; rotulo: string; total: number; partes: number[] }

/**
 * As linhas das barras de níveis: a população de 18 anos ou mais, todos os eleitos e, num estado ou nos seis, os eleitos
 * de cada cargo (num município, o prefeito é uma pessoa só: ele aparece no cabeçalho do painel). Linhas sem ninguém
 * ficam de fora.
 */
export function linhasNiveis(eleitos: LinhaEleitosInstrucao[], pop: LinhaPopulacaoInstrucao[], { ano, uf, ibge }: Lugar & { ano: number }): LinhaNiveis[] {
  const linha = (chave: string, rotulo: string, p: Perfil): LinhaNiveis => ({ chave, rotulo, total: p.total, partes: partes(p) });
  const cargos = ibge ? [] : [...new Set(eleitos.filter((l) => l.ano === ano).map((l) => l.cargo))].sort((a, b) => (a === "Prefeito" ? -1 : b === "Prefeito" ? 1 : a.localeCompare(b)));
  // um cargo só (com gente no lugar) repetiria a linha de todos os eleitos
  const porCargo = cargos.map((c) => linha(`cargo-${c}`, `Eleitos: ${c.toLowerCase()}`, perfilEleitos(eleitos, { ano, uf, ibge, cargo: c }))).filter((l) => l.total > 0);
  return [
    linha("populacao", "População de 18 anos ou mais", perfilPopulacao(pop, { uf, ibge })),
    linha("eleitos", "Todos os eleitos", perfilEleitos(eleitos, { ano, uf, ibge })),
    ...(porCargo.length > 1 ? porCargo : []),
  ].filter((l) => l.total > 0);
}

/** Um eleito de /api/municipios/ibge/{cod_ibge}/eleitos: prefeito ou vereador, com a instrução e a chave da foto. */
export interface EleitoInstrucao {
  cargo: string; id_candidato: number | null; id_candidatura: number; nome_urna: string | null; partido: string | null;
  ano: number; ue: string; sequencial: string; escolaridade: string | null; nivel: number | null; votos: number;
}

/** O grau declarado ao TSE, em letra de frase ("ENSINO MÉDIO COMPLETO" → "Ensino médio completo"); sem ele, o do nível. */
export function grauDoEleito(e: { escolaridade: string | null; nivel: number | null }): string {
  const t = e.escolaridade?.trim();
  if (t) return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  return rotuloNivel(e.nivel) ?? "Não informado";
}

/** O prefeito (o primeiro, se a API mandar mais de um) e os vereadores, na ordem da API (mais votados primeiro). */
export function separarEleitos(lista: EleitoInstrucao[]): { prefeito: EleitoInstrucao | null; vereadores: EleitoInstrucao[] } {
  return { prefeito: lista.find((e) => e.cargo === "Prefeito") ?? null, vereadores: lista.filter((e) => e.cargo === "Vereador") };
}

/** Quantos estão nos níveis da medida (`n`), entre os que informaram a instrução (`de`). */
export function contarNaMedida(lista: { nivel: number | null }[], medida: Medida): { n: number; de: number } {
  const informados = lista.filter((e) => e.nivel != null);
  return { n: informados.filter((e) => (medida.niveis as readonly number[]).includes(e.nivel!)).length, de: informados.length };
}

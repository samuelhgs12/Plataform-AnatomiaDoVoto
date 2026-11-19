// Pergunta 2 na camada Dinheiro do mapa: existe relação entre o patrimônio declarado do candidato e a taxa de sucesso
// eleitoral? Lógica pura (sem React) sobre as tabelas pat_* de GET /api/analises/q2 (api/app/analises/q2.sql) e, numa
// cidade, sobre a lista de candidatos dela (/api/municipios/<id>/candidatos) com o patrimônio da tabela pat_cidade_<ano>.
//
// Regras (as mesmas do SQL): cada candidato é comparado só com os concorrentes da mesma disputa (a cidade para prefeito e
// vereador; o estado para deputados, governador e senador). "Sem bens" (patrimônio zero) é um grupo à parte, nunca o
// "menos rico". Décimo = 1 + ⌊10 × percent_rank⌋ entre quem declarou bens (máximo 10); posição = 1 para o mais rico,
// empates com a mesma posição, sem bens por último. "Sem quem já tinha o cargo" tira essas pessoas (vereador e
// deputados) ou a disputa inteira com alguém tentando a reeleição (prefeito, governador e senador).

import { reais } from "./format";

/** Eleições com patrimônio declarado na base (bem_candidato existe de 2006 em diante). */
export const ANOS_PATRIMONIO = [2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024];
/** Cargos com um eleito por disputa (senador: às vezes dois): a pergunta vira "o candidato mais rico venceu?". */
export const MAJORITARIOS_P2 = ["Prefeito", "Governador", "Senador"];
export const ehMajoritarioP2 = (cargo: string) => MAJORITARIOS_P2.includes(cargo);
/** As eleições do mesmo tipo do cargo (vereador e prefeito: municipais; os outros: gerais), para a série. */
export const anosDoTipo = (cargo: string) => ANOS_PATRIMONIO.filter((a) => (a % 4 === 0) === ["Prefeito", "Vereador"].includes(cargo));

// ---------- as tabelas da análise q2 ----------

/** pat_decis: candidatos e eleitos de cada décimo (0 = sem bens) por eleição, cargo, UF e tinha_cargo. */
export interface LinhaDecil { ano: number; cargo: string; uf: string; tinha_cargo: boolean; decil: number; candidatos: number; eleitos: number; mediana: number | null }
/** pat_vereador: a cidade (vereador) por tinha_cargo, para a cor do mapa. */
export interface LinhaVereadorCidade {
  ano: number; uf: string; id_municipio: number; tinha_cargo: boolean;
  candidatos: number; com_bens: number; eleitos: number; eleitos_com_bens: number; eleitos_rica: number;
}
/** pat_disputas: uma disputa de prefeito, governador ou senador. */
export interface LinhaDisputa {
  ano: number; cargo: string; uf: string; id_municipio: number | null; candidatos: number; com_bens: number; vagas: number;
  pos_eleito: number | null; eleito_sem_bens: boolean; eleito_tinha: boolean; reeleicao: boolean; no_topo: number;
}
/** pat_posicoes: candidatos e eleitos por posição no patrimônio (0 = sem bens; 4 = 4º ou abaixo). */
export interface LinhaPosicao { ano: number; cargo: string; uf: string; reeleicao: boolean; posicao: number; candidatos: number; eleitos: number; mediana: number | null }
/** pat_medianas: o patrimônio típico de eleitos e não eleitos (só quem declarou) e quantos não declararam nada. */
export interface LinhaMedianas {
  ano: number; cargo: string; uf: string; sem_cargo: boolean; eleitos: number; eleitos_sem_bens: number; nao_eleitos: number; nao_sem_bens: number;
  mediana_eleitos: number | null; mediana_nao: number | null; mediana_todos: number | null;
}
/** pat_pares: pares de candidatos da mesma disputa com votos diferentes; pontos = 2 por par concordante + 1 por empate. */
export interface LinhaPares { ano: number; cargo: string; uf: string; sem_cargo: boolean; pares: number; pontos: number }
/** pat_lista: as 10 primeiras linhas de cada lista de candidatos. */
export interface LinhaLista {
  ano: number; cargo: string; uf: string; sem_cargo: boolean; lista: Lista; pos: number; id_candidato: number | null; id_candidatura: number;
  nome_urna: string | null; partido: string | null; municipio: string | null; patrimonio: number; decil: number; posicao: number;
  na_disputa: number; votos: number; eleito: boolean; tinha_cargo: boolean;
}
/** pat_cidade_<ano>: patrimônio e tinha_cargo (1/0) de quem declarou bens ou já tinha o cargo, para juntar com a cidade. */
export interface LinhaPessoa { id_candidatura: number; patrimonio: number; tinha: number }

/** O recorte das tabelas: eleição (ou várias, nos majoritários das gerais), cargo e UF (sem UF, os seis estados). */
export interface FiltroP2 { anos: number[]; cargo: string; uf?: string }
const doFiltro = (f: FiltroP2) => (l: { ano: number; cargo: string; uf: string }) => f.anos.includes(l.ano) && l.cargo === f.cargo && (!f.uf || l.uf === f.uf);

// ---------- a escada: a taxa de eleição de cada grupo, do menos rico ao mais rico ----------

/** Um degrau: um grupo (sem bens, um décimo ou uma posição), quantos se elegeram e o patrimônio típico (mediana). */
export interface Degrau { chave: number; rotulo: string; curto: string; candidatos: number; eleitos: number; taxa: number | null; tipico: number | null }

/**
 * Mediana ponderada de medianas (o valor típico de um grupo que junta várias linhas: estados, quem tinha ou não o cargo).
 * É só um rótulo aproximado: a mediana exata não se soma. null sem nenhuma linha com valor.
 */
export function medianaPonderada(itens: { valor: number | null; peso: number }[]): number | null {
  const v = itens.filter((i): i is { valor: number; peso: number } => i.valor !== null && i.peso > 0).sort((a, b) => a.valor - b.valor);
  const total = v.reduce((a, i) => a + i.peso, 0);
  if (!total) return null;
  let acum = 0;
  for (const i of v) { acum += i.peso; if (acum >= total / 2) return i.valor; }
  return v[v.length - 1].valor;
}

const ordinal = (n: number) => `${n}º`;
export const ROTULO_DECIL = (d: number) => (d === 0 ? "Sem bens" : d === 1 ? "1º décimo (menos rico)" : d === 10 ? "10º décimo (mais rico)" : `${d}º décimo`);
export const ROTULO_POSICAO = (p: number) => (p === 0 ? "Sem bens" : p === 1 ? "1º mais rico" : p === 4 ? "4º ou abaixo" : `${p}º mais rico`);
/** Ordem dos degraus da esquerda para a direita: sem bens, depois do menos rico ao mais rico. */
const ORDEM_DECIS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ORDEM_POSICOES = [0, 4, 3, 2, 1];

function montarDegraus(chaves: number[], rotulo: (k: number) => string, curto: (k: number) => string,
  grupos: Map<number, { candidatos: number; eleitos: number; tipicos: { valor: number | null; peso: number }[] }>): Degrau[] {
  return chaves.flatMap((k) => {
    const g = grupos.get(k);
    if (!g || g.candidatos <= 0) return [];
    return [{ chave: k, rotulo: rotulo(k), curto: curto(k), candidatos: g.candidatos, eleitos: g.eleitos, taxa: g.eleitos / g.candidatos, tipico: k === 0 ? 0 : medianaPonderada(g.tipicos) }];
  });
}
function agrupar<T>(linhas: T[], chave: (l: T) => number, cand: (l: T) => number, ele: (l: T) => number, med: (l: T) => number | null) {
  const m = new Map<number, { candidatos: number; eleitos: number; tipicos: { valor: number | null; peso: number }[] }>();
  for (const l of linhas) {
    const g = m.get(chave(l)) ?? { candidatos: 0, eleitos: 0, tipicos: [] };
    g.candidatos += cand(l); g.eleitos += ele(l); g.tipicos.push({ valor: med(l), peso: cand(l) });
    m.set(chave(l), g);
  }
  return m;
}

/** A escada dos décimos (vereador e deputados) num recorte: sem bens e os 10 décimos, com ou sem quem já tinha o cargo. */
export function escada(linhas: LinhaDecil[], f: FiltroP2, { semCargo = false } = {}): Degrau[] {
  const sel = linhas.filter((l) => doFiltro(f)(l) && (!semCargo || !l.tinha_cargo));
  return montarDegraus(ORDEM_DECIS, ROTULO_DECIL, (d) => (d === 0 ? "sem bens" : ordinal(d)), agrupar(sel, (l) => l.decil, (l) => l.candidatos, (l) => l.eleitos, (l) => l.mediana));
}

/** A escada das posições (prefeito, governador, senador): sem bens, 4º ou abaixo, 3º, 2º e o mais rico; sem cargo = sem disputas com reeleição. */
export function escadaPosicoes(linhas: LinhaPosicao[], f: FiltroP2, { semCargo = false } = {}): Degrau[] {
  const sel = linhas.filter((l) => doFiltro(f)(l) && (!semCargo || !l.reeleicao));
  return montarDegraus(ORDEM_POSICOES, ROTULO_POSICAO, (p) => (p === 0 ? "sem bens" : p === 4 ? "4º ou –" : ordinal(p)), agrupar(sel, (l) => l.posicao, (l) => l.candidatos, (l) => l.eleitos, (l) => l.mediana));
}

/** A taxa do degrau de cima (o 10º décimo ou o 1º mais rico); null sem ele. */
export const taxaDoTopo = (d: Degrau[], { majoritario }: { majoritario: boolean }): number | null => d.find((x) => x.chave === (majoritario ? 1 : 10))?.taxa ?? null;

// ---------- a metade mais rica (vereador e deputados) ----------

/** Os eleitos de um recorte em relação à metade mais rica dos candidatos da própria disputa (décimos 6 a 10). */
export interface Metade { eleitos: number; comBens: number; rica: number; semBens: number; candidatos: number; parte: number | null }

/** A parte dos eleitos (que declararam bens) que estava na metade mais rica, a partir da escada. Eleitos sem bens ficam fora da conta. */
export function metadeMaisRica(d: Degrau[]): Metade {
  const soma = (f: (x: Degrau) => boolean) => d.filter(f).reduce((a, x) => a + x.eleitos, 0);
  const eleitos = soma(() => true), comBens = soma((x) => x.chave >= 1), rica = soma((x) => x.chave >= 6);
  return { eleitos, comBens, rica, semBens: eleitos - comBens, candidatos: d.reduce((a, x) => a + x.candidatos, 0), parte: comBens > 0 ? rica / comBens : null };
}

/** A metade mais rica de uma cidade (tabela pat_vereador), com ou sem quem já era vereador. null sem a cidade no ano. */
export function metadeDaCidade(linhas: LinhaVereadorCidade[], ano: number, id_municipio: number, { semCargo = false } = {}): Metade | null {
  const sel = linhas.filter((l) => l.ano === ano && l.id_municipio === id_municipio && (!semCargo || !l.tinha_cargo));
  if (!linhas.some((l) => l.ano === ano && l.id_municipio === id_municipio)) return null;
  const s = (k: "candidatos" | "eleitos" | "eleitos_com_bens" | "eleitos_rica") => sel.reduce((a, l) => a + l[k], 0);
  const comBens = s("eleitos_com_bens");
  return { eleitos: s("eleitos"), comBens, rica: s("eleitos_rica"), semBens: s("eleitos") - comBens, candidatos: s("candidatos"), parte: comBens > 0 ? s("eleitos_rica") / comBens : null };
}

// ---------- o mais rico venceu? (prefeito, governador, senador) ----------

export type CategoriaEleito = "primeiro" | "segundo" | "abaixo" | "sem_bens" | "fora";
export type MotivoFora = "um_candidato" | "sem_eleito" | "reeleicao" | "ninguem_declarou";
export interface PosicaoEleito { categoria: CategoriaEleito; motivo?: MotivoFora; posicao: number | null; candidatos: number; empateTopo: boolean; eleitoTinha: boolean }

/**
 * Onde o eleito estava no patrimônio da própria disputa: o mais rico, o 2º, o 3º ou abaixo, sem bens declarados, ou fora
 * da conta (um candidato só, sem eleito na base, ninguém declarou bens ou, com "sem quem já tinha o cargo", alguém
 * tentando a reeleição). Com duas vagas (senador), vale o eleito mais rico.
 */
export function posicaoDoEleito(d: LinhaDisputa, { semCargo = false } = {}): PosicaoEleito {
  const base = { posicao: d.pos_eleito, candidatos: d.candidatos, empateTopo: d.no_topo > 1, eleitoTinha: d.eleito_tinha };
  const fora = (motivo: MotivoFora): PosicaoEleito => ({ ...base, categoria: "fora", motivo });
  if (d.candidatos < 2) return fora("um_candidato");
  if (d.pos_eleito === null || d.vagas <= 0) return fora("sem_eleito");
  if (semCargo && d.reeleicao) return fora("reeleicao");
  if (d.com_bens <= 0) return fora("ninguem_declarou");
  if (d.eleito_sem_bens) return { ...base, categoria: "sem_bens" };
  return { ...base, categoria: d.pos_eleito === 1 ? "primeiro" : d.pos_eleito === 2 ? "segundo" : "abaixo" };
}

export interface VitoriaMaisRico { comparaveis: number; venceu: number; parte: number | null; categorias: Record<CategoriaEleito, number>; fora: Record<MotivoFora, number>; eleitoTinha: number }

/** Em quantas disputas do recorte o candidato mais rico venceu (entre as comparáveis), e o que ficou de fora e por quê. */
export function vitoriaDoMaisRico(ds: LinhaDisputa[], f: FiltroP2, { semCargo = false } = {}): VitoriaMaisRico {
  const categorias: Record<CategoriaEleito, number> = { primeiro: 0, segundo: 0, abaixo: 0, sem_bens: 0, fora: 0 };
  const fora: Record<MotivoFora, number> = { um_candidato: 0, sem_eleito: 0, reeleicao: 0, ninguem_declarou: 0 };
  let eleitoTinha = 0;
  for (const d of ds.filter(doFiltro(f))) {
    const p = posicaoDoEleito(d, { semCargo });
    categorias[p.categoria]++;
    if (p.motivo) fora[p.motivo]++;
    else if (p.eleitoTinha) eleitoTinha++;
  }
  const comparaveis = categorias.primeiro + categorias.segundo + categorias.abaixo + categorias.sem_bens;
  return { comparaveis, venceu: categorias.primeiro, parte: comparaveis > 0 ? categorias.primeiro / comparaveis : null, categorias, fora, eleitoTinha };
}

// ---------- a cidade escolhida: os candidatos dela com o patrimônio ----------

/** Um candidato da disputa com o patrimônio declarado e se já tinha o cargo. */
export interface CandidatoP2 {
  id_candidatura: number; id_candidato: number | null; nome_urna: string | null; partido: string | null;
  votos: number; eleito: boolean; patrimonio: number; tinha_cargo: boolean; municipio?: string | null;
}
/** O candidato na própria disputa: décimo, posição no patrimônio, posição nos votos (1 = o mais votado). */
export interface Classificado extends CandidatoP2 { decil: number; posicao: number; naDisputa: number; comBens: number; posVotos: number }

/** Junta a lista de candidatos da cidade com o patrimônio (pat_cidade_<ano>); quem não está na tabela declarou zero e não tinha o cargo. */
export function juntarPatrimonio<T extends { id_candidatura: number; id_candidato: number | null; nome_urna: string | null; partido: string | null; votos: number; eleito: boolean }>(
  cands: T[], pessoas: LinhaPessoa[]): CandidatoP2[] {
  const por = new Map(pessoas.map((p) => [p.id_candidatura, p]));
  return cands.map((c) => ({
    id_candidatura: c.id_candidatura, id_candidato: c.id_candidato, nome_urna: c.nome_urna, partido: c.partido, votos: c.votos, eleito: c.eleito,
    patrimonio: Math.max(0, por.get(c.id_candidatura)?.patrimonio ?? 0), tinha_cargo: (por.get(c.id_candidatura)?.tinha ?? 0) === 1,
  }));
}

/**
 * Décimo e posição de cada candidato de uma disputa, com a regra do SQL: entre quem declarou bens, percent_rank =
 * (quantos declararam menos) ÷ (n − 1) (0 com um só), décimo = 1 + ⌊10 × percent_rank⌋ (no máximo 10); sem bens = 0.
 * Posição = 1 + quantos declararam mais (empates juntos; sem bens por último). Posição nos votos idem, pelos votos.
 */
export function classificar(cands: CandidatoP2[]): Classificado[] {
  const com = cands.filter((c) => c.patrimonio > 0).map((c) => c.patrimonio).sort((a, b) => a - b);
  const n = com.length;
  const menores = (v: number) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (com[m] < v) lo = m + 1; else hi = m; } return lo; };
  const maiores = (v: number) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (com[m] <= v) lo = m + 1; else hi = m; } return n - lo; };
  const votos = cands.map((c) => c.votos);
  return cands.map((c) => {
    const pr = n > 1 ? menores(c.patrimonio) / (n - 1) : 0;
    return {
      ...c, naDisputa: cands.length, comBens: n,
      decil: c.patrimonio > 0 ? Math.min(10, 1 + Math.floor(10 * pr)) : 0,
      posicao: c.patrimonio > 0 ? 1 + maiores(c.patrimonio) : 1 + n,
      posVotos: 1 + votos.filter((v) => v > c.votos).length,
    };
  });
}

/**
 * Quem entra na conta da disputa: todos ou, sem quem já tinha o cargo, sem essas pessoas (vereador) ou nenhum (prefeito,
 * quando alguém tentava a reeleição: a disputa sai inteira). Disputa com um candidato só ou sem eleito fica de fora.
 */
export function recorteDaDisputa(cls: Classificado[], { majoritario, semCargo = false }: { majoritario: boolean; semCargo?: boolean }): Classificado[] {
  if (cls.length < 2 || !cls.some((c) => c.eleito)) return [];
  if (!semCargo) return cls;
  if (majoritario) return cls.some((c) => c.tinha_cargo) ? [] : cls;
  return cls.filter((c) => !c.tinha_cargo);
}

const mediana = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** A escada de uma disputa (décimos; nos majoritários, posições), dos candidatos já recortados. */
export function escadaDeCandidatos(cls: Classificado[], { majoritario }: { majoritario: boolean }): Degrau[] {
  const chave = (c: Classificado) => (majoritario ? (c.patrimonio > 0 ? Math.min(4, c.posicao) : 0) : c.decil);
  const grupos = new Map<number, { candidatos: number; eleitos: number; tipicos: { valor: number | null; peso: number }[] }>();
  const valores = new Map<number, number[]>();
  for (const c of cls) {
    const k = chave(c);
    const g = grupos.get(k) ?? { candidatos: 0, eleitos: 0, tipicos: [] };
    g.candidatos++; if (c.eleito) g.eleitos++;
    grupos.set(k, g);
    valores.set(k, [...(valores.get(k) ?? []), c.patrimonio]);
  }
  for (const [k, g] of grupos) g.tipicos = [{ valor: mediana(valores.get(k)!), peso: 1 }];
  return majoritario
    ? montarDegraus(ORDEM_POSICOES, ROTULO_POSICAO, (p) => (p === 0 ? "sem bens" : p === 4 ? "4º ou –" : ordinal(p)), grupos)
    : montarDegraus(ORDEM_DECIS, ROTULO_DECIL, (d) => (d === 0 ? "sem bens" : ordinal(d)), grupos);
}

/**
 * Uma disputa só (prefeito numa cidade): um degrau por candidato, do sem bens ao mais rico, com a parte dos votos do 1º
 * turno (taxa) e o patrimônio (tipico); eleitos = 1 para quem venceu. Responde "o mais rico teve mais votos?" sem
 * transformar uma disputa em porcentagens de vitória (0% ou 100%).
 */
export function escadaDeVotos(cls: Classificado[]): Degrau[] {
  const total = cls.reduce((a, c) => a + c.votos, 0);
  return [...cls].sort((a, b) => a.patrimonio - b.patrimonio || a.votos - b.votos).map((c, i) => {
    const nome = (c.nome_urna ?? "Sem nome").toLowerCase().replace(/(^|\s)\p{L}/gu, (x) => x.toUpperCase());
    return { chave: i + 1, rotulo: nome, curto: nome.split(" ")[0], candidatos: 1, eleitos: c.eleito ? 1 : 0, taxa: total > 0 ? c.votos / total : null, tipico: c.patrimonio };
  });
}

/** A disputa de prefeito de uma cidade no formato de pat_disputas (para posicaoDoEleito). null sem candidatos. */
export function disputaDeCandidatos(cls: Classificado[], f: { ano: number; cargo: string; uf: string; id_municipio: number | null }): LinhaDisputa | null {
  if (!cls.length) return null;
  const eleitos = cls.filter((c) => c.eleito);
  return {
    ...f, candidatos: cls.length, com_bens: cls[0].comBens, vagas: eleitos.length,
    pos_eleito: eleitos.length ? Math.min(...eleitos.map((c) => c.posicao)) : null,
    eleito_sem_bens: eleitos.length > 0 && eleitos.every((c) => c.patrimonio <= 0),
    eleito_tinha: eleitos.some((c) => c.tinha_cargo), reeleicao: cls.some((c) => c.tinha_cargo),
    no_topo: cls.filter((c) => c.posicao === 1 && c.patrimonio > 0).length,
  };
}

// ---------- eleitos e não eleitos: quanto declararam ----------

export interface Medianas { eleitos: number; eleitosSemBens: number; naoEleitos: number; naoSemBens: number; medianaEleitos: number | null; medianaNao: number | null; medianaTodos: number | null }

/** As medianas de um estado (tabela pat_medianas). null sem o recorte. */
export function medianasDoRecorte(linhas: LinhaMedianas[], f: { ano: number; cargo: string; uf: string }, { semCargo = false } = {}): Medianas | null {
  const l = linhas.find((x) => x.ano === f.ano && x.cargo === f.cargo && x.uf === f.uf && x.sem_cargo === semCargo);
  return l ? { eleitos: l.eleitos, eleitosSemBens: l.eleitos_sem_bens, naoEleitos: l.nao_eleitos, naoSemBens: l.nao_sem_bens, medianaEleitos: l.mediana_eleitos, medianaNao: l.mediana_nao, medianaTodos: l.mediana_todos } : null;
}

/** As medianas dos candidatos de uma disputa (já recortados): só quem declarou bens entra na mediana. */
export function medianasDeCandidatos(cls: CandidatoP2[]): Medianas {
  const com = (eleito: boolean) => cls.filter((c) => c.eleito === eleito && c.patrimonio > 0).map((c) => c.patrimonio);
  const sem = (eleito: boolean) => cls.filter((c) => c.eleito === eleito && c.patrimonio <= 0).length;
  return {
    eleitos: cls.filter((c) => c.eleito).length, eleitosSemBens: sem(true), naoEleitos: cls.filter((c) => !c.eleito).length, naoSemBens: sem(false),
    medianaEleitos: mediana(com(true)), medianaNao: mediana(com(false)), medianaTodos: mediana(cls.filter((c) => c.patrimonio > 0).map((c) => c.patrimonio)),
  };
}

// ---------- de que grupo de patrimônio vieram os eleitos (para o número do décimo mais rico) ----------

export interface GrupoComposicao { chave: string; rotulo: string; candidatos: number; eleitos: number; parteCandidatos: number; parteEleitos: number; cor: string }

/**
 * Candidatos e eleitos em quatro grupos (sem bens, metade menos rica, 6º ao 9º décimo, os 10% mais ricos) ou, nos
 * majoritários, por posição (sem bens, 4º ou abaixo, 3º, 2º, o mais rico): de relance, que parte das vagas cada um levou.
 */
export function composicaoEleitos(d: Degrau[], { majoritario }: { majoritario: boolean }): GrupoComposicao[] {
  const grupos = majoritario
    ? [{ chave: "sem", rotulo: "Sem bens", k: [0], cor: "o" }, { chave: "4", rotulo: "4º ou abaixo", k: [4], cor: "q0" }, { chave: "3", rotulo: "3º mais rico", k: [3], cor: "q1" },
      { chave: "2", rotulo: "2º mais rico", k: [2], cor: "q3" }, { chave: "1", rotulo: "O mais rico", k: [1], cor: "q4" }]
    : [{ chave: "sem", rotulo: "Sem bens", k: [0], cor: "o" }, { chave: "baixo", rotulo: "Metade menos rica", k: [1, 2, 3, 4, 5], cor: "q1" },
      { chave: "meio", rotulo: "6º ao 9º décimo", k: [6, 7, 8, 9], cor: "q3" }, { chave: "topo", rotulo: "Os 10% mais ricos", k: [10], cor: "q4" }];
  const tc = d.reduce((a, x) => a + x.candidatos, 0), te = d.reduce((a, x) => a + x.eleitos, 0);
  return grupos.map((g) => {
    const sel = d.filter((x) => g.k.includes(x.chave));
    const candidatos = sel.reduce((a, x) => a + x.candidatos, 0), eleitos = sel.reduce((a, x) => a + x.eleitos, 0);
    return { chave: g.chave, rotulo: g.rotulo, candidatos, eleitos, parteCandidatos: tc ? candidatos / tc : 0, parteEleitos: te ? eleitos / te : 0, cor: g.cor };
  }).filter((g) => g.candidatos > 0);
}
/** O grupo de cima da composição (os 10% mais ricos ou o mais rico): a frase "é X% dos candidatos, mas Y% dos eleitos". */
export const topoDaComposicao = (g: GrupoComposicao[]) => g.find((x) => x.chave === "topo" || x.chave === "1") ?? null;

/**
 * O card do grupo de cima, para a coluna ao lado da resposta: o título ("Décimo mais rico" ou, nos majoritários, "O
 * mais rico de cada disputa") e a parte dos eleitos e a dos candidatos que ele é (0 a 1, para os números e as barras).
 * null sem o grupo ou sem eleitos.
 */
export function cardDoTopo(topo: GrupoComposicao | null, { majoritario }: { majoritario: boolean }): { titulo: string; eleitos: number; candidatos: number } | null {
  if (!topo || topo.eleitos <= 0) return null;
  return { titulo: majoritario ? "O mais rico de cada disputa" : "Décimo mais rico", eleitos: topo.parteEleitos, candidatos: topo.parteCandidatos };
}

/** Quantas vezes o patrimônio típico do eleito é o do não eleito (arredondado); null se o não eleito típico for ≤ 0. */
export function vezesPatrimonio(eleito: number | null, naoEleito: number | null): number | null {
  if (eleito === null || naoEleito === null || naoEleito <= 0) return null;
  return Math.round(eleito / naoEleito);
}

/**
 * O card da outra variante: a mesma medida da resposta com a escolha oposta do chip ("Sem quem já tinha o cargo" quando
 * o chip está em "Com todos", e vice-versa), comparada com a escolha atual: "68%" + "na metade mais rica" + "com todos:
 * 79%". `tipo`: a metade mais rica (vereador e deputados) ou as cidades que elegeram o mais rico (prefeito no estado).
 * null sem o valor da outra variante.
 */
export function cardOutraVariante(cargo: string, semCargo: boolean, tipo: "metade" | "vitoria", atual: number | null, outra: number | null): { titulo: string; valor: string; unidade: string; compara: string | null } | null {
  if (outra === null) return null;
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  return {
    titulo: semCargo ? "Com todos" : rotuloSemCargo(cargo),
    valor: pct(outra),
    unidade: tipo === "metade" ? "na metade mais rica" : "das cidades elegeram o mais rico",
    compara: atual === null ? null : `${semCargo ? `sem ${quemTinha(cargo)}` : "com todos"}: ${pct(atual)}`,
  };
}

/** O rótulo curto do número da resposta: a posição do eleito (disputa única), o mais rico venceu (prefeito no estado) ou a metade mais rica. */
export function rotuloRespostaP2({ unica, prefeitoEstado }: { unica: boolean; prefeitoEstado: boolean }): string {
  return unica ? "Onde estava o eleito" : prefeitoEstado ? "O mais rico venceu?" : "Eleitos na metade mais rica";
}

// ---------- concordância por pares ----------

/** Pares de candidatos com votos diferentes e a parte em que o de maior patrimônio teve mais votos (empate vale meio). */
export interface Concordancia { pares: number; parte: number | null }

/** Soma os pares de um recorte (tabela pat_pares). */
export function concordancia(linhas: LinhaPares[], f: FiltroP2, { semCargo = false } = {}): Concordancia {
  const sel = linhas.filter((l) => doFiltro(f)(l) && l.sem_cargo === semCargo);
  const pares = sel.reduce((a, l) => a + l.pares, 0), pontos = sel.reduce((a, l) => a + l.pontos, 0);
  return { pares, parte: pares > 0 ? pontos / (2 * pares) : null };
}

/** Os pares de uma disputa (candidatos já recortados), com a regra do SQL: só quem declarou bens, votos diferentes. */
export function concordanciaDeCandidatos(cls: CandidatoP2[]): Concordancia {
  const com = cls.filter((c) => c.patrimonio > 0);
  let pares = 0, pontos = 0;
  for (let i = 0; i < com.length; i++) {
    for (let j = i + 1; j < com.length; j++) {
      const [a, b] = com[i].votos > com[j].votos ? [com[i], com[j]] : [com[j], com[i]];
      if (a.votos === b.votos) continue;
      pares++;
      pontos += a.patrimonio > b.patrimonio ? 2 : a.patrimonio === b.patrimonio ? 1 : 0;
    }
  }
  return { pares, parte: pares > 0 ? pontos / (2 * pares) : null };
}

// ---------- as listas de candidatos ----------

export type Lista = "ricos" | "perderam" | "menos";
export const LISTAS: { chave: Lista; rotulo: string }[] = [
  { chave: "ricos", rotulo: "Os mais ricos" },
  { chave: "perderam", rotulo: "Ricos que não se elegeram" },
  { chave: "menos", rotulo: "Eleitos com menos bens" },
];
export const listaDe = (v: string | string[] | undefined): Lista => LISTAS.find((l) => l.chave === (Array.isArray(v) ? v[0] : v))?.chave ?? "ricos";

/** Uma linha da lista: a pessoa, o patrimônio e a posição dela na própria disputa ("1º mais rico de 842"). */
export interface ItemLista {
  id_candidato: number | null; id_candidatura: number; nome: string; partido: string; municipio: string | null;
  patrimonio: number; decil: number; posicao: number; naDisputa: number; votos: number; eleito: boolean; tinhaCargo: boolean;
}

/** A lista de um estado (tabela pat_lista), em ordem. */
export function listaDoRecorte(linhas: LinhaLista[], f: { ano: number; cargo: string; uf: string }, lista: Lista, { semCargo = false } = {}): ItemLista[] {
  return linhas.filter((l) => l.ano === f.ano && l.cargo === f.cargo && l.uf === f.uf && l.sem_cargo === semCargo && l.lista === lista)
    .sort((a, b) => a.pos - b.pos)
    .map((l) => ({
      id_candidato: l.id_candidato, id_candidatura: l.id_candidatura, nome: l.nome_urna ?? "(sem nome)", partido: l.partido ?? "?", municipio: l.municipio,
      patrimonio: l.patrimonio, decil: l.decil, posicao: l.posicao, naDisputa: l.na_disputa, votos: l.votos, eleito: l.eleito, tinhaCargo: l.tinha_cargo,
    }));
}

/** A mesma lista numa disputa (candidatos já recortados), com a ordem do SQL. */
export function listaDeCandidatos(cls: Classificado[], lista: Lista, n = 10): ItemLista[] {
  const sel = lista === "ricos" ? cls.filter((c) => c.patrimonio > 0) : lista === "perderam" ? cls.filter((c) => !c.eleito && c.patrimonio > 0) : cls.filter((c) => c.eleito);
  const ordem = lista === "menos"
    ? (a: Classificado, b: Classificado) => a.decil - b.decil || a.patrimonio - b.patrimonio || b.votos - a.votos || a.id_candidatura - b.id_candidatura
    : (a: Classificado, b: Classificado) => b.patrimonio - a.patrimonio || a.id_candidatura - b.id_candidatura;
  return [...sel].sort(ordem).slice(0, n).map((c) => ({
    id_candidato: c.id_candidato, id_candidatura: c.id_candidatura, nome: c.nome_urna ?? "(sem nome)", partido: c.partido ?? "?", municipio: c.municipio ?? null,
    patrimonio: c.patrimonio, decil: c.decil, posicao: c.posicao, naDisputa: c.naDisputa, votos: c.votos, eleito: c.eleito, tinhaCargo: c.tinha_cargo,
  }));
}

/** A disputa inteira em ordem de patrimônio (prefeito numa cidade, governador num estado): do mais rico aos sem bens; empate, mais votos primeiro. */
export function disputaEmOrdem(cls: Classificado[]): ItemLista[] {
  return [...cls].sort((a, b) => a.posicao - b.posicao || b.votos - a.votos || a.id_candidatura - b.id_candidatura).map((c) => ({
    id_candidato: c.id_candidato, id_candidatura: c.id_candidatura, nome: c.nome_urna ?? "(sem nome)", partido: c.partido ?? "?", municipio: c.municipio ?? null,
    patrimonio: c.patrimonio, decil: c.decil, posicao: c.posicao, naDisputa: c.naDisputa, votos: c.votos, eleito: c.eleito, tinhaCargo: c.tinha_cargo,
  }));
}

/**
 * A escala das barras da lista: o maior patrimônio, a menos que ele seja mais de 5 vezes o 2º (quase sempre erro de
 * digitação, como bilhões para vereador): aí vale o 2º, e o valor que passa dele fica marcado como fora do comum (a
 * barra enche e a pessoa continua na lista; nada é removido).
 */
export function escalaLista(valores: number[]): { max: number; foraDoComum: (v: number) => boolean } {
  const v = [...valores].filter((x) => x > 0).sort((a, b) => b - a);
  const max = v.length > 1 && v[0] > 5 * v[1] ? v[1] : v[0] ?? 1;
  return { max, foraDoComum: (x) => v.length > 1 && x > 5 * v[1] };
}

/** A posição na própria disputa, por extenso: "1º mais rico de 842", "sem bens declarados (842 candidatos)". */
export const textoPosicao = (i: { patrimonio: number; posicao: number; naDisputa: number }) =>
  i.patrimonio > 0 ? `${i.posicao}º mais rico de ${i.naDisputa.toLocaleString("pt-BR")}` : `sem bens declarados (${i.naDisputa.toLocaleString("pt-BR")} candidatos)`;

// ---------- as cores do mapa ----------

/** Cidades com menos candidatos que isso ficam hachuradas ("poucos candidatos"): a metade mais rica é de 3 ou 4 pessoas. */
export const MINIMO_CANDIDATOS = 15;
/** Cortes da escala divergente da metade mais rica: o neutro (50–60%) é "pouca ou nenhuma relação". */
export const CORTES_METADE = [0.4, 0.5, 0.6, 0.7];

/** Classe de cor da metade mais rica: d0 (azul, abaixo de 40%) a d4 (amarelo, 70% ou mais); d2 = o neutro; "poucos"; "sem". */
export function corDaMetade(parte: number | null, candidatos: number): string {
  if (candidatos > 0 && candidatos < MINIMO_CANDIDATOS) return "poucos";
  if (parte === null) return "sem";
  return `d${CORTES_METADE.filter((c) => parte >= c).length}`;
}

export function legendaMetade(): { classe: string; texto: string }[] {
  return [
    { classe: "d0", texto: "menos de 40%" }, { classe: "d1", texto: "40–50%" }, { classe: "d2", texto: "50–60%: pouca ou nenhuma relação" },
    { classe: "d3", texto: "60–70%" }, { classe: "d4", texto: "70% ou mais" }, { classe: "poucos", texto: `menos de ${MINIMO_CANDIDATOS} candidatos` },
  ];
}

/** Classe de cor do prefeito eleito: p1 (o mais rico), p2 (o 2º), p3 (3º ou abaixo), psb (eleito sem bens), fora. */
export const COR_CATEGORIA: Record<CategoriaEleito, string> = { primeiro: "p1", segundo: "p2", abaixo: "p3", sem_bens: "psb", fora: "fora" };
export const ROTULO_CATEGORIA: Record<CategoriaEleito, string> = {
  primeiro: "Venceu o mais rico", segundo: "Venceu o 2º mais rico", abaixo: "Venceu o 3º ou abaixo", sem_bens: "Venceu alguém sem bens declarados", fora: "Fora da conta",
};
export const ROTULO_MOTIVO: Record<MotivoFora, string> = {
  um_candidato: "um candidato só", sem_eleito: "sem eleito na base", reeleicao: "alguém tentava a reeleição", ninguem_declarou: "ninguém declarou bens",
};
export function legendaPrefeito(): { classe: string; texto: string }[] {
  return (["primeiro", "segundo", "abaixo", "sem_bens", "fora"] as CategoriaEleito[]).map((c) => ({ classe: COR_CATEGORIA[c], texto: ROTULO_CATEGORIA[c] }));
}

/** Estados no modo prefeito: a parte das cidades em que o mais rico venceu, em faixas (azul → amarelo). */
export const CORTES_CIDADES = [0.3, 0.4, 0.5, 0.6];
export const corDaParteCidades = (parte: number | null) => (parte === null ? "sem" : `q${CORTES_CIDADES.filter((c) => parte >= c).length}`);
export function legendaParteCidades(): { classe: string; texto: string }[] {
  return [{ classe: "q0", texto: "menos de 30%" }, { classe: "q1", texto: "30–40%" }, { classe: "q2", texto: "40–50%" }, { classe: "q3", texto: "50–60%" }, { classe: "q4", texto: "60% ou mais" }];
}

// ---------- a série nas eleições ----------

export interface PontoSerie { ano: number; valor: number | null; n: number }

/** A metade mais rica em cada eleição do tipo do cargo (estado ou os seis). */
export function serieMetade(linhas: LinhaDecil[], cargo: string, uf: string | undefined, { semCargo = false } = {}): PontoSerie[] {
  return anosDoTipo(cargo).map((ano) => { const m = metadeMaisRica(escada(linhas, { anos: [ano], cargo, uf }, { semCargo })); return { ano, valor: m.parte, n: m.comBens }; });
}
/** A metade mais rica de uma cidade em cada eleição municipal. */
export function serieMetadeCidade(linhas: LinhaVereadorCidade[], id_municipio: number, { semCargo = false } = {}): PontoSerie[] {
  return anosDoTipo("Vereador").map((ano) => { const m = metadeDaCidade(linhas, ano, id_municipio, { semCargo }); return { ano, valor: m?.parte ?? null, n: m?.comBens ?? 0 }; });
}
/** A parte das disputas em que o mais rico venceu, em cada eleição (estado ou os seis). */
export function serieMaisRico(ds: LinhaDisputa[], cargo: string, uf: string | undefined, { semCargo = false } = {}): PontoSerie[] {
  return anosDoTipo(cargo).map((ano) => { const v = vitoriaDoMaisRico(ds, { anos: [ano], cargo, uf }, { semCargo }); return { ano, valor: v.parte, n: v.comparaveis }; });
}
/**
 * O título da série, a resposta numa frase, com a última eleição que tem dado e as duas linhas: vereador e deputados,
 * "Em 2022, 8 em cada 10 eleitos estavam na metade mais rica; sem quem já tinha o cargo, 5 em cada 10"; prefeito, "Em
 * 2024, o mais rico venceu em 53% das cidades; sem disputas com reeleição, 51%". null sem nenhum ano com dado.
 */
export function fraseSerie(com: PontoSerie[], sem: PontoSerie[] | null, cargo: string): string | null {
  const ultimo = [...com].reverse().find((p) => p.valor !== null);
  if (!ultimo) return null;
  const outro = sem?.find((p) => p.ano === ultimo.ano)?.valor ?? null;
  if (ehMajoritarioP2(cargo)) {
    const onde = cargo === "Prefeito" ? "das cidades" : "das disputas";
    return `Em ${ultimo.ano}, o mais rico venceu em ${Math.round(ultimo.valor! * 100)}% ${onde}${outro === null ? "" : `; sem disputas com reeleição, ${Math.round(outro * 100)}%`}`;
  }
  const dez = (v: number) => Math.round(v * 10);
  return `Em ${ultimo.ano}, ${dez(ultimo.valor!)} em cada 10 eleitos estavam na metade mais rica${outro === null ? "" : `; sem quem já tinha o cargo, ${dez(outro)} em cada 10`}`;
}

/**
 * O eixo da série (0 a 1), pelos dados, em décimos com folga. Vereador e deputados: começa em 40% ou abaixo, para o
 * neutro (50%) ficar à vista. Marcas só onde não colidem: o 50% (escrito "50% · sem relação") e o topo, se estiver
 * longe dele; nos majoritários, a base e o topo.
 */
export function eixoSerie(valores: (number | null)[], cargo: string): { min: number; max: number; marcas: number[] } {
  const v = valores.filter((x): x is number => x !== null);
  const dec = (x: number) => Math.round(x * 10) / 10;
  const baixo = v.length ? Math.floor((Math.min(...v) - 0.03) * 10) / 10 : 0.4;
  const alto = v.length ? Math.ceil((Math.max(...v) + 0.03) * 10) / 10 : 0.8;
  if (!ehMajoritarioP2(cargo)) {
    const min = dec(Math.max(0, Math.min(0.4, baixo))), max = dec(Math.min(1, Math.max(min + 0.3, alto)));
    return { min, max, marcas: [0.5, ...(Math.round((max - 0.5) * 10) >= 2 ? [max] : [])] };
  }
  const min = dec(Math.max(0, baixo)), max = dec(Math.min(1, Math.max(min + 0.2, alto)));
  return { min, max, marcas: [min, max] };
}

/**
 * Afasta rótulos verticais (posições y, de cima para baixo, na ordem dada) para que fiquem a pelo menos `minimo` um do
 * outro, mexendo o mínimo e dentro de [lo, hi]: desce os que encostam no de cima e, se o último passar do fim, sobe o
 * grupo. Puro, para o SVG do servidor (sem medir no navegador).
 */
export function afastarRotulos(ys: number[], minimo: number, lo = -Infinity, hi = Infinity): number[] {
  const r = ys.map((y) => Math.min(hi, Math.max(lo, y)));
  for (let i = 1; i < r.length; i++) r[i] = Math.max(r[i], r[i - 1] + minimo);
  if (r.length && r[r.length - 1] > hi) {
    r[r.length - 1] = hi;
    for (let i = r.length - 2; i >= 0; i--) r[i] = Math.min(r[i], r[i + 1] - minimo);
  }
  return r;
}

/** Uma disputa só (a cidade, para prefeito; o estado, para governador e senador) em cada eleição: onde estava o eleito. */
export function serieDisputa(ds: LinhaDisputa[], cargo: string, uf: string, id_municipio: number | null, { semCargo = false } = {}): { ano: number; p: PosicaoEleito | null }[] {
  return anosDoTipo(cargo).map((ano) => {
    const d = ds.find((x) => x.ano === ano && x.cargo === cargo && x.uf === uf && x.id_municipio === id_municipio);
    return { ano, p: d ? posicaoDoEleito(d, { semCargo }) : null };
  });
}

// ---------- textos ----------

/** "30 em cada 100" (abaixo de 0,5: "menos de 1"). */
export const deCada100 = (p: number) => (p <= 0 ? "0" : p < 0.005 ? "menos de 1" : String(Math.round(p * 100)));
/** "quem já era vereador" (prefeito, governador e senador: as disputas com reeleição saem inteiras). */
export function quemTinha(cargo: string): string {
  if (cargo === "Prefeito") return "disputas com prefeito tentando a reeleição";
  if (cargo === "Governador") return "disputas com governador tentando a reeleição";
  if (cargo === "Senador") return "disputas com senador tentando a reeleição";
  return `quem já era ${cargo.toLowerCase()}`;
}
/** Os dois chips do recorte: com todos e sem quem já tinha o cargo. */
export const rotuloSemCargo = (cargo: string) => `Sem ${quemTinha(cargo)}`;

/**
 * A frase da faixa embaixo da escada: o degrau de cima com e sem quem já tinha o cargo, o recorte ligado primeiro.
 * Vereador: "Sem quem já era vereador, os 10% mais ricos se elegem 9 em cada 100 (com todos: 14)."
 * Prefeito: "Com todas as cidades, o mais rico venceu em 53 de cada 100 (sem as disputas com prefeito tentando a reeleição: 51)."
 */
export function fraseTopo(cargo: string, com: number | null, sem: number | null, semCargo: boolean): string | null {
  const majoritario = ehMajoritarioP2(cargo);
  const [a, b] = semCargo ? [sem, com] : [com, sem];
  if (a === null) return null;
  if (!majoritario) {
    const quem = "os 10% mais ricos se elegem";
    const primeiro = semCargo ? `Sem ${quemTinha(cargo)}, ${quem} ${deCada100(a)} em cada 100` : `Com todos, ${quem} ${deCada100(a)} em cada 100`;
    const segundo = b === null ? "" : semCargo ? ` (com todos: ${deCada100(b)})` : ` (sem ${quemTinha(cargo)}: ${deCada100(b)})`;
    return `${primeiro}${segundo}.`;
  }
  const todas = cargo === "Prefeito" ? "todas as cidades" : "todas as disputas";
  const primeiro = semCargo ? `Sem as ${quemTinha(cargo)}, o mais rico venceu em ${deCada100(a)} de cada 100` : `Com ${todas}, o mais rico venceu em ${deCada100(a)} de cada 100`;
  const segundo = b === null ? "" : semCargo ? ` (com ${todas}: ${deCada100(b)})` : ` (sem as ${quemTinha(cargo)}: ${deCada100(b)})`;
  return `${primeiro}${segundo}.`;
}

/** O título do mapa, curto como o das outras perguntas da camada: "Patrimônio e vitória em 2024". */
export const tituloP2 = (ano: number) => `Patrimônio e vitória em ${ano}`;

/** O valor típico em reais, curto, com "valores da época" dito à parte: "R$ 57 mil". */
export const valorTipico = (v: number | null) => (v === null ? "—" : v <= 0 ? "R$ 0" : reais(v));

/** A posição do eleito de uma disputa em palavras: "o eleito era o 2º mais rico entre 4". */
export function frasePosicao(p: PosicaoEleito): string {
  if (p.categoria === "fora") return `Fora da conta: ${ROTULO_MOTIVO[p.motivo!]}`;
  if (p.categoria === "sem_bens") return `O eleito não declarou bens (${p.candidatos} candidatos)`;
  return `O eleito era o ${p.posicao === 1 ? "mais rico" : `${p.posicao}º mais rico`} entre ${p.candidatos}${p.empateTopo && p.posicao === 1 ? " (empatado no topo)" : ""}`;
}

/** Escala de 10 em 10 para a dispersão: as marcas de R$ 1 mil a R$ 100 milhões que cobrem os valores. */
export function marcasLog(valores: number[]): { min: number; max: number; marcas: { valor: number; rotulo: string }[] } {
  const v = valores.filter((x) => x > 0);
  const lo = v.length ? Math.max(3, Math.floor(Math.log10(Math.min(...v)))) : 3;
  const hi = v.length ? Math.max(lo + 1, Math.ceil(Math.log10(Math.max(...v)))) : 6;
  const rot = (e: number) => (e >= 9 ? `R$ ${10 ** (e - 9)} bi` : e >= 6 ? `R$ ${10 ** (e - 6)} mi` : e >= 3 ? `R$ ${10 ** (e - 3)} mil` : `R$ ${10 ** e}`);
  const marcas = [];
  for (let e = lo; e <= hi; e++) marcas.push({ valor: 10 ** e, rotulo: rot(e) });
  return { min: 10 ** lo, max: 10 ** hi, marcas };
}
/** A posição de um valor (0 a 1) entre min e max na escala de 10 em 10. */
export const naEscalaLog = (v: number, min: number, max: number) => Math.min(1, Math.max(0, (Math.log10(Math.max(v, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min))));

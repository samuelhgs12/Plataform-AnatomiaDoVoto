// Visão "Candidato" do mapa da página inicial: onde uma candidatura teve votos, município a município.
// Os dados vêm da API: GET /api/candidatos/{id}/mapa (as candidaturas, com os números da ficha) e
// GET /api/candidaturas/{id}/votos-municipio (votos por município e turno).

import { classe, quantis } from "./abstencao";
import { pct } from "./format";

/** Uma candidatura (pessoa × eleição × cargo), com os números do verso da ficha. */
export interface CandidaturaMapa {
  id_candidato: number;
  id_candidatura: number;
  ano: number;
  cargo: string;
  /** UF da candidatura; "BR" para presidente */
  uf: string;
  partido: string | null;
  numero: string | null;
  /** o nome civil quando não há nome de urna */
  nome_urna: string;
  /** com o ano, a chave da candidatura no TSE e da foto (src/lib/foto-candidato.ts) */
  ue: string;
  sequencial: string;
  /** chave de ROTULO_RESULTADO (format.ts): ELEITO, NAO_ELEITO… */
  resultado: string;
  /** votos no 1º turno, na abrangência inteira do cargo (para presidente, o país) */
  votos_total: number;
  /** despesas contratadas na prestação final (sem transferências), em reais; null sem prestação (antes de 2018) */
  gasto_total: number | null;
  /** mediana do gasto das candidaturas do mesmo cargo, ano e UF; null sem prestação */
  mediana_gasto_cargo: number | null;
  /** parte das receitas vinda do Fundo Eleitoral e do Fundo Partidário (0 a 1); null sem receitas */
  parte_publica: number | null;
  /** eleições disputadas pela pessoa até esta, contando esta */
  disputas: number;
  /** vezes em que foi eleita até esta, contando esta */
  mandatos: number;
}

/** Votos da candidatura num município e turno; validos_cargo é o total de votos válidos do cargo ali. */
export interface VotoMunicipio {
  id_candidatura: number;
  id_municipio: number;
  /** a chave que casa com o mapa estático (mapa.json), cujo id_municipio é de outra carga */
  cod_ibge: string | null;
  uf: string;
  turno: number;
  votos: number;
  validos_cargo: number;
  /** colocação entre os candidatos do cargo naquele município e turno (1 = mais votado) */
  posicao: number;
}

/** Cargos que o mapa pinta município a município, pela parte dos votos válidos em cada um. */
export const CARGOS_ESTADUAIS = ["Deputado federal", "Deputado estadual", "Senador", "Governador"];
/** Cargos disputados num município só: sem votos por bairro ou seção, o mapa só destaca o município da disputa. */
export const CARGOS_MUNICIPAIS = ["Prefeito", "Vereador"];
export const UFS_PROJETO = ["AP", "ES", "MG", "PE", "RJ", "RR"];

/**
 * O que o mapa mostra para o cargo: os municípios da UF, os seis estados (presidente), o município da disputa em
 * destaque no estado (prefeito e vereador) ou nada (os demais, como vices e suplentes).
 */
export function abrangencia(cargo: string): "uf" | "seis" | "municipio" | "fora" {
  if (cargo === "Presidente") return "seis";
  if (CARGOS_MUNICIPAIS.includes(cargo)) return "municipio";
  return CARGOS_ESTADUAIS.includes(cargo) ? "uf" : "fora";
}

/**
 * Os votos da API com o id_municipio do mapa estático (web/public/data/mapa.json), casados pelo código IBGE: o
 * id_municipio muda a cada carga do banco, e o JSON e a API podem vir de cargas diferentes. Sem par, ficam de fora.
 */
export function noMapaEstatico(votos: VotoMunicipio[], municipios: { id_municipio: number; cod_ibge: string }[]): VotoMunicipio[] {
  const id = new Map(municipios.map((m) => [m.cod_ibge, m.id_municipio]));
  return votos.flatMap((v) => {
    const m = v.cod_ibge ? id.get(v.cod_ibge) : undefined;
    return m === undefined ? [] : [{ ...v, id_municipio: m }];
  });
}

/** A parte dos votos válidos do cargo que foi para o candidato; null sem votos válidos. */
export const proporcaoNoMunicipio = (votos: number, validos: number): number | null => (validos > 0 ? votos / validos : null);

/** Abaixo disso o candidato quase não teve votos: a 1ª faixa do mapa, separada dos quintos. */
export const QUASE_ZERO = 0.005;

/**
 * Cortes das faixas do mapa (4 cortes, 5 cores, para `classe`). Quintos dos municípios, mas um deputado costuma ter
 * quase 0% na maior parte do estado: se 1/5 ou mais dos municípios fica abaixo de 0,5%, essa vira a 1ª faixa e os
 * outros quatro grupos dividem só o resto. Cortes arredondados a 0,1 ponto (o que a legenda escreve é o que vale)
 * e sem repetição (com muitos valores iguais, sobram menos faixas).
 */
export function cortesCandidato(valores: number[]): number[] {
  const v = valores.filter((x) => Number.isFinite(x));
  if (!v.length) return [];
  const baixos = v.filter((x) => x < QUASE_ZERO).length;
  const brutos = baixos >= v.length / 5 ? [QUASE_ZERO, ...quantis(v.filter((x) => x >= QUASE_ZERO), 4)] : quantis(v, 5);
  const arred = brutos.map((c) => Math.round(c * 1000) / 1000).filter((c) => c > 0);
  return [...new Set(arred)].sort((a, b) => a - b);
}

/** Casas para escrever os cortes: 1 abaixo de 10% ("0,5%", "3,2%"), senão 0 ("24%"). */
export const fmtCorte = (v: number) => pct(v, v < 0.1 ? 1 : 0);

/** Rótulos da legenda: "menos de 0,5%", "0,5–2,1%", …, "18% ou mais". */
export function rotulosCandidato(cortes: number[]): string[] {
  if (!cortes.length) return [];
  const sem = (s: string) => s.replace("%", "");
  return [
    `menos de ${fmtCorte(cortes[0])}`,
    ...cortes.slice(0, -1).map((c, i) => `${sem(fmtCorte(c))}–${fmtCorte(cortes[i + 1])}`),
    `${fmtCorte(cortes[cortes.length - 1])} ou mais`,
  ];
}

/** Classe CSS da cor no mapa: "c0".."c4" pela faixa; "sem" quando não há votos válidos. */
export const corCandidato = (p: number | null, cortes: number[]) => (p == null ? "sem" : `c${classe(p, cortes)}`);

/** Linhas de um turno, com a proporção de cada município. */
export function doTurno(linhas: VotoMunicipio[], turno: number): (VotoMunicipio & { p: number | null })[] {
  return linhas.filter((l) => l.turno === turno).map((l) => ({ ...l, p: proporcaoNoMunicipio(l.votos, l.validos_cargo) }));
}

/** Turnos que a candidatura disputou (o 2º só aparece se houver votos nele). */
export const turnosDe = (linhas: VotoMunicipio[]) => [...new Set(linhas.map((l) => l.turno))].sort((a, b) => a - b);

/** Números do verso da ficha. */
export interface Resumo {
  gastoPorVoto: number | null;
  /** gasto / mediana do cargo; null sem mediana */
  razaoMediana: number | null;
  /** "2,3× a mediana do cargo" */
  textoMediana: string | null;
  publico: number | null;
  privado: number | null;
}

export function resumoCandidatura(c: Pick<CandidaturaMapa, "votos_total" | "gasto_total" | "mediana_gasto_cargo" | "parte_publica">): Resumo {
  const razao = c.gasto_total != null && c.mediana_gasto_cargo ? c.gasto_total / c.mediana_gasto_cargo : null;
  const r = razao == null ? null : razao < 10 ? Math.round(razao * 10) / 10 : Math.round(razao);
  return {
    gastoPorVoto: c.gasto_total != null && c.votos_total > 0 ? c.gasto_total / c.votos_total : null,
    razaoMediana: razao,
    textoMediana: r == null ? null : `${r.toLocaleString("pt-BR")}× a mediana do cargo`,
    publico: c.parte_publica,
    privado: c.parte_publica == null ? null : 1 - c.parte_publica,
  };
}

/** Votos e parte dos votos válidos num turno, somados nas linhas dadas. */
export interface SomaTurno { turno: number; votos: number; validos: number; p: number | null }

/**
 * Do 1º para o 2º turno, nas linhas dadas (o estado da candidatura, ou os estados do mapa para presidente): a parte
 * dos válidos em cada turno e a diferença em pontos (0,123 = 12,3 pontos). null sem 2º turno.
 */
export function variacaoTurnos(linhas: Pick<VotoMunicipio, "turno" | "votos" | "validos_cargo">[]): { t1: SomaTurno; t2: SomaTurno; pontos: number | null } | null {
  const soma = (turno: number): SomaTurno => {
    const doT = linhas.filter((l) => l.turno === turno);
    const votos = doT.reduce((s, l) => s + l.votos, 0), validos = doT.reduce((s, l) => s + l.validos_cargo, 0);
    return { turno, votos, validos, p: proporcaoNoMunicipio(votos, validos) };
  };
  if (!linhas.some((l) => l.turno === 2)) return null;
  const t1 = soma(1), t2 = soma(2);
  return { t1, t2, pontos: t1.p == null || t2.p == null ? null : t2.p - t1.p };
}

/** "+12,3 pontos", "−4,0 pontos", "0,0 ponto": a diferença entre duas proporções, em pontos percentuais. */
export function textoPontos(d: number): string {
  const r = Math.round(d * 1000) / 10;
  const n = Math.abs(r).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${n} ${Math.abs(r) < 2 ? "ponto" : "pontos"}`;
}

/** A partir deste ano o TSE publica a prestação de contas (receitas e despesas) que o verso da ficha usa. */
export const ANO_PRESTACAO = 2018;

/**
 * Por que o verso não tem os números de campanha (gasto, comparação, origem do dinheiro); null quando tem algum.
 * Eleições antigas estão fora do escopo da prestação de contas; nas recentes, a candidatura pode não ter prestado.
 */
export function semDadosDeCampanha(c: Pick<CandidaturaMapa, "ano" | "gasto_total" | "parte_publica">): string | null {
  if (c.gasto_total != null || c.parte_publica != null) return null;
  return c.ano < ANO_PRESTACAO
    ? `O TSE só publica a prestação de contas de ${ANO_PRESTACAO} em diante.`
    : "O TSE não tem a prestação de contas final desta candidatura.";
}

/** Soma votos e válidos por UF (soma das contagens, não média das porcentagens), na ordem das UFs. */
export function proporcaoPorUf(linhas: Pick<VotoMunicipio, "uf" | "votos" | "validos_cargo">[]): { uf: string; votos: number; validos: number; valor: number | null }[] {
  const somas = new Map<string, { votos: number; validos: number }>();
  for (const l of linhas) {
    const s = somas.get(l.uf) ?? { votos: 0, validos: 0 };
    s.votos += l.votos;
    s.validos += l.validos_cargo;
    somas.set(l.uf, s);
  }
  return [...somas].sort(([a], [b]) => a.localeCompare(b))
    .map(([uf, s]) => ({ uf, ...s, valor: proporcaoNoMunicipio(s.votos, s.validos) }));
}

/**
 * Frase neutra para o mapa e o leitor de tela: em quantos municípios está metade dos votos e onde foi a maior
 * proporção. `onde`: "de MG" ou "dos seis estados".
 */
export function fraseResumo(linhas: Pick<VotoMunicipio, "id_municipio" | "votos" | "validos_cargo">[], nomes: Map<number, string>, onde: string): string {
  const total = linhas.reduce((s, l) => s + l.votos, 0);
  const n = linhas.length;
  if (!total) return `Sem votos registrados nos ${n.toLocaleString("pt-BR")} municípios ${onde}.`;
  const ordem = [...linhas].sort((a, b) => b.votos - a.votos);
  let k = 0;
  for (let soma = 0; soma * 2 < total; k++) soma += ordem[k].votos;
  const maior = linhas.reduce<{ id: number; p: number } | null>((m, l) => {
    const p = proporcaoNoMunicipio(l.votos, l.validos_cargo);
    return p != null && (!m || p > m.p) ? { id: l.id_municipio, p } : m;
  }, null);
  const metade = `Metade dos votos veio de ${k.toLocaleString("pt-BR")} ${k === 1 ? "município" : "municípios"} entre os ${n.toLocaleString("pt-BR")} ${onde}`;
  return maior ? `${metade}; a maior proporção foi em ${nomes.get(maior.id) ?? "um município"} (${pct(maior.p, 1)}).` : `${metade}.`;
}

/** O resumo de uma disputa municipal, que acontece num município só: "Disputou só em Alfa: 30,0% dos votos válidos para prefeito, 1º lugar." */
export function fraseMunicipal(l: Pick<VotoMunicipio, "votos" | "validos_cargo" | "posicao">, municipio: string, cargo: string): string {
  const p = proporcaoNoMunicipio(l.votos, l.validos_cargo);
  if (p == null || !l.votos) return `Disputou só em ${municipio}, sem votos registrados neste turno.`;
  return `Disputou só em ${municipio}: ${pct(p, 1)} dos votos válidos para ${cargo.toLowerCase()}, ${l.posicao}º lugar.`;
}

/**
 * O nome de urna dividido como no santinho: a última palavra em destaque, o resto numa linha menor acima
 * ("Otávio" / "Cerejeira"; "Ana da" / "Silva"). Um nome de uma palavra só fica todo em destaque.
 */
export function partesDoNome(nome: string): { antes: string; destaque: string } {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  const destaque = p.pop() ?? "";
  return { antes: p.join(" "), destaque };
}

/** As candidaturas de uma pessoa, da mais recente para a mais antiga, e a padrão (a mais recente). */
export function candidaturasDe<T extends Pick<CandidaturaMapa, "id_candidato" | "ano" | "id_candidatura">>(todas: T[], id_candidato: number): { padrao: T | undefined; lista: T[] } {
  const lista = todas.filter((c) => c.id_candidato === id_candidato).sort((a, b) => b.ano - a.ano || b.id_candidatura - a.id_candidatura);
  return { padrao: lista[0], lista };
}

/**
 * A linha do tempo das candidaturas em trechos: anos seguidos no mesmo cargo e UF ficam juntos, com o cargo escrito
 * uma vez só embaixo deles (2002, 2006, 2010, 2014 · Deputado estadual). `cronologica`: da mais antiga para a mais recente.
 */
export function trechosDaCarreira<T extends Pick<CandidaturaMapa, "cargo" | "uf">>(cronologica: T[]): { cargo: string; uf: string; itens: T[] }[] {
  const trechos: { cargo: string; uf: string; itens: T[] }[] = [];
  for (const c of cronologica) {
    const ultimo = trechos.at(-1);
    if (ultimo && ultimo.cargo === c.cargo && ultimo.uf === c.uf) ultimo.itens.push(c);
    else trechos.push({ cargo: c.cargo, uf: c.uf, itens: [c] });
  }
  return trechos;
}

/** Uma pessoa na busca do mapa (mesmo formato de /api/busca). */
export interface EntradaCandidato {
  id_candidato: number; nome_urna: string | null; partido: string | null; uf: string | null; ultimo_ano: number; ultimo_cargo: string;
  ultimo_ue?: string | null; ultimo_sequencial?: string | null;
}

/** Cargos com voto de legenda: os válidos somam os votos no partido, que o TSE só publica por município de 2018 em diante. */
const PROPORCIONAIS = ["Deputado federal", "Deputado estadual", "Deputado distrital", "Vereador"];
export const ANO_LEGENDA_POR_MUNICIPIO = 2018;

/** Aviso para o mapa quando os válidos de cada município não incluem a legenda; null quando incluem. */
export function notaValidos(c: Pick<CandidaturaMapa, "ano" | "cargo">): string | null {
  return PROPORCIONAIS.includes(c.cargo) && c.ano < ANO_LEGENDA_POR_MUNICIPIO
    ? `Antes de ${ANO_LEGENDA_POR_MUNICIPIO} o TSE não publica o voto de legenda por município: a parte de cada município é calculada só sobre os votos nominais.`
    : null;
}

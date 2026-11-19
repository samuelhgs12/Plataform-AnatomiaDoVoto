// Quem puxou quem (visão de legenda do mapa): como as vagas de deputado foram divididas entre as listas (partido
// sozinho, coligação em 2018, federação de 2022 em diante) e quem sentou nelas. Os dados vêm de
// api/app/analises/cadeiras.sql; quem foi eleito, e se pelo quociente ou pelas sobras, é o rótulo do TSE. As contas
// daqui (quociente eleitoral e partidário, puxadores) explicam o resultado, não o refazem. Tudo puro: a página só desenha.
import type { CargoCiclo } from "./legenda";
import { inteiro } from "./format";

/** Anos com as listas (coligações e federações) do TSE; vereadores ainda não. */
export const ANOS_CADEIRAS = [2018, 2022, 2026];

export interface LinhaDisputa { ano: number; cargo: string; uf: string; vagas: number }
export type TipoLista = "partido" | "coligacao" | "federacao";
/** Tabela `listas`: votos de cada lista e cadeiras pelo rótulo do TSE. `lista` = as siglas, da mais votada ("PT/PCdoB/PV"). */
export interface LinhaLista {
  ano: number; cargo: string; uf: string; id_lista: string; tipo: TipoLista; lista: string;
  votos_nominais: number; votos_legenda: number; eleitos_qp: number; eleitos_media: number;
}
export type Resultado = "qp" | "media" | "suplente";
/** Tabela `candidatos`: os eleitos de cada lista e o mais votado dela sem cadeira, com a chave da foto (ano, ue, sequencial). */
export interface LinhaCandidato {
  ano: number; cargo: string; uf: string; id_lista: string; partido: string;
  id_candidato: number | null; id_candidatura: number; nome_urna: string; ue: string | null; sequencial: string | null;
  votos: number; resultado: Resultado;
}
export interface DadosCadeiras { disputas: LinhaDisputa[]; listas: LinhaLista[]; candidatos: LinhaCandidato[] }

/** O cargo da visão de legenda como está nas tabelas; com os dois cargos, a lista mostra o federal. */
export const cargoDaLista = (cargo: CargoCiclo) => (cargo === "estadual" ? "Deputado estadual" : "Deputado federal");

/** Quociente eleitoral = válidos ÷ vagas, desprezada a fração igual ou menor que meio (Código Eleitoral, art. 106). */
export function quocienteEleitoral(validos: number, vagas: number): number {
  if (vagas <= 0) return 0;
  const q = validos / vagas, base = Math.floor(q);
  return q - base > 0.5 ? base + 1 : base;
}

export interface ListaCadeiras {
  id_lista: string;
  lista: string;
  tipo: TipoLista;
  votos: number;
  /** cadeiras pelo quociente (rótulo "ELEITO POR QP") e pelas sobras ("ELEITO POR MÉDIA") */
  qp: number;
  media: number;
  cadeiras: number;
  /** do mais votado para o menos */
  eleitos: LinhaCandidato[];
  /** o mais votado da lista que ficou sem cadeira */
  suplente: LinhaCandidato | null;
}

export interface Disputa {
  ano: number; cargo: string; uf: string; vagas: number; validos: number; qe: number;
  listas: ListaCadeiras[]; semCadeira: ListaCadeiras[];
  /** nenhum eleito na base (ex.: AP em 2026, todos "SEM RESULTADO") */
  semResultado: boolean;
}

const porVotos = (a: LinhaCandidato, b: LinhaCandidato) => b.votos - a.votos || a.nome_urna.localeCompare(b.nome_urna);

/** Uma disputa (ano + cargo + UF): quociente eleitoral e as listas, as que ganharam cadeira primeiro. */
export function montarDisputa(d: DadosCadeiras, { ano, cargo, uf }: { ano: number; cargo: string; uf: string }): Disputa | null {
  const daqui = <T extends { ano: number; cargo: string; uf: string }>(x: T) => x.ano === ano && x.cargo === cargo && x.uf === uf;
  const disputa = d.disputas.find(daqui);
  if (!disputa) return null;
  const linhas = d.listas.filter(daqui);
  const cands = d.candidatos.filter(daqui);
  const validos = linhas.reduce((s, l) => s + l.votos_nominais + l.votos_legenda, 0);
  const todas = linhas.map((l): ListaCadeiras => {
    const daLista = cands.filter((c) => c.id_lista === l.id_lista).sort(porVotos);
    return {
      id_lista: l.id_lista, lista: l.lista, tipo: l.tipo, votos: l.votos_nominais + l.votos_legenda,
      qp: l.eleitos_qp, media: l.eleitos_media, cadeiras: l.eleitos_qp + l.eleitos_media,
      eleitos: daLista.filter((c) => c.resultado !== "suplente"), suplente: daLista.find((c) => c.resultado === "suplente") ?? null,
    };
  }).sort((a, b) => b.cadeiras - a.cadeiras || b.votos - a.votos);
  const listas = todas.filter((l) => l.cadeiras > 0);
  return {
    ano, cargo, uf, vagas: disputa.vagas, validos, qe: quocienteEleitoral(validos, disputa.vagas),
    listas, semCadeira: todas.filter((l) => l.cadeiras === 0), semResultado: listas.length === 0,
  };
}

export interface Puxador extends LinhaCandidato {
  lista: string;
  /** votos dele ÷ quociente eleitoral */
  quocientes: number;
  /** cadeiras da lista pelo quociente (rótulo do TSE) */
  cadeirasLista: number;
  /** cadeiras pelo quociente que a lista faria sem os votos dele */
  semEle: number;
  /** cadeiras que os votos dele pagaram além da própria */
  paraOutros: number;
  /** quem sentou nelas, de qualquer partido da lista: os menos votados dos eleitos por QP, do mais votado para o menos */
  sentaram: LinhaCandidato[];
}

/**
 * Puxador = quem teve votos para mais de um quociente e, sem esses votos, a lista perderia cadeiras além da dele.
 * Conta só a fase do quociente: sem ele, a lista perderia as últimas cadeiras do quociente, que ficaram com os menos
 * votados dos eleitos por QP (numa coligação ou federação, podem ser de outro partido). As sobras também mudariam, mas
 * dependem das outras listas e não entram na conta. Do que mais puxou para o que menos puxou.
 */
export function puxadores(d: Disputa): Puxador[] {
  if (!d.qe) return [];
  const saida: Puxador[] = [];
  for (const l of d.listas) {
    const porQp = l.eleitos.filter((e) => e.resultado === "qp");
    for (const e of porQp) {
      if (e.votos < d.qe) continue;
      const semEle = Math.floor((l.votos - e.votos) / d.qe);
      const paraOutros = Math.min(Math.floor(l.votos / d.qe), l.qp) - semEle - 1;
      if (paraOutros < 1) continue;
      const outros = porQp.filter((o) => o !== e);
      saida.push({
        ...e, lista: l.lista, quocientes: e.votos / d.qe, cadeirasLista: l.qp, semEle, paraOutros,
        sentaram: outros.slice(Math.max(0, outros.length - paraOutros)),
      });
    }
  }
  return saida.sort((a, b) => b.paraOutros - a.paraOutros || b.votos - a.votos);
}

/** Para cada candidatura puxada, o puxador (para marcar na lista de eleitos). */
export const puxadoPor = (ps: Puxador[]) => new Map(ps.flatMap((p) => p.sentaram.map((s) => [s.id_candidatura, p] as const)));

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Nome de urna (vem em caixa alta do TSE) com as iniciais maiúsculas: "JOENIA DA SILVA" → "Joenia da Silva". */
export const nomeProprio = (nome: string) =>
  nome.toLocaleLowerCase("pt-BR").split(/\s+/).filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1))).join(" ");

const decimal = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const emLista = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);

/** O puxador e os puxados numa frase curta (nome acessível da linha). */
export const rotuloPuxador = (p: Puxador) =>
  `${nomeProprio(p.nome_urna)} (${p.partido}), ${inteiro(p.votos)} votos, ${decimal(p.quocientes)} quocientes, puxou ${p.paraOutros}: ${emLista(p.sentaram.map((s) => `${nomeProprio(s.nome_urna)} (${s.partido})`))}`;

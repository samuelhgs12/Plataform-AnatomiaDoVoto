// DADOS FICTÍCIOS para o protótipo da visão "Candidato" do mapa. Nenhuma pessoa nem partido aqui existe: os nomes
// e as siglas (PFA, PFB, PFC, PFD) foram inventados. Só os municípios são reais (de public/data/mapa.json), e os
// votos válidos de cada um partem do comparecimento real do ano; os votos do candidato são gerados.
//
// Para ligar na API, troque só as duas funções exportadas no fim (lerCandidaturasMapa e lerVotosCandidatura) por
// chamadas a /api/... com o mesmo retorno: a página não sabe de onde os dados vêm.

import { CENTRO_MUNICIPIO } from "./brasil-municipios";
import { comoObjetos, lerEstatico } from "./data";
import type { LinhaMunicipio, LinhaParticipacao } from "./abstencao";
import { abrangencia, type CandidaturaMapa, type VotoMunicipio } from "./candidato-mapa";

/** Gerador pseudoaleatório com semente fixa (mulberry32): o mapa sai igual a cada carga. */
function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Como os votos se espalham. "base": reduto em volta de um município (código IBGE), com `pico` de proporção lá e nos
 * vizinhos, caindo com a distância (`alcance`, em unidades do mapa) até o `piso`. "uf": nível por estado (presidente).
 * "par": o 2º turno é o complemento de outra candidatura (os válidos do 2º turno são só dos dois).
 */
type Molde =
  | { tipo: "base"; base: string; pico: number; alcance: number; piso: number }
  | { tipo: "uf"; nivel: Record<string, number> }
  | { tipo: "nenhum" };
interface Ficticia extends Omit<CandidaturaMapa, "votos_total"> {
  molde: Molde;
  /** 2º turno contra esta candidatura; quem tem o molde gera os dois lados */
  par?: { contra: number; lider: boolean };
  /** para presidente: votos no país no 1º turno (o mapa só tem os seis estados) */
  votos_pais?: number;
}

const C = (o: Ficticia) => o;
const FICTICIAS: Ficticia[] = [
  // três eleições, cargos diferentes: deputada estadual, federal e senadora, sempre no norte de Minas
  C({ id_candidato: 9001, id_candidatura: 900101, ano: 2014, cargo: "Deputado estadual", uf: "MG", partido: "PFA", numero: 77123, nome_urna: "TEODORA QUINTANILHA", resultado: "ELEITO",
    gasto_total: 412_000, mediana_gasto_cargo: 96_000, parte_publica: 0.18, disputas: 1, mandatos: 1, molde: { tipo: "base", base: "3143302", pico: 0.31, alcance: 9, piso: 0.0006 } }),
  C({ id_candidato: 9001, id_candidatura: 900102, ano: 2018, cargo: "Deputado federal", uf: "MG", partido: "PFA", numero: 7712, nome_urna: "TEODORA QUINTANILHA", resultado: "ELEITO",
    gasto_total: 1_380_000, mediana_gasto_cargo: 210_000, parte_publica: 0.64, disputas: 2, mandatos: 2, molde: { tipo: "base", base: "3143302", pico: 0.27, alcance: 13, piso: 0.0008 } }),
  C({ id_candidato: 9001, id_candidatura: 900103, ano: 2022, cargo: "Senador", uf: "MG", partido: "PFA", numero: 771, nome_urna: "TEODORA QUINTANILHA", resultado: "NAO_ELEITO",
    gasto_total: 6_900_000, mediana_gasto_cargo: 2_400_000, parte_publica: 0.81, disputas: 3, mandatos: 2, molde: { tipo: "base", base: "3143302", pico: 0.52, alcance: 30, piso: 0.07 } }),
  // não eleito; antes disputou prefeito (cargo fora do mapa por enquanto)
  C({ id_candidato: 9002, id_candidatura: 900201, ano: 2020, cargo: "Prefeito", uf: "PE", partido: "PFB", numero: 92, nome_urna: "BALTAZAR OURIVES", resultado: "NAO_ELEITO",
    gasto_total: 188_000, mediana_gasto_cargo: 61_000, parte_publica: 0.72, disputas: 1, mandatos: 0, molde: { tipo: "nenhum" } }),
  C({ id_candidato: 9002, id_candidatura: 900202, ano: 2022, cargo: "Deputado federal", uf: "PE", partido: "PFB", numero: 9244, nome_urna: "BALTAZAR OURIVES", resultado: "NAO_ELEITO",
    gasto_total: 236_000, mediana_gasto_cargo: 198_000, parte_publica: 0.9, disputas: 2, mandatos: 0, molde: { tipo: "base", base: "2604106", pico: 0.14, alcance: 7, piso: 0.0002 } }),
  // governo de Roraima com 2º turno: os dois lados
  C({ id_candidato: 9003, id_candidatura: 900301, ano: 2022, cargo: "Governador", uf: "RR", partido: "PFC", numero: 93, nome_urna: "CELESTE ARAPUÃ", resultado: "ELEITO",
    gasto_total: 3_100_000, mediana_gasto_cargo: 1_150_000, parte_publica: 0.58, disputas: 4, mandatos: 3, molde: { tipo: "base", base: "1400100", pico: 0.62, alcance: 40, piso: 0.36 }, par: { contra: 900401, lider: true } }),
  C({ id_candidato: 9004, id_candidatura: 900401, ano: 2022, cargo: "Governador", uf: "RR", partido: "PFD", numero: 94, nome_urna: "JOAQUIM BROMÉLIA", resultado: "NAO_ELEITO",
    gasto_total: 1_750_000, mediana_gasto_cargo: 1_150_000, parte_publica: 0.33, disputas: 2, mandatos: 1, molde: { tipo: "nenhum" }, par: { contra: 900301, lider: false } }),
  C({ id_candidato: 9005, id_candidatura: 900501, ano: 2022, cargo: "Deputado estadual", uf: "ES", partido: "PFD", numero: 94321, nome_urna: "IRENE TAQUARAL", resultado: "ELEITO",
    gasto_total: 158_000, mediana_gasto_cargo: 74_000, parte_publica: 0.47, disputas: 1, mandatos: 1, molde: { tipo: "base", base: "3201506", pico: 0.24, alcance: 6, piso: 0.0012 } }),
  C({ id_candidato: 9006, id_candidatura: 900601, ano: 2018, cargo: "Deputado estadual", uf: "RJ", partido: "PFB", numero: 92180, nome_urna: "OTÁVIO CEREJEIRA", resultado: "ELEITO",
    gasto_total: 97_000, mediana_gasto_cargo: 52_000, parte_publica: 0.21, disputas: 1, mandatos: 1, molde: { tipo: "base", base: "3301009", pico: 0.22, alcance: 6, piso: 0.0004 } }),
  C({ id_candidato: 9006, id_candidatura: 900602, ano: 2022, cargo: "Deputado federal", uf: "RJ", partido: "PFB", numero: 9218, nome_urna: "OTÁVIO CEREJEIRA", resultado: "ELEITO",
    gasto_total: 940_000, mediana_gasto_cargo: 205_000, parte_publica: 0.69, disputas: 2, mandatos: 2, molde: { tipo: "base", base: "3301009", pico: 0.19, alcance: 9, piso: 0.0009 } }),
  // presidente, com 2º turno: o mapa só tem os seis estados; votos_pais é o país inteiro
  C({ id_candidato: 9007, id_candidatura: 900701, ano: 2022, cargo: "Presidente", uf: "BR", partido: "PFC", numero: 91, nome_urna: "MARISOL PEDRAVERDE", resultado: "ELEITO",
    gasto_total: 118_000_000, mediana_gasto_cargo: 9_800_000, parte_publica: 0.86, disputas: 5, mandatos: 4, votos_pais: 51_204_318,
    molde: { tipo: "uf", nivel: { AP: 0.55, ES: 0.41, MG: 0.49, PE: 0.67, RJ: 0.44, RR: 0.31 } }, par: { contra: 900801, lider: true } }),
  C({ id_candidato: 9008, id_candidatura: 900801, ano: 2022, cargo: "Presidente", uf: "BR", partido: "PFA", numero: 95, nome_urna: "AURÉLIO CAMBUÍ", resultado: "NAO_ELEITO",
    gasto_total: 87_000_000, mediana_gasto_cargo: 9_800_000, parte_publica: 0.79, disputas: 3, mandatos: 2, votos_pais: 47_861_090,
    molde: { tipo: "nenhum" }, par: { contra: 900701, lider: false } }),
];

const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const distancia = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Proporção no 1º turno e, para quem foi ao 2º, a do líder nele (o outro lado é o complemento). */
function proporcoes(f: Ficticia, m: LinhaMunicipio, sorte: () => number): { p1: number; p2?: number } {
  const ruido = 0.75 + sorte() * 0.5;
  const aqui = CENTRO_MUNICIPIO[m.cod_ibge];
  if (f.molde.tipo === "base") {
    const base = CENTRO_MUNICIPIO[f.molde.base];
    const d = aqui && base ? distancia(aqui, base) : 99;
    const p = f.molde.piso + (f.molde.pico - f.molde.piso) * Math.exp(-((d / f.molde.alcance) ** 1.4));
    const p2 = limitar(p * ruido, 0, 0.95);
    return f.par ? { p1: p2 * 0.84, p2: limitar(0.5 + (p2 - 0.5) * 1.15, 0.12, 0.9) } : { p1: p2 };
  }
  if (f.molde.tipo === "uf") {
    const x = aqui ? aqui[0] : 0;
    const p2 = limitar((f.molde.nivel[m.uf] ?? 0.5) + (ruido - 1) * 0.35 + Math.sin(x / 9) * 0.04, 0.08, 0.92);
    return { p1: p2 * 0.9, p2 };
  }
  return { p1: 0 };
}

/** Colocação plausível pela proporção (o mock não tem os outros candidatos). */
function posicao(f: Ficticia, p: number, pOutro?: number): number {
  if (pOutro != null) return p >= pOutro ? 1 : 2;
  if (f.cargo === "Senador") return p >= 0.35 ? 1 : p >= 0.2 ? 2 : 3;
  return p >= 0.2 ? 1 : Math.min(60, Math.ceil(0.2 / Math.max(p, 0.001)));
}

let cache: Promise<{ candidaturas: CandidaturaMapa[]; votos: Map<number, VotoMunicipio[]> } | null> | null = null;

async function gerar() {
  const dados = await lerEstatico("mapa");
  if (!dados) return null;
  const municipios = comoObjetos<LinhaMunicipio>(dados.municipios);
  const participacao = comoObjetos<LinhaParticipacao>(dados.participacao);
  const part = new Map(participacao.map((l) => [`${l.id_municipio}-${l.ano}`, l]));
  const validos = (id: number, ano: number) => {
    const l = part.get(`${id}-${ano}`);
    return l ? Math.max(0, l.comparecimento - l.brancos - l.nulos) : 0;
  };

  const votos = new Map<number, VotoMunicipio[]>(FICTICIAS.map((f) => [f.id_candidatura, []]));
  for (const f of FICTICIAS) {
    if (f.molde.tipo === "nenhum") continue;
    const sorte = sorteio(f.id_candidatura);
    const alcance = abrangencia(f.cargo);
    const doCargo = municipios.filter((m) => (alcance === "seis" ? true : m.uf === f.uf));
    const outro = f.par ? votos.get(f.par.contra)! : null;
    for (const m of doCargo) {
      const v1 = validos(m.id_municipio, f.ano);
      const { p1, p2 } = proporcoes(f, m, sorte);
      const base = { id_municipio: m.id_municipio, uf: m.uf };
      if (!outro || p2 == null) {
        const votos1 = Math.round(v1 * p1);
        votos.get(f.id_candidatura)!.push({ ...base, id_candidatura: f.id_candidatura, turno: 1, votos: votos1, validos_cargo: v1, posicao: posicao(f, p1) });
        continue;
      }
      // os dois lados do 2º turno: no 1º, o restante dos válidos fica com os outros candidatos
      const q1 = (1 - p2) * 0.86;
      const v2 = Math.round(v1 * 0.97);
      const [a1, b1, a2] = [Math.round(v1 * p1), Math.round(v1 * q1), Math.round(v2 * p2)];
      votos.get(f.id_candidatura)!.push(
        { ...base, id_candidatura: f.id_candidatura, turno: 1, votos: a1, validos_cargo: v1, posicao: posicao(f, p1, q1) },
        { ...base, id_candidatura: f.id_candidatura, turno: 2, votos: a2, validos_cargo: v2, posicao: posicao(f, p2, 1 - p2) },
      );
      outro.push(
        { ...base, id_candidatura: f.par!.contra, turno: 1, votos: b1, validos_cargo: v1, posicao: posicao(f, q1, p1) },
        { ...base, id_candidatura: f.par!.contra, turno: 2, votos: v2 - a2, validos_cargo: v2, posicao: posicao(f, 1 - p2, p2) },
      );
    }
  }

  const candidaturas = FICTICIAS.map((f) => {
    const c: CandidaturaMapa & Partial<Ficticia> = {
      ...f,
      // prefeito: sem votos por município no mock, um total plausível
      votos_total: f.votos_pais ?? (votos.get(f.id_candidatura)!.filter((v) => v.turno === 1).reduce((s, v) => s + v.votos, 0) || (f.cargo === "Prefeito" ? 41_382 : 0)),
    };
    delete c.molde; delete c.par; delete c.votos_pais;   // só o formato da API sai daqui
    return c as CandidaturaMapa;
  });
  return { candidaturas, votos };
}

const dados = () => (cache ??= gerar());

/** Todas as candidaturas com mapa (a API devolverá as do recorte do projeto). */
export async function lerCandidaturasMapa(): Promise<CandidaturaMapa[]> {
  return (await dados())?.candidaturas ?? [];
}

/** Votos por município e turno de uma candidatura; vazio para cargos fora do mapa. */
export async function lerVotosCandidatura(id_candidatura: number): Promise<VotoMunicipio[]> {
  return (await dados())?.votos.get(id_candidatura) ?? [];
}

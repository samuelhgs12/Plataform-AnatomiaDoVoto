// Legislativo: quem ocupa as cadeiras do Senado, da Câmara e das Assembleias (análise `legislativo`,
// api/app/analises/legislativo.sql). Tudo aqui é lógica pura: o hemiciclo, as bancadas e as classes de cor de cada leitura.

import { NOME_UF } from "./financiamento";

export type Casa = "senado" | "camara" | "assembleia";
export type Leitura = "vies" | "custo" | "partido" | "renovacao";
export type Renovacao = "reeleito" | "ja_eleito" | "estreante";
export type Recorte = "inteiro" | "estados";

export interface LinhaCadeira {
  ano: number; casa: Casa; uf: string; ano_eleicao: number; id_candidato: number; id_candidatura: number; nome: string;
  sigla: string; score: number | null; erro_padrao: number | null; fonte: string | null; gasto: number | null; renovacao: Renovacao;
}
export interface LinhaVagas { ano: number; casa: Casa; uf: string; vagas: number }
export interface LinhaGastoPartido {
  ano_eleicao: number; casa: Casa; uf: string; sigla: string; candidatos: number; eleitos: number; sem_prestacao: number; gasto: number;
}
export interface LinhaSemResultado { ano: number; casa: Casa; uf: string; candidatos: number }

/** Os anos com viés na base (pesquisa BLS): 2018, 2022 e 2026. */
export const ANOS_LEGISLATIVO = [2018, 2022, 2026];
export const UFS_PROJETO = ["AP", "ES", "MG", "PE", "RJ", "RR"];
/** Cadeiras do plenário inteiro das casas nacionais, das 27 unidades da federação. */
export const PLENARIO_NACIONAL: Record<"senado" | "camara", number> = { senado: 81, camara: 513 };
export const LEITURAS: { id: Leitura; rotulo: string }[] = [
  { id: "vies", rotulo: "Viés" }, { id: "custo", rotulo: "Custo" }, { id: "partido", rotulo: "Partido" }, { id: "renovacao", rotulo: "Renovação" },
];
export const ROTULO_RENOVACAO: Record<Renovacao, string> = {
  reeleito: "Reeleito", ja_eleito: "Já eleito antes", estreante: "Estreante",
};
/** De onde vem o viés de cada partido (coluna `fonte` de vies_partido). */
export const ROTULO_FONTE: Record<string, string> = {
  bls: "medido na pesquisa",
  bls_onda_vizinha: "medido na outra onda da pesquisa",
  bls_fusao: "partido de fusão: a partir dos partidos de origem",
  editorial: "partido fora da pesquisa: valor de um partido de referência",
};

// ---------- Siglas ----------

/** Partidos que só mudaram de nome (fusões e incorporações ficam de fora: o viés dos partidos de origem é outro). */
export const RENOMEACOES: { de: string; para: string; ano: number }[] = [
  { de: "PMDB", para: "MDB", ano: 2017 }, { de: "PRB", para: "REPUBLICANOS", ano: 2019 }, { de: "PR", para: "PL", ano: 2019 },
  { de: "PPS", para: "CIDADANIA", ano: 2019 }, { de: "PTC", para: "AGIR", ano: 2022 }, { de: "PCDOB", para: "PC do B", ano: 0 },
];

/** A sigla com o nome em vigor no ano da composição: no Senado de 2022, o PRB eleito em 2018 aparece como REPUBLICANOS. */
export function siglaNaComposicao(sigla: string, ano: number): string {
  let s = sigla;
  for (const r of RENOMEACOES) if (s === r.de && ano >= r.ano) s = r.para;
  return s;
}

// ---------- A casa escolhida ----------

/** Chave da casa na URL: "senado", "camara" ou "al-<uf>" (Assembleia Legislativa). */
export interface Escolha { casa: Casa; uf?: string }

export function lerCasa(v: string | undefined): Escolha | null {
  if (v === "senado" || v === "camara") return { casa: v };
  const m = /^al-([a-z]{2})$/.exec(v ?? "");
  const uf = m?.[1].toUpperCase();
  return uf && UFS_PROJETO.includes(uf) ? { casa: "assembleia", uf } : null;
}

export const chaveCasa = (e: Escolha) => (e.casa === "assembleia" ? `al-${e.uf!.toLowerCase()}` : e.casa);

export function nomeCasa(e: Escolha): string {
  if (e.casa === "senado") return "Senado Federal";
  if (e.casa === "camara") return "Câmara dos Deputados";
  return `Assembleia Legislativa ${preposicaoUf(e.uf!)} ${NOME_UF[e.uf!] ?? e.uf}`;
}

/** "do Amapá", "de Minas Gerais", "de Pernambuco", "do Rio de Janeiro", "de Roraima", "do Espírito Santo". */
export function preposicaoUf(uf: string): string {
  return ["AP", "ES", "RJ"].includes(uf) ? "do" : "de";
}

/** A legislatura que a eleição de `ano` formou: "2023–2027". */
export const legislatura = (ano: number) => `${ano + 1}–${ano + 5}`;

// ---------- Cadeiras ----------

const porPosicao = (a: LinhaCadeira, b: LinhaCadeira) =>
  (a.score ?? Infinity) - (b.score ?? Infinity) || a.sigla.localeCompare(b.sigla) || a.uf.localeCompare(b.uf) || a.nome.localeCompare(b.nome);

/** Eleitos que ocupam a casa no ano, da esquerda para a direita do hemiciclo (pelo viés do partido; sem viés por último). */
export function cadeirasDaCasa(linhas: LinhaCadeira[], ano: number, e: Escolha): LinhaCadeira[] {
  return linhas.filter((l) => l.ano === ano && l.casa === e.casa && (!e.uf || l.uf === e.uf)).sort(porPosicao);
}

/** Estados da casa sem resultado divulgado no ano (o TSE ainda não publicou quem se elegeu). */
export function semResultado(linhas: LinhaSemResultado[], ano: number, e: Escolha): string[] {
  return linhas.filter((l) => l.ano === ano && l.casa === e.casa && (!e.uf || l.uf === e.uf)).map((l) => l.uf).sort();
}

export function vagasDaCasa(linhas: LinhaVagas[], ano: number, e: Escolha, ufs?: string[]): number {
  return linhas.filter((l) => l.ano === ano && l.casa === e.casa && (!e.uf || l.uf === e.uf) && (!ufs || ufs.includes(l.uf)))
    .reduce((s, l) => s + l.vagas, 0);
}

// ---------- Hemiciclo ----------

export interface Ponto { x: number; y: number }

/** Número de fileiras para n cadeiras: o espaço entre fileiras fica perto do espaço entre cadeiras. */
export const fileiras = (n: number) => Math.max(1, Math.round(Math.sqrt(0.273 * n)));

/**
 * Posições de n cadeiras num semicírculo de raio 1 (centro em 0,0; y negativo para cima), da esquerda para a direita
 * pelo ângulo, fileira a fileira proporcional ao comprimento do arco. `raio` é o raio de cada cadeira.
 */
export function hemiciclo(n: number, interno = 0.4): { pontos: Ponto[]; raio: number } {
  if (n <= 0) return { pontos: [], raio: 0 };
  const f = fileiras(n);
  const raios = Array.from({ length: f }, (_, i) => (f === 1 ? 1 : interno + ((1 - interno) * i) / (f - 1)));
  const soma = raios.reduce((s, r) => s + r, 0);
  const por = raios.map((r) => Math.round((n * r) / soma));
  por[f - 1] += n - por.reduce((s, k) => s + k, 0);
  const lista: { ang: number; p: Ponto }[] = [];
  raios.forEach((r, i) => {
    const k = por[i];
    for (let j = 0; j < k; j++) {
      const ang = k === 1 ? Math.PI / 2 : Math.PI * (1 - j / (k - 1));
      lista.push({ ang, p: { x: r * Math.cos(ang), y: -r * Math.sin(ang) } });
    }
  });
  lista.sort((a, b) => b.ang - a.ang || a.p.y - b.p.y);
  const passoArco = (Math.PI * soma) / n;
  const passoFileira = f === 1 ? passoArco : (1 - interno) / (f - 1);
  return { pontos: lista.map((l) => l.p), raio: Math.min(passoArco, passoFileira) * 0.42 };
}

/** Índices em que `k` itens ficam espalhados por igual entre `total` posições, na mesma ordem. */
export function espalhar(k: number, total: number): number[] {
  if (k <= 0) return [];
  if (k >= total) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: k }, (_, i) => Math.floor(((i + 0.5) * total) / k));
}

/**
 * Onde pôr a sigla de cada bancada do lado de fora do arco: no ângulo médio das cadeiras dela (radianos, 0 = direita,
 * π = esquerda). Siglas mais próximas que `minimo` da última posta são puladas, na ordem dada (a maior primeiro).
 */
export function siglasNoArco(bancadas: { bancada: number; angulos: number[] }[], minimo = 0.16): { bancada: number; angulo: number }[] {
  const postas: { bancada: number; angulo: number }[] = [];
  for (const b of bancadas) {
    if (!b.angulos.length) continue;
    const angulo = b.angulos.reduce((s, v) => s + v, 0) / b.angulos.length;
    if (postas.some((p) => Math.abs(p.angulo - angulo) < minimo)) continue;
    postas.push({ bancada: b.bancada, angulo });
  }
  return postas;
}

export type Lugar =
  | { tipo: "eleito"; cadeira: LinhaCadeira }
  | { tipo: "sem_resultado" }      // estado da casa sem resultado divulgado
  | { tipo: "fora" };              // cadeira de outro estado, fora da base

/**
 * Os lugares do plenário, na ordem do hemiciclo: os eleitos espalhados por igual entre `total` cadeiras (mantendo a
 * ordem do viés) e, nas que sobram, as `semResultado` espalhadas entre as de outros estados.
 */
export function lugares(cadeiras: LinhaCadeira[], total: number, semResultadoN = 0): Lugar[] {
  const n = Math.max(total, cadeiras.length + semResultadoN);
  const out: Lugar[] = Array.from({ length: n }, () => ({ tipo: "fora" }));
  const livres: number[] = [];
  const ocupados = new Set(espalhar(cadeiras.length, n));
  let i = 0;
  for (let p = 0; p < n; p++) {
    if (ocupados.has(p)) out[p] = { tipo: "eleito", cadeira: cadeiras[i++] };
    else livres.push(p);
  }
  for (const j of espalhar(semResultadoN, livres.length)) out[livres[j]] = { tipo: "sem_resultado" };
  return out;
}

// ---------- Cores de cada leitura (classes CSS; as cores moram em globals.css) ----------

/** Sete faixas do viés: e3 (≤ −60) … c (−10 a +10) … d3 (> +60). */
export function classeVies(score: number | null): string {
  if (score === null) return "v-nd";
  if (score < -60) return "v-e3";
  if (score < -30) return "v-e2";
  if (score < -10) return "v-e1";
  if (score <= 10) return "v-c";
  if (score <= 30) return "v-d1";
  if (score <= 60) return "v-d2";
  return "v-d3";
}
export const FAIXAS_VIES: { classe: string; rotulo: string }[] = [
  { classe: "v-e3", rotulo: "−100 a −60" }, { classe: "v-e2", rotulo: "−60 a −30" }, { classe: "v-e1", rotulo: "−30 a −10" },
  { classe: "v-c", rotulo: "−10 a +10" }, { classe: "v-d1", rotulo: "+10 a +30" }, { classe: "v-d2", rotulo: "+30 a +60" }, { classe: "v-d3", rotulo: "+60 a +100" },
];

/** Quartis (25%, 50%, 75%) de uma lista de valores, por interpolação linear. */
export function quartis(valores: number[]): [number, number, number] | null {
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p: number) => {
    const i = (v.length - 1) * p, a = Math.floor(i), b = Math.ceil(i);
    return v[a] + (v[b] - v[a]) * (i - a);
  };
  return [q(0.25), q(0.5), q(0.75)];
}

/** Quarto do gasto do eleito dentro da casa: c1 (o quarto que menos gastou) a c4; sem dado: c-nd. */
export function classeCusto(gasto: number | null, cortes: [number, number, number] | null): string {
  if (gasto === null || !cortes) return "c-nd";
  return gasto <= cortes[0] ? "c-1" : gasto <= cortes[1] ? "c-2" : gasto <= cortes[2] ? "c-3" : "c-4";
}

/** Cor da bancada na leitura Partido: cinco cores em rodízio, na ordem do hemiciclo (vizinhos nunca repetem). */
export const classePartido = (indice: number) => `p-${indice % 5}`;

export const classeRenovacao = (r: Renovacao) => `r-${r}`;

// ---------- Bancadas ----------

export interface Bancada {
  sigla: string;
  cadeiras: number;
  score: number | null;
  erro: number | null;
  fonte: string | null;
  /** mediana do gasto dos eleitos do partido que entregaram a prestação (null se nenhum) */
  gastoMediano: number | null;
  /** gasto de todas as campanhas do partido ao cargo ÷ cadeiras que ganhou naquela eleição */
  custoPorCadeira: number | null;
  /** cadeiras ganhas na eleição do ano (no Senado, sem os eleitos quatro anos antes) */
  ganhasNoAno: number;
  candidatos: number;
  reeleitos: number; jaEleitos: number; estreantes: number;
}

/** Viés médio das cadeiras (uma bancada com nomes juntados pode ter cadeiras de eleições diferentes). */
function mediaScore(cs: LinhaCadeira[]): number | null {
  const v = cs.map((c) => c.score).filter((s): s is number => s !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Onde um viés cai na barra da legenda (0 a 1): as sete faixas têm a mesma largura, então é a faixa mais a fração dentro dela. */
export function posicaoNaEscala(score: number): number {
  const cortes = [-100, -60, -30, -10, 10, 30, 60, 100];
  const s = Math.max(-100, Math.min(100, score));
  for (let i = 0; i < 7; i++) {
    if (s <= cortes[i + 1]) return (i + (s - cortes[i]) / (cortes[i + 1] - cortes[i])) / 7;
  }
  return 1;
}

export function mediana(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Bancadas da casa, na ordem do hemiciclo (do viés mais à esquerda para o mais à direita). O custo por cadeira usa o
 * gasto de todas as campanhas do partido ao cargo no ano (as perdedoras também), como a pergunta 1.
 */
export function bancadas(cadeiras: LinhaCadeira[], gastos: LinhaGastoPartido[], ano: number, e: Escolha): Bancada[] {
  const g = gastos.filter((l) => l.ano_eleicao === ano && l.casa === e.casa && (!e.uf || l.uf === e.uf));
  const ordem: string[] = [];
  const grupos = new Map<string, LinhaCadeira[]>();
  for (const c of cadeiras) {
    if (!grupos.has(c.sigla)) { grupos.set(c.sigla, []); ordem.push(c.sigla); }
    grupos.get(c.sigla)!.push(c);
  }
  return ordem.map((sigla) => {
    const cs = grupos.get(sigla)!;
    const doPartido = g.filter((l) => l.sigla === sigla);
    const gasto = doPartido.reduce((s, l) => s + l.gasto, 0);
    const ganhas = cs.filter((c) => c.ano_eleicao === ano).length;
    const gastosEleitos = cs.map((c) => c.gasto).filter((v): v is number => v !== null);
    return {
      sigla, cadeiras: cs.length, score: mediaScore(cs), erro: cs[0].erro_padrao, fonte: cs[0].fonte,
      gastoMediano: mediana(gastosEleitos),
      custoPorCadeira: ganhas > 0 ? gasto / ganhas : null,
      ganhasNoAno: ganhas,
      candidatos: doPartido.reduce((s, l) => s + l.candidatos, 0),
      reeleitos: cs.filter((c) => c.renovacao === "reeleito").length,
      jaEleitos: cs.filter((c) => c.renovacao === "ja_eleito").length,
      estreantes: cs.filter((c) => c.renovacao === "estreante").length,
    };
  });
}

/** Ordem da tabela em cada leitura: viés (esquerda → direita), custo por cadeira (maior primeiro), demais pelo tamanho. */
export function ordenarBancadas(b: Bancada[], leitura: Leitura): Bancada[] {
  if (leitura === "vies") return b;
  if (leitura === "custo") return [...b].sort((x, y) => (y.custoPorCadeira ?? -1) - (x.custoPorCadeira ?? -1) || y.cadeiras - x.cadeiras);
  return [...b].sort((x, y) => y.cadeiras - x.cadeiras || x.sigla.localeCompare(y.sigla));
}

// ---------- Números da casa ----------

export interface Resumo {
  cadeiras: number;
  partidos: number;
  /** média do viés das cadeiras (cada cadeira pesa igual) */
  viesMedio: number | null;
  esquerda: number; centro: number; direita: number;
  /** custo da cadeira (pergunta 1): gasto de todas as campanhas ao cargo ÷ cadeiras em disputa no ano */
  custoCadeira: number | null;
  gastoMediano: number | null;
  semPrestacao: number;
  reeleitos: number; jaEleitos: number; estreantes: number;
}

/**
 * Números da casa. `ufsSemResultado` ficam fora do custo da cadeira: há gasto, mas não há eleitos para dividir.
 * Centro: viés entre −10 e +10 (a mesma faixa neutra das cores).
 */
export function resumo(cadeiras: LinhaCadeira[], gastos: LinhaGastoPartido[], ano: number, e: Escolha, ufsSemResultado: string[] = []): Resumo {
  const scores = cadeiras.map((c) => c.score).filter((v): v is number => v !== null);
  const g = gastos.filter((l) => l.ano_eleicao === ano && l.casa === e.casa && (!e.uf || l.uf === e.uf) && !ufsSemResultado.includes(l.uf));
  const eleitos = g.reduce((s, l) => s + l.eleitos, 0);
  return {
    cadeiras: cadeiras.length,
    partidos: new Set(cadeiras.map((c) => c.sigla)).size,
    viesMedio: scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
    esquerda: scores.filter((s) => s < -10).length,
    centro: scores.filter((s) => s >= -10 && s <= 10).length,
    direita: scores.filter((s) => s > 10).length,
    custoCadeira: eleitos > 0 ? g.reduce((s, l) => s + l.gasto, 0) / eleitos : null,
    gastoMediano: mediana(cadeiras.map((c) => c.gasto).filter((v): v is number => v !== null)),
    semPrestacao: g.reduce((s, l) => s + l.sem_prestacao, 0),
    reeleitos: cadeiras.filter((c) => c.renovacao === "reeleito").length,
    jaEleitos: cadeiras.filter((c) => c.renovacao === "ja_eleito").length,
    estreantes: cadeiras.filter((c) => c.renovacao === "estreante").length,
  };
}

/** Viés com sinal e uma casa: "+13,9", "−69,1", "0,0". */
export function fmtVies(v: number | null, casas = 1): string {
  if (v === null) return "—";
  const r = Number(v.toFixed(casas));
  const t = Math.abs(r).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return r > 0 ? `+${t}` : r < 0 ? `−${t}` : t;
}

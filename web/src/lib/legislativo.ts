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

// ---------- Silhuetas dos estados (seletor das Assembleias) ----------

/**
 * Enquadramento (viewBox) de um contorno da malha do IBGE (src/lib/brasil-uf.ts, só comandos absolutos M/L/Z), com uma
 * margem em fração do maior lado, para a silhueta ficar centralizada e inteira num quadrado.
 */
export function caixaDoContorno(d: string, margem = 0.08): { x: number; y: number; largura: number; altura: number } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  if (!xs.length) return { x: 0, y: 0, largura: 1, altura: 1 };
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const lado = Math.max(x1 - x0, y1 - y0) * (1 + 2 * margem);
  return { x: (x0 + x1) / 2 - lado / 2, y: (y0 + y1) / 2 - lado / 2, largura: lado, altura: lado };
}

// ---------- Hemiciclo ----------

export interface Ponto { x: number; y: number }

/**
 * Raio interno do hemiciclo (fração do externo): casas pequenas ganham um vão central maior, para o número do centro
 * caber sem encostar nas cadeiras; a Câmara (513) fica com o vão clássico.
 */
export const raioInterno = (n: number) => (n <= 40 ? 0.56 : n <= 120 ? 0.5 : 0.42);

/** Maior raio de uma cadeira (fração do raio externo): numa casa de 18 cadeiras, elas não viram bolas gigantes. */
export const RAIO_MAX_CADEIRA = 0.045;

/**
 * Número de fileiras para n cadeiras: o espaço entre fileiras fica perto do espaço entre cadeiras. Com raio interno i,
 * f·(f − 1) ≈ 2n(1 − i) / (π(1 + i)).
 */
export function fileiras(n: number, interno = raioInterno(n)): number {
  return Math.max(1, Math.round(Math.sqrt((2 * n * (1 - interno)) / (Math.PI * (1 + interno))) + 0.5));
}

/**
 * Posições de n cadeiras num semicírculo de raio 1 (centro em 0,0; y negativo para cima), da esquerda para a direita
 * pelo ângulo, fileira a fileira proporcional ao comprimento do arco. `raio` é o raio de cada cadeira e `interno`, o
 * raio da fileira de dentro.
 */
export function hemiciclo(n: number, interno = raioInterno(n)): { pontos: Ponto[]; raio: number; interno: number } {
  if (n <= 0) return { pontos: [], raio: 0, interno };
  const f = fileiras(n, interno);
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
  // o menor espaço real entre cadeiras vizinhas numa fileira (a de dentro é a mais apertada)
  const passoArco = Math.min(...raios.map((r, i) => (por[i] > 1 ? (Math.PI * r) / (por[i] - 1) : Infinity)));
  const passoFileira = f === 1 ? passoArco : (1 - interno) / (f - 1);
  return { pontos: lista.map((l) => l.p), raio: Math.min(RAIO_MAX_CADEIRA, Math.min(passoArco, passoFileira) * 0.42), interno };
}

/**
 * Tamanho das duas linhas do centro (o número e a legenda), em unidades do desenho, para caberem no vão do hemiciclo
 * sem encostar nas cadeiras. `vao` = raio da fileira de dentro menos o raio de uma cadeira; as letras têm ~0,6 da altura
 * de largura. A legenda fica com a base na linha das cadeiras de baixo, o número logo acima.
 */
export function textoCentral(vao: number, numero: string, legenda: string, maxNumero = 96, maxLegenda = 24): { numero: number; legenda: number } {
  const larg = (txt: string, fs: number) => txt.length * fs * 0.6;
  let legendaFs = maxLegenda;
  while (legendaFs > 12 && larg(legenda, legendaFs) > vao * 1.7) legendaFs -= 1;
  let numeroFs = maxNumero;
  // o número precisa caber na largura do vão na altura em que está (o arco interno fecha para cima)
  const cabe = (fs: number) => {
    const topo = legendaFs * 1.6 + fs * 0.78;          // do pé da legenda ao topo do número
    if (topo >= vao) return false;
    return larg(numero, fs) / 2 <= Math.sqrt(vao * vao - topo * topo) * 0.92;
  };
  while (numeroFs > 20 && !cabe(numeroFs)) numeroFs -= 2;
  return { numero: numeroFs, legenda: legendaFs };
}

/**
 * Onde pôr o rótulo de cada grupo do lado de fora do arco: no ângulo médio das cadeiras dele (radianos, 0 = direita,
 * π = esquerda). Na ordem dada (o maior primeiro), um rótulo que encostaria num já posto fica de fora: o espaço que cada
 * um ocupa no arco depende da largura do texto no topo (rótulos horizontais) e da altura nos lados.
 */
export function siglasNoArco(
  grupos: { bancada: number; angulos: number[]; largura?: number }[], raio = 1, altura = 0,
): { bancada: number; angulo: number }[] {
  const postas: { bancada: number; angulo: number; largura: number }[] = [];
  const minimo = (a: number, la: number, b: number, lb: number) => {
    if (!raio || (!la && !lb && !altura)) return 0.16;
    const meio = (a + b) / 2;
    return ((la + lb) / 2 * Math.abs(Math.sin(meio)) + altura * 1.3 * Math.abs(Math.cos(meio)) + altura * 0.4) / raio;
  };
  for (const g of grupos) {
    if (!g.angulos.length) continue;
    const angulo = g.angulos.reduce((s, v) => s + v, 0) / g.angulos.length;
    const largura = g.largura ?? 0;
    if (postas.some((p) => Math.abs(p.angulo - angulo) < minimo(p.angulo, p.largura, angulo, largura))) continue;
    postas.push({ bancada: g.bancada, angulo, largura });
  }
  return postas.map(({ bancada, angulo }) => ({ bancada, angulo }));
}

/** Índices em que `k` itens ficam espalhados por igual entre `total` posições, na mesma ordem. */
export function espalhar(k: number, total: number): number[] {
  if (k <= 0) return [];
  if (k >= total) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: k }, (_, i) => Math.floor(((i + 0.5) * total) / k));
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

// ---------- Ordem das cadeiras ----------

export type Ordem = "padrao" | "maior" | "menor";
const ORDEM_RENOVACAO: Renovacao[] = ["reeleito", "ja_eleito", "estreante"];

/**
 * A ordem em que as cadeiras ocupam o hemiciclo, da esquerda para a direita. Padrão: o viés do partido (como vem de
 * cadeirasDaCasa). Renovação: blocos contíguos de reeleitos, já eleitos e estreantes (dentro de cada um, a ordem do
 * viés). Custo com `ordem`: do maior para o menor gasto ou o contrário, sem dado de gasto no fim.
 */
export function ordenarCadeiras(cadeiras: LinhaCadeira[], leitura: Leitura, ordem: Ordem = "padrao"): LinhaCadeira[] {
  const pos = new Map(cadeiras.map((c, i) => [c, i]));
  const estavel = (a: LinhaCadeira, b: LinhaCadeira) => pos.get(a)! - pos.get(b)!;
  if (leitura === "renovacao") {
    return [...cadeiras].sort((a, b) => ORDEM_RENOVACAO.indexOf(a.renovacao) - ORDEM_RENOVACAO.indexOf(b.renovacao) || estavel(a, b));
  }
  if (leitura === "custo" && ordem !== "padrao") {
    const s = ordem === "maior" ? -1 : 1;
    return [...cadeiras].sort((a, b) => {
      if (a.gasto === null || b.gasto === null) return (a.gasto === null ? 1 : 0) - (b.gasto === null ? 1 : 0) || estavel(a, b);
      return s * (a.gasto - b.gasto) || estavel(a, b);
    });
  }
  return cadeiras;
}

// ---------- Lista das cadeiras (alternativa em texto ao hemiciclo) ----------

export interface GrupoLista { chave: string; titulo: string; cadeiras: LinhaCadeira[] }

/**
 * As cadeiras em grupos para a lista que acompanha o hemiciclo (teclado e leitor de tela): por bancada, na ordem do viés,
 * ou, na Renovação, pelos três blocos. Dentro de cada grupo, por nome. `filtro` deixa só as cadeiras de uma faixa do viés.
 */
export function gruposDaLista(cadeiras: LinhaCadeira[], leitura: Leitura, filtro?: Faixa): GrupoLista[] {
  const vis = filtro ? cadeiras.filter((c) => c.score !== null && faixaVies(c.score) === filtro) : cadeiras;
  const porNome = (a: LinhaCadeira, b: LinhaCadeira) => a.nome.localeCompare(b.nome);
  if (leitura === "renovacao") {
    return ORDEM_RENOVACAO.map((r) => ({ chave: r, titulo: ROTULO_RENOVACAO[r], cadeiras: vis.filter((c) => c.renovacao === r).sort(porNome) }))
      .filter((g) => g.cadeiras.length > 0);
  }
  const ordem: string[] = [];
  const mapa = new Map<string, LinhaCadeira[]>();
  for (const c of vis) {
    if (!mapa.has(c.sigla)) { mapa.set(c.sigla, []); ordem.push(c.sigla); }
    mapa.get(c.sigla)!.push(c);
  }
  return ordem.map((s) => ({ chave: s, titulo: s, cadeiras: mapa.get(s)!.sort(porNome) }));
}

// ---------- Cores de cada leitura (classes CSS; as cores moram em globals.css) ----------

export type Faixa = "e" | "ce" | "c" | "cd" | "d";

/**
 * Cinco faixas iguais de 40 pontos: esquerda (< −60), centro-esquerda (−60 a −20), centro (−20 a +20), centro-direita
 * (+20 a +60) e direita (> +60). Os cortes são simétricos: −60 e +60 ficam no centro-esquerda e no centro-direita; −20 e
 * +20, no centro.
 */
export function faixaVies(score: number): Faixa {
  if (score < -60) return "e";
  if (score < -20) return "ce";
  if (score <= 20) return "c";
  if (score <= 60) return "cd";
  return "d";
}
export const FAIXAS_VIES: { id: Faixa; rotulo: string; de: string; ate: string }[] = [
  { id: "e", rotulo: "Esquerda", de: "−100", ate: "−60" }, { id: "ce", rotulo: "Centro-esquerda", de: "−60", ate: "−20" },
  { id: "c", rotulo: "Centro", de: "−20", ate: "+20" }, { id: "cd", rotulo: "Centro-direita", de: "+20", ate: "+60" },
  { id: "d", rotulo: "Direita", de: "+60", ate: "+100" },
];
export const ROTULO_FAIXA = Object.fromEntries(FAIXAS_VIES.map((f) => [f.id, f.rotulo])) as Record<Faixa, string>;

export const classeVies = (score: number | null) => (score === null ? "v-nd" : `v-${faixaVies(score)}`);

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

/**
 * Cor da bancada na leitura Partido: a cor aproximada da identidade do partido (classe `par-<sigla>` em globals.css);
 * sigla sem cor cadastrada fica cinza (`par-outro`). "PC do B" → "par-pcdob", "UNIÃO" → "par-uniao".
 */
export const slugPartido = (sigla: string) => sigla.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
export const PARTIDOS_COM_COR = new Set([
  "agir", "avante", "cidadania", "dc", "dem", "democrata", "mdb", "novo", "patriota", "pcdob", "pdt", "phs", "pl", "pmb", "pmn", "pode", "pp",
  "ppl", "pps", "pr", "prb", "prd", "pros", "prp", "prtb", "psb", "psc", "psd", "psdb", "psl", "psol", "pt", "ptb", "ptc", "pv", "rede",
  "republicanos", "solidariedade", "uniao",
]);
export function classePartido(sigla: string): string {
  const s = slugPartido(sigla);
  return PARTIDOS_COM_COR.has(s) ? `par-${s}` : "par-outro";
}

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

/** Onde um viés cai na barra da legenda (0 a 1): as faixas são iguais, então a barra é linear de −100 a +100. */
export const posicaoNaEscala = (score: number) => (Math.max(-100, Math.min(100, score)) + 100) / 200;

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

// ---------- Números da casa ----------

export interface Resumo {
  cadeiras: number;
  partidos: number;
  /** média do viés das cadeiras (cada cadeira pesa igual) */
  viesMedio: number | null;
  /** cadeiras em cada faixa do viés */
  porFaixa: Record<Faixa, number>;
  /** custo da cadeira (pergunta 1): gasto de todas as campanhas ao cargo ÷ cadeiras em disputa no ano */
  custoCadeira: number | null;
  gastoMediano: number | null;
  semPrestacao: number;
  reeleitos: number; jaEleitos: number; estreantes: number;
}

/**
 * Números da casa. `ufsSemResultado` ficam fora do custo da cadeira: há gasto, mas não há eleitos para dividir.
 */
export function resumo(cadeiras: LinhaCadeira[], gastos: LinhaGastoPartido[], ano: number, e: Escolha, ufsSemResultado: string[] = []): Resumo {
  const scores = cadeiras.map((c) => c.score).filter((v): v is number => v !== null);
  const g = gastos.filter((l) => l.ano_eleicao === ano && l.casa === e.casa && (!e.uf || l.uf === e.uf) && !ufsSemResultado.includes(l.uf));
  const eleitos = g.reduce((s, l) => s + l.eleitos, 0);
  return {
    cadeiras: cadeiras.length,
    partidos: new Set(cadeiras.map((c) => c.sigla)).size,
    viesMedio: scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
    porFaixa: Object.fromEntries(FAIXAS_VIES.map((f) => [f.id, scores.filter((s) => faixaVies(s) === f.id).length])) as Record<Faixa, number>,
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

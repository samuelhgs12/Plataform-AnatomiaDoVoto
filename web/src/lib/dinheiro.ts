// Lógica da área "Dinheiro nas eleições" (/analises/dinheiro): as perguntas 1, 2 e 8 num mesmo recorte de eleição,
// cargo e lugar, sem React. Os dados vêm de /api/analises/municipios (cidades e estados), q1, q2 e q8.

import { pontosPercentuais, type Resposta } from "./estatistica";
import { reais } from "./format";
import { mediana, porteDe, type LinhaMunicipio, type LinhaResumo, type Porte } from "./territorio";

/** As três abas. `numero` (a pergunta do trabalho) fica discreto, perto da metodologia. */
export type Aba = "gasto" | "resultado" | "publico";
export const ABAS: { chave: Aba; rotulo: string; numero: string; pergunta: string }[] = [
  { chave: "gasto", rotulo: "Gastos por vaga", numero: "Pergunta 1", pergunta: "Quanto as campanhas gastaram por vaga?" },
  { chave: "resultado", rotulo: "Gastos e resultado", numero: "Pergunta 2", pergunta: "Quem gastou mais se elegeu mais?" },
  { chave: "publico", rotulo: "Dinheiro público", numero: "Pergunta 8", pergunta: "Quem recebeu mais dinheiro público se elegeu mais?" },
];

/** Cargos de cada tipo de eleição, na ordem das opções (o primeiro é o padrão). */
export const CARGOS_MUNICIPAIS = ["Vereador", "Prefeito"];
export const CARGOS_GERAIS = ["Deputado federal", "Deputado estadual", "Senador", "Governador"];
export const ehMunicipal = (ano: number) => ano % 4 === 0;
export const cargosDoAno = (ano: number) => (ehMunicipal(ano) ? CARGOS_MUNICIPAIS : CARGOS_GERAIS);
/** Cargos com poucos candidatos por disputa: a P2 vira "quem mais gastou venceu?". */
export const ehMajoritario = (cargo: string) => ["Prefeito", "Governador", "Senador", "Presidente"].includes(cargo);

/** O recorte da página: um ano só, um cargo compatível com ele, um lugar. */
export interface Recorte {
  ano: number; cargo: string; aba: Aba; vista: "mapa" | "lista";
  uf?: string; mun?: LinhaMunicipio;
  /** Cargo pedido que não existe nessa eleição (a página avisa que trocou). */
  cargoTrocado?: string;
  /** Município pedido numa eleição geral (não se aplica: a página avisa). */
  munIgnorado?: boolean;
}

type SP = Record<string, string | string[] | undefined>;
const um = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);

/** Lê e valida o recorte da URL contra as opções que existem; o que não existe é ignorado (e, se for o cargo, avisado). */
export function lerRecorte(sp: SP, op: { anos: number[]; ufs: string[]; municipios: LinhaMunicipio[] }): Recorte {
  const pedido = Number(um(sp.ano));
  const ano = op.anos.includes(pedido) ? pedido : op.anos[op.anos.length - 1];
  const cargos = cargosDoAno(ano);
  const cargoPedido = um(sp.cargo);
  const cargo = cargoPedido && cargos.includes(cargoPedido) ? cargoPedido : cargos[0];
  const uf = op.ufs.includes(um(sp.uf) ?? "") ? um(sp.uf) : undefined;
  const munPedido = op.municipios.find((m) => String(m.id_municipio) === um(sp.mun) && (!uf || m.uf === uf));
  const mun = ehMunicipal(ano) ? munPedido : undefined;
  const aba = ABAS.some((a) => a.chave === um(sp.aba)) ? (um(sp.aba) as Aba) : "gasto";
  return {
    ano, cargo, aba, vista: um(sp.vista) === "lista" ? "lista" : "mapa",
    uf: uf ?? mun?.uf, mun,
    cargoTrocado: cargoPedido && cargoPedido !== cargo ? cargoPedido : undefined,
    munIgnorado: !!munPedido && !mun,
  };
}

/** Endereço da área com o recorte atual e as mudanças (null apaga). Trocar o estado solta a cidade. */
export function hrefDinheiro(r: Recorte, novo: Partial<Record<"ano" | "cargo" | "uf" | "mun" | "aba" | "vista", string | number | null>> = {}, ancora?: string): string {
  const atual: Record<string, string | number | null | undefined> = {
    ano: r.ano, cargo: r.cargo, uf: r.uf, mun: "uf" in novo ? null : r.mun?.id_municipio, aba: r.aba === "gasto" ? null : r.aba, vista: r.vista === "lista" ? "lista" : null,
  };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...atual, ...novo })) if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  return `/analises/dinheiro?${p}${ancora ? `#${ancora}` : ""}`;
}

/**
 * O valor de uma cidade numa eleição municipal, para a aba e o cargo (null = não informado). Nunca mistura cargos:
 * gasto = gasto das campanhas ao cargo ÷ vagas (prefeito: 1 vaga); público = parte pública do que as campanhas ao
 * cargo receberam (receita zero = proporção indefinida, null, não 0%); resultado = prefeito: quem mais gastou venceu
 * (1/0); vereador: parte dos candidatos com mais recursos que se elegeu.
 */
export function valorCidade(r: LinhaResumo | undefined, aba: Aba, cargo: string): number | null {
  if (!r) return null;
  const prefeito = cargo === "Prefeito";
  if (aba === "gasto") return prefeito ? (r.prefeito_candidatos > 0 ? r.prefeito_gasto : null) : r.vereador_vagas > 0 ? r.vereador_gasto / r.vereador_vagas : null;
  if (aba === "publico") {
    const [pub, rec] = prefeito ? [r.prefeito_publica, r.prefeito_receita] : [r.vereador_publica, r.vereador_receita];
    return rec > 0 ? pub / rec : null;
  }
  if (prefeito) return r.maior_venceu == null ? null : r.maior_venceu ? 1 : 0;
  return r.rec_mais_cand ? (r.rec_mais_eleitos ?? 0) / r.rec_mais_cand : null;
}

/** Faixas de cor fixas e redondas (iguais em todos os anos), escolhidas pela distribuição real das cidades. */
export function faixasDe(aba: Aba, cargo: string): number[] | null {
  if (aba === "gasto") return cargo === "Prefeito" ? [100_000, 250_000, 500_000, 1_000_000] : [2_000, 5_000, 10_000, 25_000];
  if (aba === "publico") return [0.2, 0.4, 0.6, 0.8];
  return cargo === "Prefeito" ? null : [0.2, 0.3, 0.4, 0.5];   // prefeito: venceu/perdeu, sem faixas
}

/** Classe de cor de uma cidade (q0–q4 ou "sem"). */
export function corCidade(v: number | null, aba: Aba, cargo: string): string {
  if (v === null) return "sem";
  const f = faixasDe(aba, cargo);
  return f ? `q${f.filter((c) => v >= c).length}` : v === 1 ? "q4" : "q0";
}

const mil = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("pt-BR")} mi` : `${v / 1000} mil`);
/** Itens da legenda do mapa, com "Não informado" sempre separado de zero. */
export function legendaCidade(aba: Aba, cargo: string): { classe: string; texto: string }[] {
  const sem = { classe: "sem", texto: aba === "resultado" && cargo === "Prefeito" ? "Não comparável" : "Não informado" };
  const f = faixasDe(aba, cargo);
  if (!f) return [{ classe: "q4", texto: "Quem mais gastou venceu" }, { classe: "q0", texto: "Perdeu" }, sem];
  const t = aba === "gasto" ? (v: number) => mil(v) : (v: number) => `${Math.round(v * 100)}%`;
  const pre = aba === "gasto" ? "R$ " : "";
  // intervalo curto quando as duas pontas têm a mesma unidade: "R$ 2–5 mil", "20–40%"; senão, "R$ 500 mil–1 mi"
  const intervalo = (a: number, b: number) => {
    const [ta, tb] = [t(a), t(b)], ua = ta.replace(/^[\d.,]+/, ""), ub = tb.replace(/^[\d.,]+/, "");
    return ua === ub ? `${ta.slice(0, ta.length - ua.length)}–${tb}` : `${ta}–${tb}`;
  };
  return [
    { classe: "q0", texto: `até ${pre}${t(f[0])}` },
    ...f.slice(1).map((v, i) => ({ classe: `q${i + 1}`, texto: `${pre}${intervalo(f[i], v)}` })),
    { classe: `q${f.length}`, texto: `${pre}${t(f[f.length - 1])} ou mais` },
    sem,
  ];
}

/** O valor escrito, com a unidade; null vira "Não informado" (nunca zero). */
export function textoValor(v: number | null, aba: Aba, cargo: string): string {
  if (v === null) return "Não informado";
  if (aba === "gasto") return reais(v);
  if (aba === "resultado" && cargo === "Prefeito") return v === 1 ? "Venceu" : "Perdeu";
  return `${Math.round(v * 100)}%`;
}

/** A unidade do valor de uma cidade, para ficar ao lado do número. */
export function unidade(aba: Aba, cargo: string): string {
  if (aba === "gasto") return `por vaga de ${cargo.toLowerCase()}`;
  if (aba === "publico") return `do que as campanhas a ${cargo.toLowerCase()} receberam veio de fundos públicos`;
  return ehMajoritario(cargo) ? `o candidato a ${cargo.toLowerCase()} que mais gastou` : `dos candidatos a ${cargo.toLowerCase()} com mais recursos se elegeram`;
}

/**
 * Referência de comparação de uma cidade: as cidades do mesmo porte no mesmo ano (mediana; para prefeito na aba
 * resultado, a parte das cidades em que quem mais gastou venceu). `n` = cidades com o dado.
 */
export function referenciaDoPorte(resumo: LinhaResumo[], ano: number, porte: Porte, aba: Aba, cargo: string): { valor: number | null; n: number } {
  const valores = resumo.filter((r) => r.ano === ano && porteDe(r.eleitorado)?.chave === porte).flatMap((r) => valorCidade(r, aba, cargo) ?? []);
  if (aba === "resultado" && cargo === "Prefeito") return { valor: valores.length ? valores.reduce((a, v) => a + v, 0) / valores.length : null, n: valores.length };
  return { valor: mediana(valores), n: valores.length };
}

/** "30 em cada 100" (abaixo de 1: "menos de 1"). */
export const emCada100 = (p: number) => (p === 0 ? "0" : p < 0.005 ? "menos de 1" : String(Math.round(p * 100)));

/** A frase de destaque com as taxas e a diferença em pontos percentuais. */
export function fraseTaxas(maior: number, menor: number): string {
  const pp = pontosPercentuais(maior, menor);
  const dif = pp === 0 ? "sem diferença" : `diferença de ${Math.abs(pp)} ${Math.abs(pp) === 1 ? "ponto percentual" : "pontos percentuais"}`;
  return `${emCada100(maior)} em cada 100 se elegeram, contra ${emCada100(menor)} em cada 100 — ${dif}`;
}

/**
 * A qualificação estatística, secundária e sem tom conclusivo: nunca transforma "sem significância" em "não há
 * relação" nem "significância" em causa. O mínimo de 20% é uma regra do projeto, dita como tal.
 */
export function qualificacao(r: Resposta | null): string {
  if (r === null || r === "Sem dados suficientes.") return "Poucos casos para um teste estatístico.";
  if (r === "Sim." || r === "Não.") return "O teste identificou diferença estatística neste recorte (95% de confiança). Isso não demonstra que o dinheiro causou a vitória.";
  if (r === "Diferença pequena.") return "O teste identificou diferença estatística, mas menor que 20%, o mínimo que o projeto adota para destacá-la.";
  return "Neste recorte, o teste não identificou diferença estatística. Isso não quer dizer que não haja relação.";
}

/** Classe de cor por faixas dadas (para os estados, cuja escala é outra: soma de muitas campanhas). */
export const corPorFaixas = (v: number | null, faixas: number[]) => (v === null ? "sem" : `q${faixas.filter((c) => v >= c).length}`);
/** Parte das cidades em que quem mais gastou para prefeito venceu: faixas dos estados. */
export const FAIXAS_PARTE_CIDADES = [0.5, 0.6, 0.7, 0.8];

/**
 * O valor de um estado (ou dos seis, sem uf) com a mesma conta da cidade, a partir da tabela "estados" da análise
 * municipios: gasto ÷ vagas; parte pública das receitas; prefeito: parte das disputas comparáveis em que quem mais
 * gastou venceu. A P2 de vereador e deputado vem da análise q2 (grupos), não daqui (null).
 */
export function valorDoEstado(estados: { ano: number; uf: string; cargo: string; vagas: number; gasto: number; receita: number; receita_publica: number; disputas_maior: number | null; maior_venceu: number | null }[],
  ano: number, uf: string | undefined, aba: Aba, cargo: string): number | null {
  const sel = estados.filter((e) => e.ano === ano && e.cargo === cargo && e.uf !== "BR" && (!uf || e.uf === uf));
  if (!sel.length) return null;
  const soma = (k: "vagas" | "gasto" | "receita" | "receita_publica" | "disputas_maior" | "maior_venceu") => sel.reduce((a, e) => a + (e[k] ?? 0), 0);
  if (aba === "gasto") return soma("vagas") > 0 ? soma("gasto") / soma("vagas") : null;
  if (aba === "publico") return soma("receita") > 0 ? soma("receita_publica") / soma("receita") : null;
  if (cargo !== "Prefeito") return null;
  return soma("disputas_maior") > 0 ? soma("maior_venceu") / soma("disputas_maior") : null;
}

/** Filtro de porte do mapa: as cidades de outro porte ficam apagadas (continuam clicáveis), para comparar parecidas. */
export const classeComPorte = (classe: string, porteCidade: string | undefined, porteFiltro: string | undefined) =>
  porteFiltro && porteCidade !== porteFiltro ? `${classe} apagado` : classe;

/** Um grupo de candidatos e quantos se elegeram. */
export interface GrupoTaxa { candidaturas: number; eleitos: number; taxa: number }
const juntar = (gs: { candidaturas: number; eleitos: number }[]): GrupoTaxa => {
  const candidaturas = gs.reduce((a, g) => a + g.candidaturas, 0), eleitos = gs.reduce((a, g) => a + g.eleitos, 0);
  return { candidaturas, eleitos, taxa: candidaturas ? eleitos / candidaturas : 0 };
};

/**
 * Os 4 grupos de recursos da P2 (nada, pouco, médio, muito) nos mesmos 3 da P8 (nada, menos, mais), para as duas
 * comparações ficarem lado a lado com os mesmos rótulos: "mais" = cerca de 1/4 de maior valor na disputa.
 */
export function tresGrupos(grupos: { chave: string; candidaturas: number; eleitos: number }[]): { nada: GrupoTaxa; menos: GrupoTaxa; mais: GrupoTaxa } {
  const de = (...ch: string[]) => juntar(grupos.filter((g) => ch.includes(g.chave)));
  return { nada: de("nada"), menos: de("pouco", "medio"), mais: de("muito") };
}

/**
 * Numa disputa (ex.: prefeito de uma cidade), o candidato que mais recebeu dinheiro público, com as mesmas regras de
 * "quem mais gastou": null se alguém não entregou a prestação final, se ninguém recebeu ou se há empate no topo.
 */
export function maisRecebeuPublico<T extends { prestou?: boolean | null; receita_publica: number }>(cands: T[]): T | null {
  if (cands.length < 2 || cands.some((c) => c.prestou === false)) return null;
  const maior = Math.max(...cands.map((c) => c.receita_publica));
  const topo = cands.filter((c) => c.receita_publica === maior);
  return maior > 0 && topo.length === 1 ? topo[0] : null;
}

/**
 * A conta do gasto por vaga, para mostrar por extenso ("R$ 32 milhões ÷ 37 vagas"): o gasto das campanhas ao cargo e o
 * número de vagas. Na cidade, prefeito tem 1 vaga (o gasto por vaga é o total gasto na disputa, não o do eleito);
 * no estado ou nos seis, somas de todas as campanhas e de todas as vagas. null sem dado.
 */
export function contaGasto(r: LinhaResumo | undefined, cargo: string): { gasto: number; vagas: number } | null {
  if (!r) return null;
  if (cargo === "Prefeito") return r.prefeito_candidatos > 0 ? { gasto: r.prefeito_gasto, vagas: 1 } : null;
  return r.vereador_vagas > 0 ? { gasto: r.vereador_gasto, vagas: r.vereador_vagas } : null;
}
export function contaGastoEstado(estados: { ano: number; uf: string; cargo: string; vagas: number; gasto: number }[], ano: number, uf: string | undefined, cargo: string): { gasto: number; vagas: number } | null {
  const sel = estados.filter((e) => e.ano === ano && e.cargo === cargo && e.uf !== "BR" && (!uf || e.uf === uf));
  const vagas = sel.reduce((a, e) => a + e.vagas, 0), gasto = sel.reduce((a, e) => a + e.gasto, 0);
  return vagas > 0 ? { gasto, vagas } : null;
}

/**
 * Legenda com os limites escritos (para as faixas dos estados, que vêm da distribuição dos seis): "até R$ 40 mil",
 * "R$ 40 mil–R$ 60 mil"... e "Não informado". `fmt` escreve um valor da camada.
 */
export function legendaPorFaixas(faixas: number[], fmt: (v: number) => string): { classe: string; texto: string }[] {
  if (!faixas.length) return [{ classe: "sem", texto: "Não informado" }];
  return [
    { classe: "q0", texto: `até ${fmt(faixas[0])}` },
    ...faixas.slice(1).map((v, i) => ({ classe: `q${i + 1}`, texto: `${fmt(faixas[i])}–${fmt(v)}` })),
    { classe: `q${faixas.length}`, texto: `${fmt(faixas[faixas.length - 1])} ou mais` },
    { classe: "sem", texto: "Não informado" },
  ];
}

/**
 * Ordena as linhas da lista (cidades ou estados): por valor, do maior para o menor, com "não informado" no fim; ou por
 * nome. Na lista, cidades pequenas que somem no mapa podem ser comparadas com precisão.
 */
export function ordenarLinhas<T extends { nome: string; valor: number | null }>(linhas: T[], por: "valor" | "nome"): T[] {
  const porNome = (a: T, b: T) => a.nome.localeCompare(b.nome, "pt-BR");
  if (por === "nome") return [...linhas].sort(porNome);
  return [...linhas].sort((a, b) => (a.valor === null ? 1 : 0) - (b.valor === null ? 1 : 0) || (b.valor ?? 0) - (a.valor ?? 0) || porNome(a, b));
}

/**
 * O valor de um estado (ou dos seis, sem uf) contando só as cidades de um porte, com a mesma conta do estado:
 * gasto = soma dos gastos ÷ soma das vagas dessas cidades (prefeito: 1 vaga por cidade); público = soma das receitas
 * públicas ÷ soma das receitas; resultado = vereador: eleitos ÷ candidatos do grupo com mais recursos, somados;
 * prefeito: parte das cidades comparáveis em que quem mais gastou venceu. `n` = cidades do porte com o dado.
 */
export function valorDoPorte(resumo: LinhaResumo[], ano: number, uf: string | undefined, porte: Porte, aba: Aba, cargo: string): { valor: number | null; n: number; conta: { gasto: number; vagas: number } | null } {
  const sel = resumo.filter((r) => r.ano === ano && (!uf || r.uf === uf) && porteDe(r.eleitorado)?.chave === porte);
  const soma = (f: (r: LinhaResumo) => number) => sel.reduce((a, r) => a + f(r), 0);
  const prefeito = cargo === "Prefeito";
  if (aba === "gasto") {
    const comDado = sel.filter((r) => (prefeito ? r.prefeito_candidatos > 0 : r.vereador_vagas > 0));
    const gasto = comDado.reduce((a, r) => a + (prefeito ? r.prefeito_gasto : r.vereador_gasto), 0);
    const vagas = prefeito ? comDado.length : comDado.reduce((a, r) => a + r.vereador_vagas, 0);
    return { valor: vagas > 0 ? gasto / vagas : null, n: comDado.length, conta: vagas > 0 ? { gasto, vagas } : null };
  }
  if (aba === "publico") {
    const rec = soma((r) => (prefeito ? r.prefeito_receita : r.vereador_receita)), pub = soma((r) => (prefeito ? r.prefeito_publica : r.vereador_publica));
    return { valor: rec > 0 ? pub / rec : null, n: sel.length, conta: null };
  }
  if (prefeito) {
    const comp = sel.filter((r) => r.maior_venceu != null);
    return { valor: comp.length ? comp.filter((r) => r.maior_venceu).length / comp.length : null, n: comp.length, conta: null };
  }
  const cand = soma((r) => r.rec_mais_cand ?? 0), ele = soma((r) => r.rec_mais_eleitos ?? 0);
  return { valor: cand > 0 ? ele / cand : null, n: sel.length, conta: null };
}

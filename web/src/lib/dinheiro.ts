// Lógica da área "Dinheiro nas eleições" (/analises/dinheiro): as perguntas 1, 2 e 8 num mesmo recorte de eleição,
// cargo e lugar, sem React. Os dados vêm de /api/analises/municipios (cidades e estados), q1, q2 e q8.

import { pontosPercentuais, type Resposta } from "./estatistica";
import { brlCentavos, compacto, reais } from "./format";
import { mediana, porteDe, PORTES, type LinhaMunicipio, type LinhaResumo, type Porte } from "./territorio";

/** As três abas (e "eleitor": o gasto por eleitor apto, só uma medida do mapa). `numero` (a pergunta do trabalho) fica discreto, perto da metodologia. */
export type Aba = "gasto" | "resultado" | "publico" | "eleitor";
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

/** Eleições com prestação de contas no banco (não há receitas nem despesas antes de 2018). */
export const ANOS_DINHEIRO = [2018, 2020, 2022, 2024];

/** O que pinta o mapa: o gasto por vaga (padrão), o gasto por eleitor apto ou a parte pública do dinheiro recebido. */
export type Pintar = "vaga" | "eleitor" | "publico";
export const PINTAR: { chave: Pintar; rotulo: string; aba: Aba; titulo: string }[] = [
  { chave: "vaga", rotulo: "Gasto por vaga", aba: "gasto", titulo: "Quanto as campanhas gastaram por vaga" },
  { chave: "eleitor", rotulo: "Gasto por eleitor", aba: "eleitor", titulo: "Quanto as campanhas gastaram por eleitor" },
  { chave: "publico", rotulo: "Parte pública", aba: "publico", titulo: "Quanto do dinheiro das campanhas foi público" },
];
export const abaDe = (pintar: Pintar): Aba => PINTAR.find((p) => p.chave === pintar)!.aba;

/** O recorte da camada Dinheiro do mapa: ano, cargo, porte da cidade (só nas municipais), o que pinta o mapa e a medida da pergunta 2 × 8. */
export interface EscolhaMapaDinheiro { ano: number; cargo: string; porte?: Porte; pintar: Pintar; medir: "recursos" | "publico" }

/**
 * Camada Dinheiro do mapa da página inicial: o ano (padrão: o último), um cargo que exista nele, o porte (só nas
 * eleições municipais, e só um dos que existem) e a medida de "quem teve mais dinheiro se elegeu mais?": todo o
 * dinheiro (padrão, pergunta 2) ou só o público (?medir=publico, pergunta 8).
 */
export function escolhaMapaDinheiro(sp: SP): EscolhaMapaDinheiro {
  const pedido = Number(um(sp.ano));
  const ano = ANOS_DINHEIRO.includes(pedido) ? pedido : ANOS_DINHEIRO[ANOS_DINHEIRO.length - 1];
  const cargos = cargosDoAno(ano);
  const porte = ehMunicipal(ano) ? PORTES.find((p) => p.chave === um(sp.porte))?.chave : undefined;
  const pintar = PINTAR.find((p) => p.chave === um(sp.pintar))?.chave ?? "vaga";
  return { ano, cargo: cargos.find((c) => c === um(sp.cargo)) ?? cargos[0], porte, pintar, medir: um(sp.medir) === "publico" ? "publico" : "recursos" };
}

/**
 * Endereço da camada Dinheiro no mapa da página inicial, com o recorte atual e as mudanças (null apaga). Trocar o
 * estado solta a cidade; trocar o ano solta o cargo que não existe nele (volta ao primeiro do ano) e, nas eleições
 * gerais, a cidade e o porte. A cidade vai pelo código do IBGE (o id_municipio muda a cada carga do banco). `ancora`
 * troca o "#mapa" do fim (ex.: "comparar", para não subir ao mapa).
 */
export function hrefMapaDinheiro(
  atual: { ano: number; cargo: string; uf?: string; mun?: string | number; porte?: string; pintar?: string; medir?: string; ord?: string },
  novo: Partial<Record<"ano" | "cargo" | "uf" | "mun" | "porte" | "pintar" | "medir" | "ord", string | number | null>> = {},
  ancora = "mapa",
): string {
  const n = { ...atual, ...("uf" in novo ? { mun: undefined } : {}), ...novo };
  const ano = Number(n.ano);
  const p = new URLSearchParams({ ver: "dinheiro" });
  if (ano !== ANOS_DINHEIRO[ANOS_DINHEIRO.length - 1]) p.set("ano", String(ano));
  const cargos = cargosDoAno(ano);
  if (n.cargo && cargos.includes(String(n.cargo)) && n.cargo !== cargos[0]) p.set("cargo", String(n.cargo));
  if (n.uf) p.set("uf", String(n.uf));
  if (n.uf && n.mun && ehMunicipal(ano)) p.set("mun", String(n.mun));
  if (n.porte && ehMunicipal(ano)) p.set("porte", String(n.porte));
  if (n.pintar && n.pintar !== "vaga" && PINTAR.some((x) => x.chave === n.pintar)) p.set("pintar", String(n.pintar));
  if (n.medir === "publico") p.set("medir", "publico");
  if (n.ord && n.ord !== "votos" && ORDENS_CANDIDATOS.some((o) => o.chave === n.ord)) p.set("ord", String(n.ord));
  return `/?${p}#${ancora}`;
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
  if (aba === "eleitor") {
    const gasto = prefeito ? (r.prefeito_candidatos > 0 ? r.prefeito_gasto : null) : r.vereador_candidatos > 0 ? r.vereador_gasto : null;
    return gasto !== null && r.eleitorado ? gasto / r.eleitorado : null;
  }
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
  // por eleitor apto: cortes redondos perto dos quartos da distribuição das cidades (2020 e 2024)
  if (aba === "eleitor") return cargo === "Prefeito" ? [10, 20, 30, 40] : [3, 6, 10, 15];
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
  if (aba === "eleitor") {
    return [
      { classe: "q0", texto: `até R$ ${f[0]}` },
      ...f.slice(1).map((v, i) => ({ classe: `q${i + 1}`, texto: `R$ ${f[i]}–${v}` })),
      { classe: `q${f.length}`, texto: `R$ ${f[f.length - 1]} ou mais` },
      sem,
    ];
  }
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
  if (aba === "eleitor") return brlCentavos(v);
  if (aba === "resultado" && cargo === "Prefeito") return v === 1 ? "Venceu" : "Perdeu";
  return `${Math.round(v * 100)}%`;
}

/** A unidade do valor de uma cidade, para ficar ao lado do número. */
export function unidade(aba: Aba, cargo: string): string {
  if (aba === "gasto") return `por vaga de ${cargo.toLowerCase()}`;
  if (aba === "eleitor") return `por eleitor apto, gastos pelas campanhas a ${cargo.toLowerCase()}`;
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
export function valorDoEstado(estados: { ano: number; uf: string; cargo: string; vagas: number; gasto: number; receita: number; receita_publica: number; disputas_maior: number | null; maior_venceu: number | null; eleitorado?: number | null }[],
  ano: number, uf: string | undefined, aba: Aba, cargo: string): number | null {
  const sel = estados.filter((e) => e.ano === ano && e.cargo === cargo && e.uf !== "BR" && (!uf || e.uf === uf));
  if (!sel.length) return null;
  const soma = (k: "vagas" | "gasto" | "receita" | "receita_publica" | "disputas_maior" | "maior_venceu" | "eleitorado") => sel.reduce((a, e) => a + (e[k] ?? 0), 0);
  if (aba === "gasto") return soma("vagas") > 0 ? soma("gasto") / soma("vagas") : null;
  if (aba === "eleitor") return soma("eleitorado") > 0 ? soma("gasto") / soma("eleitorado") : null;
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
export function legendaPorFaixas(faixas: number[], fmt: (v: number) => string, classes?: string[]): { classe: string; texto: string }[] {
  if (!faixas.length) return [{ classe: "sem", texto: "Não informado" }];
  const cl = (i: number) => classes?.[i] ?? `q${i}`;
  return [
    { classe: cl(0), texto: `até ${fmt(faixas[0])}` },
    ...faixas.slice(1).map((v, i) => ({ classe: cl(i + 1), texto: `${fmt(faixas[i])}–${fmt(v)}` })),
    { classe: cl(faixas.length), texto: `${fmt(faixas[faixas.length - 1])} ou mais` },
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
  if (aba === "eleitor") {
    const comDado = sel.filter((r) => (prefeito ? r.prefeito_candidatos > 0 : r.vereador_candidatos > 0) && r.eleitorado);
    const gasto = comDado.reduce((a, r) => a + (prefeito ? r.prefeito_gasto : r.vereador_gasto), 0);
    const eleitores = comDado.reduce((a, r) => a + (r.eleitorado ?? 0), 0);
    return { valor: eleitores > 0 ? gasto / eleitores : null, n: comDado.length, conta: null };
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

/** Média de dinheiro por candidato de um grupo: público (Fundo Eleitoral + Fundo Partidário) e privado (o resto). */
export interface MediaDinheiro { candidaturas: number; publico: number; privado: number }

/**
 * A média de dinheiro público e privado recebido por candidato, separando eleitos e não eleitos, num estado (ou nos
 * seis), para um cargo e ano. Das somas da análise q8 (sem repasses entre candidatos: o mesmo real não conta duas
 * vezes). A média divide por todos os candidatos do grupo, inclusive os que não receberam nada.
 */
export function mediasPorResultado(fontes: { ano: number; cargo: string; uf: string; eleito: boolean; candidaturas: number; fundo_eleitoral: number; fundo_partidario: number; doacoes_pessoas: number; recursos_proprios: number; outros_privados: number }[],
  ano: number, cargo: string, uf?: string): { eleitos: MediaDinheiro; naoEleitos: MediaDinheiro } {
  const grupo = (eleito: boolean): MediaDinheiro => {
    const sel = fontes.filter((l) => l.ano === ano && l.cargo === cargo && l.eleito === eleito && (!uf || l.uf === uf));
    const cand = sel.reduce((a, l) => a + l.candidaturas, 0);
    const pub = sel.reduce((a, l) => a + l.fundo_eleitoral + l.fundo_partidario, 0);
    const priv = sel.reduce((a, l) => a + l.doacoes_pessoas + l.recursos_proprios + l.outros_privados, 0);
    return { candidaturas: cand, publico: cand ? pub / cand : 0, privado: cand ? priv / cand : 0 };
  };
  return { eleitos: grupo(true), naoEleitos: grupo(false) };
}

/**
 * A média de dinheiro público e privado recebido por candidato (eleitos e não eleitos juntos) de um estado, para a
 * comparação entre os estados. Mesma base de mediasPorResultado.
 */
export function mediaPorCandidato(fontes: Parameters<typeof mediasPorResultado>[0], ano: number, cargo: string, uf?: string): MediaDinheiro {
  const { eleitos: e, naoEleitos: n } = mediasPorResultado(fontes, ano, cargo, uf);
  const cand = e.candidaturas + n.candidaturas;
  return {
    candidaturas: cand,
    publico: cand ? (e.publico * e.candidaturas + n.publico * n.candidaturas) / cand : 0,
    privado: cand ? (e.privado * e.candidaturas + n.privado * n.candidaturas) / cand : 0,
  };
}

// ---------- a leitura do número: cobertura, referência, eleição anterior ----------

/** Candidaturas do cargo no lugar e quantas têm prestação de contas final na base (as outras entram com zero nas somas). */
export interface Contas { total: number; com: number }
export function contasDaCidade(r: LinhaResumo | undefined, cargo: string): Contas | null {
  if (!r) return null;
  const [total, sem] = cargo === "Prefeito" ? [r.prefeito_candidatos, r.prefeito_sem_prestacao] : [r.vereador_candidatos, r.vereador_sem_prestacao];
  return total > 0 ? { total, com: total - (sem ?? 0) } : null;
}
export function contasDoEstado(estados: { ano: number; uf: string; cargo: string; candidatos: number; sem_prestacao: number }[], ano: number, uf: string | undefined, cargo: string): Contas | null {
  const sel = estados.filter((e) => e.ano === ano && e.cargo === cargo && e.uf !== "BR" && (!uf || e.uf === uf));
  const total = sel.reduce((a, e) => a + e.candidatos, 0), sem = sel.reduce((a, e) => a + (e.sem_prestacao ?? 0), 0);
  return total > 0 ? { total, com: total - sem } : null;
}
/** Com um porte escolhido: as candidaturas das cidades daquele porte. */
export function contasDoPorte(resumo: LinhaResumo[], ano: number, uf: string | undefined, porte: Porte, cargo: string): Contas | null {
  const sel = resumo.filter((r) => r.ano === ano && (!uf || r.uf === uf) && porteDe(r.eleitorado)?.chave === porte);
  const partes = sel.flatMap((r) => contasDaCidade(r, cargo) ?? []);
  const total = partes.reduce((a, c) => a + c.total, 0), com = partes.reduce((a, c) => a + c.com, 0);
  return total > 0 ? { total, com } : null;
}

/**
 * A cobertura escrita, para ficar junto do número: quantas candidaturas têm prestação final na base. "Na base" é o
 * que dá para afirmar: não quer dizer contas aprovadas. Sem prestação, o gasto é desconhecido e a soma pode estar menor.
 */
export function fraseCobertura(c: Contas | null): string | null {
  if (!c) return null;
  const inteiro = (n: number) => n.toLocaleString("pt-BR");
  if (c.com >= c.total) return `Prestação de contas final na base para todas as ${inteiro(c.total)} candidaturas.`;
  const sem = c.total - c.com;
  return `Prestação de contas final na base para ${inteiro(c.com)} de ${inteiro(c.total)} candidaturas (${inteiro(sem)} sem: o total pode estar incompleto).`;
}

/** Diferença relativa de um valor para a referência (null sem referência ou referência zero): 0,35 = 35% acima. */
export function diferencaRelativa(valor: number | null, referencia: number | null): number | null {
  if (valor === null || referencia === null || referencia === 0) return null;
  return valor / referencia - 1;
}

/** "35% acima", "12% abaixo" ou "igual" (até 0,5% de diferença). */
export function textoDiferenca(d: number): string {
  const p = Math.round(Math.abs(d) * 100);
  return p === 0 ? "igual à referência" : `${p}% ${d > 0 ? "acima" : "abaixo"}`;
}

/** A eleição anterior do mesmo tipo (vereador 2020 × 2024; deputado 2018 × 2022), se houver dinheiro dela na base. */
export const anoAnterior = (ano: number): number | null => (ANOS_DINHEIRO.includes(ano - 4) ? ano - 4 : null);

/** Variação nominal (sem inflação) de um valor para o da eleição anterior, para a frase "em 2020: R$ X (+12%)". */
export function variacaoNominal(atual: number | null, anterior: number | null): number | null {
  return diferencaRelativa(atual, anterior);
}

/** O que a pergunta 1 soma a mais: gasto de campanhas ao cargo que não chegaram a disputar (null quando não há). */
export function foraDaDisputa(estados: { ano: number; uf: string; cargo: string; nao_disputou_com_gasto?: number | null; gasto_nao_disputou?: number | null }[], ano: number, uf: string | undefined, cargo: string): { n: number; gasto: number } | null {
  const sel = estados.filter((e) => e.ano === ano && e.cargo === cargo && e.uf !== "BR" && (!uf || e.uf === uf));
  const n = sel.reduce((a, e) => a + (e.nao_disputou_com_gasto ?? 0), 0), gasto = sel.reduce((a, e) => a + (e.gasto_nao_disputou ?? 0), 0);
  return n > 0 && gasto > 0 ? { n, gasto } : null;
}

// ---------- as cores dos estados ----------

/** Com só seis estados, três faixas (terços) dizem mais que cinco: as classes de cor das pontas e do meio. */
export const TERCOS = ["q0", "q2", "q4"];
/** Classe de cor de um estado pelas faixas dos terços (os cortes de `quantis(valores, 3)`). */
export const corTerco = (v: number | null, faixas: number[]) => (v === null ? "sem" : TERCOS[Math.min(2, faixas.filter((c) => v >= c).length)]);
/** O valor escrito na legenda e no selo do estado, para a medida que pinta o mapa. */
export function textoCurto(v: number, aba: Aba): string {
  if (aba === "eleitor") return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })}`;
  if (aba === "publico") return `${Math.round(v * 100)}%`;
  return `R$ ${compacto(v)}`;
}

// ---------- os candidatos ----------

export const ORDENS_CANDIDATOS = [
  { chave: "votos", rotulo: "Mais votados" },
  { chave: "gasto", rotulo: "Que mais gastaram" },
  { chave: "recebido", rotulo: "Que mais receberam" },
  { chave: "publico", rotulo: "Mais dinheiro público" },
] as const;
export type OrdemCandidatos = (typeof ORDENS_CANDIDATOS)[number]["chave"];
export const ordemCandidatos = (v: string | undefined): OrdemCandidatos => ORDENS_CANDIDATOS.find((o) => o.chave === v)?.chave ?? "votos";

/**
 * Ordena os candidatos de uma lista pela medida escolhida, do maior para o menor; quem não tem prestação de contas
 * final vai para o fim nas ordens de dinheiro (valor desconhecido, não zero). Empate: mais votos, depois o nome.
 */
export function ordenarCandidatos<T extends { votos: number; gasto: number; receita: number; receita_publica: number; prestou?: boolean | null; nome_urna?: string | null }>(linhas: T[], por: OrdemCandidatos): T[] {
  const chave = { votos: "votos", gasto: "gasto", recebido: "receita", publico: "receita_publica" }[por] as "votos" | "gasto" | "receita" | "receita_publica";
  const semDado = (c: T) => (por !== "votos" && c.prestou === false ? 1 : 0);
  return [...linhas].sort((a, b) => semDado(a) - semDado(b) || b[chave] - a[chave] || b.votos - a.votos || (a.nome_urna ?? "").localeCompare(b.nome_urna ?? "", "pt-BR"));
}

// ---------- onde o dinheiro foi gasto ----------

/** Uma linha da análise dinheiro (tabela despesas): o gasto de um grupo de categorias do TSE num lugar. */
export interface LinhaDespesa { ano: number; cargo: string; uf: string; id_municipio: number | null; grupo: string; valor: number; despesas: number }

/** Os grupos de categoria do TSE, na ordem da legenda, com o nome para o leitor. */
export const GRUPOS_DESPESA: { chave: string; rotulo: string; detalhe: string }[] = [
  { chave: "propaganda_fisica", rotulo: "Propaganda impressa e de rua", detalhe: "materiais impressos, adesivos, carros de som, jornais" },
  { chave: "propaganda_digital", rotulo: "Propaganda na internet", detalhe: "impulsionamento e páginas na internet" },
  { chave: "propaganda_audiovisual", rotulo: "Rádio, TV e jingles", detalhe: "programas de rádio e TV, vídeos, jingles" },
  { chave: "mobilizacao", rotulo: "Militância, comícios e eventos", detalhe: "mobilização de rua, comícios, eventos" },
  { chave: "pessoal", rotulo: "Pessoal", detalhe: "salários e encargos" },
  { chave: "terceiros", rotulo: "Serviços de terceiros", detalhe: "serviços prestados por terceiros" },
  { chave: "profissionais", rotulo: "Advogados, contadores e pesquisas", detalhe: "serviços advocatícios e contábeis, pesquisas" },
  { chave: "transporte", rotulo: "Transporte e combustível", detalhe: "veículos, combustível, passagens" },
  { chave: "estrutura", rotulo: "Comitê e estrutura", detalhe: "aluguel, energia, telefone, materiais, alimentação" },
  { chave: "outros", rotulo: "Outros", detalhe: "taxas, multas, doações de bens e o que não se encaixa" },
  { chave: "sem_categoria", rotulo: "Sem categoria", detalhe: "despesas sem categoria do TSE na base" },
];

/** As cidades de um porte num ano (e estado), para levar o filtro de porte a quem só tem o município (ex.: despesas). */
export function cidadesDoPorte(resumo: LinhaResumo[], ano: number, uf: string | undefined, porte: Porte): Set<number> {
  return new Set(resumo.filter((r) => r.ano === ano && (!uf || r.uf === uf) && porteDe(r.eleitorado)?.chave === porte).map((r) => r.id_municipio));
}

/** foraDaDisputa só com as cidades de um porte (prefeito e vereador), para o aviso seguir o mesmo recorte. */
export function foraDaDisputaPorte(resumo: LinhaResumo[], ano: number, uf: string | undefined, porte: Porte, cargo: string): { n: number; gasto: number } | null {
  const sel = resumo.filter((r) => r.ano === ano && (!uf || r.uf === uf) && porteDe(r.eleitorado)?.chave === porte);
  const prefeito = cargo === "Prefeito";
  const n = sel.reduce((a, r) => a + ((prefeito ? r.prefeito_nao_disputou_n : r.vereador_nao_disputou_n) ?? 0), 0);
  const gasto = sel.reduce((a, r) => a + ((prefeito ? r.prefeito_nao_disputou_gasto : r.vereador_nao_disputou_gasto) ?? 0), 0);
  return n > 0 && gasto > 0 ? { n, gasto } : null;
}

/**
 * A composição das despesas de um recorte (eleição, cargo, estado ou os seis, cidade), em grupos do maior para o menor,
 * com a parte de cada um no total. Nas gerais as linhas são por estado (id_municipio nulo); nas municipais, por cidade,
 * e o estado é a soma delas. Vazio sem despesas.
 */
export function composicaoDespesas(linhas: LinhaDespesa[], f: { ano: number; cargo: string; uf?: string; mun?: number; muns?: Set<number> }): { grupo: string; rotulo: string; detalhe: string; valor: number; despesas: number; parte: number }[] {
  // muns: só as cidades do recorte (ex.: as de um porte), para as despesas valerem para o mesmo universo das receitas
  const sel = linhas.filter((l) => l.ano === f.ano && l.cargo === f.cargo && (!f.uf || l.uf === f.uf) && (f.mun === undefined || l.id_municipio === f.mun)
    && (!f.muns || (l.id_municipio !== null && f.muns.has(l.id_municipio))));
  const total = sel.reduce((a, l) => a + l.valor, 0);
  if (total <= 0) return [];
  return GRUPOS_DESPESA.map((g) => {
    const do_ = sel.filter((l) => l.grupo === g.chave);
    const valor = do_.reduce((a, l) => a + l.valor, 0);
    return { grupo: g.chave, rotulo: g.rotulo, detalhe: g.detalhe, valor, despesas: do_.reduce((a, l) => a + l.despesas, 0), parte: valor / total };
  }).filter((g) => g.valor > 0).sort((a, b) => b.valor - a.valor);
}

/** A cobertura em poucas palavras, para a linha de aviso do painel. */
export function coberturaCurta(c: Contas | null): { texto: string; incompleta: boolean } | null {
  if (!c) return null;
  const n = (v: number) => v.toLocaleString("pt-BR");
  if (c.com >= c.total) return { texto: `Contas na base: todas as ${n(c.total)} candidaturas.`, incompleta: false };
  return { texto: `Contas na base: ${n(c.com)} de ${n(c.total)} candidaturas; ${n(c.total - c.com)} sem prestação final, então o total pode estar incompleto.`, incompleta: true };
}

/**
 * De onde veio o dinheiro recebido pelas campanhas ao cargo no lugar: público (fundos Eleitoral e Partidário) e
 * privado (o resto), somados. Cidade: a linha dela; estado ou os seis: a tabela estados (com um porte, as cidades
 * dele). null sem receita.
 */
export function origemDoDinheiro(
  dados: { resumo: LinhaResumo[]; estados: { ano: number; uf: string; cargo: string; receita: number; receita_publica: number; receita_privada?: number | null }[] },
  f: { ano: number; cargo: string; uf?: string; mun?: LinhaResumo; porte?: Porte },
): { publico: number; privado: number; naoClassificado: number; total: number } | { publico: number; naoPublico: number; total: number } | null {
  const prefeito = f.cargo === "Prefeito";
  const daCidade = (r: LinhaResumo) => (prefeito
    ? [r.prefeito_receita, r.prefeito_publica, r.prefeito_privada]
    : [r.vereador_receita, r.vereador_publica, r.vereador_privada]);
  let receita = 0, publica = 0, privada = 0, semColuna = false;
  const somar = ([rec, pub, priv]: (number | null | undefined)[]) => {
    receita += rec ?? 0; publica += pub ?? 0; privada += priv ?? 0;
    if (priv === undefined) semColuna = true;
  };
  if (f.mun) somar(daCidade(f.mun));
  else if (f.porte) dados.resumo.filter((r) => r.ano === f.ano && (!f.uf || r.uf === f.uf) && porteDe(r.eleitorado)?.chave === f.porte).forEach((r) => somar(daCidade(r)));
  else dados.estados.filter((e) => e.ano === f.ano && e.cargo === f.cargo && e.uf !== "BR" && (!f.uf || e.uf === f.uf)).forEach((e) => somar([e.receita, e.receita_publica, e.receita_privada]));
  if (receita <= 0) return null;
  const publico = Math.min(receita, publica);
  // resposta da API sem a coluna do privado (versão anterior, ou cache do Next de até 1 h depois de atualizar a API):
  // não dá para separar privado de sem fonte, então só "não público", sem afirmar nenhum dos dois
  if (semColuna) return { publico, naoPublico: receita - publico, total: receita };
  // privado = só o que a fonte marca como privado; o que sobra fica como "origem não classificada", nunca vira privado
  const privado = Math.min(receita - publico, privada);
  const resto = receita - publico - privado;   // resíduos de arredondamento (menos de 1 centavo) não viram categoria
  return { publico, privado, naoClassificado: resto < 0.01 ? 0 : resto, total: receita };
}

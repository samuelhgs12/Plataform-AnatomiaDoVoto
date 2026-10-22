// Pergunta 9: onde o candidato investe em propaganda. Lê web/public/data/q9/ (pipeline/sql/q9.sql + export_static.py):
// indice.json (os recortes) e um arquivo por eleição e UF (<ano>-<UF>.json; presidente em <ano>-BR.json).
// Valores em centavos inteiros: somas e percentuais exatos. Valor = valor CONTRATADO, não o pago.

import type { TabelaEstatica } from "./types";
import { comoObjetos } from "./data";
import { normalizarBusca } from "./busca";
import { deCada100, ORDEM_CARGOS } from "./financiamento";

export interface LinhaRecorte {
  ano: number; uf: string; arquivo: string; candidaturas: number; com_despesas: number; com_propaganda: number;
  total_centavos: number; propaganda_centavos: number;
}
export interface Indice { origem: "banco" | "sintetico"; recortes: LinhaRecorte[] }

export interface LinhaCandidatura {
  id_candidatura: number; sequencial: string; cargo: string; cod_municipio: string | null; nome_urna: string | null;
  numero_urna: string | null; partido: string | null; lancamentos: number; total_centavos: number; propaganda_centavos: number;
}
export interface Candidatura extends LinhaCandidatura { municipio: string | null }
export interface LinhaCategoria { sequencial: string; origem: number; lancamentos: number; centavos: number }
export interface Categoria { origem: string; grupo: string; lancamentos: number; centavos: number }
export interface Recorte { candidaturas: Candidatura[]; categorias: Map<string, Categoria[]> }

/** Os três grupos de propaganda da classificação do projeto (categoria_despesa.grupo_classificacao). */
export const GRUPOS: Record<string, { rotulo: string; descricao: string; classe: string }> = {
  propaganda_fisica: { rotulo: "Propaganda física", descricao: "impressos, adesivos, jornais e carros de som", classe: "pp-fis" },
  propaganda_audiovisual: { rotulo: "Propaganda audiovisual", descricao: "rádio, TV, vídeo e jingles", classe: "pp-av" },
  propaganda_digital: { rotulo: "Propaganda digital", descricao: "impulsionamento e páginas na internet", classe: "pp-dig" },
};
const GRUPO_DESCONHECIDO = { rotulo: "Outra propaganda", descricao: "categoria sem grupo conhecido", classe: "pp-outra" };
export const grupo = (g: string) => GRUPOS[g] ?? { ...GRUPO_DESCONHECIDO, rotulo: g };

/** Nome curto de cada categoria original do TSE (DS_ORIGEM_DESPESA). Categoria nova: aparece com o nome original. */
const ROTULO_ORIGEM: Record<string, string> = {
  "Publicidade por materiais impressos": "Materiais impressos",
  "Publicidade por adesivos": "Adesivos",
  "Publicidade por carros de som": "Carros de som",
  "Publicidade por jornais e revistas": "Jornais e revistas",
  "Produção de programas de rádio, televisão ou vídeo": "Programas de rádio, TV ou vídeo",
  "Produção de jingles, vinhetas e slogans": "Jingles, vinhetas e slogans",
  "Despesa com Impulsionamento de Conteúdos": "Impulsionamento de conteúdo",
  "Criação e inclusão de páginas na internet": "Páginas na internet",
};
export const rotuloOrigem = (origem: string) => ROTULO_ORIGEM[origem] ?? origem;

export function lerIndice(dados: Record<string, TabelaEstatica> | null): Indice | null {
  if (!dados?.recortes || !dados.meta) return null;
  const meta = comoObjetos<{ origem: string }>(dados.meta)[0];
  return { origem: meta?.origem === "banco" ? "banco" : "sintetico", recortes: comoObjetos<LinhaRecorte>(dados.recortes) };
}

/** Anos com dados, do mais antigo ao mais recente. */
export const anosDoIndice = (ind: Indice) => [...new Set(ind.recortes.map((r) => r.ano))].sort((a, b) => a - b);

/** Recortes de um ano: UFs em ordem alfabética e o recorte nacional (presidente) por último. */
export function recortesDoAno(ind: Indice, ano: number): LinhaRecorte[] {
  return ind.recortes.filter((r) => r.ano === ano).sort((a, b) => (a.uf === "BR" ? 1 : 0) - (b.uf === "BR" ? 1 : 0) || a.uf.localeCompare(b.uf));
}

/** Decodifica o arquivo de um recorte: nome do município e categoria original (com o grupo) a partir das tabelas de consulta. */
export function lerRecorte(dados: Record<string, TabelaEstatica> | null): Recorte | null {
  if (!dados?.candidaturas || !dados.categorias || !dados.origens) return null;
  const municipios = new Map(comoObjetos<{ cod_municipio: string; municipio: string | null }>(dados.municipios).map((m) => [m.cod_municipio, m.municipio]));
  const origens = comoObjetos<{ origem: string; grupo: string }>(dados.origens);
  const candidaturas = comoObjetos<LinhaCandidatura>(dados.candidaturas).map((c) => ({
    ...c, sequencial: String(c.sequencial), municipio: c.cod_municipio ? municipios.get(c.cod_municipio) ?? null : null,
  }));
  const categorias = new Map<string, Categoria[]>();
  for (const k of comoObjetos<LinhaCategoria>(dados.categorias)) {
    const o = origens[k.origem];
    if (!o) continue;
    const lista = categorias.get(String(k.sequencial)) ?? [];
    lista.push({ origem: o.origem, grupo: o.grupo, lancamentos: k.lancamentos, centavos: k.centavos });
    categorias.set(String(k.sequencial), lista);
  }
  return { candidaturas, categorias };
}

/** Cargos do recorte, na ordem do site (presidente → vereador). */
export const cargosDoRecorte = (r: Recorte) => {
  const pos = (c: string) => ORDEM_CARGOS.indexOf(c) + 1 || 99;
  return [...new Set(r.candidaturas.map((c) => c.cargo))].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b));
};

/** Municípios do recorte que têm candidaturas ao cargo (vazio em eleição geral), em ordem alfabética. */
export function municipiosDoCargo(r: Recorte, cargo: string): [string, string][] {
  const m = new Map<string, string>();
  for (const c of r.candidaturas) if (c.cargo === cargo && c.cod_municipio) m.set(c.cod_municipio, c.municipio ?? c.cod_municipio);
  return [...m].sort((a, b) => a[1].localeCompare(b[1], "pt-BR") || a[0].localeCompare(b[0]));
}

/** Candidaturas de um cargo (e município, se houver), pelo nome de urna; o sequencial desempata. */
export function candidaturasDe(r: Recorte, cargo: string, municipio?: string): Candidatura[] {
  return r.candidaturas
    .filter((c) => c.cargo === cargo && (!municipio || c.cod_municipio === municipio))
    .sort((a, b) => (a.nome_urna ?? "").localeCompare(b.nome_urna ?? "", "pt-BR") || a.sequencial.localeCompare(b.sequencial));
}

/**
 * Problemas de integridade de um recorte (lista vazia = íntegro): sequencial repetido, categoria sem candidatura,
 * categorias que não somam a propaganda da candidatura, propaganda maior que o total. A página não mostra um recorte com problema.
 */
export function conferirRecorte(r: Recorte): string[] {
  const problemas: string[] = [];
  const porSq = new Map<string, Candidatura>();
  for (const c of r.candidaturas) {
    if (porSq.has(c.sequencial)) problemas.push(`candidatura repetida: ${c.sequencial}`);
    porSq.set(c.sequencial, c);
    if (c.propaganda_centavos > c.total_centavos) problemas.push(`propaganda maior que o total: ${c.sequencial}`);
  }
  for (const [sq, ks] of r.categorias) {
    const c = porSq.get(sq);
    if (!c) { problemas.push(`categorias sem candidatura: ${sq}`); continue; }
    const soma = ks.reduce((a, k) => a + k.centavos, 0);
    if (soma !== c.propaganda_centavos) problemas.push(`categorias de ${sq} somam ${soma}, propaganda ${c.propaganda_centavos}`);
  }
  for (const c of r.candidaturas) if (c.propaganda_centavos > 0 && !r.categorias.has(c.sequencial)) problemas.push(`propaganda sem categorias: ${c.sequencial}`);
  return problemas;
}

// ── Busca pelo nome (dentro de um recorte: eleição + UF) ─────────────────────────────────────────────────────────

/** Mínimo de letras para buscar (o mesmo da busca de candidatos da plataforma). */
export const MINIMO_BUSCA = 3;
/** Quantas sugestões mostrar. */
export const LIMITE_BUSCA = 20;

/** Candidatura com o nome de urna já normalizado (sem acento, minúsculo, palavras separadas por um espaço). */
export interface EntradaBusca { c: Candidatura; nome: string; palavras: string[] }
export const prepararBusca = (cands: Candidatura[]): EntradaBusca[] =>
  cands.map((c) => { const nome = normalizarBusca(c.nome_urna ?? ""); return { c, nome, palavras: nome ? nome.split(" ") : [] }; });

/**
 * Candidaturas cujo nome de urna casa com o texto: cada palavra digitada precisa casar com o início de uma palavra do
 * nome (mesma regra da busca de candidatos da API; ignora acentos, maiúsculas e pontuação: "joao" acha "JOÃO", "dr sil"
 * acha "DR. SILVA"). Ordem: nome igual ao digitado, palavras inteiras, início de palavra; depois nome, município e o
 * sequencial (ordem estável). `cargo` restringe ao cargo escolhido; o município não é exigido.
 */
export function buscarCandidaturas(indice: EntradaBusca[], texto: string, cargo?: string, limite = LIMITE_BUSCA): { itens: Candidatura[]; total: number } {
  const alvo = normalizarBusca(texto);
  if (alvo.replace(/ /g, "").length < MINIMO_BUSCA) return { itens: [], total: 0 };
  const termos = alvo.split(" ");
  const achados: { c: Candidatura; nivel: number }[] = [];
  for (const e of indice) {
    if (cargo && e.c.cargo !== cargo) continue;
    if (!termos.every((t) => e.palavras.some((p) => p.startsWith(t)))) continue;
    const nivel = e.nome === alvo ? 0 : termos.every((t) => e.palavras.includes(t)) ? 1 : 2;
    achados.push({ c: e.c, nivel });
  }
  achados.sort((a, b) => a.nivel - b.nivel || (a.c.nome_urna ?? "").localeCompare(b.c.nome_urna ?? "", "pt-BR")
    || (a.c.municipio ?? "").localeCompare(b.c.municipio ?? "", "pt-BR") || a.c.sequencial.localeCompare(b.c.sequencial));
  return { itens: achados.slice(0, limite).map((a) => a.c), total: achados.length };
}

/** "FULANA DE TAL · PT 13" (o que aparece na lista de escolha). */
export const rotuloCandidatura = (c: Candidatura) =>
  [c.nome_urna ?? "Nome não informado", [c.partido, c.numero_urna].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

export interface CategoriaAnalisada extends Categoria {
  rotulo: string;
  /** Parte da propaganda (0 a 1, exata). */ parteDaPropaganda: number;
  /** Parte das despesas consideradas (0 a 1, exata). */ parteDoTotal: number;
  /** "R$ n de cada R$ 100" de propaganda (maior resto: as categorias somam exatamente 100). */ de100: number;
}
export interface GrupoAnalisado { grupo: string; centavos: number; lancamentos: number; de100: number; categorias: CategoriaAnalisada[] }
export type Analise =
  | { estado: "sem_dados" }
  | { estado: "sem_propaganda"; totalCentavos: number; lancamentos: number }
  | {
      estado: "com_propaganda"; totalCentavos: number; propagandaCentavos: number; lancamentos: number;
      /** Propaganda ÷ despesas consideradas (todas as categorias, sem transferências). */ parteDoTotal: number;
      categorias: CategoriaAnalisada[]; grupos: GrupoAnalisado[];
      /** A(s) categoria(s) de maior valor: mais de uma = empate exato. */ predominantes: CategoriaAnalisada[];
    };

/**
 * A resposta para uma candidatura. "sem_dados": nenhuma despesa considerada na prestação de contas (não é gasto zero:
 * a prestação pode faltar, ser só parcial ou vir sem movimentação). "sem_propaganda": há despesas, nenhuma de propaganda.
 * Categorias ordenadas do maior para o menor valor (o nome desempata, para a ordem não depender do arquivo).
 */
export function analisar(c: Candidatura, categorias: Categoria[]): Analise {
  if (c.lancamentos <= 0) return { estado: "sem_dados" };
  const prop = categorias.filter((k) => k.centavos > 0);
  const propagandaCentavos = prop.reduce((a, k) => a + k.centavos, 0);
  if (propagandaCentavos <= 0) return { estado: "sem_propaganda", totalCentavos: c.total_centavos, lancamentos: c.lancamentos };
  const ordenadas = [...prop].sort((a, b) => b.centavos - a.centavos || rotuloOrigem(a.origem).localeCompare(rotuloOrigem(b.origem), "pt-BR"));
  const de100 = deCada100(ordenadas.map((k) => k.centavos));
  const analisadas: CategoriaAnalisada[] = ordenadas.map((k, i) => ({
    ...k, rotulo: rotuloOrigem(k.origem), de100: de100[i],
    parteDaPropaganda: k.centavos / propagandaCentavos, parteDoTotal: c.total_centavos > 0 ? k.centavos / c.total_centavos : 0,
  }));
  const porGrupo = new Map<string, CategoriaAnalisada[]>();
  for (const k of analisadas) porGrupo.set(k.grupo, [...(porGrupo.get(k.grupo) ?? []), k]);
  const grupos = [...porGrupo].map(([g, ks]) => ({ grupo: g, categorias: ks, centavos: ks.reduce((a, k) => a + k.centavos, 0), lancamentos: ks.reduce((a, k) => a + k.lancamentos, 0) }))
    .sort((a, b) => b.centavos - a.centavos || a.grupo.localeCompare(b.grupo));
  const g100 = deCada100(grupos.map((g) => g.centavos));
  return {
    estado: "com_propaganda", totalCentavos: c.total_centavos, propagandaCentavos, lancamentos: c.lancamentos,
    parteDoTotal: c.total_centavos > 0 ? propagandaCentavos / c.total_centavos : 0,
    categorias: analisadas, grupos: grupos.map((g, i) => ({ ...g, de100: g100[i] })),
    predominantes: analisadas.filter((k) => k.centavos === analisadas[0].centavos),
  };
}

export interface TipoComposto { grupo: string; centavos: number; lancamentos: number; categorias: number; de100: number; parte: number }

/**
 * Composição da propaganda pelos três tipos (física, audiovisual, digital), sempre nessa ordem e com os três presentes
 * (um tipo sem despesa aparece com zero: a composição fica completa); um grupo fora dos três, se a classificação mudar,
 * vem depois. `parte` é a fração exata da propaganda; `de100` soma exatamente 100 entre os tipos com valor.
 */
export function composicaoPorTipo(a: Extract<Analise, { estado: "com_propaganda" }>): TipoComposto[] {
  const porGrupo = new Map(a.grupos.map((g) => [g.grupo, g]));
  const ordem = [...Object.keys(GRUPOS), ...a.grupos.map((g) => g.grupo).filter((g) => !(g in GRUPOS))];
  return ordem.map((g) => {
    const x = porGrupo.get(g);
    return {
      grupo: g, centavos: x?.centavos ?? 0, lancamentos: x?.lancamentos ?? 0, categorias: x?.categorias.length ?? 0,
      de100: x?.de100 ?? 0, parte: x ? x.centavos / a.propagandaCentavos : 0,
    };
  });
}

/** "Materiais impressos"; empate:"Adesivos e carros de som", "Adesivos, carros de som e jingles" (maiúscula só na 1ª). */
export function nomearPredominantes(ks: { rotulo: string }[]): string {
  const n = ks.map((k, i) => (i === 0 ? k.rotulo : k.rotulo.charAt(0).toLowerCase() + k.rotulo.slice(1)));
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} e ${n.at(-1)}`;
}

/** Centavos em reais com centavos ("R$ 1.234,56"), para a tabela: o gráfico usa o formato curto de format.ts. */
export const reaisCentavos = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Parte em %, com uma casa; um valor que existe mas arredonda para zero vira "menos de 0,1%". */
export function parteTexto(p: number): string {
  if (p > 0 && p < 0.0005) return "menos de 0,1%";
  return `${(p * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

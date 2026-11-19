// Lógica da página "de onde vem o dinheiro das campanhas" (pergunta 8), sem dependência do React: fácil de testar.
// Os dados vêm de GET /api/analises/q8 (api/app/analises/q8.sql).
import { compararGrupos } from "./estatistica";
import type { CarreiraItem, Receitas } from "./types";
import { fatias, type Fatia } from "./dinheiro";
import { inteiro, reais } from "./format";

export type Fonte = "fundo_eleitoral" | "fundo_partidario" | "doacoes_pessoas" | "recursos_proprios" | "outros_privados";

/**
 * As 5 fontes na ordem de exibição: primeiro as públicas, depois as privadas. As cores (classes f1–f5 em globals.css)
 * são uma ordem da paleta validada para daltonismo nos modos claro e escuro; azul = Fundo Eleitoral, laranja = doações.
 */
export const FONTES: { chave: Fonte; rotulo: string; publico: boolean; classe: string; explicacao: string }[] = [
  { chave: "fundo_eleitoral", rotulo: "Fundo Eleitoral", publico: true, classe: "f1",
    explicacao: "Dinheiro do orçamento federal, pago com impostos, que o TSE divide entre os partidos só para as campanhas. Existe desde 2018." },
  { chave: "fundo_partidario", rotulo: "Fundo Partidário", publico: true, classe: "f2",
    explicacao: "Dinheiro público que os partidos recebem todo ano para se manter. Parte dele vai para as campanhas." },
  { chave: "doacoes_pessoas", rotulo: "Doações de pessoas", publico: false, classe: "f3",
    explicacao: "Doações de eleitores, inclusive por vaquinha na internet. Empresas não podem doar desde 2015." },
  { chave: "recursos_proprios", rotulo: "Dinheiro do próprio candidato", publico: false, classe: "f4",
    explicacao: "O que o candidato tirou do próprio bolso para pagar a campanha." },
  { chave: "outros_privados", rotulo: "Outras fontes privadas", publico: false, classe: "f5",
    explicacao: "Dinheiro privado repassado pelo partido, venda de bens e eventos, rendimentos e origem não identificada." },
];

export interface LinhaFontes {
  ano: number; cargo: string; uf: string; partido: string; eleito: boolean; candidaturas: number; com_receita: number;
  fundo_eleitoral: number; fundo_partidario: number; doacoes_pessoas: number; recursos_proprios: number; outros_privados: number;
}
export type Faixa = "so_publico" | "mais_publico" | "mais_privado" | "so_privado" | "sem_receita";
export interface LinhaFaixa { ano: number; cargo: string; uf: string; eleito: boolean; faixa: Faixa; candidaturas: number }
export interface LinhaMediana {
  ano: number; cargo: string; uf: string | null; eleito: boolean; candidaturas: number;
  mediana_total: number; mediana_publico: number; mediana_pct_publico: number | null;
  /** Opcional: só vem depois que a API lê o q8.sql novo; sem ela, o privado típico fica "—" (nunca total − público). */
  mediana_privado?: number | null;
}
/** Taxa de eleição por faixa de dinheiro público (pergunta 8). faixa -1 = sem prestação final; 0 = nada; 1–4 = quartos de quem recebeu (no mesmo ano, cargo e UF). */
export interface LinhaSucesso { ano: number; cargo: string; uf: string; faixa: number; candidaturas: number; eleitos: number; publico_min: number; publico_max: number }

export const FAIXAS_PUBLICO = [
  { faixa: 0, rotulo: "Não recebeu dinheiro público", curto: "não receberam nada" },
  { faixa: 1, rotulo: "Recebeu pouco", detalhe: "cerca de 1/4, os que menos receberam", curto: "receberam pouco" },
  { faixa: 2, rotulo: "Recebeu abaixo do meio", detalhe: "25% a 50%", curto: "receberam abaixo do meio" },
  { faixa: 3, rotulo: "Recebeu acima do meio", detalhe: "50% a 75%", curto: "receberam acima do meio" },
  { faixa: 4, rotulo: "Recebeu muito", detalhe: "cerca de 1/4, os que mais receberam", curto: "mais receberam" },
];

/** `frase` completa "X em cada 10 candidatos ..." na manchete da seção. */
export const FAIXAS: { chave: Faixa; rotulo: string; descricao: string; frase: string; classe: string }[] = [
  { chave: "so_publico", rotulo: "Só dinheiro público", descricao: "todo o dinheiro veio dos fundos públicos", frase: "fizeram a campanha só com dinheiro público", classe: "fx1" },
  { chave: "mais_publico", rotulo: "Mais público que privado", descricao: "mais da metade veio dos fundos públicos", frase: "usaram mais dinheiro público que privado", classe: "fx2" },
  { chave: "mais_privado", rotulo: "Mais privado que público", descricao: "mais da metade veio de doações ou do próprio bolso", frase: "usaram mais dinheiro privado que público", classe: "fx3" },
  { chave: "so_privado", rotulo: "Só dinheiro privado", descricao: "nenhum real veio dos fundos públicos", frase: "fizeram a campanha só com dinheiro privado", classe: "fx4" },
  { chave: "sem_receita", rotulo: "Não recebeu nada", descricao: "não declarou ter recebido dinheiro", frase: "não declararam ter recebido dinheiro", classe: "fx5" },
];

export const NOME_UF: Record<string, string> = { AP: "Amapá", ES: "Espírito Santo", MG: "Minas Gerais", PE: "Pernambuco", RJ: "Rio de Janeiro", RR: "Roraima" };

/** Cargos na ordem de importância (do mais alto ao mais baixo), para listas e filtros. */
export const ORDEM_CARGOS = ["Presidente", "Governador", "Senador", "Deputado federal", "Deputado estadual", "Prefeito", "Vereador"];
export const TIPO_ELEICAO = (ano: number) => (ano % 4 === 2 ? "eleição geral" : "eleição municipal");

export interface Filtros { ano?: number; cargo?: string; uf?: string }

export interface Soma {
  valores: Record<Fonte, number>; total: number; publico: number; privado: number; candidaturas: number; comReceita: number;
}

const vazio = (): Soma => ({
  valores: { fundo_eleitoral: 0, fundo_partidario: 0, doacoes_pessoas: 0, recursos_proprios: 0, outros_privados: 0 },
  total: 0, publico: 0, privado: 0, candidaturas: 0, comReceita: 0,
});

export function passa(l: { ano: number; cargo: string; uf: string | null }, f: Filtros): boolean {
  return (!f.ano || l.ano === f.ano) && (!f.cargo || l.cargo === f.cargo) && (!f.uf || l.uf === f.uf);
}

function acumular(s: Soma, l: LinhaFontes) {
  for (const { chave, publico } of FONTES) {
    const v = l[chave] ?? 0;
    s.valores[chave] += v;
    s.total += v;
    if (publico) s.publico += v; else s.privado += v;
  }
  s.candidaturas += l.candidaturas;
  s.comReceita += l.com_receita;
}

/** Soma as 5 fontes das linhas que passam nos filtros. */
export function somar(linhas: LinhaFontes[], f: Filtros): Soma {
  const s = vazio();
  for (const l of linhas) if (passa(l, f)) acumular(s, l);
  return s;
}

/** Uma soma por ano (para a evolução), aplicando cargo e UF. */
export function porAno(linhas: LinhaFontes[], f: Omit<Filtros, "ano">): { ano: number; soma: Soma }[] {
  const anos = [...new Set(linhas.map((l) => l.ano))].sort();
  return anos.map((ano) => ({ ano, soma: somar(linhas, { ...f, ano }) }));
}

/**
 * Uma soma por estado, do que mais dependeu de dinheiro público ao que menos. Ignora o UF da seleção
 * (a comparação é entre todos) e as campanhas nacionais (presidente, UF "BR").
 */
export function porUf(linhas: LinhaFontes[], f: Omit<Filtros, "uf">): { uf: string; soma: Soma }[] {
  const mapa = new Map<string, Soma>();
  for (const l of linhas) {
    if (l.uf === "BR" || !passa(l, f)) continue;
    let s = mapa.get(l.uf);
    if (!s) mapa.set(l.uf, (s = vazio()));
    acumular(s, l);
  }
  return [...mapa.entries()].map(([uf, soma]) => ({ uf, soma })).filter((u) => u.soma.total > 0)
    .sort((a, b) => b.soma.publico / b.soma.total - a.soma.publico / a.soma.total || a.uf.localeCompare(b.uf));
}

/**
 * Frases de mudança comparando eleição geral com geral e municipal com municipal (anos alternados não são comparáveis):
 * "de 66% em 2018 para 81% em 2022 (subiu 15 pontos)". Só gera frase para o tipo que tem pelo menos 2 eleições com dados.
 */
export function descreverMudancas(evolucao: { ano: number; soma: Soma }[]): { tipo: string; texto: string }[] {
  const saida: { tipo: string; texto: string }[] = [];
  for (const [tipo, resto] of [["gerais", 2], ["municipais", 0]] as const) {
    const anos = evolucao.filter((e) => e.ano % 4 === resto && e.soma.total > 0);
    if (anos.length < 2) continue;
    const [a, b] = [anos[0], anos[anos.length - 1]];
    const pa = Math.round((a.soma.publico / a.soma.total) * 100), pb = Math.round((b.soma.publico / b.soma.total) * 100);
    const d = pb - pa;
    const variacao = d === 0 ? "ficou igual" : `${d > 0 ? "subiu" : "caiu"} ${Math.abs(d)} ${Math.abs(d) === 1 ? "ponto" : "pontos"}`;
    saida.push({ tipo, texto: `o dinheiro público foi de ${pa}% em ${a.ano} para ${pb}% em ${b.ano} (${variacao}).` });
  }
  return saida;
}

/** Uma soma por partido, do que mais recebeu ao que menos recebeu. */
export function porPartido(linhas: LinhaFontes[], f: Filtros): { partido: string; soma: Soma }[] {
  const mapa = new Map<string, Soma>();
  for (const l of linhas) {
    if (!passa(l, f)) continue;
    let s = mapa.get(l.partido);
    if (!s) mapa.set(l.partido, (s = vazio()));
    acumular(s, l);
  }
  return [...mapa.entries()].map(([partido, soma]) => ({ partido, soma })).filter((p) => p.soma.total > 0).sort((a, b) => b.soma.total - a.soma.total);
}

/**
 * Ordena os partidos para o gráfico: "valor" (quem recebeu mais) ou "publico" (quem mais dependeu de dinheiro público).
 * Na ordem por % público, partidos com menos de `minimoParte` do dinheiro total ficam de fora: com valores muito
 * pequenos o percentual engana (um partido com R$ 5 mil, todo público, apareceria no topo).
 */
export function ordenarPartidos<T extends { partido: string; soma: Soma }>(partidos: T[], ordem: "valor" | "publico", minimoParte = 0.005): T[] {
  if (ordem === "valor") return [...partidos].sort((a, b) => b.soma.total - a.soma.total);
  const total = partidos.reduce((a, p) => a + p.soma.total, 0);
  return partidos.filter((p) => p.soma.total >= total * minimoParte)
    .sort((a, b) => b.soma.publico / b.soma.total - a.soma.publico / a.soma.total || b.soma.total - a.soma.total);
}

/** Faixa dos candidatos sem prestação de contas final (perguntas 2 e 8): o valor é desconhecido, não zero. */
export const SEM_PRESTACAO = -1;

/** Quantos candidatos do recorte não entregaram a prestação final e ficaram fora dos grupos. `cargos` limita a esses cargos. */
export function semPrestacao(linhas: { ano: number; cargo: string; uf: string | null; faixa: number; candidaturas: number }[], f: Filtros, cargos?: string[]): number {
  let n = 0;
  for (const l of linhas) if (l.faixa === SEM_PRESTACAO && passa(l, f) && (!cargos || cargos.includes(l.cargo))) n += l.candidaturas;
  return n;
}

/** Taxa de eleição em cada faixa de dinheiro público (sempre as 5 faixas, mesmo vazias; quem não prestou contas fica de fora). */
export function sucessoPorFaixa(linhas: LinhaSucesso[], f: Filtros) {
  const porFaixa = FAIXAS_PUBLICO.map((x) => ({ ...x, candidaturas: 0, eleitos: 0, min: Infinity, max: 0 }));
  for (const l of linhas) {
    if (!passa(l, f)) continue;
    const g = porFaixa[l.faixa];
    if (!g) continue;
    g.candidaturas += l.candidaturas;
    g.eleitos += l.eleitos;
    g.min = Math.min(g.min, l.publico_min);
    g.max = Math.max(g.max, l.publico_max);
  }
  return porFaixa.map((g) => ({ ...g, taxa: g.candidaturas ? g.eleitos / g.candidaturas : 0 }));
}

/**
 * A resposta simples da pergunta 8: três grupos e a parte de cada um que se elegeu.
 * "muito" = cerca de 1/4 de quem recebeu, os que mais receberam dinheiro público (comparando com a mesma disputa);
 * "pouco" = os outros 75% que receberam algo; "nada" = não receberam dinheiro público.
 */
export function sucessoTresGrupos(linhas: LinhaSucesso[], f: Filtros) {
  const fx = sucessoPorFaixa(linhas, f);
  const juntar = (chave: "nada" | "pouco" | "muito", faixas: number[]) => {
    const cand = faixas.reduce((a, i) => a + fx[i].candidaturas, 0), ele = faixas.reduce((a, i) => a + fx[i].eleitos, 0);
    return { chave, candidaturas: cand, eleitos: ele, taxa: cand ? ele / cand : 0 };
  };
  return { nada: juntar("nada", [0]), pouco: juntar("pouco", [1, 2, 3]), muito: juntar("muito", [4]) };
}

/**
 * Resposta curta da pergunta 8: compara quem recebeu muito com quem não recebeu nada (ou, se ninguém ficou sem, com
 * quem recebeu pouco). "Sim" se a taxa de eleição de "muito" passa 1,2 vez a dos outros; "Não" se fica 1,2 vez abaixo.
 */
export function respostaSucesso(g: ReturnType<typeof sucessoTresGrupos>) {
  // a mesma comparação na resposta curta, na frase e no gráfico: "muito" contra quem não recebeu nada (ou, se ninguém
  // ficou sem, contra quem recebeu pouco), com teste estatístico em vez de um limite fixo
  const base = g.nada.candidaturas > 0 ? g.nada : g.pouco;
  const { resposta: curta } = compararGrupos(g.muito, base);
  return { base, curta, vezes: base.taxa > 0 ? g.muito.taxa / base.taxa : null };
}

/** Que parte dos candidatos os eleitos eram, e que parte do dinheiro público eles receberam. */
export function parteDosEleitos(linhas: LinhaFontes[], f: Filtros) {
  let cand = 0, candEleitos = 0, pub = 0, pubEleitos = 0;
  for (const l of linhas) {
    if (!passa(l, f)) continue;
    const p = l.fundo_eleitoral + l.fundo_partidario;
    cand += l.candidaturas;
    pub += p;
    if (l.eleito) { candEleitos += l.candidaturas; pubEleitos += p; }
  }
  return { candidatos: cand, eleitos: candEleitos, pctCandidatos: cand ? candEleitos / cand : 0, publico: pub, publicoEleitos: pubEleitos, pctPublico: pub ? pubEleitos / pub : 0 };
}

/** Quantas candidaturas em cada faixa de dependência do dinheiro público. `eleito` undefined = todas. */
export function contarFaixas(linhas: LinhaFaixa[], f: Filtros, eleito?: boolean): { porFaixa: Record<Faixa, number>; total: number } {
  const porFaixa: Record<Faixa, number> = { so_publico: 0, mais_publico: 0, mais_privado: 0, so_privado: 0, sem_receita: 0 };
  let total = 0;
  for (const l of linhas) {
    if (!passa(l, f) || (eleito !== undefined && l.eleito !== eleito)) continue;
    porFaixa[l.faixa] += l.candidaturas;
    total += l.candidaturas;
  }
  return { porFaixa, total };
}

/** Mediana de eleitos e não eleitos por cargo, num ano (uf ausente = todas as UFs, linha pré-calculada no pipeline). */
export function medianasPorCargo(linhas: LinhaMediana[], ano: number, uf?: string, cargo?: string) {
  const sel = linhas.filter((l) => l.ano === ano && (l.uf ?? undefined) === uf && (!cargo || l.cargo === cargo));
  const cargos = ordenarCargos([...new Set(sel.map((l) => l.cargo))]);
  return cargos.map((c) => ({
    cargo: c,
    eleito: sel.find((l) => l.cargo === c && l.eleito) ?? null,
    naoEleito: sel.find((l) => l.cargo === c && !l.eleito) ?? null,
  }));
}

export function ordenarCargos(cargos: string[]): string[] {
  const pos = (c: string) => (ORDEM_CARGOS.indexOf(c) + 1 || 99);
  return [...cargos].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b));
}

/**
 * Divide 100 unidades proporcionalmente aos valores (maior resto), para o gráfico "de cada R$ 100".
 * A soma é sempre exatamente 100 (ou 0, se não houver valores).
 */
export function deCada100(valores: number[]): number[] {
  const total = valores.reduce((a, b) => a + b, 0);
  if (total <= 0) return valores.map(() => 0);
  const brutos = valores.map((v) => (v / total) * 100);
  const inteiros = brutos.map(Math.floor);
  let falta = 100 - inteiros.reduce((a, b) => a + b, 0);
  const ordem = brutos.map((b, i) => [b - Math.floor(b), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordem) {
    if (falta <= 0) break;
    inteiros[i] += 1;
    falta -= 1;
  }
  return inteiros;
}

/** "R$ 14 de cada R$ 100"; um valor que existe mas arredonda para zero vira "menos de R$ 1 de cada R$ 100". */
export const textoDe100 = (n: number, valor: number) => (n === 0 && valor > 0 ? "menos de R$ 1 de cada R$ 100" : `R$ ${n} de cada R$ 100`);

/** "3 em cada 10 candidatos": arredonda uma proporção para uma fração simples de dizer em voz alta. */
export function emCada10(p: number, plural = "candidatos", singular = "candidato"): string {
  const n = Math.round(p * 10);
  if (n <= 0) return p > 0 ? `menos de 1 em cada 10 ${plural}` : `nenhum ${singular}`;
  if (n >= 10) return p < 1 ? `quase todos os ${plural}` : `todos os ${plural}`;
  return `${n} em cada 10 ${plural}`;
}

export interface ResumoCampanha {
  id: number; ano: number; cargo: string; eleito: boolean;
  /** null: as receitas não puderam ser carregadas. */
  total: number | null; publica: number; privada: number; publicoDe100: number;
}

/** Uma linha por campanha (na ordem recebida) para comparar quanto cada uma recebeu e quanto disso foi dinheiro público. */
export function resumoCampanhas(campanhas: { c: CarreiraItem; r: Receitas | null }[]): ResumoCampanha[] {
  return campanhas.map(({ c, r }) => ({
    id: c.id_candidatura, ano: c.ano, cargo: c.cargo, eleito: c.eleito,
    total: r ? r.total : null, publica: r?.publica ?? 0, privada: r?.privada ?? 0,
    publicoDe100: r && r.total > 0 ? deCada100([r.publica, r.privada])[0] : 0,
  }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Pergunta 8 na camada Dinheiro do mapa: eleitos × não eleitos, sempre nos dois lados (público e privado).
// ---------------------------------------------------------------------------------------------------------------------

/** As somas das 5 fontes de eleitos e de não eleitos no recorte (sem uf, os seis estados). */
export function fontesPorResultado(linhas: LinhaFontes[], f: Filtros): { eleitos: Soma; naoEleitos: Soma } {
  return { eleitos: somar(linhas.filter((l) => l.eleito), f), naoEleitos: somar(linhas.filter((l) => !l.eleito), f) };
}

const classeDe = (c: Fonte) => FONTES.find((x) => x.chave === c)!.classe;
/** Os 4 grupos da barra, na ordem fixa: fundos públicos (os dois fundos juntos), doações, recursos próprios e outros. */
export const GRUPOS_P8: { chave: string; rotulo: string; fontes: Fonte[]; cor: string }[] = [
  { chave: "publico", rotulo: "Fundos públicos", fontes: ["fundo_eleitoral", "fundo_partidario"], cor: classeDe("fundo_eleitoral") },
  { chave: "doacoes", rotulo: "Doações", fontes: ["doacoes_pessoas"], cor: classeDe("doacoes_pessoas") },
  { chave: "proprios", rotulo: "Recursos próprios", fontes: ["recursos_proprios"], cor: classeDe("recursos_proprios") },
  { chave: "outros", rotulo: "Outros", fontes: ["outros_privados"], cor: classeDe("outros_privados") },
];

/** As fatias da barra de um grupo (eleitos ou não eleitos), nos 4 grupos de GRUPOS_P8, na ordem fixa. */
export function gruposP8(s: Soma): Fatia[] {
  return fatias(GRUPOS_P8.map((g) => ({ chave: g.chave, rotulo: g.rotulo, cor: g.cor, valor: g.fontes.reduce((a, c) => a + s.valores[c], 0) })), { fixo: true });
}

/** A parte pública do que um grupo recebeu (0 a 1); null sem dinheiro. */
export const partePublica = (s: Soma): number | null => (s.total > 0 ? s.publico / s.total : null);

/** O candidato típico (medianas): total, público e privado. */
export interface TipicoP8 { total: number; publico: number; privado: number | null }

/**
 * O eleito típico e o não eleito típico do recorte (tabela medianas; sem uf, a linha de uf nula, como em
 * medianasPorCargo). O privado vem só da coluna mediana_privado: medianas não se subtraem (sem a coluna, null).
 */
export function tipicosP8(linhas: LinhaMediana[], f: Filtros): { eleito: TipicoP8 | null; naoEleito: TipicoP8 | null } {
  const de = (eleito: boolean): TipicoP8 | null => {
    const l = linhas.find((x) => x.ano === f.ano && x.cargo === f.cargo && (x.uf ?? undefined) === f.uf && x.eleito === eleito);
    return l ? { total: l.mediana_total, publico: l.mediana_publico, privado: l.mediana_privado ?? null } : null;
  };
  return { eleito: de(true), naoEleito: de(false) };
}

/** Quantas vezes mais o eleito típico recebeu (arredondado); null quando o não eleito típico não recebeu nada. */
export const vezesMais = (eleito: number, naoEleito: number): number | null => (naoEleito <= 0 ? null : Math.round(eleito / naoEleito));

/**
 * A parte de cada grupo em que a maioria do dinheiro foi pública (só público ou mais público que privado), sobre o
 * total do grupo, inclusive quem não recebeu nada. null quando o grupo não tem ninguém.
 */
export function maioriaPublica(linhas: LinhaFaixa[], f: Filtros): { eleitos: number | null; naoEleitos: number | null } {
  const de = (eleito: boolean) => {
    const { porFaixa, total } = contarFaixas(linhas, f, eleito);
    return total > 0 ? (porFaixa.so_publico + porFaixa.mais_publico) / total : null;
  };
  return { eleitos: de(true), naoEleitos: de(false) };
}

/** A parte pública de eleitos e de não eleitos em dois anos (a eleição anterior do mesmo tipo e a atual). */
export function partePublicaNosAnos(linhas: LinhaFontes[], f: { cargo?: string; uf?: string }, [antes, depois]: [number, number]) {
  const [a, d] = [fontesPorResultado(linhas, { ...f, ano: antes }), fontesPorResultado(linhas, { ...f, ano: depois })];
  return {
    eleitos: { antes: partePublica(a.eleitos), depois: partePublica(d.eleitos) },
    naoEleitos: { antes: partePublica(a.naoEleitos), depois: partePublica(d.naoEleitos) },
  };
}

/**
 * A resposta em um número e uma frase: "4× mais dinheiro" + de onde veio uma parte maior (diferença de 3 p.p. ou mais;
 * abaixo disso, "a mistura é parecida"). Quando o não eleito típico não recebeu nada, o número é o total do eleito típico.
 */
export function fraseP8(t: { eleito: TipicoP8 | null; naoEleito: TipicoP8 | null }, partes: { eleitos: number | null; naoEleitos: number | null }): { numero: string; frase: string } | null {
  if (!t.eleito || !t.naoEleito) return null;
  const vezes = vezesMais(t.eleito.total, t.naoEleito.total);
  if (vezes === null) return { numero: reais(t.eleito.total), frase: "o não eleito típico não recebeu nada." };
  const [pe, pn] = [partes.eleitos, partes.naoEleitos];
  const mistura = pe === null || pn === null || Math.abs(pe - pn) < 0.03 ? "e a mistura de público e privado é parecida."
    : pe > pn ? "e uma parte maior dele veio dos fundos públicos." : "e uma parte maior dele veio dos recursos privados.";
  return { numero: `${vezes}× mais dinheiro`, frase: mistura };
}

/** O topo da régua das colunas: o múltiplo de 0,1 logo acima da maior taxa (no mínimo 0,1). */
export const topoDaRegua = (taxas: number[]): number => Math.max(0.1, Math.ceil(Math.max(0, ...taxas) * 10 - 1e-9) / 10);

/** A variação em pontos percentuais, escrita: "▲ 18 p.p." (sobe), "▼ 3 p.p." (desce) ou "= 0 p.p."; null sem um dos lados. */
export function setaPP(antes: number | null, depois: number | null): { texto: string; classe: "sobe" | "desce" | "" } | null {
  if (antes === null || depois === null) return null;
  const pp = Math.round((depois - antes) * 100);
  return pp === 0 ? { texto: "= 0 p.p.", classe: "" } : { texto: `${pp > 0 ? "▲" : "▼"} ${Math.abs(pp)} p.p.`, classe: pp > 0 ? "sobe" : "desce" };
}

/**
 * As colunas de "quem recebeu mais dinheiro público se elegeu mais?" (sucessoPorFaixa): as faixas 0 a 4, sem quem não
 * prestou contas, com a taxa de eleição e "X eleitos de Y". A faixa 4 (os que mais receberam) fica na cor de destaque;
 * a 0 (nada), em fx5; as outras, em fx2. `max`: o topo da régua (topoDaRegua).
 */
export function colunasSucessoP8(linhas: LinhaSucesso[], f: Filtros) {
  const fx = sucessoPorFaixa(linhas, f);
  const colunas = fx.map((g) => ({
    chave: String(g.faixa), rotulo: g.rotulo, linhas: [`${inteiro(g.eleitos)} ${g.eleitos === 1 ? "eleito" : "eleitos"} de ${inteiro(g.candidaturas)}`],
    parte: g.candidaturas ? g.taxa : null, vazia: "ninguém neste grupo", classe: g.faixa === 4 ? undefined : g.faixa === 0 ? "fx5" : "fx2",
  }));
  return { colunas, max: topoDaRegua(fx.filter((g) => g.candidaturas).map((g) => g.taxa)) };
}

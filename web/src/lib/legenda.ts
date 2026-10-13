// Lógica da página de votos de legenda (pergunta 5). Tudo aqui é puro: a página só desenha o que sai destas funções.
// As siglas renomeadas já chegam unificadas pelo SQL (pipeline/sql/q5.sql); fusões chegam separadas e só são
// somadas quando o usuário liga "juntar", usando a tabela linhagem.
import { pct, pctSinal } from "./format";

/** Tabela `legenda` de q5.json: ano x cargo x UF x partido. */
export interface LinhaLegenda { ano: number; cargo: string; uf: string; numero: number; partido: string; votos_nominais: number; votos_legenda: number; eleitos: number }
export type TipoEvento = "renomeacao" | "incorporacao" | "fusao" | "federacao" | "extincao";
/** Tabela `eventos` de q5.json: o que aconteceu com o partido no ano (ano da aprovação pelo TSE). */
export interface EventoPartido { partido: string; ano: number; tipo: TipoEvento; rotulo: string; descricao: string }
/** Tabela `linhagem` de q5.json: partido absorvido → sucessor direto e partido atual (fim da cadeia). */
export interface Linhagem { partido: string; sucessor: string; atual: string; ano: number }

export const TODOS = "Todos";
export const PADRAO_PARTIDOS = ["PT", "PL", "NOVO"];
export const MAX_PARTIDOS = 3;
export const CICLOS = ["geral", "municipal"] as const;
export const CARGOS = ["ambos", "estadual", "federal"] as const;
export const ORDENS = ["soma", "recente", "anterior", "crescimento"] as const;
export type Ciclo = (typeof CICLOS)[number];
export type CargoCiclo = (typeof CARGOS)[number];
export type OrdemCiclo = (typeof ORDENS)[number];

export const proporcao = (legenda: number, nominais: number) => (legenda + nominais > 0 ? legenda / (legenda + nominais) : 0);
/** Eleição geral (deputados) em 2018, 2022...; municipal (vereadores) em 2020, 2024... */
export const cicloDoAno = (ano: number): Ciclo => (ano % 4 === 2 ? "geral" : "municipal");

export const anosDe = (linhas: LinhaLegenda[]) => [...new Set(linhas.map((l) => l.ano))].sort((a, b) => a - b);
const porPartido = (linhagem: Linhagem[]) => new Map(linhagem.map((l) => [l.partido, l]));

interface Soma { legenda: number; nominais: number; eleitos: number }
function somar(linhas: LinhaLegenda[]): Soma {
  const s = { legenda: 0, nominais: 0, eleitos: 0 };
  for (const l of linhas) { s.legenda += l.votos_legenda; s.nominais += l.votos_nominais; s.eleitos += l.eleitos; }
  return s;
}

export interface FiltroLegenda { uf?: string; juntar?: boolean; linhagem?: Linhagem[] }

/** Recorta pela UF (sem UF = todas) e, com juntar, troca cada partido absorvido pelo partido atual. */
export function filtrar(linhas: LinhaLegenda[], { uf, juntar = false, linhagem = [] }: FiltroLegenda = {}): LinhaLegenda[] {
  const suc = porPartido(linhagem);
  return linhas.filter((l) => !uf || l.uf === uf).map((l) => {
    const s = juntar ? suc.get(l.partido) : undefined;
    return s ? { ...l, partido: s.atual } : l;
  });
}

/** Com juntar, os partidos escolhidos que foram absorvidos viram o partido atual (sem repetir). */
export function resolverSelecao(partidos: string[], juntar: boolean, linhagem: Linhagem[]): string[] {
  const suc = porPartido(linhagem);
  return [...new Set(partidos.map((p) => (juntar && suc.get(p)?.atual) || p))];
}

export interface PontoSerie extends Soma { ano: number; proporcao: number }
export interface Serie { partido: string; pontos: PontoSerie[] }

const pontosDe = (linhas: LinhaLegenda[], anos: number[]): PontoSerie[] => anos.flatMap((ano) => {
  const ls = linhas.filter((l) => l.ano === ano);
  if (!ls.length) return [];
  const s = somar(ls);
  return [{ ano, ...s, proporcao: proporcao(s.legenda, s.nominais) }];
});

/** Proporção e votos de legenda por ano: primeiro "Todos" (todos os partidos das linhas), depois cada partido pedido.
 *  Ano sem votos do partido não vira ponto (a linha fica com um buraco). */
export function serie(linhas: LinhaLegenda[], partidos: string[]): Serie[] {
  const anos = anosDe(linhas);
  return [{ partido: TODOS, pontos: pontosDe(linhas, anos) }, ...partidos.map((p) => ({ partido: p, pontos: pontosDe(linhas.filter((l) => l.partido === p), anos) }))];
}

/** Todos os partidos das linhas, do que tem mais votos de legenda para o que tem menos (tabela completa). */
export function tabelaPartidos(linhas: LinhaLegenda[]): Serie[] {
  const anos = anosDe(linhas);
  const total = new Map<string, number>();
  for (const l of linhas) total.set(l.partido, (total.get(l.partido) ?? 0) + l.votos_legenda);
  return [...total].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([partido]) => ({ partido, pontos: pontosDe(linhas.filter((l) => l.partido === partido), anos) }));
}

/** Quebra os pontos em trechos de anos seguidos (dentro de `anos`): onde o partido some, a linha é interrompida. */
export function trechos<T extends { ano: number }>(pontos: T[], anos: number[]): T[][] {
  const res: T[][] = [];
  pontos.forEach((p, i) => {
    if (i && anos.indexOf(p.ano) === anos.indexOf(pontos[i - 1].ano) + 1) res[res.length - 1].push(p);
    else res.push([p]);
  });
  return res;
}

/** Posição do evento no eixo de anos. Mudança em ano de eleição acontece antes dela (prazo de registro do partido),
 *  então fica um pouco antes do ponto: 2022 → 2021,55. */
export const posicaoEvento = (ano: number) => (ano % 2 === 0 ? ano - 0.45 : ano);

/** Posições em que a linha do partido muda de tom: renomeação sempre; incorporação e fusão só com juntar
 *  (só então a linha passa a somar outro partido). */
export function cortesTom(partido: string, eventos: EventoPartido[], juntar: boolean): number[] {
  const xs = eventos
    .filter((e) => e.partido === partido && (e.tipo === "renomeacao" || (juntar && (e.tipo === "incorporacao" || e.tipo === "fusao"))))
    .map((e) => posicaoEvento(e.ano));
  return [...new Set(xs)].sort((a, b) => a - b);
}

export interface EventoFaixa extends EventoPartido { x: number }

/** Eventos dos partidos escolhidos, em ordem de ano, para a faixa abaixo do gráfico. */
export function faixaEventos(partidos: string[], eventos: EventoPartido[]): EventoFaixa[] {
  return eventos
    .filter((e) => partidos.includes(e.partido))
    .map((e) => ({ ...e, x: posicaoEvento(e.ano) }))
    .sort((a, b) => a.ano - b.ano || partidos.indexOf(a.partido) - partidos.indexOf(b.partido));
}

export interface EntradaIndice { sigla: string; numero: number; partido: string }

/** Índice para a busca por sigla ou número. Recebe as linhas SEM juntar (para manter as siglas antigas);
 *  com juntar, a sigla antiga aponta para o partido atual (DEM → UNIÃO). */
export function indicePartidos(linhas: LinhaLegenda[], juntar: boolean, linhagem: Linhagem[]): EntradaIndice[] {
  const suc = porPartido(linhagem);
  const indice = new Map<string, EntradaIndice>();
  for (const l of linhas) {
    const k = `${l.partido}|${l.numero}`;
    if (!indice.has(k)) indice.set(k, { sigla: l.partido, numero: l.numero, partido: (juntar && suc.get(l.partido)?.atual) || l.partido });
  }
  return [...indice.values()].sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR") || a.numero - b.numero);
}

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Entradas que casam com o termo (número exato ou sigla começando pelo termo, sem acento nem maiúsculas),
 *  uma por partido de destino, fora os já escolhidos. */
export function buscarPartido(indice: EntradaIndice[], termo: string, escolhidos: string[] = []): EntradaIndice[] {
  const t = semAcento(termo.trim());
  if (!t) return [];
  const vistos = new Set(escolhidos);
  return indice.filter((e) => {
    if (vistos.has(e.partido) || (String(e.numero) !== t && !semAcento(e.sigla).startsWith(t))) return false;
    vistos.add(e.partido);
    return true;
  });
}

/** Os n partidos com mais votos de legenda que ainda não foram escolhidos. */
export function sugestoes(linhas: LinhaLegenda[], selecionados: string[], n = 5): string[] {
  return tabelaPartidos(linhas).map((s) => s.partido).filter((p) => !selecionados.includes(p)).slice(0, n);
}

/** As duas eleições mais recentes do ciclo nas linhas, ou null se não houver duas. */
export function anosCiclo(linhas: LinhaLegenda[], ciclo: Ciclo): [number, number] | null {
  const anos = anosDe(linhas).filter((a) => cicloDoAno(a) === ciclo);
  return anos.length < 2 ? null : [anos[anos.length - 2], anos[anos.length - 1]];
}

export interface OpcoesCiclo { ciclo: Ciclo; cargo: CargoCiclo; ordem: OrdemCiclo }
/** anterior/recente = votos de legenda no ano (null se o partido não disputou); variacao = crescimento relativo
 *  (recente ÷ anterior − 1; null sem os dois anos ou com anterior 0); fatia = parte do partido em todos os votos de
 *  legenda do ano recente. */
export interface ParCiclo {
  partido: string; numero: number; anterior: number | null; recente: number | null; variacao: number | null;
  eleitosRecente: number; fatia: number; status: string | null;
}
export interface Comparacao { anos: [number, number] | null; pares: ParCiclo[] }

/**
 * Compara as duas eleições mais recentes do ciclo (geral: 2018 × 2022; municipal: 2020 × 2024).
 * Recebe as linhas já filtradas (filtrar). Quando falta um dos anos, o status explica:
 * "virou X (ano)" (absorvido, segundo a linhagem), "não existia" (partido que resultou de fusão e ainda não existia
 * com esse nome), "novo" (sem votos em nenhum ano até o anterior) ou "não disputou".
 */
export function compararCiclos(linhas: LinhaLegenda[], { ciclo, cargo, ordem }: OpcoesCiclo, linhagem: Linhagem[] = []): Comparacao {
  const doCiclo = linhas.filter((l) => cicloDoAno(l.ano) === ciclo && (ciclo === "municipal" || cargo === "ambos" || l.cargo.toLowerCase().includes(cargo)));
  const anos = anosCiclo(doCiclo, ciclo);
  if (!anos) return { anos: null, pares: [] };
  const [antes, depois] = anos;
  const suc = porPartido(linhagem);
  const atuais = new Set(linhagem.map((l) => l.atual));
  const jaExistia = new Set(linhas.filter((l) => l.ano <= antes).map((l) => l.partido));
  const totalRecente = somar(doCiclo.filter((l) => l.ano === depois)).legenda;

  const grupos = new Map<string, LinhaLegenda[]>();
  for (const l of doCiclo) if (l.ano === antes || l.ano === depois) grupos.set(l.partido, [...(grupos.get(l.partido) ?? []), l]);

  const itens = [...grupos].map(([partido, ls]) => {
    const ant = ls.filter((l) => l.ano === antes), rec = ls.filter((l) => l.ano === depois);
    const sa = somar(ant), sr = somar(rec);
    const anterior = ant.length ? sa.legenda : null;
    const recente = rec.length ? sr.legenda : null;
    const absorvido = suc.get(partido);
    const status = ant.length && rec.length ? null
      : !rec.length ? (absorvido ? `virou ${absorvido.sucessor} (${absorvido.ano})` : "não disputou")
      : jaExistia.has(partido) ? "não disputou"
      : atuais.has(partido) ? "não existia" : "novo";
    const par: ParCiclo = {
      partido, numero: (rec[0] ?? ant[0]).numero, anterior, recente,
      variacao: anterior && recente != null ? recente / anterior - 1 : null,
      eleitosRecente: sr.eleitos, fatia: totalRecente > 0 ? sr.legenda / totalRecente : 0, status,
    };
    return { par, soma: sa.legenda + sr.legenda };
  });

  // quem não tem o valor da ordem (null) vai para o fim; empate desempata pelo total de votos de legenda
  const valor = (i: (typeof itens)[number]) =>
    ordem === "soma" ? i.soma : (ordem === "recente" ? i.par.recente : ordem === "anterior" ? i.par.anterior : i.par.variacao) ?? -Infinity;
  itens.sort((a, b) => (valor(b) - valor(a) || 0) || b.soma - a.soma || a.par.partido.localeCompare(b.par.partido));
  return { anos: [antes, depois], pares: itens.map((i) => i.par) };
}

/** Frase-resumo do gráfico de linhas: o conjunto do primeiro ao último ano e o destaque entre os escolhidos. */
export function resumoSerie(series: Serie[]): string {
  const [todos, ...partidos] = series;
  if (!todos?.pontos.length) return "Sem votos para os filtros escolhidos.";
  const ini = todos.pontos[0], fim = todos.pontos[todos.pontos.length - 1];
  const frases = [ini === fim
    ? `No conjunto dos partidos, ${pct(fim.proporcao)} dos votos foram de legenda em ${fim.ano}.`
    : `No conjunto dos partidos, a legenda passou de ${pct(ini.proporcao)} dos votos em ${ini.ano} para ${pct(fim.proporcao)} em ${fim.ano}.`];
  const noFim = partidos.flatMap((s) => s.pontos.filter((p) => p.ano === fim.ano).map((p) => ({ partido: s.partido, p })));
  if (noFim.length) {
    const m = noFim.reduce((a, b) => (b.p.proporcao > a.p.proporcao ? b : a));
    const lado = m.p.proporcao > fim.proporcao ? "acima" : m.p.proporcao < fim.proporcao ? "abaixo" : "igual";
    frases.push(`Entre os escolhidos, ${m.partido} teve a maior proporção em ${fim.ano}: ${pct(m.p.proporcao)}, ${lado === "igual" ? "igual ao conjunto" : `${lado} do conjunto`}.`);
  }
  return frases.join(" ");
}

/** Frase-resumo da comparação entre ciclos: quantos ganharam e perderam votos de legenda, maior alta e maior queda. */
export function resumoCiclos({ anos, pares }: Comparacao): string {
  if (!anos) return "Não há duas eleições deste ciclo para comparar.";
  const ambos = pares.filter((p) => p.variacao != null);
  const sobe = ambos.filter((p) => p.variacao! > 0), desce = ambos.filter((p) => p.variacao! < 0);
  const n = (k: number, um: string, varios: string) => `${k} ${k === 1 ? um : varios}`;
  let s = `Entre ${anos[0]} e ${anos[1]}, ${n(sobe.length, "partido aumentou", "partidos aumentaram")} os votos de legenda e ${n(desce.length, "diminuiu", "diminuíram")}.`;
  const alta = sobe.reduce<ParCiclo | null>((a, b) => (!a || b.variacao! > a.variacao! ? b : a), null);
  const queda = desce.reduce<ParCiclo | null>((a, b) => (!a || b.variacao! < a.variacao! ? b : a), null);
  if (alta) s += ` Maior alta: ${alta.partido} (${pctSinal(alta.variacao!)}).`;
  if (queda) s += ` Maior queda: ${queda.partido} (${pctSinal(queda.variacao!)}).`;
  return s;
}

export interface ParametrosLegenda { uf?: string; juntar: boolean; p: string[]; ciclo: Ciclo; cargo: CargoCiclo; ordem: OrdemCiclo; todos: boolean }
type SP = Record<string, string | string[] | undefined>;

const lista = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v != null ? [v] : []);
const escolha = <T extends string>(v: string | undefined, opcoes: readonly T[], padrao: T): T => (opcoes.find((o) => o === v) ?? padrao);
const booleano = (v: string | undefined, padrao: boolean) => (v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : padrao);

/**
 * Lê e valida os parâmetros da URL; valor inválido volta ao padrão. p aceita `p=PT&p=PL` ou `p=PT,PL`, até 3 partidos;
 * `p=` vazio é uma escolha válida (nenhum partido, só "Todos"). Com `opcoes`, UF e partidos precisam existir nos dados
 * (a sigla é casada sem diferenciar maiúsculas). todos=1 mostra todos os partidos na comparação de ciclos.
 */
export function lerParametros(sp: SP, opcoes: { ufs?: string[]; partidos?: string[] } = {}): ParametrosLegenda {
  const uf = lista(sp.uf)[0]?.toUpperCase();
  const canonico = (s: string) => (opcoes.partidos ? opcoes.partidos.find((x) => x.toLowerCase() === s.toLowerCase()) : s);
  const pedidos = lista(sp.p).flatMap((v) => v.split(",")).map((s) => s.trim()).filter(Boolean);
  const p = [...new Set(pedidos.map(canonico).filter((s): s is string => !!s))].slice(0, MAX_PARTIDOS);
  const vazio = sp.p != null && !pedidos.length;
  return {
    uf: uf && /^[A-Z]{2}$/.test(uf) && (!opcoes.ufs || opcoes.ufs.includes(uf)) ? uf : undefined,
    juntar: booleano(lista(sp.juntar)[0], false),
    p: p.length || vazio ? p : [...PADRAO_PARTIDOS],
    ciclo: escolha(lista(sp.ciclo)[0], CICLOS, "geral"),
    cargo: escolha(lista(sp.cargo)[0], CARGOS, "ambos"),
    ordem: escolha(lista(sp.ordem)[0], ORDENS, "soma"),
    todos: booleano(lista(sp.todos)[0], false),
  };
}

/** URL da página com os parâmetros atuais trocados por `mudanca`; omite o que está no padrão. */
export function hrefLegenda(atual: ParametrosLegenda, mudanca: Partial<ParametrosLegenda> = {}): string {
  const n = { ...atual, ...mudanca };
  const q = new URLSearchParams();
  if (n.uf) q.set("uf", n.uf);
  if (n.juntar) q.set("juntar", "1");
  if (n.p.join(",") !== PADRAO_PARTIDOS.join(",")) q.set("p", n.p.join(","));
  if (n.ciclo !== "geral") q.set("ciclo", n.ciclo);
  if (n.cargo !== "ambos") q.set("cargo", n.cargo);
  if (n.ordem !== "soma") q.set("ordem", n.ordem);
  if (n.todos) q.set("todos", "1");
  const s = q.toString();
  return `/analises/legenda${s ? `?${s}` : ""}`;
}

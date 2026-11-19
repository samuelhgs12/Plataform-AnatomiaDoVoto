/**
 * Perguntas 6 e 7: a idade do eleitorado e o viés político de cada município (análise `vies`, api/app/analises/vies.sql).
 * Sub-abas Comparar › Idade e Comparar › Viés do mapa da página inicial (components/VisaoVies.tsx).
 *
 * As tabelas trazem somas, não médias, para que o estado e os seis estados saiam ponderados: o viés pelos votos em
 * partidos com score, a idade do eleitorado pelos eleitores, a idade dos votados pelos votos.
 */
import { faixaVies, fmtVies, ROTULO_FAIXA } from "./legislativo";

export interface LinhaVies { ano: number; cargo: string; uf: string; cod_ibge: string; votos: number; votos_score: number | null; soma_score: number | null }
export interface LinhaVotados { ano: number; cargo: string; uf: string; cod_ibge: string; votos: number; votos_idade: number | null; soma_idade: number | null; votos_jovem: number }
export interface LinhaEleitorado { ano: number; uf: string; cod_ibge: string; eleitores: number; soma_idade: number; jovens: number; idosos: number }
export interface LinhaPopulacao { uf: string; cod_ibge: string; pessoas: number; soma_idade: number; jovens: number; idosos: number }

/** Onde medir: os seis estados (vazio), um estado ou um município (cod_ibge). */
export interface Lugar { uf?: string; ibge?: string }

export const ANOS_VIES = [2018, 2020, 2022, 2024, 2026] as const;
export const ehMunicipal = (ano: number) => ano % 4 === 0;

export type ChaveCargo = "presidente" | "dep-federal" | "dep-estadual" | "senador" | "governador" | "vereador" | "prefeito";
/** Os cargos que o usuário escolhe, um de cada vez (a linha do tempo só compara eleições do mesmo cargo). O padrão é o
 *  deputado federal nos anos gerais e o vereador nos municipais (CARGO_PADRAO e cargoEquivalente). */
export const CARGOS_VIES: { chave: ChaveCargo; rotulo: string; nome?: string; municipal?: boolean }[] = [
  { chave: "presidente", rotulo: "Presidente", nome: "Presidente", municipal: false },
  { chave: "dep-federal", rotulo: "Deputado federal", nome: "Deputado federal", municipal: false },
  { chave: "dep-estadual", rotulo: "Deputado estadual", nome: "Deputado estadual", municipal: false },
  { chave: "senador", rotulo: "Senador", nome: "Senador", municipal: false },
  { chave: "governador", rotulo: "Governador", nome: "Governador", municipal: false },
  { chave: "vereador", rotulo: "Vereador", nome: "Vereador", municipal: true },
  { chave: "prefeito", rotulo: "Prefeito", nome: "Prefeito", municipal: true },
];
/** Cargos com um ou dois candidatos fortes por lugar: a geografia de quem é forte pesa mais que o partido ou a idade. */
export const CARGO_PADRAO: ChaveCargo = "dep-federal";
export const MAJORITARIOS = new Set(["Presidente", "Senador", "Governador", "Prefeito"]);

/** O nome do cargo (como no banco) que a escolha mede naquele ano; null se o cargo não foi disputado nele. */
export function cargoNoAno(chave: ChaveCargo, ano: number): string | null {
  const c = CARGOS_VIES.find((x) => x.chave === chave)!;
  return c.municipal === ehMunicipal(ano) ? c.nome! : null;
}
/** O cargo de "outro ciclo" que corresponde ao escolhido, para trocar de ano sem perder a escolha: deputado ↔ vereador,
 *  presidente, senador e governador ↔ prefeito. Se o cargo existe no ano, fica ele mesmo. */
export function cargoEquivalente(chave: ChaveCargo, ano: number): ChaveCargo {
  if (cargoNoAno(chave, ano)) return chave;
  const par: Record<ChaveCargo, ChaveCargo> = {
    presidente: "prefeito", "dep-federal": "vereador", "dep-estadual": "vereador", senador: "prefeito", governador: "prefeito", vereador: "dep-federal", prefeito: "governador",
  };
  return par[chave];
}
/** Os cargos que podem ser escolhidos no ano. */
export const cargosDoAno = (ano: number) => CARGOS_VIES.filter((c) => cargoNoAno(c.chave, ano) !== null);

export type Sub = "idade" | "vies";
export type ChaveMedida = "media" | "jovens" | "idosos";
export const MEDIDAS_IDADE: { chave: ChaveMedida; rotulo: string; curto: string }[] = [
  { chave: "media", rotulo: "Idade média", curto: "idade média" },
  { chave: "jovens", rotulo: "De 16 a 29 anos", curto: "parte de 16 a 29 anos" },
  { chave: "idosos", rotulo: "60 anos ou mais", curto: "parte de 60 anos ou mais" },
];
export type Fonte = "eleitorado" | "censo";
/** O Censo 2022 vale para a eleição dele e as municipais em volta, como no resto do mapa. */
export const ANOS_CENSO_IDADE = [2020, 2022, 2024];
/** O que vai no eixo vertical da dispersão de Comparar › Idade. */
export type Eixo = "votados" | "vies";

export interface EscolhaVies { sub: Sub; ano: number; cargo: ChaveCargo; med: ChaveMedida; fonte: Fonte; eixo: Eixo }
type SP = Record<string, string | string[] | undefined>;
const um = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);

/** Lê e valida a escolha da URL; um cargo que não houve no ano vira o equivalente do ciclo, o Censo fora de 2020–2024 volta ao eleitorado. */
export function escolhaVies(sp: SP): EscolhaVies {
  const sub: Sub = um(sp.ver) === "idade" ? "idade" : "vies";
  const pedido = Number(um(sp.ano));
  const ano = (ANOS_VIES as readonly number[]).includes(pedido) ? pedido : 2022;
  const cargo = cargoEquivalente(CARGOS_VIES.find((x) => x.chave === um(sp.cargo))?.chave ?? CARGO_PADRAO, ano);
  const med = MEDIDAS_IDADE.find((m) => m.chave === um(sp.med))?.chave ?? "media";
  const fonte: Fonte = um(sp.fonte) === "censo" && ANOS_CENSO_IDADE.includes(ano) ? "censo" : "eleitorado";
  const eixo: Eixo = um(sp.eixo) === "vies" ? "vies" : "votados";
  return { sub, ano, cargo, med, fonte, eixo };
}

/** Parâmetros da URL (sem os padrões), na ordem: ver, ano, uf, mun, cargo, med, fonte, eixo. O cargo e o Censo são
 *  ajustados ao ano (trocar de ano não leva a uma combinação que não existe). */
export function paramsVies(escolha: EscolhaVies, lugar: { uf?: string; mun?: string }): URLSearchParams {
  const e = { ...escolha, cargo: cargoEquivalente(escolha.cargo, escolha.ano), fonte: ANOS_CENSO_IDADE.includes(escolha.ano) ? escolha.fonte : "eleitorado" };
  const p = new URLSearchParams({ ver: e.sub });
  if (e.ano !== 2022) p.set("ano", String(e.ano));
  if (lugar.uf) p.set("uf", lugar.uf);
  if (lugar.uf && lugar.mun) p.set("mun", lugar.mun);
  if (e.cargo !== cargoEquivalente(CARGO_PADRAO, e.ano)) p.set("cargo", e.cargo);   // o padrão do ano: deputado federal ou vereador
  if (e.sub === "idade") {
    if (e.med !== "media") p.set("med", e.med);
    if (e.fonte !== "eleitorado") p.set("fonte", e.fonte);
    if (e.eixo !== "votados") p.set("eixo", e.eixo);
  }
  return p;
}

const noLugar = (l: { uf: string; cod_ibge: string }, lugar: Lugar) => (!lugar.uf || l.uf === lugar.uf) && (!lugar.ibge || l.cod_ibge === lugar.ibge);

/** Viés do lugar: a média dos scores ponderada pelos votos em partidos com score; cobertura = parte dos votos com score. */
export function medirVies(linhas: LinhaVies[], ano: number, cargo: string, lugar: Lugar = {}): { score: number | null; votos: number; cobertura: number | null } {
  let votos = 0, comScore = 0, soma = 0;
  for (const l of linhas) {
    if (l.ano !== ano || l.cargo !== cargo || !noLugar(l, lugar)) continue;
    votos += Number(l.votos); comScore += Number(l.votos_score ?? 0); soma += Number(l.soma_score ?? 0);
  }
  return { score: comScore > 0 ? soma / comScore : null, votos, cobertura: votos > 0 ? comScore / votos : null };
}

/** Viés de cada município (cod_ibge → score) no ano e cargo. */
export function viesPorMunicipio(linhas: LinhaVies[], ano: number, cargo: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of linhas) if (l.ano === ano && l.cargo === cargo && Number(l.votos_score) > 0) m.set(l.cod_ibge, Number(l.soma_score) / Number(l.votos_score));
  return m;
}

/** Linha do tempo do viés do lugar: um ponto por eleição em que o cargo escolhido foi disputado. */
export function serieVies(linhas: LinhaVies[], chave: ChaveCargo, lugar: Lugar = {}): { ano: number; cargo: string; score: number }[] {
  return ANOS_VIES.flatMap((ano) => {
    const cargo = cargoNoAno(chave, ano);
    const s = cargo ? medirVies(linhas, ano, cargo, lugar).score : null;
    return cargo && s !== null ? [{ ano, cargo, score: s }] : [];
  });
}

/** A medida de idade a partir das somas: idade média, ou a parte de jovens ou de idosos. */
function daSoma(total: number, somaIdade: number, jovens: number, idosos: number, med: ChaveMedida): number | null {
  if (total <= 0) return null;
  return med === "media" ? somaIdade / total : med === "jovens" ? jovens / total : idosos / total;
}

/** Idade do lugar: do eleitorado do TSE no ano, ou da população de 16 anos ou mais no Censo 2022. */
export function medirIdade(fonte: Fonte, dados: { eleitorado: LinhaEleitorado[]; populacao: LinhaPopulacao[] }, ano: number, med: ChaveMedida, lugar: Lugar = {}): number | null {
  let total = 0, soma = 0, jovens = 0, idosos = 0;
  if (fonte === "eleitorado") {
    for (const l of dados.eleitorado) if (l.ano === ano && noLugar(l, lugar)) { total += Number(l.eleitores); soma += Number(l.soma_idade); jovens += Number(l.jovens); idosos += Number(l.idosos); }
  } else {
    for (const l of dados.populacao) if (noLugar(l, lugar)) { total += Number(l.pessoas); soma += Number(l.soma_idade); jovens += Number(l.jovens); idosos += Number(l.idosos); }
  }
  return daSoma(total, soma, jovens, idosos, med);
}

/** A medida de idade de cada município (cod_ibge → valor). */
export function idadePorMunicipio(fonte: Fonte, dados: { eleitorado: LinhaEleitorado[]; populacao: LinhaPopulacao[] }, ano: number, med: ChaveMedida): Map<string, number> {
  const m = new Map<string, number>();
  const linhas = fonte === "eleitorado"
    ? dados.eleitorado.filter((l) => l.ano === ano).map((l) => ({ cod: l.cod_ibge, t: Number(l.eleitores), s: Number(l.soma_idade), j: Number(l.jovens), i: Number(l.idosos) }))
    : dados.populacao.map((l) => ({ cod: l.cod_ibge, t: Number(l.pessoas), s: Number(l.soma_idade), j: Number(l.jovens), i: Number(l.idosos) }));
  for (const l of linhas) { const v = daSoma(l.t, l.s, l.j, l.i, med); if (v !== null) m.set(l.cod, v); }
  return m;
}

/** Idade dos candidatos votados no lugar: a média ponderada pelos votos e a parte dos votos em quem tinha até 29 anos. */
export function medirVotados(linhas: LinhaVotados[], ano: number, cargo: string, lugar: Lugar = {}): { idade: number | null; jovem: number | null; votos: number } {
  let votos = 0, comIdade = 0, soma = 0, jovem = 0;
  for (const l of linhas) {
    if (l.ano !== ano || l.cargo !== cargo || !noLugar(l, lugar)) continue;
    votos += Number(l.votos); comIdade += Number(l.votos_idade ?? 0); soma += Number(l.soma_idade ?? 0); jovem += Number(l.votos_jovem);
  }
  return { idade: comIdade > 0 ? soma / comIdade : null, jovem: votos > 0 ? jovem / votos : null, votos };
}

/** Idade média dos votados em cada município (cod_ibge → anos). */
export function votadosPorMunicipio(linhas: LinhaVotados[], ano: number, cargo: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of linhas) if (l.ano === ano && l.cargo === cargo && Number(l.votos_idade) > 0) m.set(l.cod_ibge, Number(l.soma_idade) / Number(l.votos_idade));
  return m;
}

/** Pares (x, y) dos municípios que têm os dois valores, para a dispersão; `on` marca o escolhido. */
export function parear(xs: Map<string, number>, ys: Map<string, number>, cods: string[], escolhido?: string): { id: number; x: number; y: number; on: boolean }[] {
  return cods.flatMap((c) => {
    const x = xs.get(c), y = ys.get(c);
    return x === undefined || y === undefined ? [] : [{ id: Number(c), x, y, on: c === escolhido }];
  });
}

/**
 * Cores do mapa do viés: nove degraus fixos (iguais em todos os anos e cargos, para a linha do tempo comparar), do
 * vermelho (esquerda) ao azul (direita), com o centro neutro entre −5 e +5. Os cortes são mais finos perto do centro,
 * onde fica quase todo município: a média ponderada de muitos partidos puxa para o meio.
 */
export const CORTES_VIES = [-45, -30, -15, -5, 5, 15, 30, 45];
export const classeMapaVies = (score: number | null | undefined) => (score == null ? "sem" : `dv${CORTES_VIES.filter((c) => score >= c).length}`);
/** Rótulos dos nove degraus, para a legenda: "−45 ou menos", "−45 a −30", …, "+45 ou mais". */
export function rotulosVies(): string[] {
  const f = (v: number) => fmtVies(v, 0);
  return [`${f(CORTES_VIES[0])} ou menos`, ...CORTES_VIES.slice(0, -1).map((c, i) => `${f(c)} a ${f(CORTES_VIES[i + 1])}`), `${f(CORTES_VIES[CORTES_VIES.length - 1])} ou mais`];
}
/** Posição do score na régua da dica (0 = −100, 1 = +100), dentro dos nove degraus de largura igual. */
export function naReguaVies(score: number): number {
  const i = CORTES_VIES.filter((c) => score >= c).length;
  const de = i === 0 ? -100 : CORTES_VIES[i - 1], ate = i === CORTES_VIES.length ? 100 : CORTES_VIES[i];
  return (i + Math.min(1, Math.max(0, (score - de) / (ate - de)))) / (CORTES_VIES.length + 1);
}
/** "+18,4 · Centro", com a faixa do Legislativo (cortes em ±20 e ±60). */
export const textoVies = (score: number | null) => (score === null ? "sem dado" : `${fmtVies(score)} · ${ROTULO_FAIXA[faixaVies(score)]}`);

/** Formata a medida de idade: "42,3 anos" ou "24%". */
export function fmtIdade(v: number | null, med: ChaveMedida): string {
  if (v === null) return "—";
  return med === "media" ? `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} anos` : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

/** A correlação em palavras, como a da abstenção: força por |r|, sentido pelo sinal. */
export function lerRelacao(r: number, x: string, y: string): string {
  const f = Math.abs(r);
  if (f < 0.1) return `Quase nenhuma relação entre ${x} e ${y}`;
  const forca = f < 0.3 ? "fraca" : f < 0.5 ? "moderada" : "forte";
  return `Relação ${forca}: onde ${x} é maior, ${y} tende a ser ${r > 0 ? "maior" : "menor"}`;
}

/** Variação do viés entre o primeiro e o último ponto da série (um cargo só), em palavras: "foi 6,2 pontos para a direita". */
export function lerSerie(serie: { ano: number; score: number }[]): string | null {
  if (serie.length < 2) return null;
  const a = serie[0], b = serie[serie.length - 1], d = b.score - a.score;
  const fim = `(${fmtVies(a.score)} → ${fmtVies(b.score)})`;
  if (Math.abs(d) < 1) return `De ${a.ano} a ${b.ano}, o viés ficou praticamente igual ${fim}.`;
  return `De ${a.ano} a ${b.ano}, o viés foi ${Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pontos para a ${d > 0 ? "direita" : "esquerda"} ${fim}.`;
}

// Visão geral da pergunta 9 ("Onde os candidatos investem em propaganda?"): a aba Propaganda da área "Dinheiro nas
// eleições" (/analises/dinheiro?aba=propaganda), sem React. Os dados vêm da tabela "geral" de GET /api/analises/q9 (média
// das parcelas, parte das campanhas que gastou em cada tipo e soma, por ano + cargo + UF ou todos os estados) e das peças
// de GET /api/propaganda/pecas. O detalhe de cada campanha, com a mediana do grupo, fica no perfil (src/lib/propaganda.ts).

import { ORDEM_CARGOS } from "./financiamento";
import { inteiro, reais } from "./format";
import { GRUPOS, tipoComum, type TipoComposto } from "./propaganda";

/** Linha da tabela "geral" da q9. uf nulo = todos os estados (presidente só aparece assim). */
export interface LinhaGeral {
  ano: number; id_cargo: number; cargo: string; uf: string | null; grupo: string; campanhas: number;
  /** Média da parcela do tipo (0 a 1): cada campanha conta igual; os três tipos somam 1. */ media: number;
  /** Parte das campanhas que gastou algo no tipo (0 a 1). */ parte_com_gasto: number;
  soma_centavos: number;
  /** Total de TODAS as despesas das campanhas do recorte (o mesmo nas três linhas); ausente numa API anterior a ele. */
  despesas_centavos?: number | null;
}

/** Os três tipos, sempre nesta ordem nas barras. */
export const TIPOS = Object.keys(GRUPOS);
/** Abaixo disso, o cargo some da comparação; abaixo de POUCAS_CAMPANHAS, aparece com o número de campanhas. */
export const MIN_CAMPANHAS = 3;
export const POUCAS_CAMPANHAS = 30;

/** Parte de um tipo na campanha média: a média, o "de cada R$ 100" (soma 100), a parte que usou e a soma em centavos. */
export interface ParteTipo { grupo: string; media: number; de100: number; usaram: number; somaCentavos: number }
/** A campanha média de um cargo num recorte (ano + UF, ou todos os estados). */
export interface Composicao {
  ano: number; cargo: string; uf: string | null; campanhas: number; somaCentavos: number;
  /** Total de todas as despesas das campanhas (null sem o dado). */ despesasCentavos: number | null; partes: ParteTipo[];
}

/** Divide 100 entre as médias (maior resto): as partes de uma barra somam exatamente 100. */
function de100(valores: number[]): number[] {
  const total = valores.reduce((a, b) => a + b, 0);
  if (total <= 0) return valores.map(() => 0);
  const brutos = valores.map((v) => (v / total) * 100), inteiros = brutos.map(Math.floor);
  let falta = 100 - inteiros.reduce((a, b) => a + b, 0);
  for (const [, i] of brutos.map((b, i) => [b - Math.floor(b), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1])) {
    if (falta-- <= 0) break;
    inteiros[i] += 1;
  }
  return inteiros;
}

/** A campanha média de um cargo num ano, numa UF ou em todos os estados (uf null). null se não houver linha. */
export function composicao(linhas: LinhaGeral[], ano: number, cargo: string, uf: string | null): Composicao | null {
  const sel = linhas.filter((l) => l.ano === ano && l.cargo === cargo && (l.uf ?? null) === uf);
  if (!sel.length) return null;
  const linha = (g: string) => sel.find((l) => l.grupo === g);
  const medias = TIPOS.map((g) => linha(g)?.media ?? 0);
  const d = de100(medias);
  const partes = TIPOS.map((g, i) => ({ grupo: g, media: medias[i], de100: d[i], usaram: linha(g)?.parte_com_gasto ?? 0, somaCentavos: linha(g)?.soma_centavos ?? 0 }));
  const despesas = sel[0].despesas_centavos;
  return { ano, cargo, uf, campanhas: sel[0].campanhas, somaCentavos: partes.reduce((s, p) => s + p.somaCentavos, 0),
    despesasCentavos: typeof despesas === "number" && despesas > 0 ? despesas : null, partes };
}

/**
 * Uma composição por cargo da eleição, do mais alto ao mais baixo, só os que têm pelo menos MIN_CAMPANHAS campanhas. Com
 * UF escolhida, o presidente entra com a campanha nacional (não há recorte por UF para ele).
 */
export function composicaoPorCargo(linhas: LinhaGeral[], ano: number, uf: string | null): Composicao[] {
  const cargos = [...new Set(linhas.filter((l) => l.ano === ano).map((l) => l.cargo))]
    .sort((a, b) => (ORDEM_CARGOS.indexOf(a) + 1 || 99) - (ORDEM_CARGOS.indexOf(b) + 1 || 99) || a.localeCompare(b));
  return cargos.map((c) => composicao(linhas, ano, c, c === "Presidente" ? null : uf))
    .filter((c): c is Composicao => c !== null && c.campanhas >= MIN_CAMPANHAS);
}

const pct = (p: number) => (p > 0 && p < 0.005 ? "menos de 1%" : `${Math.round(p * 100)}%`);

/** Uma linha do gráfico "uma linha por tipo": a média e quantas campanhas usaram o tipo. */
export interface LinhaTipo { grupo: string; rotulo: string; media: number; pct: string; usaram: string }

/** As linhas por tipo da campanha média: tipos com média acima de zero, da maior para a menor (empate: a ordem de TIPOS). */
export function linhasPorTipo(c: Composicao): LinhaTipo[] {
  return c.partes.filter((p) => p.media > 0).sort((a, b) => b.media - a.media || TIPOS.indexOf(a.grupo) - TIPOS.indexOf(b.grupo))
    .map((p) => ({ grupo: p.grupo, rotulo: tipoComum(p.grupo).legenda, media: p.media, pct: p.de100 > 0 ? `${p.de100}%` : pct(p.media), usaram: pct(p.usaram) }));
}

/** Os dois números da resposta, na cor do tipo de maior média: a soma contratada e a parte da propaganda no gasto todo. */
export interface NumerosResposta { total: string; rotuloTotal: string; parte: string | null; grupo: string | null }

/**
 * "R$ 150 milhões" contratados em propaganda pelas N campanhas, e "74%" de tudo que essas campanhas gastaram (abaixo de 1%,
 * "menos de 1%"; sem o total de despesas, null e o número não aparece).
 */
export function numerosResposta(c: Composicao): NumerosResposta {
  return {
    total: reais(c.somaCentavos / 100), rotuloTotal: `contratados em propaganda pelas ${inteiro(c.campanhas)} campanhas`,
    parte: c.despesasCentavos && c.somaCentavos > 0 ? pct(c.somaCentavos / c.despesasCentavos) : null,
    grupo: linhasPorTipo(c)[0]?.grupo ?? null,
  };
}

/** " nos seis estados", " em Minas Gerais"; presidente: " (campanha nacional)". */
export function alcance(cargo: string, nomeUf: string | null): string {
  return cargo === "Presidente" ? " (campanha nacional)" : nomeUf ? ` em ${nomeUf}` : " nos seis estados";
}

/** Texto para leitor de tela das linhas por tipo. */
export function descricaoLinhas(c: Composicao, nomeUf: string | null): string {
  return `Campanha média a ${c.cargo.toLowerCase()}${alcance(c.cargo, nomeUf)} em ${c.ano}: `
    + linhasPorTipo(c).map((l) => `${l.rotulo.toLowerCase()} ${l.pct} (${l.usaram} das campanhas usaram)`).join("; ") + ".";
}

/**
 * Os tipos para a manchete pelas peças (manchetePecas, de src/lib/propaganda.ts): o valor de cada tipo é a soma do
 * recorte, que é o que as peças somam.
 */
export function tiposDaManchete(c: Composicao): TipoComposto[] {
  const total = c.somaCentavos;
  return c.partes.map((p) => ({ grupo: p.grupo, centavos: p.somaCentavos, lancamentos: 0, categorias: p.somaCentavos > 0 ? 1 : 0, de100: p.de100,
    parte: total > 0 ? p.somaCentavos / total : 0 }));
}

/** "a vereador" (na frase: "na campanha média a vereador"). */
const aCargo = (c: string) => `a ${c.toLowerCase()}`;

/** A eleição anterior do mesmo tipo (2022 → 2018, 2024 → 2020), se houver dados dela. */
export function anoAnterior(linhas: LinhaGeral[], ano: number): number | null {
  return linhas.some((l) => l.ano === ano - 4) ? ano - 4 : null;
}

/** O tipo como sujeito de frase, com o verbo concordando ("rádio, TV e vídeo" é plural). */
const COMO_SUJEITO: Record<string, { nome: string; subiu: string; caiu: string }> = {
  propaganda_fisica: { nome: "o material impresso e de rua", subiu: "subiu", caiu: "caiu" },
  propaganda_audiovisual: { nome: "rádio, TV e vídeo", subiu: "subiram", caiu: "caíram" },
  propaganda_digital: { nome: "a internet", subiu: "subiu", caiu: "caiu" },
};

/**
 * O tipo que mais mudou entre duas eleições do mesmo cargo: "De 2020 para 2024, a internet subiu de R$ 3 para R$ 7 de
 * cada R$ 100 na campanha média a vereador." null sem mudança.
 */
export function fraseMudanca(antes: Composicao, depois: Composicao): string | null {
  const m = TIPOS.map((g, i) => ({ g, a: antes.partes[i].de100, d: depois.partes[i].de100 }))
    .reduce((x, y) => (Math.abs(y.d - y.a) > Math.abs(x.d - x.a) ? y : x));
  if (m.a === m.d) return null;
  const s = COMO_SUJEITO[m.g];
  return `De ${antes.ano} para ${depois.ano}, ${s.nome} ${m.d > m.a ? s.subiu : s.caiu} de R$ ${m.a} para R$ ${m.d} de cada R$ 100 `
    + `na campanha média ${aCargo(depois.cargo)}.`;
}

/** "53.019 campanhas" ao lado do nome, só quando o grupo é pequeno (menos de POUCAS_CAMPANHAS). */
export const detalheCampanhas = (c: Composicao) => (c.campanhas < POUCAS_CAMPANHAS ? `${inteiro(c.campanhas)} campanhas` : undefined);

// ---------------------------------------------------------------------------------------------------------------------
// "Como cada cargo dividiu a propaganda": uma linha por tipo, pelos cargos em ordem de alcance
// ---------------------------------------------------------------------------------------------------------------------

/** Cargos do menor alcance para o maior (o eixo horizontal do gráfico). */
export const ORDEM_ALCANCE = ["Vereador", "Prefeito", "Deputado estadual", "Deputado federal", "Deputado distrital", "Senador", "Governador", "Presidente"];

/**
 * Os cargos do eixo: os da eleição, em ordem de alcance, só os com pelo menos MIN_CAMPANHAS campanhas no recorte. Com UF
 * escolhida, o presidente entra com a campanha nacional.
 */
export function cargosNoEixo(linhas: LinhaGeral[], ano: number, uf: string | null): Composicao[] {
  const pos = (c: string) => (ORDEM_ALCANCE.indexOf(c) + 1 || 99);
  const cargos = [...new Set(linhas.filter((l) => l.ano === ano).map((l) => l.cargo))].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b));
  return cargos.map((c) => composicao(linhas, ano, c, c === "Presidente" ? null : uf))
    .filter((c): c is Composicao => c !== null && c.campanhas >= MIN_CAMPANHAS);
}

/** Nome curto de cada tipo no título do gráfico. */
const NO_TITULO: Record<string, string> = { propaganda_fisica: "material impresso", propaganda_audiovisual: "rádio, TV e vídeo", propaganda_digital: "internet" };
/** Mudança mínima (pontos percentuais) entre o primeiro e o último cargo para o título dizer a tendência. */
export const MUDANCA_TITULO = 10;
export const TITULO_NEUTRO = "Como cada cargo dividiu a propaganda";

/**
 * O título do gráfico: do primeiro cargo do eixo para o último, o tipo que mais subiu e o que mais desceu. Se os dois
 * mudaram MUDANCA_TITULO pontos ou mais: "Quanto maior o cargo, menos material impresso e mais rádio, TV e vídeo"
 * (eleição geral) ou "Prefeitos põem mais em rádio, TV e vídeo e menos em material impresso que vereadores" (municipal).
 * Senão, o título neutro.
 */
export function tituloCargos(cargos: Composicao[]): string {
  if (cargos.length < 2) return TITULO_NEUTRO;
  const [a, b] = [cargos[0], cargos[cargos.length - 1]];
  const dif = TIPOS.map((g, i) => ({ g, d: Math.round((b.partes[i].media - a.partes[i].media) * 100) }));
  const subiu = dif.reduce((x, y) => (y.d > x.d ? y : x)), desceu = dif.reduce((x, y) => (y.d < x.d ? y : x));
  if (subiu.d < MUDANCA_TITULO || desceu.d > -MUDANCA_TITULO) return TITULO_NEUTRO;
  return a.ano % 4 === 0
    ? `Prefeitos põem mais em ${NO_TITULO[subiu.g]} e menos em ${NO_TITULO[desceu.g]} que vereadores`
    : `Quanto maior o cargo, menos ${NO_TITULO[desceu.g]} e mais ${NO_TITULO[subiu.g]}`;
}

/** Geometria do gráfico (unidades do viewBox do SVG; o SVG escala com a largura). */
export const GRAFICO = { largura: 520, margemEsq: 160, margemDir: 56, topo: 16, alturaPlot: 170, altura: 250 };
const LINHA_TEXTO = 15;   // distância mínima entre dois rótulos empilhados (px do viewBox)

/** Espalha rótulos na vertical para que fiquem a pelo menos `gap` um do outro, sem passar de `max` (empurra para cima). */
export function espalhar(ys: number[], gap = LINHA_TEXTO, min = -Infinity, max = Infinity): number[] {
  const ordem = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const saida = [...ys];
  let ultimo = -Infinity;
  for (const [y, i] of ordem) { saida[i] = Math.max(y, ultimo + gap, min); ultimo = saida[i]; }
  const excesso = ultimo - max;
  if (excesso > 0) for (const [, i] of ordem) saida[i] -= excesso;
  return saida;
}

export interface SerieGrafico { grupo: string; rotulo: string; tracejada: boolean; pontos: { x: number; y: number; valor: number }[]; rotuloY: number }
export interface ColunaGrafico { cargo: string; x: number; nome: string[]; detalhe?: string; atual: boolean }
export interface GraficoCargos {
  colunas: ColunaGrafico[]; series: SerieGrafico[];
  /** Faixa de fundo do cargo escolhido (null se ele não está no eixo). */ faixa: { x: number; largura: number } | null;
  /** Os percentuais escritos ao lado dos pontos do cargo escolhido. */ valores: { grupo: string; x: number; y: number; texto: string }[];
  y0: number; y50: number; y100: number;
}

/**
 * O gráfico de linhas pelos cargos: x = a coluna do cargo, y = a média da parcela de cada tipo (0% embaixo, 100% em cima).
 * Uma série por tipo (internet tracejada), menos os tipos com média 0 em todos os cargos; o nome do tipo vai junto do
 * primeiro ponto. Nomes compostos dos cargos em duas linhas ("Deputado" / "estadual").
 */
export function graficoCargos(cargos: Composicao[], cargoAtual: string): GraficoCargos {
  const { largura, margemEsq, margemDir, topo, alturaPlot } = GRAFICO;
  const n = cargos.length;
  const passo = n > 1 ? (largura - margemEsq - margemDir) / (n - 1) : 0;
  const xDe = (i: number) => (n > 1 ? margemEsq + i * passo : (margemEsq + largura - margemDir) / 2);
  const yDe = (v: number) => topo + (1 - Math.min(Math.max(v, 0), 1)) * alturaPlot;
  const colunas = cargos.map((c, i) => ({
    cargo: c.cargo, x: xDe(i), nome: c.cargo.startsWith("Deputado ") ? ["Deputado", c.cargo.slice(9)] : [c.cargo],
    detalhe: detalheCampanhas(c), atual: c.cargo === cargoAtual,
  }));
  const tipos = TIPOS.map((g, i) => ({ g, i })).filter(({ i }) => cargos.some((c) => c.partes[i].media > 0));
  const primeiros = espalhar(tipos.map(({ i }) => yDe(cargos[0]?.partes[i].media ?? 0)), LINHA_TEXTO, topo, topo + alturaPlot);
  const series = tipos.map(({ g, i }, k) => ({
    grupo: g, rotulo: tipoComum(g).legenda, tracejada: g === "propaganda_digital", rotuloY: primeiros[k],
    pontos: cargos.map((c, j) => ({ x: xDe(j), y: yDe(c.partes[i].media), valor: c.partes[i].media })),
  }));
  const ia = cargos.findIndex((c) => c.cargo === cargoAtual);
  const largFaixa = Math.min(n > 1 ? passo * 0.8 : 80, 90);
  const ysAtual = ia < 0 ? [] : espalhar(tipos.map(({ i }) => yDe(cargos[ia].partes[i].media)), LINHA_TEXTO, topo, topo + alturaPlot);
  return {
    colunas, series, faixa: ia < 0 ? null : { x: xDe(ia) - largFaixa / 2, largura: largFaixa },
    valores: ia < 0 ? [] : tipos.map(({ g, i }, k) => ({ grupo: g, x: xDe(ia) + 9, y: ysAtual[k], texto: `${cargos[ia].partes[i].de100}%` })),
    y0: yDe(0), y50: yDe(0.5), y100: yDe(1),
  };
}

/** Texto para leitor de tela do gráfico: por tipo, a média de cada cargo na ordem do eixo. */
export function descricaoGrafico(cargos: Composicao[], ano: number, onde: string): string {
  const tipos = TIPOS.map((g, i) => ({ g, i })).filter(({ i }) => cargos.some((c) => c.partes[i].media > 0));
  return `Campanha média de cada cargo em ${ano}${onde}, de ${cargos[0]?.cargo.toLowerCase()} a ${cargos.at(-1)?.cargo.toLowerCase()}. `
    + tipos.map(({ g, i }) => `${tipoComum(g).legenda}: ${cargos.map((c) => `${c.cargo.toLowerCase()} ${c.partes[i].de100}%`).join(", ")}`).join("; ") + ".";
}

// ---------------------------------------------------------------------------------------------------------------------
// "Como mudou": uma seta por tipo, da eleição anterior do mesmo tipo para a escolhida
// ---------------------------------------------------------------------------------------------------------------------

export interface Seta {
  grupo: string; rotulo: string;
  /** Posições na trilha (0 a 1): a média antes e depois. */ de: number; para: number;
  /** Os valores escritos ("63%") e a diferença em pontos (inteiros, os mesmos dos valores). */ textoDe: string; textoPara: string; pontos: number;
  direcao: "sobe" | "desce" | "igual"; diferenca: string;
}

const pontosTexto = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? "ponto" : "pontos"}`;

/**
 * Uma seta por tipo, da eleição anterior para a escolhida, na ordem das linhas por tipo da eleição escolhida; tipos com 0%
 * nos dois anos ficam de fora. Mudança de menos de 1 ponto (os mesmos percentuais inteiros na tela): "sem mudança", só o
 * círculo. A diferença: "+12 pontos" / "−21 pontos".
 */
export function setasMudanca(antes: Composicao, depois: Composicao): Seta[] {
  const ordem = linhasPorTipo(depois).map((l) => l.grupo);
  return TIPOS.map((g, i) => ({ g, a: antes.partes[i], b: depois.partes[i] }))
    .filter(({ a, b }) => a.media > 0 || b.media > 0)
    .sort((x, y) => (ordem.indexOf(x.g) + 1 || 99) - (ordem.indexOf(y.g) + 1 || 99) || TIPOS.indexOf(x.g) - TIPOS.indexOf(y.g))
    .map(({ g, a, b }) => {
      const pontos = b.de100 - a.de100;
      const direcao: Seta["direcao"] = pontos > 0 ? "sobe" : pontos < 0 ? "desce" : "igual";
      return { grupo: g, rotulo: tipoComum(g).legenda, de: a.media, para: b.media, textoDe: `${a.de100}%`, textoPara: `${b.de100}%`, pontos, direcao,
        diferenca: direcao === "igual" ? "sem mudança" : `${pontos > 0 ? "+" : "−"}${pontosTexto(pontos)}` };
    });
}

/**
 * Onde ficam os dois valores escritos acima da seta (translateX, em % da largura do texto): o do ano anterior do lado de
 * fora do círculo e o do ano escolhido do lado de fora da ponta, para não se sobreporem. Sem mudança: um valor só, centrado.
 */
export function ancorasSeta(direcao: Seta["direcao"]): { de: string; para: string | null } {
  if (direcao === "igual") return { de: "translateX(-50%)", para: null };
  return direcao === "sobe"
    ? { de: "translateX(calc(-100% - 8px))", para: "translateX(4px)" }
    : { de: "translateX(8px)", para: "translateX(calc(-100% - 4px))" };
}

/** Texto para leitor de tela das setas: "rádio, TV e vídeo de 63% para 42%, menos 21 pontos; …". */
export function descricaoSetas(setas: Seta[], anoAntes: number, ano: number): string {
  return `Campanha média de ${anoAntes} para ${ano}: ` + setas.map((s) => `${tipoComum(s.grupo).frase} de ${s.textoDe} para ${s.textoPara}, `
    + (s.direcao === "igual" ? "sem mudança" : `${s.direcao === "sobe" ? "mais" : "menos"} ${pontosTexto(s.pontos)}`)).join("; ") + ".";
}

// ---------------------------------------------------------------------------------------------------------------------
// Filtros da aba: o recorte da área (lerRecorte, src/lib/dinheiro.ts) com o que muda na propaganda
// ---------------------------------------------------------------------------------------------------------------------

export const ABA_PROPAGANDA = "propaganda";

/**
 * O recorte da aba Propaganda a partir do recorte da área: numa eleição geral, "Presidente" também vale (a área não tem
 * esse cargo); com presidente, a UF é ignorada (campanha nacional). Município e porte não têm recorte próprio: os dados são
 * do estado inteiro. `avisos` explica o que foi ignorado.
 */
export function recortePropaganda(r: { ano: number; cargo: string; uf?: string; mun?: { nome: string }; munIgnorado?: boolean }, pedido: {
  cargo?: string; porte?: string; nomeUf?: (uf: string) => string;
}): { ano: number; cargo: string; uf: string | null; avisos: string[] } {
  const geral = r.ano % 4 === 2;
  const cargo = geral && pedido.cargo === "Presidente" ? "Presidente" : r.cargo;
  const uf = cargo === "Presidente" ? null : r.uf ?? null;
  const nome = (u: string) => pedido.nomeUf?.(u) ?? u;
  const avisos: string[] = [];
  if (pedido.cargo && pedido.cargo !== cargo) avisos.push(`${pedido.cargo} não é eleito em ${r.ano}: mostrando ${cargo.toLowerCase()}.`);
  if (cargo === "Presidente" && r.uf) avisos.push(`A campanha a presidente é nacional: os números não são só de ${nome(r.uf)}.`);
  if (r.mun) avisos.push(`A propaganda não tem recorte por município: dados do estado inteiro${uf ? ` (${nome(uf)})` : ""}, não só de ${r.mun.nome}.`);
  else if (r.munIgnorado) avisos.push("A propaganda não tem recorte por município: dados do estado inteiro.");
  else if (pedido.porte) avisos.push("O porte da cidade não se aplica à propaganda: dados do estado inteiro.");
  return { ano: r.ano, cargo, uf, avisos };
}

/** Cargos do filtro na aba Propaganda: os da área e, numa eleição geral, também presidente (primeiro). */
export const cargosPropaganda = (ano: number, cargosDaArea: string[]) => (ano % 4 === 2 ? ["Presidente", ...cargosDaArea] : cargosDaArea);

/**
 * Endereço da área com ano, cargo e UF e a aba escolhida (null = a aba padrão, "Gasto por vaga"). Os outros filtros caem:
 * cada link preserva só o recorte comum às duas abas. A UF fica mesmo com presidente (ignorada só na conta, com aviso), para
 * não se perder ao trocar de cargo. Presidente não existe na aba padrão: lá o cargo cai para o padrão.
 */
export function hrefAba(f: { ano: number; cargo: string; uf: string | null }, aba: string | null, ancora?: string): string {
  const p = new URLSearchParams({ ano: String(f.ano) });
  if (!(aba === null && f.cargo === "Presidente")) p.set("cargo", f.cargo);
  if (f.uf) p.set("uf", f.uf);
  if (aba) p.set("aba", aba);
  return `/analises/dinheiro?${p}${ancora ? `#${ancora}` : ""}`;
}

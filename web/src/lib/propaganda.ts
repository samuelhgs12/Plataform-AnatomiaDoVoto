// Pergunta 9: onde a campanha investe em propaganda. Os dados vêm da API, uma candidatura por vez
// (GET /api/candidaturas/<id>/propaganda), e aparecem no perfil do candidato.
// Valores em centavos inteiros: somas e percentuais exatos. Valor = valor CONTRATADO, não o pago.

import { deCada100 } from "./financiamento";
import { inteiro, reais } from "./format";
import { LARGURA_LETRA, textoDetalhes, type TermoNuvem } from "./nuvem";
import type { CarreiraItem } from "./types";

/** Totais da candidatura: despesas consideradas (todas as categorias, sem transferências) e a parte de propaganda. */
export interface Totais { lancamentos: number; total_centavos: number; propaganda_centavos: number }
export interface Categoria { origem: string; grupo: string; lancamentos: number; centavos: number }
/**
 * Resposta de GET /api/candidaturas/<id>/propaganda. `termos` (nuvem de palavras) falta numa API anterior a ela, e pode
 * vir incompleto de outra versão: por isso Partial, completado por `normalizarTermo` (src/lib/nuvem.ts).
 */
export interface Propaganda extends Totais { id_candidatura: number; categorias: Categoria[]; termos?: Partial<TermoNuvem>[] }

export interface ResumoPropaganda {
  id: number; ano: number; cargo: string; eleito: boolean;
  /** null = sem resposta da API ou sem despesa registrada (não é gasto zero). */ propagandaCentavos: number | null;
  /** Propaganda ÷ despesas consideradas; null quando não há despesa com valor. */ parteDoTotal: number | null;
}

/** Uma linha por campanha (na ordem recebida) para comparar quanto cada uma contratou em propaganda. */
export function resumoPropaganda(campanhas: { c: CarreiraItem; p: Propaganda | null }[]): ResumoPropaganda[] {
  return campanhas.map(({ c, p }) => ({
    id: c.id_candidatura, ano: c.ano, cargo: c.cargo, eleito: c.eleito,
    propagandaCentavos: p && p.lancamentos > 0 ? p.propaganda_centavos : null,
    parteDoTotal: p && p.total_centavos > 0 ? p.propaganda_centavos / p.total_centavos : null,
  }));
}

/** Os três grupos de propaganda da classificação do projeto (categoria_despesa.grupo_classificacao). */
export const GRUPOS: Record<string, { rotulo: string; descricao: string; classe: string }> = {
  propaganda_fisica: { rotulo: "Propaganda física", descricao: "impressos, adesivos, jornais e carros de som", classe: "pp-fis" },
  propaganda_audiovisual: { rotulo: "Propaganda audiovisual", descricao: "rádio, TV, vídeo e jingles", classe: "pp-av" },
  propaganda_digital: { rotulo: "Propaganda digital", descricao: "impulsionamento e páginas na internet", classe: "pp-dig" },
};
const GRUPO_DESCONHECIDO = { rotulo: "Outra propaganda", descricao: "categoria sem grupo conhecido", classe: "pp-outra" };
export const grupo = (g: string) => GRUPOS[g] ?? { ...GRUPO_DESCONHECIDO, rotulo: g };
/** Classe de cor de uma palavra da nuvem: a do tipo de propaganda, ou neutra se ela não diz qual peça foi comprada. */
export const classeTermo = (t: { grupo: string; generico: boolean }) => (t.generico ? GRUPO_DESCONHECIDO.classe : grupo(t.grupo).classe);

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
export function analisar(c: Totais, categorias: Categoria[]): Analise {
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

// ---------------------------------------------------------------------------------------------------------------------
// Resposta da seção: manchete pelas PEÇAS (o que foi comprado, pela descrição), dois números (total de propaganda e
// parte nos gastos), a barra das peças agrupadas por tipo (totais oficiais das categorias do TSE) com a marca da
// campanha típica, e as tabelas recolhidas. As peças vêm de `termos` da API (api/app/nuvem.py), já normalizados.
// ---------------------------------------------------------------------------------------------------------------------

/** Tamanho do grupo da comparação com a típica (campanhas do mesmo cargo, ano e UF, a própria incluída). */
export const LIMIAR_GRUPO_PEQUENO = 30;        // abaixo disso, a frase diz de quantas campanhas sai a típica
export const LIMIAR_GRUPO_MINIMO = 3;          // abaixo disso, não há comparação (nem marca, nem frase)

/** Condições da seção (frações de 0 a 1 do total de propaganda, salvo MIN_PECAS_NUVEM). */
export const MIN_PECAS_NUVEM = 4;              // nuvem só com 4 ou mais peças específicas
export const LIMIAR_OUTRAS = 0.05;             // na barra, peças abaixo de 5% viram um segmento "outras" do seu tipo
export const LIMIAR_GENERICO_FRASE = 0.30;     // acima disso, a linha pequena diz quanto não diz a peça
export const LIMIAR_GENERICO_MANCHETE = 0.60;  // acima disso, a manchete fica pelo tipo dominante
export const LIMIAR_PADRAO_QUASE_TOTAL = 0.95; // típica e esta campanha com isso no mesmo tipo: "Como a maioria…"

/** Cada tipo em linguagem comum: na frase ("Nada em…", comparação) e no rótulo curto (chave da barra, tabelas). */
export const TIPO_COMUM: Record<string, { frase: string; em: string; legenda: string }> = {
  propaganda_fisica: { frase: "material impresso e de rua", em: "em material impresso e de rua", legenda: "Impresso e de rua" },
  propaganda_audiovisual: { frase: "rádio, TV e vídeo", em: "em rádio, TV e vídeo", legenda: "Rádio, TV e vídeo" },
  propaganda_digital: { frase: "internet", em: "na internet", legenda: "Internet" },
};
export const tipoComum = (g: string) => TIPO_COMUM[g] ?? { frase: g, em: `em ${g}`, legenda: g };

/** Nome do estado com a preposição certa, para as frases de comparação ("em Minas Gerais", "no Rio de Janeiro"). */
export const UF_COM_PREPOSICAO: Record<string, string> = {
  AC: "no Acre", AL: "em Alagoas", AP: "no Amapá", AM: "no Amazonas", BA: "na Bahia", CE: "no Ceará", DF: "no Distrito Federal",
  ES: "no Espírito Santo", GO: "em Goiás", MA: "no Maranhão", MT: "em Mato Grosso", MS: "em Mato Grosso do Sul", MG: "em Minas Gerais",
  PA: "no Pará", PB: "na Paraíba", PR: "no Paraná", PE: "em Pernambuco", PI: "no Piauí", RJ: "no Rio de Janeiro",
  RN: "no Rio Grande do Norte", RS: "no Rio Grande do Sul", RO: "em Rondônia", RR: "em Roraima", SC: "em Santa Catarina",
  SP: "em São Paulo", SE: "em Sergipe", TO: "no Tocantins",
};
/** " em Minas Gerais"; presidente (BR) ou sem UF: vazio. */
export const noEstado = (uf: string | null) => (!uf || uf === "BR" ? "" : ` ${UF_COM_PREPOSICAO[uf] ?? `em ${uf}`}`);

/** Forma por extenso de cada peça do dicionário (api/app/nuvem.py, PECA): plural, para a manchete e as tabelas. */
export const PECA_MANCHETE: Record<string, string> = {
  santinho: "santinhos", adesivo: "adesivos", "bóton": "bótons", bandeira: "bandeiras", panfleto: "panfletos",
  cartaz: "cartazes", carta: "cartas", jornal: "jornais", faixa: "faixas", impressos: "material impresso",
  camiseta: "camisetas", pirulito: "brindes", som: "carros de som", jingle: "jingles", "rádio/TV": "programas de rádio/TV",
  "vídeo": "vídeos", foto: "fotografia", Facebook: "anúncios no Facebook", Google: "anúncios no Google",
  redes: "redes sociais", site: "site", SMS: "mensagens de texto", "anúncios": "anúncios na internet",
  marketing: "marketing e criação",
};
export const pecaManchete = (p: string) => PECA_MANCHETE[p] ?? p;

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const juntar = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);
const r$ = (centavos: number) => reais(centavos / 100);
const ORDEM_TIPOS = Object.keys(GRUPOS);
/** Maior para o menor; empate pelo nome (a ordem não depende da resposta da API). */
const porValor = <T extends { centavos: number }>(nome: (x: T) => string) => (a: T, b: T) =>
  b.centavos - a.centavos || nome(a).localeCompare(nome(b), "pt-BR");
/** Percentual inteiro: "32%"; um valor que existe mas arredonda para zero: "menos de 1%". */
const pctInteiro = (p: number) => (p > 0 && Math.round(p * 100) < 1 ? "menos de 1%" : `${Math.round(p * 100)}%`);

/** Tipos com valor, do maior para o menor; empate: física, audiovisual, digital. */
export const tiposPorValor = (tipos: TipoComposto[]) => tipos.filter((t) => t.centavos > 0)
  .sort((a, b) => b.centavos - a.centavos || ORDEM_TIPOS.indexOf(a.grupo) - ORDEM_TIPOS.indexOf(b.grupo));

/** Tipo de maior valor oficial; empate: física, audiovisual, digital. */
export const tipoDominante = (tipos: TipoComposto[]): string | null => tiposPorValor(tipos)[0]?.grupo ?? null;

/** Valor das peças genéricas ("impressos", "marketing": não dizem qual peça foi comprada). */
export const centavosGenericos = (termos: TermoNuvem[]) => termos.filter((t) => t.generico).reduce((s, t) => s + Math.max(t.centavos, 0), 0);

/**
 * Peças da manchete: as específicas, da maior para a menor, até cobrir 80% do valor específico, no máximo 3.
 * Vazio se não houver peça específica.
 */
export function pecasDaManchete(termos: TermoNuvem[]): TermoNuvem[] {
  const esp = termos.filter((t) => !t.generico && t.centavos > 0).sort(porValor((t) => t.termo));
  const total = esp.reduce((s, t) => s + t.centavos, 0);
  const escolhidas: TermoNuvem[] = [];
  let acc = 0;
  for (const t of esp) {
    if (escolhidas.length >= 3 || (escolhidas.length && acc >= 0.8 * total)) break;
    escolhidas.push(t); acc += t.centavos;
  }
  return escolhidas;
}

/**
 * Manchete pelas peças: "Adesivos, panfletos e santinhos.". Se o genérico passar de LIMIAR_GENERICO_MANCHETE do total
 * de propaganda (ou não houver peça específica), vai pelo tipo dominante: "Material impresso e de rua, sem especificar a
 * peça.". null sem peças (API anterior à nuvem): a página usa a manchete antiga, pela categoria do TSE.
 */
export function manchetePecas(termos: TermoNuvem[], tipos: TipoComposto[], propagandaCentavos: number): string | null {
  if (!termos.length || propagandaCentavos <= 0) return null;
  const escolhidas = pecasDaManchete(termos);
  if (!escolhidas.length || centavosGenericos(termos) / propagandaCentavos > LIMIAR_GENERICO_MANCHETE) {
    const dom = tipoDominante(tipos);
    return dom ? `${maiuscula(tipoComum(dom).frase)}, sem especificar a peça.` : null;
  }
  return `${maiuscula(juntar(escolhidas.map((t) => pecaManchete(t.termo))))}.`;
}

/** Parcela da propaganda no total de despesas consideradas, inteira: "11%"; abaixo de 1%, "menos de 1%". null sem total. */
export function parteDosGastos(propagandaCentavos: number, totalCentavos: number): string | null {
  if (totalCentavos <= 0 || propagandaCentavos <= 0) return null;
  return pctInteiro(propagandaCentavos / totalCentavos);
}

/** Os dois números do topo: o total de propaganda ("R$ 444 mil") e a parte nos gastos ("11%", null sem total), na cor do tipo dominante. */
export interface NumerosDestaque { total: string; parte: string | null; grupo: string | null }
export const numerosDestaque = (tipos: TipoComposto[], propagandaCentavos: number, totalCentavos: number): NumerosDestaque =>
  ({ total: r$(propagandaCentavos), parte: parteDosGastos(propagandaCentavos, totalCentavos), grupo: tipoDominante(tipos) });

/**
 * Linha pequena abaixo dos números: os tipos sem nenhuma despesa, com "nem" a partir do segundo ("Nada em rádio, TV e
 * vídeo, nem na internet."), e, com genérico acima de LIMIAR_GENERICO_FRASE, "R$ X de cada R$ 100 não dizem a peça.".
 * null quando não há nada a dizer.
 */
export function linhaNada(tipos: TipoComposto[], propagandaCentavos: number, termos: TermoNuvem[]): string | null {
  const ausentes = tipos.filter((t) => t.centavos <= 0 && t.grupo in GRUPOS).map((t) => tipoComum(t.grupo).em);
  const partes: string[] = [];
  if (ausentes.length) partes.push(`Nada ${ausentes[0]}${ausentes.slice(1).map((a) => `, nem ${a}`).join("")}.`);
  const generico = centavosGenericos(termos);
  if (propagandaCentavos > 0 && generico / propagandaCentavos > LIMIAR_GENERICO_FRASE) {
    const [g] = deCada100([generico, Math.max(propagandaCentavos - generico, 0)]);
    partes.push(`R$ ${g} de cada R$ 100 não dizem a peça.`);
  }
  return partes.length ? partes.join(" ") : null;
}

/**
 * Larguras da barra (px) usadas como degraus: o rótulo que só cabe a partir de um degrau recebe a classe pp-cabe-<px>, e
 * o CSS (container query na barra) o esconde quando ela é mais estreita. Assim nenhum rótulo aparece cortado, sem JS.
 */
export const DEGRAUS_BARRA = [240, 280, 320, 360, 400, 440, 480, 560, 640, 720, 800, 900, 1000, 1200, 1400, 1600];
const FONTE_ROTULO_BARRA = 13;   // px, como nos rótulos da barra
const FOLGA_ROTULO_BARRA = 12;   // px: bordas e recuo da chave, intervalo entre segmentos

/**
 * Menor largura da barra (um dos DEGRAUS_BARRA) em que o texto cabe numa fatia `parte` dela: 0 = cabe em qualquer barra;
 * null = não cabe nem na maior. Largura do texto estimada com folga (LARGURA_LETRA, a mesma da nuvem), sem medir no navegador.
 */
export function larguraParaRotulo(texto: string, parte: number): number | null {
  if (parte <= 0) return null;
  const precisa = (texto.length * FONTE_ROTULO_BARRA * LARGURA_LETRA + FOLGA_ROTULO_BARRA) / parte;
  if (precisa <= DEGRAUS_BARRA[0]) return 0;
  return DEGRAUS_BARRA.find((d) => d >= precisa) ?? null;
}

/** Um segmento da barra: uma peça num tipo, ou as peças pequenas do tipo juntas ("outras"). */
export interface SegmentoBarra {
  chave: string; grupo: string; rotulo: string; centavos: number; parte: number; pct: string; generico: boolean; outras: boolean;
  /** As peças que o segmento junta (uma, salvo "outras"), do maior para o menor valor. */ membros: { rotulo: string; centavos: number; generico: boolean }[];
  /** Largura mínima da barra para o rótulo (nome e percentual) caber embaixo do segmento; null = nunca. */ cabe: number | null;
}
/** Um tipo da barra: a chave acima dos seus segmentos ("Impresso e de rua 84%"). */
export interface TipoBarra { grupo: string; rotulo: string; centavos: number; parte: number; de100: number; segmentos: SegmentoBarra[]; cabe: number | null }
export interface BarraPecas { tipos: TipoBarra[]; totalCentavos: number }

/**
 * Barra única: um segmento por peça, agrupado por tipo; o tipo de maior valor primeiro, à esquerda, e dentro dele as peças
 * do maior para o menor. O total de cada tipo é o oficial (categorias do TSE); as peças vêm do por_tipo (uma peça em dois
 * tipos aparece nos dois). Peças abaixo de LIMIAR_OUTRAS do total viram um segmento "outras" do tipo (se for uma só, fica
 * com o próprio nome). Se as peças não somarem o total do tipo (API anterior ao por_tipo), a diferença vira "sem detalhe".
 */
export function barraPecas(tipos: TipoComposto[], termos: TermoNuvem[], propagandaCentavos: number): BarraPecas {
  const total = propagandaCentavos;
  const parte = (c: number) => (total > 0 ? c / total : 0);
  const maisLongo = (a: string, b: string) => (a.length >= b.length ? a : b);
  return {
    totalCentavos: total,
    tipos: tiposPorValor(tipos).map((t) => {
      const itens = termos.flatMap((p) => p.por_tipo.filter((x) => x.grupo === t.grupo && x.centavos > 0)
        .map((x) => ({ rotulo: p.termo, centavos: x.centavos, generico: p.generico })));
      const soma = itens.reduce((s, x) => s + x.centavos, 0);
      if (t.centavos - soma > 0) itens.push({ rotulo: "sem detalhe", centavos: t.centavos - soma, generico: true });
      itens.sort(porValor((x) => x.rotulo));
      const segmento = (rotulo: string, membros: typeof itens, outras: boolean): SegmentoBarra => {
        const c = membros.reduce((s, x) => s + x.centavos, 0), pct = pctInteiro(parte(c));
        return { chave: `${t.grupo}:${rotulo}`, grupo: t.grupo, rotulo, centavos: c, parte: parte(c), pct, outras, membros,
          generico: membros.every((x) => x.generico), cabe: larguraParaRotulo(maisLongo(rotulo, pct), parte(c)) };
      };
      const grandes = itens.filter((x) => parte(x.centavos) >= LIMIAR_OUTRAS);
      const pequenas = itens.filter((x) => parte(x.centavos) < LIMIAR_OUTRAS);
      const segmentos = grandes.map((x) => segmento(x.rotulo, [x], false));
      if (pequenas.length === 1) segmentos.push(segmento(pequenas[0].rotulo, pequenas, false));
      else if (pequenas.length > 1) segmentos.push(segmento("outras", pequenas, true));
      const rotulo = tipoComum(t.grupo).legenda;
      return { grupo: t.grupo, rotulo, centavos: t.centavos, parte: parte(t.centavos), de100: t.de100, segmentos,
        cabe: larguraParaRotulo(`${rotulo} ${t.de100}%`, parte(t.centavos)) };
    }),
  };
}

/** Um tipo na legenda abaixo da barra: aparece só quando o nome da sua chave está escondido. */
export interface TipoSemNome { grupo: string; rotulo: string; de100: number; classe: string | null }

/**
 * Tipos cujo nome pode não caber na chave: os mesmos degraus da chave, com a regra invertida (pp-falta-<px> só aparece
 * quando a barra é mais estreita que isso; null = a chave nunca tem nome, o item aparece sempre). Tipo cujo nome cabe em
 * qualquer largura não entra.
 */
export const tiposSemNome = (b: BarraPecas): TipoSemNome[] => b.tipos.filter((t) => t.cabe !== 0)
  .map((t) => ({ grupo: t.grupo, rotulo: t.rotulo, de100: t.de100, classe: t.cabe === null ? null : `pp-falta-${t.cabe}` }));

/** A barra só faz sentido com mais de um tipo ou mais de uma peça: com um tipo e uma peça específica, não. */
export function mostrarBarra(b: BarraPecas): boolean {
  if (!b.tipos.length) return false;
  if (b.tipos.length > 1 || b.tipos[0].segmentos.length > 1) return true;
  const [s] = b.tipos[0].segmentos;
  return s.membros.length !== 1 || s.generico;
}

/** Nuvem só com MIN_PECAS_NUVEM ou mais peças específicas. */
export const mostrarNuvem = (termos: TermoNuvem[]) => termos.filter((t) => !t.generico && t.centavos > 0).length >= MIN_PECAS_NUVEM;

/** Linha da tabela "referencia" de GET /api/analises/q9: mediana da parcela de um tipo, por cargo + ano + UF. */
export interface LinhaReferencia { ano: number; id_cargo: number; cargo: string; uf: string; grupo: string; mediana: number; campanhas: number }
/**
 * Linha da tabela "parcelas" da q9: as parcelas (0 a 1) de cada tipo numa campanha de grupo pequeno (menos de
 * LIMIAR_GRUPO_PEQUENO campanhas), com o nome do tipo como coluna.
 */
export interface LinhaParcelas {
  id_candidatura: number; ano: number; id_cargo: number; cargo: string; uf: string;
  propaganda_fisica: number; propaganda_audiovisual: number; propaganda_digital: number;
}
type CampanhaRef = { id_cargo: number; cargo: string; ano: number; uf: string | null; id_candidatura?: number };

/** Mediana como a median() do DuckDB usada na q9: com número par de valores, a média dos dois do meio. null sem valores. */
export function mediana(xs: number[]): number | null {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

const doGrupo = (c: CampanhaRef) => (x: { ano: number; id_cargo: number; uf: string }) =>
  x.id_cargo === c.id_cargo && x.ano === c.ano && x.uf === (c.uf ?? "BR");
const parcelaDe = (x: LinhaParcelas, grupo: string) => {
  const v = (x as unknown as Record<string, unknown>)[grupo];
  return typeof v === "number" ? v : Number.NaN;
};

/** O grupo da campanha (cargo + ano + UF) tem menos de LIMIAR_GRUPO_PEQUENO campanhas? Só então o perfil busca "parcelas". */
export function grupoPequeno(refs: LinhaReferencia[] | null, c: CampanhaRef): boolean {
  const r = refs?.find(doGrupo(c));
  return !!r && r.campanhas < LIMIAR_GRUPO_PEQUENO;
}

/** A típica da comparação: a mediana do tipo, de quantas campanhas ela sai e se a própria campanha ficou de fora. */
export interface Tipica { mediana: number; campanhas: number; semAPropria: boolean }

/**
 * Típica do tipo `grupo` para a campanha `c`. Grupo pequeno (menos de LIMIAR_GRUPO_PEQUENO campanhas) com a campanha em
 * `parcelas`: a mediana das OUTRAS campanhas do grupo (campanhas = o grupo menos 1). Senão, a mediana da referencia com o
 * grupo inteiro: nos grupos de 30 ou mais a própria campanha fica na conta, porque tirar uma quase não muda a mediana; e
 * uma campanha ausente de "parcelas" (algum filtro da q9) também fica com a referencia. null sem referência ou com menos
 * de LIMIAR_GRUPO_MINIMO campanhas na conta.
 */
export function tipica(refs: LinhaReferencia[] | null, c: CampanhaRef, grupo: string | null, parcelas: LinhaParcelas[] | null = null): Tipica | null {
  if (!refs || !grupo) return null;
  const r = refs.find((x) => doGrupo(c)(x) && x.grupo === grupo);
  if (!r || !Number.isFinite(r.mediana)) return null;
  let t: Tipica = { mediana: r.mediana, campanhas: r.campanhas, semAPropria: false };
  if (r.campanhas < LIMIAR_GRUPO_PEQUENO && parcelas && c.id_candidatura !== undefined) {
    const grupoTodo = parcelas.filter(doGrupo(c));
    if (grupoTodo.some((x) => x.id_candidatura === c.id_candidatura)) {
      const m = mediana(grupoTodo.filter((x) => x.id_candidatura !== c.id_candidatura).map((x) => parcelaDe(x, grupo)));
      if (m !== null) t = { mediana: m, campanhas: r.campanhas - 1, semAPropria: true };
    }
  }
  return t.campanhas >= LIMIAR_GRUPO_MINIMO ? t : null;
}

const quemCompara = (c: CampanhaRef) => `candidatos a ${c.cargo.toLowerCase()}${noEstado(c.uf ?? "BR")} em ${c.ano}`;
const quaseTotal = (mediana: number, esta: number) => mediana >= LIMIAR_PADRAO_QUASE_TOTAL && esta >= LIMIAR_PADRAO_QUASE_TOTAL;

/**
 * Comparação com a típica, pelo tipo de maior valor desta campanha: "Típica campanha a senador em Minas Gerais em 2018: 68%
 * em impresso e de rua; esta: 84%." (esta = o percentual da chave do tipo). Grupo pequeno sem a própria campanha: "Típica
 * entre as outras 11 campanhas a senador em Minas Gerais em 2018: …" (sem "parcelas": "Típica entre as 12 campanhas…").
 * Com o padrão quase total (típica e esta com LIMIAR_PADRAO_QUASE_TOTAL ou mais nesse tipo), "Como a maioria dos candidatos
 * a vereador em Minas Gerais em 2024.". Presidente: sem estado. null quando `tipica` é null.
 */
export function fraseComparacao(refs: LinhaReferencia[] | null, c: CampanhaRef, tipos: TipoComposto[],
  parcelas: LinhaParcelas[] | null = null): string | null {
  const dom = tipos.find((t) => t.grupo === tipoDominante(tipos));
  const t = tipica(refs, c, dom?.grupo ?? null, parcelas);
  if (!t || !dom) return null;
  if (quaseTotal(t.mediana, dom.parte)) return `Como a maioria dos ${quemCompara(c)}.`;
  const quem = t.semAPropria ? `Típica entre as outras ${inteiro(t.campanhas)} campanhas`
    : t.campanhas < LIMIAR_GRUPO_PEQUENO ? `Típica entre as ${inteiro(t.campanhas)} campanhas` : "Típica campanha";
  return `${quem} a ${c.cargo.toLowerCase()}${noEstado(c.uf ?? "BR")} em ${c.ano}: ${pctInteiro(t.mediana)} em `
    + `${minuscula(tipoComum(dom.grupo).legenda)}; esta: ${dom.de100}%.`;
}

/** A comparação com a típica: como marca na barra (com a legenda) ou como texto no topo; os dois null sem referência. */
export interface Comparacao { marca: { parte: number; legenda: string } | null; texto: string | null }

/**
 * Marca × texto: com dado de referência, a regra é a marca tracejada na barra, na posição da típica do tipo dominante desta
 * campanha (que vem primeiro, à esquerda), com a frase de fraseComparacao como legenda (o mesmo valor da frase). Vira texto
 * no topo quando vale o padrão quase total ("Como a maioria…") ou quando a barra não é mostrada (a mesma frase da legenda).
 */
export function comparacao(refs: LinhaReferencia[] | null, c: CampanhaRef, tipos: TipoComposto[], barraVisivel: boolean,
  parcelas: LinhaParcelas[] | null = null): Comparacao {
  const dom = tipos.find((t) => t.grupo === tipoDominante(tipos));
  const t = tipica(refs, c, dom?.grupo ?? null, parcelas);
  const frase = fraseComparacao(refs, c, tipos, parcelas);
  if (!t || !dom || !frase) return { marca: null, texto: null };
  if (!barraVisivel || quaseTotal(t.mediana, dom.parte)) return { marca: null, texto: frase };
  return { marca: { parte: Math.min(Math.max(t.mediana, 0), 1), legenda: frase }, texto: null };
}

/** Texto para leitor de tela da barra: tipos, peças com percentual e a típica. */
/**
 * Régua da típica, logo abaixo da barra: começa na borda esquerda (onde começa o tipo comparado, sempre o primeiro) e vai
 * até a típica. `largura` é a fração da barra, limitada a 0–1; com 0 sobra só o traço do fim, na borda esquerda. Pode
 * passar do fim do tipo, quando a típica é maior que a parcela desta campanha. null sem comparação (a régua não ocupa
 * espaço).
 */
export function reguaTipica(marca: Comparacao["marca"]): { largura: number } | null {
  if (!marca || !Number.isFinite(marca.parte)) return null;
  return { largura: Math.min(Math.max(marca.parte, 0), 1) };
}

export function descricaoBarra(b: BarraPecas, marca: Comparacao["marca"]): string {
  const tipos = b.tipos.map((t) => `${t.rotulo}, ${t.de100}%: `
    + t.segmentos.map((s) => `${s.outras ? `outras (${juntar(s.membros.map((m) => m.rotulo))})` : s.rotulo} ${s.pct}`).join(", "));
  return `Propaganda por tipo e por peça. ${tipos.join("; ")}.${marca ? ` ${marca.legenda}` : ""}`;
}

/** Percentual das tabelas, com uma casa: "21,6%"; abaixo de 0,1%, "< 0,1%". */
export function parteTabela(p: number): string {
  if (p > 0 && p < 0.001) return "< 0,1%";
  return `${(p * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Linha das tabelas recolhidas: peça (ou categoria) num tipo. */
export interface LinhaTabela { chave: string; nome: string; detalhe: string | null; generico: boolean; despesas: number; centavos: number; parte: number }
/**
 * Grupo das tabelas: um tipo, com a linha de cabeçalho e as suas linhas. O cabeçalho traz os totais oficiais do tipo
 * (despesas e valor das categorias do TSE), os mesmos nas duas tabelas: na de peças, as despesas das linhas podem somar
 * mais que isso, porque uma despesa que cita duas peças ("santinhos e adesivos") conta nas duas.
 */
export interface GrupoTabela { grupo: string; rotulo: string; despesas: number; centavos: number; parte: number; linhas: LinhaTabela[] }

const grupoTabela = (t: TipoComposto, total: number, linhas: LinhaTabela[]): GrupoTabela => ({
  grupo: t.grupo, rotulo: tipoComum(t.grupo).legenda, despesas: t.lancamentos, centavos: t.centavos,
  parte: total > 0 ? t.centavos / total : 0, linhas: linhas.sort(porValor((x) => x.nome)),
});

/**
 * Tabela "Ver o valor de cada peça": grupos por tipo (do maior para o menor), uma linha por peça (todas, sem agrupar),
 * do maior para o menor. Nome por extenso; detalhe = os formatos com percentual ou o que a peça inclui. Uma peça em dois
 * tipos aparece nos dois grupos, com o valor e as despesas de cada um.
 */
export function tabelaPecas(tipos: TipoComposto[], termos: TermoNuvem[], propagandaCentavos: number): GrupoTabela[] {
  const parte = (c: number) => (propagandaCentavos > 0 ? c / propagandaCentavos : 0);
  return tiposPorValor(tipos).map((t) => {
    const linhas: LinhaTabela[] = termos.flatMap((p) => p.por_tipo.filter((x) => x.grupo === t.grupo && x.centavos > 0).map((x) => ({
      chave: `${t.grupo}:${p.termo}`, nome: pecaManchete(p.termo), detalhe: textoDetalhes(p, 6) || p.explicacao,
      generico: p.generico, despesas: x.despesas, centavos: x.centavos, parte: parte(x.centavos),
    })));
    const resto = t.centavos - linhas.reduce((s, x) => s + x.centavos, 0);
    if (resto > 0) linhas.push({ chave: `${t.grupo}:sem detalhe`, nome: "sem detalhe", detalhe: null, generico: true, despesas: 0, centavos: resto, parte: parte(resto) });
    return grupoTabela(t, propagandaCentavos, linhas);
  });
}

/** Nota abaixo da tabela de peças, quando as despesas das peças de algum tipo somam mais que as do tipo. */
export const NOTA_DESPESA_DUPLA = "Uma despesa que cita mais de uma peça é contada em cada uma.";

/**
 * Em algum tipo, as despesas das peças somam mais que o total de despesas do tipo (uma despesa que cita "santinhos e
 * adesivos" conta nas duas peças)? Então a tabela de peças precisa da NOTA_DESPESA_DUPLA.
 */
export const temDespesaDupla = (grupos: GrupoTabela[]) =>
  grupos.some((g) => g.linhas.reduce((s, l) => s + l.despesas, 0) > g.despesas);

/**
 * Tabela "Ver como o TSE classificou cada despesa": o mesmo formato, uma linha por categoria do TSE (nome curto; detalhe =
 * a classificação original).
 */
export function tabelaCategorias(a: Extract<Analise, { estado: "com_propaganda" }>, tipos: TipoComposto[]): GrupoTabela[] {
  return tiposPorValor(tipos).map((t) => grupoTabela(t, a.propagandaCentavos, a.categorias.filter((k) => k.grupo === t.grupo).map((k) => ({
    chave: k.origem, nome: k.rotulo, detalhe: k.origem, generico: false, despesas: k.lancamentos, centavos: k.centavos, parte: k.parteDaPropaganda,
  }))));
}

/** Linha final das duas tabelas e a frase logo abaixo delas. */
export interface TotalTabela { despesas: number; centavos: number; parte: string | null; frase: string | null }

/**
 * Linha "Propaganda": despesas e valor de propaganda e, na última coluna, "10,7% do total" (de todas as despesas); abaixo da
 * tabela, "Total de despesas da campanha: R$ 4.165.774,01, em 276 lançamentos.". Sem total de despesas, parte e frase null.
 */
export function totalTabela(a: Extract<Analise, { estado: "com_propaganda" }>): TotalTabela {
  const despesas = a.categorias.reduce((s, k) => s + k.lancamentos, 0);
  const comTotal = a.totalCentavos > 0;
  return {
    despesas, centavos: a.propagandaCentavos,
    parte: comTotal ? `${parteTabela(a.propagandaCentavos / a.totalCentavos)} do total` : null,
    frase: comTotal ? `Total de despesas da campanha: ${reaisCentavos(a.totalCentavos)}, em ${inteiro(a.lancamentos)} ${a.lancamentos === 1 ? "lançamento" : "lançamentos"}.` : null,
  };
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

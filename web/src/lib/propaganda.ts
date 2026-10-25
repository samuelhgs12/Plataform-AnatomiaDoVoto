// Pergunta 9: onde a campanha investe em propaganda. Os dados vêm da API, uma candidatura por vez
// (GET /api/candidaturas/<id>/propaganda), e aparecem no perfil do candidato.
// Valores em centavos inteiros: somas e percentuais exatos. Valor = valor CONTRATADO, não o pago.

import { deCada100 } from "./financiamento";
import type { TermoNuvem } from "./nuvem";
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

// Busca rápida (Ctrl K): páginas, análises, estados e municípios do mapa, filtrados no navegador. Os candidatos vêm da
// API (/api/busca) e entram depois, na mesma lista. Tudo aqui é puro: o componente PaletaBusca só desenha.
import { ANALISES } from "./analises";
import { normalizarBusca } from "./busca";
import { fotoDaBusca } from "./foto-candidato";
import { NOME_UF } from "./financiamento";
import type { CandidatoBusca } from "./types";

export type TipoItem = "pagina" | "estado" | "municipio" | "candidato";

export interface ItemPaleta {
  tipo: TipoItem;
  titulo: string;
  /** segunda linha: o que é o item ("Análise · Pergunta 5", "Município · MG") */
  detalhe: string;
  href: string;
  /** miniatura do candidato (/api/fotos); sem ela, o ícone do tipo */
  foto?: string;
}

/** Grupos na ordem em que aparecem na lista. */
export const GRUPOS: { tipo: TipoItem; rotulo: string }[] = [
  { tipo: "pagina", rotulo: "Páginas e análises" },
  { tipo: "estado", rotulo: "Estados no mapa" },
  { tipo: "municipio", rotulo: "Municípios no mapa" },
  { tipo: "candidato", rotulo: "Candidatos" },
];

const PAGINAS: ItemPaleta[] = [
  { tipo: "pagina", titulo: "Mapa da abstenção", detalhe: "Página inicial", href: "/#mapa" },
  { tipo: "pagina", titulo: "Mapa do voto de legenda", detalhe: "Página inicial", href: "/?ver=legenda#mapa" },
  { tipo: "pagina", titulo: "Candidatos", detalhe: "Listagem por eleição", href: "/candidatos" },
  ...ANALISES.filter((a) => a.href.startsWith("/analises/")).map((a): ItemPaleta => ({ tipo: "pagina", titulo: a.titulo, detalhe: `Análise · ${a.pergunta}`, href: a.href })),
  { tipo: "pagina", titulo: "Todas as análises", detalhe: "Análises", href: "/analises" },
  { tipo: "pagina", titulo: "Sobre os dados", detalhe: "Fonte, escopo e privacidade", href: "/sobre" },
];

/** O que a lista mostra antes de a pessoa digitar. */
export const SUGESTOES = PAGINAS;

/** Itens fixos e os do mapa. municipios: [id_municipio, nome já em nome próprio, uf]. */
export function indicePaleta(municipios: [number, string, string][]): ItemPaleta[] {
  const ufs = [...new Set(municipios.map(([, , uf]) => uf))].sort();
  return [
    ...PAGINAS,
    ...ufs.map((uf): ItemPaleta => ({ tipo: "estado", titulo: NOME_UF[uf] ?? uf, detalhe: `Estado · ${uf}`, href: `/?uf=${uf}#mapa` })),
    ...municipios.map(([id, nome, uf]): ItemPaleta => ({ tipo: "municipio", titulo: nome, detalhe: `Município · ${uf}`, href: `/?uf=${uf}&mun=${id}#mapa` })),
  ];
}

/**
 * Itens em que cada palavra digitada começa uma palavra do título ou do detalhe ("bel hor" acha Belo Horizonte,
 * "mg" acha os municípios de MG), ignorando acentos. Primeiro quem começa pelo texto inteiro, depois o título mais
 * curto; no máximo `limite` por grupo.
 */
export function filtrarPaleta(itens: ItemPaleta[], busca: string, limite = 5): ItemPaleta[] {
  const termos = normalizarBusca(busca).split(" ").filter(Boolean);
  if (!termos.length) return [];
  const inteiro = termos.join(" ");
  const achados = itens.flatMap((item) => {
    const titulo = normalizarBusca(item.titulo);
    const palavras = `${titulo} ${normalizarBusca(item.detalhe)}`.split(" ");
    if (!termos.every((t) => palavras.some((p) => p.startsWith(t)))) return [];
    return [{ item, nota: titulo.startsWith(inteiro) ? 0 : 1, tamanho: titulo.length }];
  });
  achados.sort((a, b) => a.nota - b.nota || a.tamanho - b.tamanho || a.item.titulo.localeCompare(b.item.titulo, "pt-BR"));
  const porGrupo = new Map<TipoItem, number>();
  return achados.flatMap(({ item }) => {
    const n = porGrupo.get(item.tipo) ?? 0;
    porGrupo.set(item.tipo, n + 1);
    return n < limite ? [item] : [];
  });
}

/** Junta os itens locais e os candidatos na ordem dos grupos; é a ordem das setas do teclado. */
export function agrupar(itens: ItemPaleta[]): { tipo: TipoItem; rotulo: string; itens: ItemPaleta[] }[] {
  return GRUPOS.map((g) => ({ ...g, itens: itens.filter((i) => i.tipo === g.tipo) })).filter((g) => g.itens.length);
}

/** Candidato de /api/busca como item da lista: o nome de urna (ou o civil) e a última candidatura. */
export function candidatoNaPaleta(c: CandidatoBusca): ItemPaleta {
  const detalhe = [c.ultimo_cargo, c.uf, String(c.ultimo_ano), c.partido, c.ultimo_eleito ? "eleito" : null].filter(Boolean).join(" · ");
  return { tipo: "candidato", titulo: c.nome_urna ?? c.nome_civil ?? "Sem nome", detalhe, href: `/candidato/${c.id_candidato}`, foto: fotoDaBusca(c) ?? undefined };
}

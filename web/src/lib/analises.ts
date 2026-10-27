// As análises do site, na ordem em que aparecem na página inicial e em /analises.

/** curto: o nome no menu lateral e na busca rápida, onde o título inteiro não cabe. */
export interface Analise { href: string; pergunta: string; titulo: string; curto: string; resumo: string }

export const ANALISES: Analise[] = [
  // As perguntas 1, 2 e 8 numa entrada só: as análises completas de cada uma (/analises/custo-cadeira, /gastos e
  // /financiamento) e o mapa de cidades (/municipios) continuam no ar, linkados pela metodologia da área.
  // A pergunta 5 (voto de legenda) saiu da lista: vive na camada Legenda do mapa da página inicial, que liga para
  // /analises/legenda. O perfil do candidato tem entrada própria no menu (Candidatos).
  { href: "/analises/dinheiro", pergunta: "Perguntas 1, 2 e 8", titulo: "Dinheiro nas eleições", curto: "Dinheiro nas eleições", resumo: "Quanto as campanhas gastaram por vaga, cidade por cidade, e se quem teve mais dinheiro (inclusive público) se elegeu mais. De 2018 a 2024." },
];

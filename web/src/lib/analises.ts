// As análises do site, na ordem em que aparecem na página inicial e em /analises.

/** curto: o nome no menu lateral e na busca rápida, onde o título inteiro não cabe. */
export interface Analise { href: string; pergunta: string; titulo: string; curto: string; resumo: string }

export const ANALISES: Analise[] = [
  // As perguntas 1, 2 e 8 numa entrada só: as análises completas de cada uma (/analises/custo-cadeira, /gastos e
  // /financiamento) e o mapa de cidades (/municipios) continuam no ar, linkados pela metodologia da área.
  { href: "/analises/dinheiro", pergunta: "Perguntas 1, 2 e 8", titulo: "Dinheiro nas eleições", curto: "Dinheiro nas eleições", resumo: "Quanto as campanhas gastaram por vaga, cidade por cidade, e se quem teve mais dinheiro (inclusive público) se elegeu mais. De 2018 a 2024." },
  { href: "/analises/legenda", pergunta: "Pergunta 5", titulo: "Voto de legenda", curto: "Voto de legenda", resumo: "Quantos votos cada partido recebeu só na sigla, de 2018 a 2024, com fusões e renomeações marcadas." },
  { href: "/candidatos", pergunta: "Por candidato", titulo: "Perfil do candidato", curto: "Perfil do candidato", resumo: "A carreira de 1998 a 2024 numa linha do tempo, de onde veio o dinheiro de cada campanha e onde ela investiu em propaganda." },
];

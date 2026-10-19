// As análises do site, na ordem em que aparecem na página inicial e em /analises.

export interface Analise { href: string; pergunta: string; titulo: string; resumo: string }

export const ANALISES: Analise[] = [
  { href: "/analises/financiamento", pergunta: "Pergunta 8", titulo: "Dinheiro público e sucesso eleitoral", resumo: "Quem recebe mais dinheiro público para a campanha se elege mais? De 2018 a 2024." },
  { href: "/analises/legenda", pergunta: "Pergunta 5", titulo: "Voto de legenda", resumo: "Quantos votos cada partido recebeu só na sigla, de 2018 a 2024, com fusões e renomeações marcadas." },
  { href: "/analises/pos-mandato", pergunta: "Pergunta 10", titulo: "Depois de um mandato", resumo: "Reeleição, outro cargo, derrota ou saída: o que cada eleito fez até a eleição seguinte." },
  { href: "/candidatos", pergunta: "Perguntas 9 e 10", titulo: "Perfil do candidato", resumo: "A carreira de 1998 a 2024 numa linha do tempo e para onde foi o dinheiro de cada campanha." },
];

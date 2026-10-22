// As análises do site, na ordem em que aparecem na página inicial e em /analises.

export interface Analise { href: string; pergunta: string; titulo: string; resumo: string }

export const ANALISES: Analise[] = [
  { href: "/analises/custo-cadeira", pergunta: "Pergunta 1", titulo: "Quanto custa uma cadeira", resumo: "O gasto de campanha de cada cargo dividido pelas vagas e pelos candidatos, de 2018 a 2024." },
  { href: "/analises/gastos", pergunta: "Pergunta 2", titulo: "Recursos de campanha e sucesso eleitoral", resumo: "Quem tem mais recursos na campanha se elege mais? E o candidato com mais recursos costuma vencer?" },
  { href: "/analises/financiamento", pergunta: "Pergunta 8", titulo: "Dinheiro público e sucesso eleitoral", resumo: "Quem recebe mais dinheiro público para a campanha se elege mais? De 2018 a 2024." },
  { href: "/analises/legenda", pergunta: "Pergunta 5", titulo: "Voto de legenda", resumo: "Quantos votos cada partido recebeu só na sigla, de 2018 a 2024, com fusões e renomeações marcadas." },
  { href: "/candidatos", pergunta: "Por candidato", titulo: "Perfil do candidato", resumo: "A carreira de 1998 a 2024 numa linha do tempo, de onde veio o dinheiro de cada campanha e onde ela investiu em propaganda." },
];

// Metodologia de cada pergunta que a plataforma responde: a fonte única do texto. As páginas de análise (o bloco "Como
// calculamos") e a página /sobre leem daqui, para as duas versões não divergirem. O texto de `calculo` é o que a equipe
// já revisou nas páginas; para a /sobre há `resposta` e `resumo`, sem editar o original.

export type IdMetodologia = "mapa" | "dinheiro" | "p1" | "p2" | "p5" | "p8" | "p9" | "p10" | "candidato";

export interface Metodologia {
  id: IdMetodologia;
  /** "Pergunta 1", "Perguntas 1, 2 e 8", "Mapa" */
  numero: string;
  /** nome curto da análise: o título da seção na /sobre */
  titulo: string;
  /** a pergunta como aparece no topo da página da análise */
  pergunta: string;
  /** 1–2 frases para o leigo: o que a página mostra */
  resposta: string;
  /** a medida principal numa linha, para a ilustração da /sobre */
  formula?: { resultado: string; parcelas: string[]; operador: "÷" };
  ondeVer: { rotulo: string; href: string }[];
  anos: string;
  cargos: string;
  turno?: string;
  /** tabelas do banco e fontes externas */
  dados: string[];
  recorte: string[];
  /** fórmulas e testes, no texto que já está nas páginas */
  calculo: string[];
  /** o que não dá para afirmar */
  limites: string[];
  /** consultas de origem, a partir da raiz do repositório */
  sql: string[];
  /** linha de fonte que a página da análise mostra no rodapé */
  fonte?: string;
  /** perguntas detalhadas dentro desta (a de dinheiro reúne 1, 2 e 8) */
  partes?: IdMetodologia[];
}

export const REPOSITORIO = "https://github.com/samuelhgs12/Plataform-AnatomiaDoVoto";

/** Link do arquivo no GitHub (ramo principal). */
export const linkFonte = (caminho: string) => `${REPOSITORIO}/blob/main/${caminho}`;

const UFS = "AP, ES, MG, PE, RJ e RR";

export const METODOLOGIA: Record<IdMetodologia, Metodologia> = {
  mapa: {
    id: "mapa",
    numero: "Mapa · ligado à pergunta 3",
    titulo: "Abstenção e indicadores do Censo",
    pergunta: "Onde os eleitores mais deixaram de votar, e isso acompanha os indicadores sociais do município?",
    resposta: "A abstenção de cada estado e município, de 2008 a 2024. Em 2008 e 2012 dá para pôr ao lado um indicador do Censo 2010 (renda, escolaridade, IDHM e outros) e ver se os dois andam juntos.",
    formula: { resultado: "abstenção", parcelas: ["eleitores que faltaram", "eleitores aptos"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver o mapa", href: "/" }],
    anos: "2008–2024",
    cargos: "Governador (anos gerais) e prefeito (anos municipais)",
    turno: "1º turno",
    dados: [
      "participacao_eleitoral, eleicao e municipio (banco bdr_final), de 2018 em diante",
      "Dados abertos do TSE (detalhe_votacao_munzona), de 2008 a 2016, baixados pelo pipeline/export_static.py (provisório, decisão 10)",
      "Indicadores do Atlas do Desenvolvimento Humano no Brasil (PNUD, Ipea e FJP), Censo 2010, com o código IBGE (banco bdr_v2)",
      "Malhas de estados e municípios do IBGE",
    ],
    recorte: [
      "Eleição ordinária, 1º turno: governador nos anos gerais, prefeito nos municipais; as suplementares do mesmo ano ficam de fora.",
      "Indicadores do Censo 2010 só ao lado das eleições municipais em volta dele: 2008 e 2012 (decisão 11).",
    ],
    calculo: [
      "Abstenção = abstenções ÷ eleitores aptos. Para um estado ou os seis juntos, as abstenções e os aptos são somados antes da divisão: não é a média das taxas dos municípios.",
      "Cores do mapa em quintos: cada cor reúne um quinto (20%) dos municípios dos seis estados naquele ano.",
      "Comparativo com o Censo (2008 e 2012, com um estado aberto): cada município recebe o terço da abstenção e o terço do indicador dentro do estado, e a cor vem da grade 3 × 3 formada pelos dois.",
      "Dispersão: cada ponto é um município. A correlação de Pearson (r) mede o quanto abstenção e indicador sobem ou descem juntos; a reta é a de mínimos quadrados. Em palavras: |r| abaixo de 0,1 é quase nenhuma relação, até 0,3 fraca, até 0,5 moderada e acima disso forte.",
      "Indicador de um estado ou dos seis juntos: média dos municípios ponderada pela população de 2010, um retrato do conjunto e não o índice oficial dele.",
    ],
    limites: [
      "Correlação não é causa: o mapa mostra onde as duas coisas aparecem juntas, não que uma explique a outra.",
      "Os indicadores são de 2010; por isso só são comparados com 2008 e 2012. Nos outros anos o mapa mostra só a abstenção.",
      "De 2008 a 2016 a abstenção vem direto dos dados abertos do TSE, fora do banco, até a carga trazer esses anos.",
    ],
    sql: ["pipeline/sql/mapa.sql"],
  },

  dinheiro: {
    id: "dinheiro",
    numero: "Perguntas 1, 2 e 8",
    titulo: "Dinheiro nas eleições",
    pergunta: "Quanto custa uma vaga, e quem teve mais dinheiro (inclusive público) se elegeu mais?",
    resposta: "Quanto as campanhas gastaram por vaga, cidade por cidade, e se quem teve mais dinheiro, ou mais dinheiro público, se elegeu mais. De 2018 a 2024.",
    ondeVer: [
      { rotulo: "Ver a análise", href: "/analises/dinheiro" },
      { rotulo: "Pergunta 1", href: "/analises/custo-cadeira" },
      { rotulo: "Pergunta 2", href: "/analises/gastos" },
      { rotulo: "Pergunta 8", href: "/analises/financiamento" },
    ],
    anos: "2018–2024",
    cargos: "Todos os cargos titulares",
    dados: ["despesa_campanha, receita_campanha e fonte_recurso", "candidatura, eleicao, cargo, rotulo_resultado e vagas", "Prestação de contas do TSE"],
    recorte: ["Titulares", "Eleições ordinárias", "Quem de fato disputou", "Prestação final ou regularização"],
    calculo: [
      "Gasto por vaga: soma dos gastos declarados por todas as campanhas ao cargo, inclusive as derrotadas, ÷ número de vagas. Não é salário nem o custo do mandato. Cidades de porte semelhante: a mediana das cidades com eleitorado parecido; estado: soma de todos os gastos ÷ soma de todas as vagas.",
      "Todo o dinheiro de campanha (P2): o maior valor entre receitas e despesas declaradas, para considerar também campanhas que receberam material. Só o dinheiro público (P8): o que veio do Fundo Eleitoral e do Fundo Partidário, inclusive por meio de outro candidato.",
      "Prefeito, governador e senador: se quem teve o maior gasto declarado venceu. Ficam de fora disputas com um só candidato, prestação de contas incompleta, sem gasto ou com empate no maior gasto.",
      "Teste estatístico: comparação de duas proporções com 95% de confiança; o projeto só destaca diferenças de pelo menos 20% (regra do projeto). Sem diferença estatística não quer dizer sem relação; com diferença, não quer dizer causa.",
      "Fonte: TSE (prestação de contas final ou regularização). Só titulares, eleições ordinárias e quem disputou; dinheiro de 2018 em diante. Quem não entregou a prestação final aparece como “Não informado”. Valores sem correção pela inflação: compare eleições do mesmo tipo (vereador 2020 × 2024; deputado 2018 × 2022).",
    ],
    limites: [
      "Mostra que dinheiro e vitória andam juntos, não que o dinheiro fez ganhar: quem já tem mais chance também arrecada mais.",
      "Não há receitas nem despesas antes de 2018 na base.",
      "Valores sem correção pela inflação.",
    ],
    sql: ["api/app/analises/municipios.sql", "api/app/analises/q1.sql", "api/app/analises/q2.sql", "api/app/analises/q8.sql"],
    partes: ["p1", "p2", "p8"],
  },

  p1: {
    id: "p1",
    numero: "Pergunta 1",
    titulo: "Quanto custa uma cadeira",
    pergunta: "Quanto custa uma cadeira/mandato?",
    resposta: "Quanto todas as campanhas a um cargo gastaram, dividido pelo número de vagas, por ano e estado.",
    formula: { resultado: "custo da cadeira", parcelas: ["gasto de todas as campanhas ao cargo", "número de vagas"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver a análise", href: "/analises/custo-cadeira" }],
    anos: "2018–2024",
    cargos: "Todos os cargos titulares",
    dados: ["vw_despesa_candidatura (sobre despesa_campanha)", "vagas", "candidatura, eleicao, cargo e rotulo_resultado"],
    recorte: ["Titulares", "Eleições ordinárias", "Prestação final ou regularização", "Sem transferências"],
    calculo: [
      "Gasto: despesas da prestação de contas final entregue ao TSE (ou a regularização), somando os dois turnos, sem as transferências para outros candidatos ou partidos. É o valor contratado, como o TSE divulga.",
      "Custo da cadeira = gasto de todos que fizeram campanha para o cargo ÷ número de vagas. Entra também quem gastou mas não chegou a disputar (candidatura barrada, renúncia ou substituição): esse dinheiro também foi gasto na disputa.",
      "Gasto por candidato (a fórmula do enunciado) = gasto de quem disputou ÷ número de candidatos que disputaram. Só titulares e eleições ordinárias; vagas conforme o TSE.",
      "Candidato que não entregou a prestação final conta com gasto zero (são poucos: cerca de 1% do valor). Não há dados de despesas antes de 2018 na base.",
      "Valores exatamente como declarados ao TSE em cada eleição, sem nenhum ajuste.",
    ],
    limites: ["Não é salário nem o custo do mandato.", "Valores sem correção pela inflação."],
    sql: ["api/app/analises/q1.sql"],
  },

  p2: {
    id: "p2",
    numero: "Pergunta 2",
    titulo: "Recursos de campanha e sucesso eleitoral",
    pergunta: "Existe relação entre o volume de recursos/gastos e a taxa de sucesso eleitoral?",
    resposta: "Se, na mesma disputa, quem teve mais dinheiro se elegeu mais do que quem teve menos.",
    ondeVer: [{ rotulo: "Ver a análise", href: "/analises/gastos" }],
    anos: "2018–2024",
    cargos: "Todos os cargos titulares",
    turno: "Votos do 1º turno na correlação",
    dados: ["vw_despesa_candidatura e receita_campanha", "resultado_candidatura e rotulo_resultado", "candidatura, eleicao e cargo"],
    recorte: ["Titulares", "Eleições ordinárias", "Quem de fato disputou", "Prestação final ou regularização"],
    calculo: [
      "Três medidas, da prestação de contas entregue ao TSE (versão final ou regularização): o gasto (despesas, sem as transferências para outros candidatos ou partidos); a receita (tudo o que recebeu, inclusive material de campanha doado por outros candidatos, comum entre vereadores); e os recursos, o maior dos dois. As conclusões são as mesmas nas três.",
      "Os recursos existem porque muitos candidatos declaram despesas com valor zero (material doado) e recebem o material de outro candidato: só pelo gasto, eles pareceriam campanhas sem dinheiro.",
      "Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador), o estado (deputados, senador e governador) ou o país (presidente).",
      "“Muito” é cerca de 1/4 de quem declarou algo, os que mais têm na disputa; “pouco”, cerca de 1/4, os que menos têm; “médio”, o meio. Valores iguais ficam sempre no mesmo grupo, por isso os grupos têm tamanho aproximado. “Nada declarado” = valor zero na prestação final.",
      "Em prefeito, governador, senador e presidente há poucos candidatos por disputa, então a pergunta vira “o que tinha mais dinheiro venceu?”, comparada com a chance de um sorteio.",
      "A resposta “Sim” ou “Não” só aparece quando a diferença é grande demais para ser acaso (teste estatístico, 95% de confiança) e de pelo menos 20%; com poucos casos, a página diz que não dá para afirmar.",
      "Correlação: cada candidato recebe sua posição no dinheiro e nos votos (1º turno) dentro da disputa, com a média das posições em caso de empate (como no Spearman), dividida pelo número de candidatos; as posições de todas as disputas do cargo são reunidas numa só correlação.",
      "Sucesso eleitoral = ter sido eleito, conforme o resultado do TSE. Só titulares, eleições ordinárias e quem de fato disputou; não há receitas nem despesas antes de 2018.",
    ],
    limites: [
      "Mostra que dinheiro e vitória andam juntos, não que o dinheiro fez ganhar: quem já tem mais chance também arrecada mais.",
      "Sem diferença estatística não quer dizer sem relação; com poucos casos, a página diz que não dá para afirmar.",
    ],
    sql: ["api/app/analises/q2.sql"],
  },

  p8: {
    id: "p8",
    numero: "Pergunta 8",
    titulo: "Dinheiro público e sucesso eleitoral",
    pergunta: "Quem recebe mais dinheiro público para a campanha se elege mais?",
    resposta: "De onde vem o dinheiro das campanhas e se quem recebeu mais do Fundo Eleitoral e do Fundo Partidário se elegeu mais que os concorrentes.",
    ondeVer: [{ rotulo: "Ver a análise", href: "/analises/financiamento" }],
    anos: "2018–2024",
    cargos: "Todos os cargos titulares",
    dados: ["receita_campanha e fonte_recurso", "candidatura, eleicao, cargo e rotulo_resultado"],
    recorte: ["Titulares", "Eleições ordinárias", "Quem de fato disputou", "Prestação final ou regularização"],
    calculo: [
      "Fonte: prestação de contas entregue ao TSE (versão final ou regularização). Só candidatos titulares em eleições ordinárias que de fato disputaram.",
      "Nas somas (de onde vem o dinheiro, estados, partidos), o dinheiro que um candidato repassou a outro não é contado de novo: senão o mesmo real apareceria duas vezes.",
      "Já na resposta e na dependência de cada candidato, conta o que cada um recebeu, inclusive por meio de outro candidato: muitos vereadores recebem o dinheiro do Fundo Eleitoral pelo candidato a prefeito.",
      "“Público” é o que o TSE classifica como Fundo Especial (Fundo Eleitoral) ou Fundo Partidário; todo o resto é privado.",
      "Sucesso eleitoral = ter sido eleito (inclusive por média ou quociente partidário), conforme o resultado divulgado pelo TSE.",
      "Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador) ou o estado (os demais). “Recebeu muito” é cerca de 1/4 de quem recebeu, os que mais receberam; “recebeu pouco”, os demais que receberam algo. Valores iguais ficam no mesmo grupo, então os grupos têm tamanho aproximado (numa disputa com 2 candidatos, “o que mais recebeu” é metade dela).",
      "A resposta “Sim” ou “Não” só aparece quando a diferença entre os grupos é grande demais para ser acaso (teste estatístico, 95% de confiança) e de pelo menos 20%; com poucos candidatos, a página diz que não dá para afirmar.",
      "Não há dados de receita antes de 2018 na base, por isso não dá para comparar com o tempo em que empresas podiam doar (até 2015).",
      "Valores em reais da época, sem correção pela inflação.",
    ],
    limites: [
      "Não dá para comparar com o tempo em que empresas podiam doar (até 2015): não há receitas antes de 2018 na base.",
      "Com diferença estatística, não quer dizer causa.",
    ],
    sql: ["api/app/analises/q8.sql"],
  },

  p5: {
    id: "p5",
    numero: "Pergunta 5",
    titulo: "Voto de legenda",
    pergunta: "Quantos votos cada partido recebeu só na sigla, sem escolher candidato?",
    resposta: "Quantidade e proporção dos votos de legenda de cada partido nas eleições para deputado e vereador, de 2018 a 2024, com as fusões e renomeações marcadas.",
    formula: { resultado: "proporção de legenda", parcelas: ["votos de legenda", "votos de legenda + votos nominais"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver a análise", href: "/analises/legenda" }, { rotulo: "Ver no mapa", href: "/?ver=legenda" }],
    anos: "2018–2024",
    cargos: "Deputado federal, deputado estadual e vereador",
    turno: "1º turno",
    dados: ["votos_partido_municipio", "partido, eleicao, cargo e municipio", "vw_eleito_efetivo (eleitos por partido)"],
    recorte: ["Cargos proporcionais", "1º turno", "Eleições ordinárias", UFS],
    calculo: [
      "Siglas renomeadas aparecem com o nome atual (PRB → REPUBLICANOS, PR → PL, PPS → CIDADANIA, PTC → AGIR, PMN → MOBILIZA).",
      "Com “Juntar partidos que se fundiram”, os votos dos antigos passam para o atual: DEM e PSL → UNIÃO; PTB, PATRIOTA e PRP → PRD; PSC e PHS → PODEMOS; PROS → SOLIDARIEDADE; PPL → PCdoB.",
      "Datas das mudanças: ano da aprovação pelo TSE.",
    ],
    limites: [
      "O voto de legenda só existe nos cargos proporcionais; prefeito, governador, senador e presidente ficam de fora.",
      "No mapa, o voto de legenda é mostrado por estado; por município ainda não.",
    ],
    sql: ["api/app/analises/q5.sql"],
    fonte: "Fonte: TSE, dados abertos; banco do projeto BDR. Cargos proporcionais, 1º turno, eleições ordinárias, em AP, ES, MG, PE, RJ e RR.",
  },

  p9: {
    id: "p9",
    numero: "Pergunta 9",
    titulo: "Onde a campanha investe em propaganda",
    pergunta: "Onde o candidato investe em propaganda?",
    resposta: "No perfil de cada candidato, quanto a campanha escolhida contratou em propaganda, dividido em impresso e de rua, rádio, TV e vídeo, e internet, ao lado da campanha típica do mesmo cargo, ano e estado.",
    ondeVer: [{ rotulo: "Buscar um candidato", href: "/candidatos" }],
    anos: "2018–2024",
    cargos: "Todos os cargos titulares",
    dados: ["despesa_campanha e categoria_despesa (categorias de publicidade)", "candidatura, eleicao, cargo e rotulo_resultado"],
    recorte: ["Uma campanha por vez", "Prestação final", "Sem transferências", "Valor contratado"],
    calculo: [
      "Os valores são o que foi contratado e declarado ao TSE na prestação de contas final, não necessariamente o que foi pago. Não há correção pela inflação, e as doações a outros candidatos ficam de fora.",
      "Impresso e de rua reúne impressos, adesivos, jornais e carros de som; rádio, TV e vídeo reúne programas, vídeos e jingles; internet reúne impulsionamento e páginas. Os tipos e as categorias são oficiais. As peças são estimadas a partir da descrição de cada despesa.",
      "Material recebido pronto do partido, como programas de rádio e TV, não entra nesta conta. Gastar mais não diz quantas pessoas a propaganda alcançou nem se ajudou a eleger.",
    ],
    limites: [
      "Gastar mais não diz quantas pessoas a propaganda alcançou nem se ajudou a eleger.",
      "Material recebido pronto do partido não aparece.",
    ],
    sql: ["api/app/queries/propaganda_totais.sql", "api/app/queries/propaganda_categorias.sql", "api/app/analises/q9.sql"],
  },

  p10: {
    id: "p10",
    numero: "Pergunta 10",
    titulo: "Carreira eleitoral",
    pergunta: "Como é a carreira de quem disputa eleições: quantas vezes concorre, se é eleito e por quais cargos passa?",
    resposta: "No perfil de cada candidato, a carreira de 1998 a 2024 numa linha do tempo: cada eleição disputada, o cargo, o partido e se foi eleito.",
    ondeVer: [{ rotulo: "Buscar um candidato", href: "/candidatos" }],
    anos: "1998–2024",
    cargos: "Todos os cargos titulares e vice-prefeito",
    dados: ["candidato e candidatura", "eleicao, cargo, partido e rotulo_resultado", "resultado_candidatura (votos do 1º turno)"],
    recorte: ["Titulares e vice-prefeito", "Eleições ordinárias", "Quem de fato disputou"],
    calculo: [
      "A carreira de uma pessoa é seguida por um identificador interno; a turma de 1998 inclui quem já tinha carreira antes.",
      "Na linha do tempo entram as candidaturas de titulares em eleições ordinárias que de fato foram disputadas, além das de vice-prefeito. Cada ponto é uma eleição, na altura do cargo (de vereador a presidente); ponto cheio é eleito, ponto vazado é não eleito.",
      "Trocas de partido no perfil são uma comparação simples das siglas entre candidaturas seguidas. A versão que considera fusões e incorporações (DEM → UNIÃO e outras) está na análise q10, ainda não usada no perfil.",
    ],
    limites: [
      "Quem estreou em 1998 pode ter tido carreira antes: a base começa nesse ano.",
      "No perfil, uma fusão de partidos ainda aparece como troca de sigla.",
      "Retenção por turma de estreia e trocas de partido no conjunto ainda não têm página.",
    ],
    sql: ["api/app/queries/candidato_carreira.sql", "api/app/analises/q10.sql"],
  },

  candidato: {
    id: "candidato",
    numero: "Visão Candidato no mapa",
    titulo: "Votos de um candidato no mapa",
    pergunta: "Onde um candidato teve votos, município a município?",
    resposta: "Escolhido um nome, o mapa pinta cada município pela parte dos votos válidos do cargo que foi para essa candidatura.",
    formula: { resultado: "parte no município", parcelas: ["votos da candidatura", "votos válidos do cargo no município"], operador: "÷" },
    ondeVer: [{ rotulo: "Abrir a visão Candidato", href: "/?ver=candidato" }],
    anos: "Eleições gerais, 1998–2022",
    cargos: "Deputado federal, deputado estadual, senador, governador e presidente",
    turno: "1º e 2º turno, separados",
    dados: ["votos_candidatura_municipio", "votos_partido_municipio (votos de legenda)", "candidatura, eleicao e municipio"],
    recorte: ["Municípios da UF da candidatura", "Presidente: os seis estados do projeto", "Prefeito e vereador ainda sem mapa"],
    calculo: [
      "Válidos do cargo = votos nominais de todas as candidaturas da mesma disputa + votos de legenda. Antes de 2018 o TSE não publica o voto de legenda por município: a parte de cada município é calculada só sobre os votos nominais.",
      "Cores em quintos dos municípios. Um deputado costuma ter quase 0% na maior parte do estado: se um quinto ou mais dos municípios fica abaixo de 0,5%, essa vira a primeira faixa e as outras quatro dividem o resto.",
      "Com 2º turno, cada turno tem o seu mapa; a variação é a diferença, em pontos, da parte dos válidos entre os dois.",
    ],
    limites: [
      "Para presidente, o mapa cobre só os seis estados do projeto, não o país.",
      "Mostra onde a candidatura teve votos, não por quê.",
    ],
    sql: ["api/app/queries/votos_municipio.sql", "api/app/queries/candidato_mapa.sql"],
  },
};

/** Ordem das seções na /sobre. As partes (p1, p2, p8) aparecem dentro da seção de dinheiro. */
export const ORDEM_SOBRE: IdMetodologia[] = ["mapa", "dinheiro", "p5", "p9", "p10", "candidato"];

/**
 * O número grande ao lado do título de cada seção: "Pergunta" + "5", "Perguntas" + "1, 2 e 8"; o que não é uma pergunta
 * numerada (o mapa, a visão Candidato) fica só com o rótulo, e `nota` guarda o que vem depois do "·".
 */
export function marca(numero: string): { rotulo: string; valor: string | null; nota: string | null } {
  const [cabeca, nota = null] = numero.split(" · ");
  const m = cabeca.match(/^(Perguntas?) (.+)$/);
  return m ? { rotulo: m[1], valor: m[2], nota } : { rotulo: cabeca, valor: null, nota };
}

/** As fórmulas que ilustram uma seção: a dela e, numa seção que reúne perguntas, as das partes. */
export function formulasDa(m: Metodologia): NonNullable<Metodologia["formula"]>[] {
  return [m.formula, ...(m.partes ?? []).map((p) => METODOLOGIA[p].formula)].filter((f) => f != null);
}

/** Regras que valem para todas as análises (antes "Como lemos os dados" na /sobre). */
export const REGRAS_GERAIS: string[] = [
  "Só entram eleições ordinárias e candidaturas de titulares nas análises; vices e suplentes só têm resultado a partir de 2022.",
  "Em 2024 o TSE não divulgou a situação do registro; usamos o resultado para saber quem disputou.",
  "Gastos: prestação final (ou regularização da omissão), sem transferências para outros candidatos ou partidos.",
  "A carreira de uma pessoa é seguida por um identificador interno; a turma de 1998 inclui quem já tinha carreira antes.",
  "“Eleito” é o resultado divulgado pelo TSE, inclusive por média ou quociente partidário.",
  "Valores em reais da época, sem correção pela inflação.",
];

// ---------- Escopo de relance: o que existe em cada ano ----------

/** banco: no bdr_final; externo: fora do banco (dados abertos do TSE); censo: ano comparado com o Censo 2010. */
export type Cobertura = "banco" | "externo" | "censo";

export interface LinhaEscopo { dado: string; nota: string; anos: Partial<Record<number, Cobertura>> }

/** Anos de eleição ordinária da base: 1998 a 2024, de dois em dois. */
export const ANOS_ELEICAO = Array.from({ length: 14 }, (_, i) => 1998 + 2 * i);

const de = (a0: number, a1: number, c: Cobertura) =>
  Object.fromEntries(ANOS_ELEICAO.filter((a) => a >= a0 && a <= a1).map((a) => [a, c])) as Partial<Record<number, Cobertura>>;

export const ESCOPO: LinhaEscopo[] = [
  { dado: "Candidaturas e votação", nota: "carreira e perfil", anos: de(1998, 2024, "banco") },
  { dado: "Participação e abstenção", nota: "o mapa da página inicial", anos: { ...de(2008, 2016, "externo"), ...de(2018, 2024, "banco") } },
  { dado: "Indicadores do Censo 2010", nota: "comparados só com 2008 e 2012", anos: { 2008: "censo", 2012: "censo" } },
  { dado: "Voto de legenda", nota: "pergunta 5", anos: de(2018, 2024, "banco") },
  { dado: "Receitas e despesas", nota: "perguntas 1, 2, 8 e 9", anos: de(2018, 2024, "banco") },
  { dado: "Fotos dos candidatos", nota: "banco à parte (bdr_fotos)", anos: de(2018, 2024, "banco") },
];

/** Anos em trechos contínuos (de dois em dois), por escrito: [2008, 2010, 2018] → "2008–2010 e 2018". */
export function trechosDeAnos(anos: number[]): string {
  const ord = [...new Set(anos)].sort((a, b) => a - b);
  const trechos: [number, number][] = [];
  for (const a of ord) {
    const ult = trechos[trechos.length - 1];
    if (ult && a - ult[1] === 2) ult[1] = a;
    else trechos.push([a, a]);
  }
  const txt = trechos.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`));
  return txt.length > 1 ? `${txt.slice(0, -1).join(", ")} e ${txt[txt.length - 1]}` : txt[0] ?? "";
}

/** Uma linha da matriz em palavras, para o celular e para leitores de tela. */
export function escopoEmTexto(l: LinhaEscopo): string {
  const anos = (c?: Cobertura) => Object.entries(l.anos).filter(([, v]) => !c || v === c).map(([a]) => Number(a));
  const externo = anos("externo");
  const base = trechosDeAnos(anos());
  return externo.length ? `${base} (${trechosDeAnos(externo)} dos dados abertos do TSE)` : base;
}

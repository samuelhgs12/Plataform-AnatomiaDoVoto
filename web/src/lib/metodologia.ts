// Metodologia de cada pergunta que a plataforma responde: a fonte única do texto. As páginas de análise (o bloco "Como
// calculamos") e a página /sobre leem daqui, para as duas versões não divergirem. O texto de `calculo` é o que a equipe
// já revisou nas páginas; para a /sobre há `resposta`, sem editar o original. As perguntas, no texto do dossiê, estão em
// PERGUNTAS.

export type IdMetodologia = "mapa" | "dinheiro" | "p1" | "p2" | "p4" | "p5" | "p6" | "p7" | "p8" | "p9" | "p10" | "candidato" | "legislativo";

export interface Metodologia {
  id: IdMetodologia;
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
}

export const REPOSITORIO = "https://github.com/samuelhgs12/Plataform-AnatomiaDoVoto";

/** Link do arquivo no GitHub (ramo principal). */
export const linkFonte = (caminho: string) => `${REPOSITORIO}/blob/main/${caminho}`;

const UFS = "AP, ES, MG, PE, RJ e RR";

export const METODOLOGIA: Record<IdMetodologia, Metodologia> = {
  mapa: {
    id: "mapa",
    resposta: "A abstenção de cada estado e município, de 2008 a 2026. Em 2008, 2010 e 2012 dá para pôr ao lado um indicador do Censo 2010 (renda, escolaridade, IDHM e outros), e em 2020, 2022 e 2024 um do Censo 2022, e ver se os dois andam juntos.",
    formula: { resultado: "abstenção", parcelas: ["eleitores que faltaram", "eleitores aptos"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver a resposta no mapa", href: "/" }],
    anos: "2008–2026",
    cargos: "Governador (anos gerais) e prefeito (anos municipais)",
    turno: "1º turno",
    dados: [
      "participacao_eleitoral, eleicao e municipio (banco bdr_final), de 2018 em diante",
      "Dados abertos do TSE (detalhe_votacao_munzona), de 2008 a 2016, baixados pelo pipeline/export_static.py (provisório, decisão 10)",
      "Censo 2010: indicadores do Atlas do Desenvolvimento Humano no Brasil (PNUD, Ipea e FJP), com o código IBGE (banco bdr_v2)",
      "Censo 2022: IBGE (SIDRA), só os equivalentes aos do Atlas (renda, pobres, analfabetismo, ensino médio, desocupação e população), com a mesma chave; definições em pipeline/sql/mapa.sql",
      "Malhas de estados e municípios do IBGE",
    ],
    recorte: [
      "Eleição ordinária, 1º turno: governador nos anos gerais, prefeito nos municipais; as suplementares do mesmo ano ficam de fora.",
      "Cada Censo só ao lado da eleição do ano dele e das municipais em volta: Censo 2010 com 2008, 2010 e 2012; Censo 2022 com 2020, 2022 e 2024 (decisão 11).",
    ],
    calculo: [
      "Abstenção = abstenções ÷ eleitores aptos. Para um estado ou os seis juntos, as abstenções e os aptos são somados antes da divisão: não é a média das taxas dos municípios.",
      "Cores do mapa em quintos: cada cor reúne um quinto (20%) dos municípios dos seis estados naquele ano.",
      "Comparativo com o Censo (nos anos com Censo, com um estado aberto): cada município recebe o terço da abstenção e o terço do indicador dentro do estado, e a cor vem da grade 3 × 3 formada pelos dois.",
      "Dispersão: cada ponto é um município. A correlação de Pearson (r) mede o quanto abstenção e indicador sobem ou descem juntos; a reta é a de mínimos quadrados. Em palavras: |r| abaixo de 0,1 é quase nenhuma relação, até 0,3 fraca, até 0,5 moderada e acima disso forte.",
      "Indicador de um estado ou dos seis juntos: média dos municípios ponderada pela população do mesmo Censo, um retrato do conjunto e não o índice oficial dele.",
    ],
    limites: [
      "Correlação não é causa: o mapa mostra onde as duas coisas aparecem juntas, não que uma explique a outra.",
      "Cada Censo só é comparado com as eleições em volta dele; de 2014 a 2018 o mapa mostra só a abstenção.",
      "No Censo 2022, os indicadores são os equivalentes do IBGE aos do Atlas, nem sempre com a mesma definição (idade mínima, linha de pobreza). IDHM, Gini, esperança de vida, trabalho formal e água encanada só existem com o Censo 2010.",
      "De 2008 a 2016 a abstenção vem direto dos dados abertos do TSE, fora do banco, até a carga trazer esses anos.",
      "A outra metade da pergunta, a votação por partido, ainda não tem página.",
    ],
    sql: ["pipeline/sql/mapa.sql"],
  },

  dinheiro: {
    id: "dinheiro",
    resposta: "Quanto as campanhas gastaram por vaga, cidade por cidade, e se quem teve mais dinheiro, ou mais dinheiro público, se elegeu mais. De 2018 a 2026.",
    ondeVer: [
      { rotulo: "Ver a análise", href: "/analises/dinheiro" },
      { rotulo: "Pergunta 1", href: "/analises/custo-cadeira" },
      { rotulo: "Pergunta 2", href: "/analises/gastos" },
      { rotulo: "Pergunta 8", href: "/analises/financiamento" },
    ],
    anos: "2018–2026",
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
  },

  p1: {
    id: "p1",
    resposta: "Quanto todas as campanhas a um cargo gastaram, dividido pelo número de vagas, por ano e estado.",
    formula: { resultado: "custo da cadeira", parcelas: ["gasto de todas as campanhas ao cargo", "número de vagas"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver a resposta", href: "/analises/custo-cadeira" }, { rotulo: "Gasto por vaga no mapa, cidade por cidade", href: "/?ver=dinheiro#mapa" }],
    anos: "2018–2026",
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
    resposta: "Se, na mesma disputa, quem declarou mais patrimônio se elegeu mais do que quem declarou menos.",
    ondeVer: [{ rotulo: "Ver a resposta", href: "/analises/gastos" }, { rotulo: "Gasto por vaga no mapa, cidade por cidade", href: "/?ver=dinheiro#mapa" }],
    anos: "2006–2026 (dinheiro de campanha: 2018–2026)",
    cargos: "Todos os cargos titulares",
    turno: "Votos do 1º turno na correlação",
    dados: ["bem_candidato (bens declarados)", "vw_despesa_candidatura e receita_campanha (para comparar)", "resultado_candidatura e rotulo_resultado", "candidatura, eleicao e cargo"],
    recorte: ["Titulares", "Eleições ordinárias", "Quem de fato disputou"],
    calculo: [
      "Patrimônio = soma dos bens que o candidato declarou ao TSE no registro da candidatura (casas, terrenos, veículos, aplicações...), no valor informado por ele, sem correção pela inflação. Quem não declarou nenhum bem entra como “nada declarado”.",
      "Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador), o estado (deputados, senador e governador) ou o país (presidente).",
      "“Muito” é cerca de 1/4 de quem declarou algo, os que mais têm na disputa; “pouco”, cerca de 1/4, os que menos têm; “médio”, o meio. Valores iguais ficam sempre no mesmo grupo, por isso os grupos têm tamanho aproximado.",
      "Em prefeito, governador, senador e presidente há poucos candidatos por disputa, então a pergunta vira “o que tinha mais patrimônio venceu?”, comparada com a chance de um sorteio.",
      "A resposta “Sim” ou “Não” só aparece quando a diferença é grande demais para ser acaso (teste estatístico, 95% de confiança) e de pelo menos 20%; com poucos casos, a página diz que não dá para afirmar.",
      "Correlação: cada candidato recebe sua posição no patrimônio e nos votos (1º turno) dentro da disputa, com a média das posições em caso de empate (como no Spearman), dividida pelo número de candidatos; as posições de todas as disputas do cargo são reunidas numa só correlação.",
      "Para comparar, a mesma conta pode ser feita com o dinheiro da campanha, da prestação de contas final (2018 em diante): o gasto, a receita (inclusive material doado por outros candidatos) ou os recursos, o maior dos dois. Quem não entregou a prestação final fica de fora: não se sabe quanto teve.",
      "Sucesso eleitoral = ter sido eleito, conforme o resultado do TSE. Só titulares, eleições ordinárias e quem de fato disputou.",
    ],
    limites: [
      "Mostra que patrimônio e vitória andam juntos, não que ser rico fez ganhar: quem tem mais patrimônio também costuma ter mais dinheiro de campanha e, muitas vezes, já um mandato.",
      "O patrimônio é o declarado pelo candidato: bens podem estar em nome de outras pessoas ou com valor desatualizado.",
      "Sem diferença estatística não quer dizer sem relação; com poucos casos, a página diz que não dá para afirmar.",
    ],
    sql: ["api/app/analises/q2.sql"],
  },

  p8: {
    id: "p8",
    resposta: "De onde vem o dinheiro das campanhas e se quem recebeu mais do Fundo Eleitoral e do Fundo Partidário se elegeu mais que os concorrentes.",
    ondeVer: [{ rotulo: "Ver a resposta", href: "/analises/financiamento" }, { rotulo: "Gasto por vaga no mapa, cidade por cidade", href: "/?ver=dinheiro#mapa" }],
    anos: "2018–2026",
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

  p4: {
    id: "p4",
    resposta: "No mapa, a parte da população de 18 anos ou mais de cada município (Censo 2022) com o grau de instrução escolhido. Ao passar o mouse, o grau do prefeito eleito e o grau mais comum na população; no painel, os eleitos (prefeito e vereadores) de 2020 ou 2024 ao lado da população.",
    ondeVer: [{ rotulo: "Ver a resposta no mapa", href: "/?ver=instrucao" }],
    anos: "2020 e 2024",
    cargos: "Prefeito e vereador eleitos",
    dados: [
      "candidatura, nivel_instrucao, eleicao, cargo, rotulo_resultado e municipio (banco bdr_final)",
      "populacao_instrucao: pessoas de 18 anos ou mais por grau de instrução, Censo 2022 (IBGE, SIDRA 10061)",
    ],
    recorte: ["Eleições municipais ordinárias em volta do Censo 2022", "Só os eleitos, titulares (sem vices)", UFS],
    calculo: [
      "O IBGE publica quatro grupos de instrução: sem instrução e fundamental incompleto, fundamental completo e médio incompleto, médio completo e superior incompleto, e superior completo. Os rótulos do TSE, mais detalhados (analfabeto, “lê e escreve”, fundamental incompleto…), entram nesses quatro grupos.",
      "A cor do mapa é a parte da população de 18 anos ou mais no grau escolhido: um recorte dos quatro grupos, acumulado do menor ao maior grau: “sem o fundamental completo”, “fundamental completo ou mais”, “médio completo ou mais” ou “superior completo”. Os grupos somados aparecem contornados nas barras do painel. Cores em quintos: cada cor reúne um quinto dos municípios dos seis estados.",
      "Grau mais comum na população: o grupo com mais gente no município (no empate, o mais baixo).",
      "Para um estado ou os seis juntos, as pessoas e os eleitos são somados antes da divisão.",
      "Eleito: o resultado final da candidatura (2º turno, quando houve).",
    ],
    limites: [
      "Os quatro grupos do IBGE não separam, por exemplo, quem é analfabeto de quem não terminou o fundamental: o detalhe do TSE se perde.",
      "O grau do eleito é o que ele declarou no registro da candidatura, sem conferência; o da população é a resposta ao Censo.",
      "A população adulta inclui os mais velhos, que estudaram menos; os eleitos não têm a mesma distribuição de idade.",
      "Quem não informou a instrução ao TSE fica de fora da conta dos eleitos.",
      "Município sem prefeito eleito na eleição ordinária (eleição anulada, por exemplo) aparece sem prefeito.",
    ],
    sql: ["api/app/analises/q4.sql"],
  },

  p6: {
    id: "p6",
    resposta: "No mapa, a idade de quem vota em cada município: a idade média, a parte de 16 a 29 anos ou a de 60 anos ou mais. No painel, essa idade cruzada com a dos candidatos votados ali (municípios com eleitorado mais jovem votam em candidatos mais jovens?) ou com o viés político dos votos.",
    ondeVer: [{ rotulo: "Ver a resposta no mapa", href: "/?ver=idade" }],
    anos: "2018–2026",
    cargos: "Presidente, deputado federal e estadual, senador, governador, prefeito e vereador (à escolha)",
    turno: "1º turno",
    dados: [
      "perfil_eleitorado e faixa_etaria: eleitores aptos por faixa etária em cada eleição (TSE)",
      "populacao_idade: pessoas por idade no Censo 2022 (IBGE)",
      "votos_candidatura_municipio e candidatura (idade na eleição); votos_partido_municipio e vies_partido (viés)",
    ],
    recorte: ["Eleições ordinárias, 1º turno, só titulares", "Eleitorado de 16 anos ou mais; no Censo, pessoas de 16 anos ou mais", UFS],
    calculo: [
      "Idade média do eleitorado: cada faixa etária do TSE conta pelo ponto médio dela (21 a 24 anos = 22,5; 100 anos ou mais = 100), ponderada pelos eleitores. Jovens: 16 a 29 anos; idosos: 60 anos ou mais. No Censo 2022, cada idade conta por ela mesma.",
      "O Censo 2022 vale para a eleição de 2022 e as municipais em volta (2020 e 2024), como no resto do mapa; o eleitorado do TSE existe em todas as eleições.",
      "Idade dos votados: a média da idade dos candidatos na data da eleição, ponderada pelos votos que cada um teve no município. Também mostramos a parte dos votos que foi para quem tinha até 29 anos.",
      "Viés: o mesmo da pergunta 7 (média do score dos partidos, ponderada pelos votos).",
      "Cores do mapa em quintos: cada cor reúne um quinto dos municípios dos seis estados. Para um estado ou os seis juntos, eleitores e votos são somados antes da divisão.",
      "A dispersão tem um ponto por município, com a correlação de Pearson (r) e a reta de mínimos quadrados.",
    ],
    limites: [
      "O TSE não diz em quem cada eleitor votou: a relação é entre municípios (um município com eleitorado mais jovem dá mais votos a candidatos jovens?), não entre pessoas. Concluir sobre o eleitor individual é a falácia ecológica.",
      "Nos cargos majoritários (presidente, senador, governador, prefeito) há poucos candidatos por lugar: a idade dos votados reflete onde cada candidato é forte, mais do que a idade de quem votou.",
      "As idades mínimas para concorrer variam (18 anos para vereador, 21 para deputado e prefeito, 30 para governador, 35 para senador) e o eleitorado começa aos 16: compare municípios entre si, não a idade do eleitor com a do votado.",
      "O ponto médio das faixas do TSE é uma aproximação da idade média; a faixa “inválida” fica de fora.",
      "Correlação não é causa: idade, renda, região e religião andam juntas.",
    ],
    sql: ["api/app/analises/vies.sql"],
  },

  p7: {
    id: "p7",
    resposta: "O viés político dos votos de cada município, estado ou dos seis estados juntos, de 2018 a 2026: a média do score dos partidos (−100 esquerda, +100 direita), ponderada pelos votos de cada partido. No mapa, a eleição escolhida; no painel, a linha do tempo.",
    formula: { resultado: "viés do município", parcelas: ["Σ votos do partido × score do partido", "votos em partidos com score"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver a resposta no mapa", href: "/?ver=vies" }],
    anos: "2018–2026",
    cargos: "Um de cada vez: presidente, deputado federal (padrão nos anos gerais), deputado estadual, senador, governador, vereador (padrão nos municipais) ou prefeito",
    turno: "1º turno",
    dados: [
      "vies_partido: score de cada partido em cada eleição, da pesquisa BLS com parlamentares (Brazilian Legislative Surveys), de −100 a +100",
      "votos_partido_municipio (nominais + legenda), eleicao, cargo e municipio",
      "votos_candidatura_municipio e candidatura (presidente, que não está nos votos por partido)",
    ],
    recorte: ["Eleições ordinárias, 1º turno", "Votos válidos dados a partidos (sem brancos e nulos)", UFS],
    calculo: [
      "Viés do município = soma, em todos os partidos, de (votos do partido × score do partido) ÷ votos em partidos com score. O score é o da eleição daquele ano.",
      "Para um estado ou os seis juntos, as somas dos municípios são somadas antes da divisão: o resultado é ponderado pelos votos.",
      "A linha do tempo compara só eleições do mesmo cargo: deputado federal em 2018, 2022 e 2026; vereador em 2020 e 2024; e assim por diante. O padrão é o deputado federal nos anos gerais e o vereador nos municipais, os cargos proporcionais, em que quase todo partido concorre e o voto é mais partidário.",
      "Presidente: os votos de cada candidato no município, 1º turno, contam para o partido dele (não para a coligação).",
      "As cores do mapa são nove faixas fixas, iguais em todos os anos e cargos: de −45 ou menos (vermelho) a +45 ou mais (azul), com o centro entre −5 e +5. As faixas são mais finas perto do centro porque a média de muitos partidos puxa para o meio.",
      "O nome da faixa (Esquerda, Centro-esquerda, Centro, Centro-direita, Direita) segue os cortes do Legislativo: ±20 e ±60.",
    ],
    limites: [
      "É o viés dos partidos votados, não do eleitor: quem vota num candidato pode não concordar com o partido dele.",
      "A linha do tempo mexe por dois motivos: o eleitor mudou de partido ou o partido mudou de posição na pesquisa daquela eleição.",
      "A média ponderada puxa para o centro: um município dividido entre esquerda e direita aparece no centro.",
      "Parte dos scores vem de fontes complementares (fusão de partidos, onda vizinha da pesquisa ou classificação editorial) quando a pesquisa não mediu o partido; votos em partido sem score ficam fora da média, e o painel avisa quanto.",
      "Nos cargos majoritários, o voto pesa a pessoa mais que o partido: o viés de presidente, governador ou senador diz mais sobre os candidatos fortes do lugar. Em presidente, o score é o do partido do candidato, mesmo quando a coligação é ampla.",
      "Cada cargo tem só os anos em que foi disputado: três pontos nos cargos das eleições gerais (2018, 2022, 2026) e dois nos municipais (2020, 2024).",
    ],
    sql: ["api/app/analises/vies.sql"],
  },

  p5: {
    id: "p5",
    resposta: "Quantidade e proporção dos votos de legenda de cada partido nas eleições para deputado e vereador, de 2018 a 2026, com as fusões e renomeações marcadas.",
    formula: { resultado: "proporção de legenda", parcelas: ["votos de legenda", "votos de legenda + votos nominais"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver a resposta", href: "/analises/legenda" }, { rotulo: "Voto de legenda no mapa", href: "/?ver=legenda" }],
    anos: "2018–2026",
    cargos: "Deputado federal, deputado estadual e vereador",
    turno: "1º turno",
    dados: ["votos_partido_municipio", "partido, eleicao, cargo e municipio", "vw_eleito_efetivo (eleitos por partido)", "candidatura, resultado_candidatura, rotulo_resultado e vagas (quem puxou quem)", "TSE, consulta_coligacao: coligações de 2018 e federações de 2022 e 2026"],
    recorte: ["Cargos proporcionais", "1º turno", "Eleições ordinárias", UFS],
    calculo: [
      "Siglas renomeadas aparecem com o nome atual (PRB → REPUBLICANOS, PR → PL, PPS → CIDADANIA, PTC → AGIR, PMN → MOBILIZA).",
      "Com “Juntar partidos que se fundiram”, os votos dos antigos passam para o atual: DEM e PSL → UNIÃO; PTB, PATRIOTA e PRP → PRD; PSC e PHS → PODEMOS; PROS → SOLIDARIEDADE; PPL → PCdoB.",
      "Datas das mudanças: ano da aprovação pelo TSE.",
      "Quem puxou quem (mapa, deputados de 2018, 2022 e 2026, com um estado escolhido): a lista que disputa as cadeiras é a coligação (2018), a federação (2022 em diante) ou o partido sozinho, segundo o TSE (dados abertos, consulta_coligacao). Quociente eleitoral = votos válidos (nominais + legenda) ÷ vagas, desprezada a fração igual ou menor que meio. Cada lista leva uma cadeira por quociente completo; as que sobram vão para as maiores médias. Quem foi eleito, e se pelo quociente ou pelas sobras, é o resultado do TSE.",
      "Puxador = quem teve votos para mais de um quociente e, sem esses votos, a lista perderia cadeiras além da dele. As cadeiras puxadas são as últimas da lista pelo quociente, que ficaram com os eleitos menos votados por quociente, de qualquer partido da lista.",
    ],
    limites: [
      "O voto de legenda só existe nos cargos proporcionais; prefeito, governador, senador e presidente ficam de fora.",
      "No mapa, o voto de legenda é mostrado por estado; por município ainda não.",
      "Quem puxou quem: vereadores ainda não. Amapá em 2026 ainda sem resultado na base.",
      "A conta do puxador olha só a fase do quociente: sem os votos dele, as sobras também mudariam, mas dependem das outras listas.",
    ],
    sql: ["api/app/analises/q5.sql", "api/app/analises/cadeiras.sql"],
    fonte: "Fonte: TSE, dados abertos; banco do projeto BDR. Cargos proporcionais, 1º turno, eleições ordinárias, em AP, ES, MG, PE, RJ e RR.",
  },

  p9: {
    id: "p9",
    resposta: "No perfil de cada candidato, quanto a campanha escolhida contratou em propaganda, dividido em impresso e de rua, rádio, TV e vídeo, e internet, ao lado da campanha típica do mesmo cargo, ano e estado.",
    ondeVer: [{ rotulo: "Ver a resposta no perfil de um candidato", href: "/candidatos" }],
    anos: "2018–2026",
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
    resposta: "No perfil de cada candidato, a carreira de 1998 a 2024 numa linha do tempo: cada eleição disputada, o cargo, o partido e se foi eleito.",
    ondeVer: [{ rotulo: "Ver a resposta no perfil de um candidato", href: "/candidatos" }],
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
    resposta: "Escolhido um nome, o mapa pinta cada município pela parte dos votos válidos do cargo que foi para essa candidatura. Para prefeito e vereador, destaca o município da disputa.",
    formula: { resultado: "parte no município", parcelas: ["votos da candidatura", "votos válidos do cargo no município"], operador: "÷" },
    ondeVer: [{ rotulo: "Abrir a visão Candidato", href: "/?ver=candidato" }],
    anos: "1998–2026",
    cargos: "Titulares, de vereador a presidente",
    turno: "1º e 2º turno, separados",
    dados: ["votos_candidatura_municipio", "votos_partido_municipio (votos de legenda)", "candidatura, eleicao e municipio"],
    recorte: ["Deputados, senador e governador: os municípios da UF da candidatura", "Presidente: os seis estados do projeto", "Prefeito e vereador: o município da disputa, em destaque no estado"],
    calculo: [
      "Válidos do cargo = votos nominais de todas as candidaturas da mesma disputa + votos de legenda. Antes de 2018 o TSE não publica o voto de legenda por município: a parte de cada município é calculada só sobre os votos nominais.",
      "Cores em quintos dos municípios. Um deputado costuma ter quase 0% na maior parte do estado: se um quinto ou mais dos municípios fica abaixo de 0,5%, essa vira a primeira faixa e as outras quatro dividem o resto.",
      "Com 2º turno, cada turno tem o seu mapa; a variação é a diferença, em pontos, da parte dos válidos entre os dois.",
      "Prefeito e vereador disputam num município só, e não há votos por bairro ou seção: o mapa destaca o município da disputa, sem pintar uma proporção.",
    ],
    limites: [
      "Para presidente, o mapa cobre só os seis estados do projeto, não o país.",
      "Para prefeito e vereador, o mapa não mostra onde, dentro do município, vieram os votos.",
      "Mostra onde a candidatura teve votos, não por quê.",
    ],
    sql: ["api/app/queries/votos_municipio.sql", "api/app/queries/candidato_mapa.sql"],
  },
  legislativo: {
    id: "legislativo",
    resposta: "Quem ocupa as cadeiras do Senado, da Câmara e das Assembleias dos seis estados em 2018, 2022 e 2026: o viés ideológico de cada partido, o que as campanhas gastaram por cadeira e quantos eleitos já tinham mandato.",
    formula: { resultado: "custo da cadeira", parcelas: ["gasto de todas as campanhas ao cargo", "cadeiras em disputa"], operador: "÷" },
    ondeVer: [{ rotulo: "Ver o Legislativo", href: "/legislativo" }],
    anos: "2018, 2022 e 2026",
    cargos: "Senador, deputado federal e deputado estadual",
    dados: [
      "vies_partido: viés de cada partido por eleição, da pesquisa com parlamentares (Brazilian Legislative Surveys), de −100 a +100",
      "candidatura, eleicao, rotulo_resultado, partido e vagas",
      "vw_despesa_candidatura (sobre despesa_campanha), como na pergunta 1",
    ],
    recorte: ["Eleitos titulares", "Eleições ordinárias", `Só ${UFS}: da Câmara, 150 das 513 cadeiras; do Senado, 18 das 81`],
    calculo: [
      "Cada cadeira é um eleito. Câmara e Assembleias: os eleitos do ano. Senado: a composição da legislatura, com os eleitos no ano e os eleitos quatro anos antes (o mandato é de oito anos).",
      "Viés: o do partido pelo qual a pessoa foi eleita, na eleição em que foi eleita, de −100 (esquerda) a +100 (direita), com o erro padrão da pesquisa. Os senadores eleitos em 2014, antes da pesquisa, levam o viés de 2018 do mesmo partido (o PMDB, que virou MDB em 2017, leva o do MDB). O viés médio da casa é a média das cadeiras, cada uma pesando igual. Partido que só mudou de nome (PMDB → MDB, PRB → Republicanos, PR → PL, PPS → Cidadania, PTC → Agir) aparece com o nome em vigor no ano da composição; fusões e incorporações ficam separadas.",
      "Faixas do viés, cinco de 40 pontos cada: esquerda (abaixo de −60), centro-esquerda (−60 a −20), centro (−20 a +20), centro-direita (+20 a +60) e direita (acima de +60). As cores seguem a convenção usual, do vermelho (esquerda) ao azul (direita); são as faixas do score, não uma classificação oficial dos partidos.",
      "As cadeiras ficam em ordem de viés, da esquerda para a direita. Na leitura Renovação, elas se agrupam em blocos (reeleitos, já eleitos e estreantes, cada bloco na ordem do viés); na leitura Custo, podem ser ordenadas do maior para o menor gasto (ou o contrário) e filtradas por faixa do viés, que apaga as cadeiras das outras faixas. Na leitura Partido, as cores são aproximações da identidade visual de cada partido, escolhidas pelo projeto (não vêm dos dados).",
      "Custo da cadeira (pergunta 1): gasto de todas as campanhas ao cargo, inclusive as derrotadas e as que não chegaram a disputar, ÷ cadeiras em disputa no ano. Por partido, o gasto das campanhas do partido ÷ cadeiras que ele ganhou. Na cadeira, o gasto do próprio eleito, colorido pelo quarto da casa em que ele está.",
      "Renovação: reeleito venceu para a mesma casa e estado na eleição anterior (no Senado, oito anos antes); já eleito venceu outra eleição na base, para qualquer cargo, desde 1998; estreante não tem vitória na base.",
    ],
    limites: [
      "Só seis estados: o plenário inteiro da Câmara e do Senado mostra as outras cadeiras em contorno, sem partido.",
      "O viés é do partido, não de cada parlamentar; e nem todo partido foi medido em toda onda da pesquisa (a ficha de cada cadeira avisa quando o valor vem de outra onda, de fusão ou de um partido de referência).",
      "Quem assumiu como suplente não aparece: a cadeira é de quem foi eleito.",
      "Estreante quer dizer sem vitória na base (desde 1998 e só nestes seis estados), não sem carreira política.",
      "Valores de campanha sem correção pela inflação; não há despesas antes de 2018.",
    ],
    sql: ["api/app/analises/legislativo.sql"],
  },
};

/** As dez perguntas de pesquisa, no texto do dossiê. Sem `id`, a plataforma ainda não responde: a /sobre diz "Em breve". */
/**
 * O "Como calculamos" da camada Dinheiro do mapa (VisaoDinheiro): além da regra da análise, as medidas e os blocos que só
 * o mapa mostra (gasto por eleitor, cada cadeira, quartis, quem mais gastou...). A página /analises/dinheiro e a /sobre
 * usam METODOLOGIA.dinheiro.
 */
export const CALCULO_MAPA_DINHEIRO: string[] = [
      "Gasto por vaga: soma dos gastos declarados por todas as campanhas ao cargo, inclusive as derrotadas, ÷ número de vagas. Não é salário nem o custo do mandato. Cidades de porte semelhante: a mediana das cidades com eleitorado parecido; estado: soma de todos os gastos ÷ soma de todas as vagas.",
      "Gasto por eleitor: a mesma soma de gastos ÷ eleitores aptos do lugar no 1º turno. Parte pública: dinheiro dos fundos Eleitoral e Partidário ÷ tudo o que as campanhas ao cargo receberam. No mapa, os estados ficam em três faixas (terços dos seis) e as cidades em faixas fixas, iguais em todos os estados e anos.",
      "Cobertura: junto do número vai quantas candidaturas têm prestação de contas final na base. Quem não tem entra com zero nas somas (o valor é desconhecido, e o total pode estar incompleto). “Na base” não quer dizer contas aprovadas pela Justiça Eleitoral.",
      "Onde o dinheiro foi gasto: as despesas em grupos de categoria do TSE (propaganda impressa e de rua, internet, rádio e TV, militância e eventos, pessoal, serviços, transporte, estrutura, outros). São valores contratados, não pagos, e o município é o da candidatura, não o do fornecedor.",
      "Todo o dinheiro de campanha (P2): o maior valor entre receitas e despesas declaradas, para considerar também campanhas que receberam material. Só o dinheiro público (P8): o que veio do Fundo Eleitoral e do Fundo Partidário, inclusive por meio de outro candidato.",
      "Prefeito, governador e senador: se quem teve o maior gasto declarado venceu. Ficam de fora disputas com um só candidato, prestação de contas incompleta, sem gasto ou com empate no maior gasto.",
      "Teste estatístico: comparação de duas proporções com 95% de confiança; o projeto só destaca diferenças de pelo menos 20% (regra do projeto). Sem diferença estatística não quer dizer sem relação; com diferença, não quer dizer causa.",
      "Fonte: TSE (prestação de contas final ou regularização). Só titulares, eleições ordinárias e quem disputou; dinheiro de 2018 em diante. Quem não tem a prestação final na base aparece como “Não informado”. Campanhas que não chegaram a disputar ficam fora daqui; a Pergunta 1 soma o gasto delas no custo da cadeira, e a página diz quanto é quando há diferença.",
      "Eleição anterior: a variação é nominal, sem correção pela inflação, e só entre eleições do mesmo tipo (vereador 2020 × 2024; deputado 2018 × 2022).",
      "Quanto cada partido gastou: a soma dos gastos declarados pelas campanhas do partido ao cargo, no mesmo recorte do número (cidade, porte, estado ou os seis). Quanto custou um voto: esse gasto ÷ votos nominais no 1º turno (o voto só na legenda não entra).",
      "Quartis: os candidatos que entregaram as contas e declararam algum gasto, em quatro grupos de tamanho aproximado, do que menos ao que mais gastou, comparando cada um com os do mesmo recorte (valores iguais ficam no mesmo grupo). Quem não declarou gasto e quem não entregou as contas aparecem à parte. Numa cidade, só com pelo menos 8 candidatos com gasto (não vale para prefeito).",
      "Ano a ano: o mesmo cargo nas eleições com dados de dinheiro, no mesmo lugar; valores da época, e as partes (parte pública, fatia dos 25% que mais gastaram) comparadas em pontos percentuais.",
      "Quem mais gastou: as 10 campanhas de maior gasto declarado no recorte, entre todos os que disputaram ou só entre os eleitos; a parte pública é o que veio do Fundo Eleitoral e do Fundo Partidário no que a campanha recebeu.",
      "Cada cadeira: gasto de todas as campanhas ao cargo ÷ cadeiras em disputa no recorte; o eleito típico é a mediana do gasto dos eleitos que entregaram as contas.",
      "Dependeu do dinheiro público: mais da metade do que a campanha recebeu veio do Fundo Eleitoral e do Fundo Partidário. “De cada 100” arredonda pelos maiores restos para somar 100; com menos de 20 pessoas, mostra a conta de verdade (ex.: 2 de 3).",
      "Propaganda: as despesas de propaganda viram peças (santinho, adesivo, Facebook...) pelo mesmo dicionário da Pergunta 9; o tamanho da palavra é o valor contratado. Dá para ver todos os candidatos ou só os eleitos; o filtro de porte não se aplica à nuvem.",
];

export const PERGUNTAS: { n: number; texto: string; id?: IdMetodologia }[] = [
  { n: 1, texto: "Qual é o custo por cadeira conquistada?", id: "p1" },
  { n: 2, texto: "Existe relação entre o patrimônio do candidato e a taxa de sucesso eleitoral?", id: "p2" },
  { n: 3, texto: "Como as características socioeconômicas dos municípios se relacionam com votação partidária e abstenção?", id: "mapa" },
  { n: 4, texto: "Grau de instrução dos candidatos versus o da população?", id: "p4" },
  { n: 5, texto: "Qual é a quantidade e a proporção de votos de legenda recebidos por cada partido?", id: "p5" },
  { n: 6, texto: "Qual a relação entre a idade da população do município com o viés político?", id: "p6" },
  { n: 7, texto: "Qual o viés político do município/região na linha do tempo?", id: "p7" },
  { n: 8, texto: "Candidatos eleitos e não eleitos apresentam diferenças no uso de recursos públicos e privados?", id: "p8" },
  { n: 9, texto: "Onde o candidato investe em propaganda?", id: "p9" },
  { n: 10, texto: "Como ocorre a permanência e a trajetória dos políticos na carreira eleitoral ao longo do tempo?", id: "p10" },
];

/** Fora das dez perguntas, mas com metodologia própria na /sobre. */
export const TAMBEM: { texto: string; id: IdMetodologia; icone: "mapa" | "plenario" }[] = [
  { texto: "Onde um candidato teve votos, município a município?", id: "candidato", icone: "mapa" },
  { texto: "Quem ocupa as cadeiras do Legislativo, com que viés e a que custo?", id: "legislativo", icone: "plenario" },
];

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

/** dado: existe naquele ano; censo: a eleição daquele ano é comparada com o Censo da linha. */
export type Cobertura = "dado" | "censo";

export interface LinhaEscopo { dado: string; nota: string; anos: Partial<Record<number, Cobertura>> }

/** Anos de eleição ordinária da base: 1998 a 2026, de dois em dois. */
export const ANOS_ELEICAO = Array.from({ length: 15 }, (_, i) => 1998 + 2 * i);

const de = (a0: number, a1: number, c: Cobertura) =>
  Object.fromEntries(ANOS_ELEICAO.filter((a) => a >= a0 && a <= a1).map((a) => [a, c])) as Partial<Record<number, Cobertura>>;

export const ESCOPO: LinhaEscopo[] = [
  { dado: "Candidaturas e votação", nota: "carreira e perfil", anos: de(1998, 2026, "dado") },
  { dado: "Participação e abstenção", nota: "o mapa (pergunta 3)", anos: de(2008, 2026, "dado") },
  { dado: "Censo 2010", nota: "Atlas do Desenvolvimento Humano", anos: de(2008, 2012, "censo") },
  { dado: "Censo 2022", nota: "IBGE", anos: de(2020, 2024, "censo") },
  { dado: "Instrução dos eleitos × população", nota: "pergunta 4, com o Censo 2022", anos: { 2020: "censo", 2024: "censo" } },
  { dado: "Voto de legenda", nota: "pergunta 5", anos: de(2018, 2026, "dado") },
  { dado: "Receitas e despesas", nota: "perguntas 1, 2, 8 e 9", anos: de(2018, 2026, "dado") },
  { dado: "Fotos dos candidatos", nota: "banco à parte (bdr_fotos)", anos: de(2018, 2026, "dado") },
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
  const anos = Object.keys(l.anos).map(Number).sort((a, b) => a - b);
  if (!Object.values(l.anos).includes("censo")) return trechosDeAnos(anos);
  // o Censo vale para anos soltos, um a um: "comparado com 2008, 2010 e 2012"
  return `comparado com ${anos.slice(0, -1).join(", ")} e ${anos[anos.length - 1]}`;
}

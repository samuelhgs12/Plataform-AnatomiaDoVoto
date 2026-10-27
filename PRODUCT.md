# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Banca e professores da disciplina de Banco de Dados da UFPI.** Avaliam a plataforma como entrega acadêmica: querem
  ver que os dados foram carregados, validados e consultados corretamente, e que cada resposta tem origem rastreável.
- **Eleitor curioso.** Cidadão sem formação técnica que quer entender a abstenção na própria cidade ou conhecer um
  político (carreira, de onde veio o dinheiro, onde foi gasto). Chega sem saber o que procurar.

As duas audiências usam as mesmas páginas: o rigor que convence a banca não pode virar jargão que afasta o eleitor.

## Product Purpose

Tornar legíveis os dados eleitorais abertos do TSE de 1998 a 2024 para AP, ES, MG, PE, RJ e RR. A pessoa entra pelo
**mapa da abstenção** (estados e, com zoom, municípios, com indicadores dos Censos 2010 e 2022) e dele chega às pessoas (perfil de
cada candidato) e às análises agregadas, que respondem às perguntas de pesquisa do projeto: voto de legenda (P5),
recursos públicos × sucesso eleitoral (P8), gastos de propaganda (P9) e carreira, retenção e trocas de partido (P10).

Sucesso: a pessoa sai sabendo o que os dados mostram sobre o território, sobre um político e sobre as perguntas, e
confia nos números porque sabe de onde vêm e o que ficou de fora.

## Positioning

Um único banco validado (`bdr_final`) que liga território, pessoas e dinheiro: a mesma carreira é seguida de 1998 a
2024 por um identificador interno, os gastos e receitas de cada campanha são comparados com a mediana do cargo, e a
abstenção municipal é cruzada com o Censo. Não é fonte oficial; é um projeto acadêmico que explicita como leu os dados.

## Operating Context

- Rotas: `/` (mapa), `/candidatos` (listagem com filtros), `/candidato/[id]` (perfil), `/analises/*` (financiamento,
  legenda, gastos, custo da cadeira; retenção e trocas a fazer), `/sobre` (fonte, escopo, leitura, privacidade).
- Dados históricos e só leitura: Next.js 16 lê a API FastAPI (`/api/*`), e o mapa vem de JSON estático provisório.
- Equipe de quatro pessoas, entregas em fases de cerca de seis semanas (`docs/TAREFAS.md`).

## Capabilities and Constraints

- Análises usam só titulares e eleições ordinárias; "eleito" vem de `rotulo_resultado`; gastos só da prestação final ou
  regularização, sem transferências.
- Indicadores de cada Censo só são comparados com a eleição do ano dele e as municipais em volta: Censo 2010 (Atlas)
  com 2008, 2010 e 2012; Censo 2022 (IBGE, só os equivalentes aos do Atlas) com 2020, 2022 e 2024.
- Sem foto de candidato (não há nos dados); avatar por iniciais.
- O mapa é o centro da página inicial (decisão 9 em `docs/DECISOES.md`), a única decisão de desenho fechada.
- Em aberto pela equipe: identidade visual, slug público, inclusão de vereador na listagem, biblioteca de gráficos,
  hospedagem.

## Brand Commitments

- Nome: **Anatomia do Voto**.
- Voz **neutra e factual**: sem adjetivos de juízo e sem opinião sobre partidos ou pessoas; os números falam, e toda
  limitação dos dados é dita com clareza.
- Sempre deixar claro que é projeto acadêmico da UFPI e não fonte oficial.

## Evidence on Hand

- Dados reais do TSE via API e `web/public/data/mapa.json`; malha municipal em `web/public/malhas/municipios.svg`.
- Fotos de acervo aberto (Wikimedia Commons) em `web/public/fotos/`, com créditos em `credits.json`: urna, Congresso,
  votação. Nenhuma mostra candidato.
- Não existem depoimentos, parceiros ou números de uso: não inventar. Contato da equipe ainda é TODO em `/sobre`.

## Product Principles

1. **Território primeiro.** O mapa abre a experiência; pessoas e análises são aprofundamentos a partir dele.
2. **Rastreável.** Todo número diz de onde vem, que recorte usa e o que ficou de fora.
3. **Neutro.** Mostrar, não julgar: nenhuma escolha de texto, cor ou ordem pode favorecer partido ou pessoa.
4. **Legível para leigos, sólido para a banca.** Linguagem simples por cima, metodologia acessível por baixo.
5. **Privacidade inegociável.** Nunca exibir título eleitoral, CPF, data de nascimento ou documentos de doadores.

## Accessibility & Inclusion

- Todo gráfico tem `role="img"` + `aria-label` ou tabela equivalente; cor nunca é o único código (eleito = ponto cheio).
- Contraste mínimo 4,5:1, navegação por teclado nos filtros, `lang="pt-BR"`.
- Funciona sem JavaScript onde possível (filtros com `<noscript>`, gráficos como componentes de servidor).

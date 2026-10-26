# CLAUDE.md

Leia também `docs/*.md` (arquitetura, decisões, telas, tarefas) e `web/AGENTS.md`: o Next.js deste projeto (16.x)
tem mudanças em relação ao que você conhece — consulte `web/node_modules/next/dist/docs/` antes de escrever código.

## Regra principal

**Lógica pura em `web/src/lib` com teste no vitest; componente só desenha.** Filtrar, agregar, unificar siglas,
calcular proporções e escalas são funções puras em `src/lib/<assunto>.ts`, testadas em `web/tests/`. Páginas e
componentes recebem os dados prontos e só montam o HTML/SVG.

## Como uma análise chega à página

- Cada `api/app/analises/<nome>.sql` vira `GET /api/analises/<nome>` sozinho (sem registrar nada): os `CREATE TEMP`
  preparam a sessão e cada `COPY (...) TO 'x.csv'` vira a tabela `x`, no formato `{colunas: [...], linhas: [[...]]}`
  (`TabelaEstatica`). `?tabela=x` (pode repetir) devolve só as pedidas. q5 tem `legenda`, `eventos` e `linhagem` (tipos
  em `src/lib/legenda.ts`). O resultado fica no cache da API e do Next (dados históricos).
- Na página (componente de servidor, `async`): `await lerAnalise("q5", ["legenda"])` (`src/lib/api.ts`, devolve `null`
  se a API não responder) → `comoObjetos<Linha>(dados.tabela)` → função de `src/lib/<assunto>.ts`.
- Se a tabela faltar, mostre o `card aviso` dizendo que a API não respondeu (veja `analises/legenda`).
- Exceção provisória: o mapa da página inicial ainda é JSON estático (`pipeline/export_static.py` → `web/public/data/mapa.json`,
  lido com `lerEstatico("mapa")` de `src/lib/data.ts`; tabelas `municipios`, `participacao`, `indicadores` e `dicionario`,
  tipos em `src/lib/abstencao.ts`), porque parte dos dados ainda vem do TSE, fora do banco (decisão 10).
- O que é **por candidatura** não é análise: fica no perfil (`candidato/[id]`), com um endpoint por bloco em
  `/api/candidaturas/<id>/...` e a mesma campanha escolhida (`?campanha=<id_candidatura>`) em todos os blocos. P8:
  `receitas` → `DinheiroCampanha`; P9: `propaganda` (centavos inteiros) → `PropagandaCampanha` (lógica em `src/lib/propaganda.ts`
  e `src/lib/nuvem.ts`; desenho em `BarraPecas` e `NuvemPalavras`). A comparação com a campanha típica vem da análise q9:
  o perfil lê `referencia` e, só quando o grupo (cargo + ano + UF) tem menos de 30 campanhas, `parcelas`, para tirar a
  própria campanha da típica.

## Como filtros viram searchParams

- `searchParams` é uma `Promise` (Next 16): `const sp = await searchParams`; normalize com `um()` (pega o 1º valor
  de arrays) e **valide contra as opções que existem nos dados** (ex.: `ufs.includes(uf)`), senão ignore o filtro.
- Análises usam `export const dynamic = "force-dynamic"` e filtros como `<Link className="chip">` (classe `on` no ativo);
  um helper `href(nova)` mescla o estado atual com a mudança via `URLSearchParams` (veja `analises/legenda`).

## Quando usar componente cliente (`"use client"`)

Só com estado/eventos/efeitos do navegador: `Filters` e `EscolhaMunicipio` (também escolhe o partido na visão de legenda, com `nome="p"`; selects que aplicam na hora com
`router.push` + `useTransition`, com `<noscript>` de fallback), `SearchBox` (sugestões via `fetch('/api/busca')`),
`BuscaNome` (abre/fecha), `MenuLateral` (recolhe em trilho com o botão ou a tecla `[`; gaveta no celular; estado em `<html data-menu>`), `PaletaBusca` (Ctrl K: páginas, estados e municípios de `/indice/municipios` filtrados por `src/lib/paleta.ts`, candidatos da `/api/busca`; a caixa nasce do botão por View Transition) e `MapaVivo` (navegação sem recarregar, dica e zoom do mapa da página inicial). Gráficos
(`MapaAbstencao`, `Dispersao`, `BarrasH`, `BarraPecas`, `NuvemPalavras`) e `PartyChip` são componentes de servidor sem JS
(`SpendBars` e `WordList` também, mas estão sem uso).

## Design visual

Fixo: **o mapa é o centro da página inicial** (decisão 9) e a **paleta e o logotipo** (decisão 12): cores-base da
identidade no topo de `globals.css` (`--marinho-*`, `--gelo`, `--ardosia*`, `--verde-*`, `--laranja-urna*`, `--amarelo-400`)
e papéis que apontam para elas (`--bg`, `--panel`, `--fg`, `--muted`, `--accent` = ação em verde, `--tinta` = teclas
marinho, `--menu-*`, `--noite*`/`--q*` do mapa, `--logo-*`); o tema escuro remapeia os papéis. Cores sempre como
`var(--…)` de papel, nunca fixas no componente. Logotipo: `Simbolo` e `Nome` de `components/Logotipo.tsx` (favicon em
`app/icon.svg`). Tipografia e layout seguem em aberto.

## Acessibilidade

Todo gráfico tem `role="img"` + `aria-label` (ou tabela equivalente) e não depende só de cor.

## Testes do web

- Vitest (`vitest.config.ts` inclui `tests/**/*.test.ts`): `web/tests/legenda.test.ts` para `src/lib/legenda.ts` e
  `web/tests/lib.test.ts` para o resto; um `describe` por função de `src/lib`, com uma fábrica de linha
  (`const l = (o: Partial<Linha>) => ({...padrão, ...o})`) e poucas linhas inventadas.
- Só lógica pura é testada (sem render de componente). Antes do PR: `npm run lint && npm run typecheck && npm test && npm run build`.
- Fluxos no navegador: Playwright na raiz (`tests/*.spec.ts`, `npx playwright test`; sobe o `npm run dev` sozinho).

# CLAUDE.md

Leia também `docs/*.md` (arquitetura, decisões, telas, tarefas) e `web/AGENTS.md`: o Next.js deste projeto (16.x)
tem mudanças em relação ao que você conhece — consulte `web/node_modules/next/dist/docs/` antes de escrever código.

## Regra principal

**Lógica pura em `web/src/lib` com teste no vitest; componente só desenha.** Filtrar, agregar, unificar siglas,
calcular proporções e escalas são funções puras em `src/lib/<assunto>.ts`, testadas em `web/tests/`. Páginas e
componentes recebem os dados prontos e só montam o HTML/SVG.

## Como uma análise lê o JSON estático

- `pipeline/export_static.py` roda `pipeline/sql/q5.sql`, `q8.sql`, `q10.sql` e `mapa.sql` (ou só os que forem passados:
  `python export_static.py mapa`); cada `COPY (...) TO 'x.csv'` vira a chave `x` em `web/public/data/<consulta>.json`,
  no formato `{colunas: [...], linhas: [[...]]}` (`TabelaEstatica`). q5 tem `legenda`, `eventos` e `linhagem` (tipos em
  `src/lib/legenda.ts`); mapa tem `municipios`, `participacao`, `indicadores` e `dicionario` (tipos em `src/lib/abstencao.ts`).
- Na página (componente de servidor, `async`): `await lerEstatico("q5")` (`src/lib/data.ts`, lê do disco, devolve
  `null` se o arquivo não existe) → `comoObjetos<Linha>(dados.tabela)` → função de `src/lib/<assunto>.ts`.
- Se a tabela faltar, mostre o `card aviso` pedindo para rodar `python export_static.py` (veja `analises/legenda`).

## Como filtros viram searchParams

- `searchParams` é uma `Promise` (Next 16): `const sp = await searchParams`; normalize com `um()` (pega o 1º valor
  de arrays) e **valide contra as opções que existem nos dados** (ex.: `ufs.includes(uf)`), senão ignore o filtro.
- Análises usam `export const dynamic = "force-dynamic"` e filtros como `<Link className="chip">` (classe `on` no ativo);
  um helper `href(nova)` mescla o estado atual com a mudança via `URLSearchParams` (veja `analises/pos-mandato`).

## Quando usar componente cliente (`"use client"`)

Só com estado/eventos/efeitos do navegador: `Filters` e `EscolhaMunicipio` (selects que aplicam na hora com
`router.push` + `useTransition`, com `<noscript>` de fallback), `SearchBox` (sugestões via `fetch('/api/busca')`),
`BuscaNome` (abre/fecha) e `MapaVivo` (navegação sem recarregar, dica e zoom do mapa da página inicial). Gráficos
(`MapaAbstencao`, `Dispersao`, `FlowBars`, `SpendBars`) e `PartyChip` são componentes de servidor sem JS.

## Design visual

Em aberto: cores, tipografia e layout das páginas ainda estão sendo definidos. A única decisão fixa é que **o mapa é o
centro da página inicial** (`docs/DECISOES.md`, decisão 9). Cores sempre como `var(--…)` de `globals.css`, nunca fixas
no componente.

## Acessibilidade

Todo gráfico tem `role="img"` + `aria-label` (ou tabela equivalente) e não depende só de cor.

## Testes do web

- Vitest (`vitest.config.ts` inclui `tests/**/*.test.ts`): `web/tests/legenda.test.ts` para `src/lib/legenda.ts` e
  `web/tests/lib.test.ts` para o resto; um `describe` por função de `src/lib`, com uma fábrica de linha
  (`const l = (o: Partial<Linha>) => ({...padrão, ...o})`) e poucas linhas inventadas.
- Só lógica pura é testada (sem render de componente). Antes do PR: `npm run lint && npm run typecheck && npm test && npm run build`.
- Fluxos no navegador: Playwright na raiz (`tests/*.spec.ts`, `npx playwright test`; sobe o `npm run dev` sozinho).

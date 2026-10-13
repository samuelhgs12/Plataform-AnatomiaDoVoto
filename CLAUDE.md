# CLAUDE.md

Leia também `docs/*.md` (arquitetura, decisões, telas, tarefas) e `web/AGENTS.md`: o Next.js deste projeto (16.x)
tem mudanças em relação ao que você conhece — consulte `web/node_modules/next/dist/docs/` antes de escrever código.

## Regra principal

**Lógica pura em `web/src/lib` com teste no vitest; componente só desenha.** Filtrar, agregar, unificar siglas,
calcular proporções e escalas são funções puras em `src/lib/<assunto>.ts`, testadas em `web/tests/`. Páginas e
componentes recebem os dados prontos e só montam o HTML/SVG.

## Como uma análise lê o JSON estático

- `pipeline/export_static.py` roda `pipeline/sql/q5.sql` e `q10.sql`; cada `COPY (...) TO 'x.csv'` vira a chave `x`
  em `web/public/data/q5.json` / `q10.json`, no formato `{colunas: [...], linhas: [[...]]}` (`TabelaEstatica`).
  q5 tem `legenda_partido`, `legenda_total`, `legenda_municipio` e `legenda_ranking`.
- Na página (componente de servidor, `async`): `await lerEstatico("q5")` (`src/lib/data.ts`, lê do disco, devolve
  `null` se o arquivo não existe) → `comoObjetos<Linha>(dados.tabela)` → função de `src/lib/<assunto>.ts`.
- Se a tabela faltar, mostre o `card aviso` pedindo para rodar `python export_static.py` (veja `analises/legenda`).

## Como filtros viram searchParams

- `searchParams` é uma `Promise` (Next 16): `const sp = await searchParams`; normalize com `um()` (pega o 1º valor
  de arrays) e **valide contra as opções que existem nos dados** (ex.: `ufs.includes(uf)`), senão ignore o filtro.
- Análises usam `export const dynamic = "force-dynamic"` e filtros como `<Link className="chip">` (classe `on` no ativo);
  um helper `href(nova)` mescla o estado atual com a mudança via `URLSearchParams` (veja `analises/pos-mandato`).

## Quando usar componente cliente (`"use client"`)

Só com estado/eventos/efeitos do navegador: `Filters` (selects que aplicam na hora com `router.push` +
`useTransition`, com `<noscript>` de fallback), `SearchBox` (sugestões via `fetch('/api/busca')`) e `BuscaNome`
(abre/fecha). Gráficos (`FlowBars`, `SpendBars`) e `PartyChip` são componentes de servidor sem JS.

## Classes e tokens de `web/src/app/globals.css` para gráficos

- Tokens: `--bar`, `--accent` (destaque/propaganda), `--ok`, `--warn`, escala `--w1..--w4` (azuis) e `--l1`, `--l2`
  (laranjas), `--o` (neutro), `--panel2` (trilho), `--line` (grade), `--fg`/`--muted`, `--on-dark`/`--on-light` (texto
  sobre cor). Há variantes para tema escuro; use sempre `var(--…)`, nunca cor fixa.
- Barras empilhadas 100%: `.flow` (grid rótulo | barra, `.nm` + `small`), `.stack`, `.seg` + `.w1..w4/.l1/.l2/.o`, `.legend i`.
- Barras horizontais com referência: `.spend`, `.trilho`, `.barra` (`.prop`), `.mediana`.
- SVG: `.chart` (`.wide` + `.chartwrap` para rolar no celular), `svg text`, `svg .gr` (linha de grade).
- Tabelas: `.tablewrap`, `td.num`/`th.num`. Cor de partido: `corPartido()` / `<PartyChip>`.
- Acessibilidade: todo gráfico tem `role="img"` + `aria-label` (ou tabela equivalente) e não depende só de cor.

## Testes do web

- Vitest (`vitest.config.ts` inclui `tests/**/*.test.ts`); hoje tudo em `web/tests/lib.test.ts`, um `describe` por
  função de `src/lib`, com uma fábrica de linha (`const l = (o: Partial<Linha>) => ({...padrão, ...o})`).
- Só lógica pura é testada (sem render de componente). Antes do PR: `npm run lint && npm run typecheck && npm test && npm run build`.

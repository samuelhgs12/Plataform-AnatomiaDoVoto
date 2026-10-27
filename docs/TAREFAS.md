# Plano de trabalho

## O que o esqueleto já faz

- API com busca, listagem, perfil, gastos por categoria (com mediana do cargo), palavras e receitas, 16 testes e teste de privacidade.
- Front com início, listagem com filtros, perfil (linha do tempo, dinheiro da campanha e propaganda, com nuvem de palavras e comparação com a campanha típica), análises agregadas e página "Sobre".
- Análises agregadas (perguntas 1, 2, 5, 8, 9 e 10) servidas pela API em `/api/analises/<nome>`; a da pergunta 9 (q9) é lida pelo perfil; o mapa da página inicial é exportado para JSON.
- Página inicial com o mapa da abstenção (estados e municípios, 2008 a 2024) e os indicadores dos Censos 2010 (Atlas) e 2022 (IBGE).
- CI (testes da API; lint, tipos, testes e build do front), Docker e `.env.example`.

## Fases (cerca de 6 semanas)

| Fase | Entrega | Onde mexer |
|---|---|---|
| **1. Fundação** (sem. 1–2) | Rodar tudo com os dados reais; conferir os números contra o projeto de carga; ajustar busca e perfil; deploy da API e do site | `api/`, `web/` |
| **2. Perguntas 9 e 10** (sem. 3–4) | Retenção por turma, trocas de partido, propaganda por cargo; pré-calcular referências (mediana) e trocas com sucessão partidária; nuvem de palavras de verdade (pergunta 9 feita no perfil: nuvem, barra por peça e típica da q9) | `pipeline/`, `api/`, `web/src/components` |
| **3. Demais perguntas** (sem. 5–6) | P5 com gráfico e mapa; P1/P2 (custo por voto e percentil no perfil); P8; acessibilidade, desempenho e testes de ponta a ponta | tudo |
| **Depois** | IBGE (população, escolaridade, faixa etária) cruzado com o eleitorado; outros mapas municipais (legenda) | `pipeline/`, `web/` |

## Divisão sugerida (4 pessoas)

| Pessoa | Foco | Primeiras tarefas |
|---|---|---|
| 1 | Dados e SQL (`pipeline/`, `api/app/queries/`) | tabelas `app.*` pré-calculadas (referência de despesa, trocas com sucessão); conferir os números |
| 2 | API (`api/`) | novos endpoints, cache, limite de requisições, deploy |
| 3 | Perfil e listagem (`web/`) | refinar o perfil, custo por voto e percentil, responsividade, busca |
| 4 | Gráficos e análises agregadas (`web/`) | retenção, trocas, propaganda, legenda (gráfico e mapa), nuvem de palavras |

## Checklist de pull request

- [ ] `pytest` (api) e `npm run lint && npm run typecheck && npm test && npm run build` (web) passam.
- [ ] Nenhum campo novo expõe título eleitoral, CPF, data de nascimento ou documento de doador.
- [ ] Consulta nova usa parâmetros `?` e tem teste.
- [ ] Gráfico novo tem texto/tabela equivalente e não depende só de cor.
- [ ] Números novos foram conferidos contra o projeto de carga.

## TODOs deixados no código

**Dados do mapa no banco (depende do `load_BDR`):** a carga precisa trazer a participação eleitoral de 2008 a 2016
(`participacao_eleitoral`) e os indicadores com o código IBGE (`indicador_municipal`, `municipio.cod_ibge`, hoje só no
`bdr_v2`) para o banco que a plataforma usa. Feito isso, tirar de `pipeline/sql/mapa.sql` a parte
`tse_participacao`, movê-lo para `api/app/analises/` (a página inicial passa a usar `lerAnalise("mapa", ...)`) e apagar
`pipeline/export_static.py` e `web/public/data/` (decisão 10 em `DECISOES.md`).

Procure por `TODO`: dados do mapa no banco (`export_static.py`, `mapa.sql`), referências pré-calculadas (`despesas_referencia.sql`, `receitas_referencia.sql`), nuvem de palavras real (`WordList.tsx`, já superado: a nuvem do perfil é o `NuvemPalavras`, e o `WordList` ficou sem uso), mapa da legenda por município, e-mail de contato em `sobre/page.tsx`.

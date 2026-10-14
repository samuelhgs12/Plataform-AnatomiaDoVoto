# Plano de trabalho

## O que o esqueleto já faz

- API com busca, listagem, perfil, gastos por categoria (com mediana do cargo), palavras e receitas, 16 testes e teste de privacidade.
- Front com início, listagem com filtros, perfil (linha do tempo, gastos, palavras, receitas), duas análises agregadas e página "Sobre".
- Exportação dos agregados das perguntas 5 e 10 para JSON.
- CI (testes da API; lint, tipos, testes e build do front), Docker e `.env.example`.

## Fases (cerca de 6 semanas)

| Fase | Entrega | Onde mexer |
|---|---|---|
| **1. Fundação** (sem. 1–2) | Rodar tudo com os dados reais; conferir os números contra o projeto de carga; ajustar busca e perfil; deploy da API e do site | `api/`, `web/` |
| **2. Perguntas 9 e 10** (sem. 3–4) | Retenção por turma, trocas de partido, propaganda por cargo; pré-calcular referências (mediana) e trocas com sucessão partidária; nuvem de palavras de verdade | `pipeline/`, `api/`, `web/src/components` |
| **3. Demais perguntas** (sem. 5–6) | P5 com gráfico e mapa; P1/P2 (custo por voto e percentil no perfil); P8; acessibilidade, desempenho e testes de ponta a ponta | tudo |
| **Depois** | IBGE (população, escolaridade, faixa etária) cruzado com o eleitorado; mapas municipais | `pipeline/`, `web/` |

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

Procure por `TODO`: referências pré-calculadas (`despesas_referencia.sql`, `receitas_referencia.sql`), nuvem de palavras real (`WordList.tsx`), mapa da legenda por município, e-mail de contato em `sobre/page.tsx`.

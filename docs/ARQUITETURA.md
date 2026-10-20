# Arquitetura

```
[Repositório de carga] ──► MotherDuck / bdr_final.duckdb   (já carregado e validado; somente leitura aqui)
                               │  token só no servidor
                               ▼
                    ┌───────────────────────┐        ┌───────────────────────────┐
                    │ API FastAPI (api/)    │        │ pipeline/export_static.py │
                    │ SQL parametrizado     │        │ q5, q8, q10, mapa (.sql)  │
                    │ cache em memória      │        │   → web/public/data/*.json│
                    └──────────┬────────────┘        └─────────────┬─────────────┘
                               │ /api/*                            │ arquivos estáticos
                               ▼                                   ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │ Next.js (web/)   páginas dinâmicas + análises agregadas │
                    │ rewrites: /api/* → API (sem CORS, URL da API não pública)│
                    └─────────────────────────────────────────────────────────┘
                                          ▲
                                       Navegador (sem credenciais)
```

## Por que assim

| Decisão | Motivo |
|---|---|
| Token do MotherDuck **só na API** | O token é uma credencial de conta: no navegador, qualquer pessoa rodaria SQL arbitrário e gastaria a cota |
| Perfis via **API**, análises agregadas via **JSON estático** | 552 mil perfis não cabem num site estático; as análises agregadas são pequenas e não mudam (dados históricos) |
| Next.js repassa `/api/*` para a FastAPI (`rewrites`) | O navegador só fala com o próprio site: sem CORS e sem expor o endereço da API |
| Respostas com `Cache-Control` e cache em memória | Os dados são históricos: a mesma consulta nunca precisa ser refeita |
| Modelos Pydantic como lista de campos permitidos | É a barreira de privacidade: o que não está em `schemas.py` não sai |
| Consultas em arquivos `.sql` | Quem sabe SQL revisa e altera sem mexer em Python; todas são parametrizadas |

## Fluxo de uma visita ao perfil

1. `GET /candidato/42` chega ao Next.js (componente de servidor).
2. O Next chama `GET {API_URL}/api/candidatos/42` e, para a candidatura escolhida, `/despesas`, `/palavras` e `/receitas`.
3. A API roda as consultas no DuckDB/MotherDuck (ou responde do cache) e devolve JSON só com campos públicos.
4. O Next monta o HTML (linha do tempo em SVG, barras de gasto) e o devolve.

## Regras de negócio herdadas do projeto de carga

- Análises usam só **titulares** e eleições **ordinárias**.
- "Eleito" e "disputou" vêm da tabela `rotulo_resultado` (em 2024 o TSE não divulgou a situação do registro).
- Gasto: prestação **FINAL ou REGULARIZACAO_OMISSAO**, sem transferências. Receita: sem repasses entre candidatos.
- Trocas de partido na API são uma comparação simples de siglas; a versão rigorosa (com sucessão partidária: DEM → UNIÃO etc.) está em `pipeline/sql/q10.sql`. **TODO:** pré-calcular e servir.

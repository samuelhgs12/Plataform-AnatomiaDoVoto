# Arquitetura

```
[Repositório de carga] ──► MotherDuck / bdr_final.duckdb   (já carregado e validado; somente leitura aqui)
                               │  token só no servidor
                               ▼
                    ┌───────────────────────┐        ┌───────────────────────────┐
                    │ API FastAPI (api/)    │        │ pipeline/export_static.py │
                    │ SQL parametrizado     │        │ só o mapa (provisório)    │
                    │ análises agregadas    │        │   → web/public/data/      │
                    │ cache em memória      │        │     mapa.json             │
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
| Perfis e análises agregadas via **API** | 552 mil perfis não cabem num site estático; nas análises, um `.sql` novo em `api/app/analises/` já vira rota, sem passo manual. O mapa ainda é JSON estático (decisão 10) |
| Next.js repassa `/api/*` para a FastAPI (`rewrites`) | O navegador só fala com o próprio site: sem CORS e sem expor o endereço da API |
| Respostas com `Cache-Control` e cache em memória | Os dados são históricos: a mesma consulta nunca precisa ser refeita |
| Modelos Pydantic como lista de campos permitidos | É a barreira de privacidade: o que não está em `schemas.py` não sai |
| Consultas em arquivos `.sql` | Quem sabe SQL revisa e altera sem mexer em Python; todas são parametrizadas |

## Fluxo de uma visita ao perfil

1. `GET /candidato/42` chega ao Next.js (componente de servidor).
2. O Next chama `GET {API_URL}/api/candidatos/42` e, para a candidatura escolhida, `/despesas`, `/palavras` e `/receitas`.
3. A API roda as consultas no DuckDB/MotherDuck (ou responde do cache) e devolve JSON só com campos públicos.
4. O Next monta o HTML (linha do tempo em SVG, barras de gasto) e o devolve.

## Como adicionar uma análise

1. Crie `api/app/analises/<nome>.sql`. Ele pode preparar a sessão com `CREATE OR REPLACE TEMP TABLE` (o banco é só
   leitura) e cada `COPY (SELECT ...) TO '<tabela>.csv' (HEADER);` vira uma tabela da resposta. O mesmo arquivo roda no
   `duckdb` de linha de comando.
2. A rota `GET /api/analises/<nome>` passa a existir sozinha e devolve `{tabela: {colunas, linhas}}`. Com
   `?tabela=a&tabela=b`, só as pedidas (o cache do Next não guarda respostas acima de 2 MB).
3. Na página: `await lerAnalise("<nome>", ["a", "b"])` (`web/src/lib/api.ts`) → `comoObjetos` → função de `src/lib`.
4. Teste em `api/tests/test_api.py`: o banco de teste (`tests/fixtures/`) precisa ter as tabelas que o SQL usa.

## Regras de negócio herdadas do projeto de carga

- Análises usam só **titulares** e eleições **ordinárias**.
- "Eleito" e "disputou" vêm da tabela `rotulo_resultado` (em 2024 o TSE não divulgou a situação do registro).
- Gasto: prestação **FINAL ou REGULARIZACAO_OMISSAO**, sem transferências. Receita: sem repasses entre candidatos.
- Trocas de partido na API são uma comparação simples de siglas; a versão rigorosa (com sucessão partidária: DEM → UNIÃO etc.) está em `api/app/analises/q10.sql` (tabela `trocas` de `/api/analises/q10`). **TODO:** usar no perfil.

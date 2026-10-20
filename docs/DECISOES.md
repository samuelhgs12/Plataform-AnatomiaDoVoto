# Decisões de projeto

| # | Decisão | Alternativas | Motivo |
|---|---|---|---|
| 1 | **Next.js + FastAPI** | SvelteKit, Streamlit | A equipe já tem familiaridade com as duas |
| 2 | Token do MotherDuck só no servidor | WASM no navegador | Segurança: o token seria visível a todos |
| 3 | `rewrites` do Next para a API | CORS e `NEXT_PUBLIC_API_URL` | Sem CORS; o endereço da API não fica público |
| 4 | Análises agregadas como JSON estático (`pipeline/`) | Consultar o banco a cada visita | Dados históricos; mais rápido e barato |
| 5 | Identificador público = `id_candidato` interno | Título eleitoral, CPF | Privacidade (LGPD): nunca expor documentos |
| 6 | SQL em arquivos `.sql` parametrizados | ORM | O time domina SQL; revisão mais fácil |
| 7 | Sem foto de candidato | Buscar fotos | Não há foto nos dados do TSE carregados |
| 8 | DuckDB 1.5.6 fixo | Versão livre | O formato do arquivo e o MotherDuck exigem versões compatíveis |
| 9 | **O mapa é o centro da página inicial**: abstenção por estado e, com zoom, por município, com indicadores ao lado | Página inicial de busca e cartões | Os dados são regionais; o mapa é a porta de entrada para eles |
| 10 | Abstenção de 2008 a 2016 vem dos dados abertos do TSE (`detalhe_votacao_munzona`), baixada pelo `export_static.py`; de 2018 em diante, do banco | Só os anos do banco | O banco não tem participação antes de 2018, e a comparação com o Censo 2010 precisa de 2008 e 2012 |
| 11 | Indicadores do Censo 2010 (Atlas do Desenvolvimento Humano, banco `bdr_v2`) só são comparados com a abstenção de 2008 e 2012 | Comparar com qualquer ano | São as eleições municipais em volta do Censo; nos outros anos o mapa mostra só a abstenção |

## A decidir pela equipe

- **Identidade visual**: cores, tipografia e layout das páginas estão em aberto (em iteração na branch `feature/redesign`).
  Só a decisão 9 está fechada.
- Consultar o MotherDuck ao vivo ou embutir um `serving.duckdb` na API (mais rápido, sem cota)?
- Incluir vereador na listagem (volume grande) ou só pela busca?
- Slug público: `id` interno ou hash (evita enumerar pessoas por número)?
- Biblioteca de gráficos para o que for além do SVG simples: Observable Plot, ECharts ou D3.
- Hospedagem (front: Vercel/Cloudflare; API: Render/Cloud Run/Fly.io) — conferir os limites gratuitos atuais.

# Decisões de projeto

| # | Decisão | Alternativas | Motivo |
|---|---|---|---|
| 1 | **Next.js + FastAPI** | SvelteKit, Streamlit | A equipe já tem familiaridade com as duas |
| 2 | Token do MotherDuck só no servidor | WASM no navegador | Segurança: o token seria visível a todos |
| 3 | `rewrites` do Next para a API | CORS e `NEXT_PUBLIC_API_URL` | Sem CORS; o endereço da API não fica público |
| 4 | Análises agregadas como JSON estático (`pipeline/`) | Consultar o banco a cada visita | Dados históricos; mais rápido e barato |
| 5 | Identificador público = `id_candidato` interno | Título eleitoral, CPF | Privacidade (LGPD): nunca expor documentos |
| 6 | SQL em arquivos `.sql` parametrizados | ORM | O time domina SQL; revisão mais fácil |
| 7 | Sem foto: avatar de iniciais na cor do partido | Buscar fotos | Não há foto nos dados do TSE carregados |
| 8 | DuckDB 1.5.6 fixo | Versão livre | O formato do arquivo e o MotherDuck exigem versões compatíveis |

## A decidir pela equipe

- Consultar o MotherDuck ao vivo ou embutir um `serving.duckdb` na API (mais rápido, sem cota)?
- Incluir vereador na listagem (volume grande) ou só pela busca?
- Slug público: `id` interno ou hash (evita enumerar pessoas por número)?
- Biblioteca de gráficos para o que for além do SVG simples: Observable Plot, ECharts ou D3.
- Hospedagem (front: Vercel/Cloudflare; API: Render/Cloud Run/Fly.io) — conferir os limites gratuitos atuais.

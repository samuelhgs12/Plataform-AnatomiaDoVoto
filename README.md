# Anatomia do Voto (BDR / UFPI)

Plataforma web sobre os dados eleitorais do TSE (1998–2024) de AP, ES, MG, PE, RJ e RR: **carreira** de cada político (pergunta 10), **gastos de campanha** por categoria (pergunta 9), votos de legenda (pergunta 5), recursos públicos × sucesso eleitoral (pergunta 8) e mais. O layout do perfil do candidato se inspira no especial "Quem são os candidatos" do G1.

Os dados vêm do banco `bdr_final` (DuckDB / MotherDuck), carregado e validado no **repositório de carga**. Este repositório só lê.

```
api/        FastAPI (Python): busca, listagem, perfil, gastos, receitas      → docs/API.md
web/        Next.js 16 (React 19, TypeScript): páginas e gráficos
pipeline/   gera os JSONs estáticos das análises agregadas (perguntas 5 e 10)
docs/       arquitetura, API, esboço das telas, decisões, plano de trabalho
```

**0. Acesso ao banco (MotherDuck)**

1. No MotherDuck, gere seu token pessoal (Settings → Access Tokens). Cada pessoa usa o próprio token.
2. Peça ao dono do banco o link do share, no formato `md:_share/bdr/<codigo>`.
3. Em `api/.env` (criado no passo 1), preencha:
   ```
   DATABASE=md:_share/bdr/<codigo>
   MOTHERDUCK_TOKEN=<seu token>
   ```

Na primeira execução a API anexa o share à sua conta com o nome `bdr`. O MotherDuck guarda esse anexo na conta, então nas próximas execuções a API só o reutiliza. Se você já tiver anexado o share por conta própria (pela interface do MotherDuck, por exemplo), também funciona. Outras opções para `DATABASE`: `md:bdr` (share já anexado como `bdr`) ou o caminho de um arquivo `.duckdb` local.

**Sem acesso ao MotherDuck**: rode a carga no repositório `load_BDR` para gerar `dados_bdr/bdr_final.duckdb` (veja o README de lá). Se o MotherDuck falhar (sem token, conta fora da organização, share sem acesso), a API e o `export_static.py` passam a ler esse arquivo sozinhos. Por padrão procuram em `../load_BDR/dados_bdr/bdr_final.duckdb`, com as duas pastas lado a lado:
```
BDR/
├── load_BDR/dados_bdr/bdr_final.duckdb
└── Plataform-AnatomiaDoVoto/
```
Em outro lugar, informe o caminho em `api/.env` com `DATABASE_LOCAL=/caminho/para/bdr_final.duckdb`. Quando o fallback é usado, o terminal da API mostra o aviso `MotherDuck indisponível (...); usando o banco local ...`. O DuckDB não deixa abrir o arquivo enquanto a carga estiver escrevendo nele: rode a carga antes de subir a API.

**1. API**

Rode tudo de dentro da pasta `api/` (o `app.main` é relativo a ela) e com o ambiente virtual ativo. Sem ele, o `pip` instala os pacotes no Python global e o comando `uvicorn` pode não ser encontrado.

Linux/Mac:
```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                     # preencha DATABASE e MOTHERDUCK_TOKEN (passo 0)
pytest                                                   # testes com um banco de teste pequeno
uvicorn app.main:app --reload                            # http://localhost:8000/docs
```

Windows (PowerShell):
```powershell
cd api
python -m venv .venv
.venv\Scripts\Activate.ps1                               # se bloquear: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements-dev.txt
copy .env.example .env                                   # preencha DATABASE e MOTHERDUCK_TOKEN (passo 0)
pytest
uvicorn app.main:app --reload                            # http://localhost:8000/docs
```

Para conferir a conexão com o banco, abra http://localhost:8000/api/health: deve responder `{"status":"ok","db":"ok"}`. Se responder 503, a mensagem diz o motivo (token ausente, share sem acesso etc.).

**2. Análises agregadas** (uma vez, ou quando o banco mudar)
```bash
cd pipeline
pip install -r requirements.txt
python export_static.py                                  # grava web/public/data/q5.json, q8.json e q10.json
```

**3. Site**
```bash
cd web
cp .env.example .env.local
npm ci
npm run dev                                              # http://localhost:3000
```
Outros comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Com Docker: `docker compose up --build` (não foi testado ainda).


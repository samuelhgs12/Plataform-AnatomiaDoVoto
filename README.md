# Plataforma Eleitoral (BDR / UFPI)

Plataforma web sobre os dados eleitorais do TSE (1998–2024) de AP, ES, MG, PE, RJ e RR: **carreira** de cada político (pergunta 10), **gastos de campanha** por categoria (pergunta 9), votos de legenda (pergunta 5) e mais. O layout do perfil do candidato se inspira no especial "Quem são os candidatos" do G1.

Os dados vêm do banco `bdr_final` (DuckDB / MotherDuck), carregado e validado no **repositório de carga**. Este repositório só lê.

```
api/        FastAPI (Python): busca, listagem, perfil, gastos, receitas      → docs/API.md
web/        Next.js 16 (React 19, TypeScript): páginas e gráficos
pipeline/   gera os JSONs estáticos das análises agregadas (perguntas 5 e 10)
docs/       arquitetura, API, esboço das telas, decisões, plano de trabalho
```

## Começar em 10 minutos

Pré-requisitos: Python 3.12+, Node 20.9+ (recomendado 22) e uma conta na organização do MotherDuck com acesso ao share do banco `bdr`.

**0. Acesso ao banco (MotherDuck)**

1. No MotherDuck, gere seu token pessoal (Settings → Access Tokens). Cada pessoa usa o próprio token.
2. Peça ao dono do banco o link do share, no formato `md:_share/bdr/<codigo>`.
3. Em `api/.env` (criado no passo 1), preencha:
   ```
   DATABASE=md:_share/bdr/<codigo>
   MOTHERDUCK_TOKEN=<seu token>
   ```

Na primeira execução a API anexa o share à sua conta com o nome `bdr`. O MotherDuck guarda esse anexo na conta, então nas próximas execuções a API só o reutiliza. Se você já tiver anexado o share por conta própria (pela interface do MotherDuck, por exemplo), também funciona. Outras opções para `DATABASE`: `md:bdr` (share já anexado como `bdr`) ou o caminho de um arquivo `.duckdb` local.

**1. API**

Rode tudo de dentro da pasta `api/` (o `app.main` é relativo a ela) e com o ambiente virtual ativo. Sem ele, o `pip` instala os pacotes no Python global e o comando `uvicorn` pode não ser encontrado.

Linux/Mac:
```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                     # preencha DATABASE e MOTHERDUCK_TOKEN (passo 0)
pytest                                                   # 16 testes, usam um banco de teste pequeno
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
python export_static.py                                  # grava web/public/data/q5.json e q10.json
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

## Regras importantes

1. **Privacidade:** nunca exibir título eleitoral, CPF, data de nascimento ou documento de doador. O que sai pela API é só o que está em `api/app/schemas.py`; há um teste que garante isso.
2. **Token do MotherDuck** (`MOTHERDUCK_TOKEN`) só no servidor da API, nunca no front-end nem no Git. Cada pessoa usa o token da própria conta.
3. **Regras dos dados:** titulares, eleição ordinária; gasto = prestação final sem transferências. Ver `docs/ARQUITETURA.md`.
4. As consultas das perguntas 5 e 10 em `pipeline/sql/` são cópia do repositório de carga: se a regra mudar lá, atualize aqui.

## Estado atual

Esqueleto funcional, **testado com dados de exemplo** (banco de teste pequeno, criado pelos testes). Ainda não foi rodado com o banco real: o primeiro passo da equipe é conferir os números contra o projeto de carga (por exemplo, 887.801 candidaturas e percentual de legenda de 7,4% em 2018, 5,6% em 2020, 5,1% em 2022 e 3,8% em 2024).

Veja `docs/TAREFAS.md` para as fases e a divisão sugerida, e `docs/ESBOCO_TELAS.md` para as telas.

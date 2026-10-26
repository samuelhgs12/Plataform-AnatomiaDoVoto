# API

Com a API rodando, a documentação interativa (gerada automaticamente) fica em `http://localhost:8000/docs`.

| Método | Rota | Parâmetros | Resposta |
|---|---|---|---|
| GET | `/api/health` | — | `{status, db}`; 503 se o banco não abrir |
| GET | `/api/meta` | — | cargos, anos de eleição ordinária e UFs (para os filtros) |
| GET | `/api/busca` | `q` (3 a 80 letras; o texto precisa aparecer inteiro e na ordem, a partir do início de uma palavra do nome civil ou de urna; ignora acentos, maiúsculas e pontuação) | até 20 pessoas, com a candidatura mais recente de cada |
| GET | `/api/candidaturas` | `cargo` (id), `ano`, `uf`, `partido` (sigla), `eleito`, `ordem` (`votos`\|`nome`), `pagina`, `tamanho` (≤100), `incluir_suplementares` | listagem paginada de titulares |
| GET | `/api/partidos` | `ano`, `cargo` (id, obrigatório), `uf` | siglas com titulares na eleição ordinária (opções do filtro de partido) |
| GET | `/api/candidatos/{id}` | — | cabeçalho, resumo, carreira completa e trocas de partido |
| GET | `/api/candidaturas/{id}/despesas` | — | gasto por categoria + mediana do cargo/ano/UF (pergunta 9) |
| GET | `/api/candidaturas/{id}/propaganda` | — | onde a campanha investiu em propaganda (pergunta 9): despesas consideradas, propaganda e propaganda por categoria original do TSE, em centavos inteiros |
| GET | `/api/candidaturas/{id}/palavras` | `limite` (≤100) | termos das despesas de propaganda (nuvem de palavras) |
| GET | `/api/fotos/{ano}/{ue}/{sequencial}` | `tam` (`mini`: WebP 120×160, padrão; `ficha`: JPEG original 161×225) | a foto da candidatura (banco `bdr_fotos`), com `Cache-Control` de um ano; 404 sem foto (guardado por um dia); 503 se o banco de fotos não abrir. A chave sai em `ue`/`sequencial` de `/api/candidaturas` e da carreira, e em `ultimo_ue`/`ultimo_sequencial` da busca |
| GET | `/api/candidaturas/{id}/receitas` | — | receita pública × privada, valor por fonte (fundo eleitoral, fundo partidário, doações de pessoas, recursos próprios, outros privados) + mediana (pergunta 8) |

Exemplos:

```bash
curl "http://localhost:8000/api/busca?q=maria"
curl "http://localhost:8000/api/candidaturas?cargo=13&ano=2024&uf=MG&eleito=true&pagina=1"
curl "http://localhost:8000/api/candidatos/1"
curl -o foto.webp "http://localhost:8000/api/fotos/2022/RR/230001604255?tam=mini"
```

## Regras que não se negociam

- **Nunca** devolver título eleitoral, CPF, data de nascimento ou documentos de doadores. O identificador público é `id_candidato` (interno).
- Toda consulta usa parâmetros `?`; nunca monte SQL concatenando texto do usuário.
- Resposta nova = modelo novo em `app/schemas.py` + teste em `tests/test_api.py`. O teste `test_privacidade_nenhuma_resposta_expoe_dado_sensivel` precisa continuar passando.

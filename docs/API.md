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
| GET | `/api/candidatos/{id}/mapa` | — | visão Candidato do mapa: as candidaturas titulares da pessoa (mais recente primeiro) com os números da ficha (votos no 1º turno, gasto, mediana do gasto da disputa, parte pública, disputas e mandatos até ali) e a chave da foto |
| GET | `/api/candidaturas/{id}/votos-municipio` | — | votos da candidatura em cada município dos seis estados, por turno, com os válidos do cargo (nominais da disputa + legenda; a legenda por município só existe de 2018 em diante) e a colocação; 0 onde a disputa teve voto e ela não (tabela `votos_candidatura_municipio`). Traz o `cod_ibge`, que o site usa para casar com o mapa estático (o `id_municipio` muda a cada carga). Prefeito e vereador: uma linha só, a do município da disputa |
| GET | `/api/candidaturas/{id}/despesas` | — | gasto por categoria + mediana do cargo/ano/UF (pergunta 9) |
| GET | `/api/candidaturas/{id}/propaganda` | — | onde a campanha investiu em propaganda (pergunta 9): despesas consideradas, propaganda, propaganda por categoria original do TSE e `termos` da nuvem de palavras (o que foi comprado: dicionário em `app/nuvem.py`, sem a descrição original; cada peça traz `por_tipo`, com o valor e o número de despesas em cada tipo de propaganda, e somado por tipo o valor bate com o total oficial das categorias), em centavos inteiros |
| GET | `/api/candidaturas/{id}/palavras` | `limite` (≤100) | palavras soltas das despesas de propaganda (versão antiga, sem uso: a nuvem usa `termos` de `/propaganda`) |
| GET | `/api/fotos/{ano}/{ue}/{sequencial}` | `tam` (`mini`: WebP 120×160, padrão; `ficha`: JPEG original 161×225) | a foto da candidatura (banco `bdr_fotos`), com `Cache-Control` de um ano; 404 sem foto (guardado por um dia); 503 se o banco de fotos não abrir. A chave sai em `ue`/`sequencial` de `/api/candidaturas` e da carreira, e em `ultimo_ue`/`ultimo_sequencial` da busca |
| GET | `/api/candidaturas/{id}/receitas` | — | receita pública × privada, valor por fonte (fundo eleitoral, fundo partidário, doações de pessoas, recursos próprios, outros privados) + mediana (pergunta 8) |
| GET | `/api/analises` | — | nomes das análises agregadas (um arquivo `app/analises/<nome>.sql` para cada) |
| GET | `/api/analises/{nome}` | `tabela` (pode repetir) | tabelas da análise, no formato `{tabela: {colunas, linhas}}`; cada `COPY ... TO 'x.csv'` do SQL vira a tabela `x` (ver `ARQUITETURA.md`) |
| GET | `/api/analises/q9` | `tabela` = `referencia` e/ou `parcelas` | pergunta 9, a campanha típica para o perfil: `referencia` = mediana da parcela de cada tipo de propaganda e número de campanhas, por cargo, ano e UF; `parcelas` = parcelas de cada campanha dos grupos com menos de 30 campanhas, para tirar a própria campanha da típica |

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

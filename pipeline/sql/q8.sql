-- Pergunta 8: recursos públicos x sucesso eleitoral (e, como contexto, de onde vem o dinheiro das campanhas).
-- Roda no banco final (bdr_final.duckdb ou MotherDuck).
-- Uso: python export_static.py   (grava web/public/data/q8.json)
--
-- Regras do projeto: só titulares, eleição ordinária e quem de fato disputou; prestação FINAL ou REGULARIZACAO_OMISSAO.
-- Receitas só existem de 2018 em diante. Duas medidas, para dois usos:
--   * SOMAS (de onde vem o dinheiro, partidos, estados): sem repasses entre candidatos, senão o mesmo real seria contado
--     duas vezes (no candidato que repassa e no que recebe);
--   * POR CANDIDATO (dependência, medianas e a resposta da pergunta, em "sucesso"): o que cada um RECEBEU, inclusive de
--     outros candidatos. Muitos vereadores recebem dinheiro do Fundo Eleitoral por meio do candidato a prefeito; sem
--     isso, cerca de 20 mil deles apareceriam como "sem dinheiro público" em 2020 e em 2024.
-- As 5 fontes abaixo são as mesmas de api/app/queries/receitas.sql: se mudar aqui, mude lá.

CREATE OR REPLACE TEMP TABLE receita_fonte AS
SELECT r.id_candidatura,
       CASE
           WHEN f.tipo = 'publico' AND upper(f.nome_fonte) LIKE '%ESPECIAL%' THEN 'fundo_eleitoral'
           WHEN f.tipo = 'publico' THEN 'fundo_partidario'
           WHEN r.origem_receita ILIKE '%pessoas f_sicas%' OR r.origem_receita ILIKE '%financiamento coletivo%'
                OR r.origem_receita ILIKE '%internet%' THEN 'doacoes_pessoas'
           WHEN r.origem_receita ILIKE '%recursos pr_prios%' THEN 'recursos_proprios'
           ELSE 'outros_privados'
       END AS fonte,
       r.valor_receita AS valor
FROM receita_campanha r
LEFT JOIN fonte_recurso f ON f.id_fonte_recurso = r.id_fonte_recurso
WHERE r.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND NOT r.repasse_entre_candidatos;

-- O que cada candidatura recebeu, inclusive de outros candidatos (medida por candidato).
CREATE OR REPLACE TEMP TABLE recebido AS
SELECT r.id_candidatura,
       sum(r.valor_receita) FILTER (WHERE f.tipo = 'publico') AS publico_rec,
       sum(r.valor_receita) AS total_rec
FROM receita_campanha r
LEFT JOIN fonte_recurso f ON f.id_fonte_recurso = r.id_fonte_recurso
WHERE r.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
GROUP BY r.id_candidatura;

-- Uma linha por candidatura (inclusive as que não receberam nada: também é informação).
-- disputa = onde o candidato concorre: o município (prefeito e vereador) ou a UF (os demais; presidente: o país).
CREATE OR REPLACE TEMP TABLE cand AS
SELECT c.id_candidatura, c.ano, g.nome AS cargo, c.uf, coalesce(p.sigla, '?') AS partido, rr.eleito,
       CASE WHEN g.nome IN ('Prefeito', 'Vereador') THEN 'M' || c.id_municipio::VARCHAR ELSE coalesce(c.uf, 'BR') END AS disputa,
       coalesce(rec.publico_rec, 0) AS publico_rec, coalesce(rec.total_rec, 0) AS total_rec,
       coalesce(sum(x.valor) FILTER (WHERE x.fonte = 'fundo_eleitoral'), 0)   AS fundo_eleitoral,
       coalesce(sum(x.valor) FILTER (WHERE x.fonte = 'fundo_partidario'), 0)  AS fundo_partidario,
       coalesce(sum(x.valor) FILTER (WHERE x.fonte = 'doacoes_pessoas'), 0)   AS doacoes_pessoas,
       coalesce(sum(x.valor) FILTER (WHERE x.fonte = 'recursos_proprios'), 0) AS recursos_proprios,
       coalesce(sum(x.valor) FILTER (WHERE x.fonte = 'outros_privados'), 0)   AS outros_privados
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN receita_fonte x ON x.id_candidatura = c.id_candidatura
LEFT JOIN recebido rec    ON rec.id_candidatura = c.id_candidatura
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou
GROUP BY ALL;

CREATE OR REPLACE TEMP TABLE cand_pct AS
SELECT *,
       fundo_eleitoral + fundo_partidario AS publico,
       fundo_eleitoral + fundo_partidario + doacoes_pessoas + recursos_proprios + outros_privados AS total
FROM cand;

-------------------------------------------------------------------------------
-- 1. Valores somados por ano, cargo, UF, partido e resultado (a página filtra e soma)
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, partido, eleito, count(*) AS candidaturas,
           count(*) FILTER (WHERE total > 0) AS com_receita,
           round(sum(fundo_eleitoral), 2) AS fundo_eleitoral, round(sum(fundo_partidario), 2) AS fundo_partidario,
           round(sum(doacoes_pessoas), 2) AS doacoes_pessoas, round(sum(recursos_proprios), 2) AS recursos_proprios,
           round(sum(outros_privados), 2) AS outros_privados
    FROM cand_pct
    GROUP BY ALL ORDER BY ano, cargo, uf, partido, eleito
) TO 'painel_q8/fontes.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. Quanto cada candidatura dependeu de dinheiro público (faixas), por ano, cargo, UF e resultado.
--    Medida por candidato: o que recebeu, inclusive de outros candidatos.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, eleito,
           CASE WHEN total_rec <= 0 THEN 'sem_receita'
                WHEN publico_rec <= 0 THEN 'so_privado'
                WHEN publico_rec >= total_rec THEN 'so_publico'
                WHEN publico_rec / total_rec >= 0.5 THEN 'mais_publico'
                ELSE 'mais_privado' END AS faixa,
           count(*) AS candidaturas
    FROM cand_pct
    GROUP BY ALL ORDER BY ano, cargo, uf, eleito, faixa
) TO 'painel_q8/faixas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. Valores típicos (mediana) de eleitos e não eleitos, com e sem UF (uf NULL = todas as UFs).
--    Todos os candidatos entram (quem não recebeu nada conta como zero); o % público só entre quem recebeu algo.
--    Medida por candidato: o que recebeu, inclusive de outros candidatos.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, eleito, count(*) AS candidaturas,
           round(median(total_rec), 2) AS mediana_total, round(median(publico_rec), 2) AS mediana_publico,
           round(median(publico_rec / total_rec) FILTER (WHERE total_rec > 0), 4) AS mediana_pct_publico
    FROM cand_pct
    GROUP BY GROUPING SETS ((ano, cargo, uf, eleito), (ano, cargo, eleito))
    ORDER BY ano, cargo, uf NULLS FIRST, eleito
) TO 'painel_q8/medianas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 4. Pergunta 8 propriamente: taxa de eleição por faixa de dinheiro público recebido.
--    Medida por candidato: o dinheiro público que recebeu, inclusive por meio de outros candidatos.
--    faixa 0 = não recebeu dinheiro público; 1 a 4 = cerca de um quarto cada de quem recebeu, comparando cada candidato
--    só com os concorrentes da mesma disputa (o município para prefeito e vereador; a UF para os demais).
--    percent_rank dá a mesma posição a valores iguais: empates caem sempre no mesmo grupo (resultado estável), por isso
--    os grupos têm tamanho aproximado, e não exatamente 25%.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, faixa, count(*) AS candidaturas, count(*) FILTER (WHERE eleito) AS eleitos,
           round(min(publico_rec), 2) AS publico_min, round(max(publico_rec), 2) AS publico_max
    FROM (
        SELECT ano, cargo, uf, eleito, publico_rec,
               CASE WHEN publico_rec <= 0 THEN 0
                    ELSE least(4, 1 + floor(4 * percent_rank() OVER (PARTITION BY ano, cargo, disputa, publico_rec > 0 ORDER BY publico_rec)))::INTEGER
               END AS faixa
        FROM cand_pct
    )
    GROUP BY ALL ORDER BY ano, cargo, uf, faixa
) TO 'painel_q8/sucesso.csv' (HEADER);

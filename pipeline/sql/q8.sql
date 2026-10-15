-- Pergunta 8: recursos públicos x sucesso eleitoral (e, como contexto, de onde vem o dinheiro das campanhas).
-- Roda no banco final (bdr_final.duckdb ou MotherDuck).
-- Uso: python export_static.py   (grava web/public/data/q8.json)
--
-- Regras do projeto: só titulares, eleição ordinária e quem de fato disputou; prestação FINAL ou REGULARIZACAO_OMISSAO;
-- sem repasses entre candidatos (o mesmo dinheiro seria contado duas vezes). Receitas só existem de 2018 em diante.
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

-- Uma linha por candidatura (inclusive as que não receberam nada: também é informação).
CREATE OR REPLACE TEMP TABLE cand AS
SELECT c.id_candidatura, c.ano, g.nome AS cargo, c.uf, coalesce(p.sigla, '?') AS partido, rr.eleito,
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
-- 2. Quanto cada candidatura dependeu de dinheiro público (faixas), por ano, cargo, UF e resultado
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, eleito,
           CASE WHEN total <= 0 THEN 'sem_receita'
                WHEN publico <= 0 THEN 'so_privado'
                WHEN publico >= total THEN 'so_publico'
                WHEN publico / total >= 0.5 THEN 'mais_publico'
                ELSE 'mais_privado' END AS faixa,
           count(*) AS candidaturas
    FROM cand_pct
    GROUP BY ALL ORDER BY ano, cargo, uf, eleito, faixa
) TO 'painel_q8/faixas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. Valores típicos (mediana) de eleitos e não eleitos, com e sem UF (uf NULL = todas as UFs).
--    Todos os candidatos entram (quem não recebeu nada conta como zero); o % público só entre quem recebeu algo.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, eleito, count(*) AS candidaturas,
           round(median(total), 2) AS mediana_total, round(median(publico), 2) AS mediana_publico,
           round(median(publico / total) FILTER (WHERE total > 0), 4) AS mediana_pct_publico
    FROM cand_pct
    GROUP BY GROUPING SETS ((ano, cargo, uf, eleito), (ano, cargo, eleito))
    ORDER BY ano, cargo, uf NULLS FIRST, eleito
) TO 'painel_q8/medianas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 4. Pergunta 8 propriamente: taxa de eleição por faixa de dinheiro público recebido.
--    faixa 0 = não recebeu dinheiro público; 1 a 4 = quartos de quem recebeu, comparando cada candidato
--    só com os do mesmo ano, cargo e UF (1 = os 25% que menos receberam, 4 = os 25% que mais receberam).
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, faixa, count(*) AS candidaturas, count(*) FILTER (WHERE eleito) AS eleitos,
           round(min(publico), 2) AS publico_min, round(max(publico), 2) AS publico_max
    FROM (
        SELECT ano, cargo, uf, eleito, publico,
               CASE WHEN publico <= 0 THEN 0
                    ELSE ntile(4) OVER (PARTITION BY ano, cargo, uf, publico > 0 ORDER BY publico) END AS faixa
        FROM cand_pct
    )
    GROUP BY ALL ORDER BY ano, cargo, uf, faixa
) TO 'painel_q8/sucesso.csv' (HEADER);

-- Pergunta 1: quanto custa uma cadeira/mandato? Roda no banco final (bdr_final.duckdb ou MotherDuck).
-- Servida pela API em GET /api/analises/q1 (cada COPY ... TO 'x.csv' vira a tabela x da resposta)
--
-- Gasto = despesas da prestação de contas FINAL ou REGULARIZACAO_OMISSAO, sem transferências para outros candidatos ou
-- partidos (vw_despesa_candidatura); é o valor contratado, somando os dois turnos. Candidato sem prestação final fica com
-- gasto zero. Só titulares e eleição ordinária; despesas só existem de 2018 em diante.
--
-- Duas divisões, calculadas na página a partir das somas abaixo:
--   * custo da cadeira = gasto de TODOS que fizeram campanha para o cargo ÷ vagas. Inclui quem gastou mas não chegou a
--     disputar (candidatura barrada, renúncia, substituição): esse dinheiro também foi gasto na disputa pela cadeira
--     (ex.: a campanha de Lula a presidente em 2018, barrada, gastou R$ 19,6 milhões);
--   * gasto por candidato = gasto de quem disputou ÷ número de quem disputou (a média de um concorrente de fato).

CREATE OR REPLACE TEMP TABLE cand_q1 AS
SELECT c.ano, g.id_cargo, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf, rr.eleito,
       coalesce(rr.disputou, false) AS disputou,
       coalesce(d.gasto_total, 0) AS gasto
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA';

-------------------------------------------------------------------------------
-- 1. Somas por ano, cargo e UF (presidente: UF "BR"). A página soma as UFs quando o filtro é "todos".
--    candidatos/eleitos/com_gasto contam só quem disputou; gasto_total inclui quem não disputou (gasto_nao_disputou).
-------------------------------------------------------------------------------
COPY (
    WITH v AS (
        SELECT ano, id_cargo, coalesce(uf, 'BR') AS uf, sum(qt_vagas) AS vagas
        FROM vagas GROUP BY ALL
    )
    SELECT c.ano, c.cargo, c.uf,
           count(*) FILTER (WHERE c.disputou) AS candidatos,
           count(*) FILTER (WHERE c.disputou AND c.gasto > 0) AS com_gasto,
           count(*) FILTER (WHERE c.eleito) AS eleitos,
           coalesce(max(v.vagas), 0) AS vagas,
           round(sum(c.gasto), 2) AS gasto_total,
           round(coalesce(sum(c.gasto) FILTER (WHERE c.disputou), 0), 2) AS gasto_disputou,
           round(coalesce(sum(c.gasto) FILTER (WHERE NOT c.disputou), 0), 2) AS gasto_nao_disputou,
           count(*) FILTER (WHERE NOT c.disputou AND c.gasto > 0) AS nao_disputou_com_gasto,
           round(coalesce(sum(c.gasto) FILTER (WHERE c.eleito), 0), 2) AS gasto_eleitos
    FROM cand_q1 c
    LEFT JOIN v ON v.ano = c.ano AND v.id_cargo = c.id_cargo AND v.uf = c.uf
    GROUP BY c.ano, c.cargo, c.uf
    HAVING count(*) FILTER (WHERE c.disputou) > 0
    ORDER BY c.ano, c.cargo, c.uf
) TO 'painel_q1/custo.csv' (HEADER);

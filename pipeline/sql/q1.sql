-- Pergunta 1: quanto custa uma cadeira/mandato? Roda no banco final (bdr_final.duckdb ou MotherDuck).
-- Uso: python export_static.py q1   (grava web/public/data/q1.json)
--
-- Gasto = despesas da prestação de contas FINAL ou REGULARIZACAO_OMISSAO, sem transferências (vw_despesa_candidatura).
-- Só titulares, eleição ordinária e quem de fato disputou. Despesas só existem de 2018 em diante.
-- Duas divisões do gasto total de cada cargo: pelo número de vagas (custo de uma cadeira) e pelo número de
-- candidatos (gasto médio por candidato). A página calcula as duas a partir das somas abaixo.

CREATE OR REPLACE TEMP TABLE cand_q1 AS
SELECT c.ano, g.id_cargo, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf, rr.eleito,
       coalesce(d.gasto_total, 0) AS gasto
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou;

-------------------------------------------------------------------------------
-- 1. Somas por ano, cargo e UF (presidente: UF "BR"). A página soma as UFs quando o filtro é "todos".
-------------------------------------------------------------------------------
COPY (
    WITH v AS (
        SELECT ano, id_cargo, coalesce(uf, 'BR') AS uf, sum(qt_vagas) AS vagas
        FROM vagas GROUP BY ALL
    )
    SELECT c.ano, c.cargo, c.uf,
           count(*) AS candidatos,
           count(*) FILTER (WHERE c.gasto > 0) AS com_gasto,
           count(*) FILTER (WHERE c.eleito) AS eleitos,
           coalesce(max(v.vagas), 0) AS vagas,
           round(sum(c.gasto), 2) AS gasto_total,
           round(coalesce(sum(c.gasto) FILTER (WHERE c.eleito), 0), 2) AS gasto_eleitos
    FROM cand_q1 c
    LEFT JOIN v ON v.ano = c.ano AND v.id_cargo = c.id_cargo AND v.uf = c.uf
    GROUP BY c.ano, c.cargo, c.uf
    ORDER BY c.ano, c.cargo, c.uf
) TO 'painel_q1/custo.csv' (HEADER);

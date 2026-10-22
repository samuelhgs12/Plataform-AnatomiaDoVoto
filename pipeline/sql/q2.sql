-- Pergunta 2: existe relação entre o volume de recursos/gastos e a taxa de sucesso eleitoral?
-- Roda no banco final (bdr_final.duckdb ou MotherDuck). Uso: python export_static.py q2   (grava web/public/data/q2.json)
--
-- Gasto = despesas da prestação de contas FINAL ou REGULARIZACAO_OMISSAO, sem transferências (vw_despesa_candidatura).
-- Só titulares, eleição ordinária e quem de fato disputou; despesas só existem de 2018 em diante.
-- Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador) ou a UF
-- (deputados, senador e governador; presidente: o país).

CREATE OR REPLACE TEMP TABLE cand_q2 AS
SELECT c.id_candidatura, c.id_candidato, c.ano, g.id_cargo, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf,
       CASE WHEN g.nome IN ('Prefeito', 'Vereador') THEN 'M' || c.id_municipio::VARCHAR ELSE coalesce(c.uf, 'BR') END AS disputa,
       rr.eleito, coalesce(d.gasto_total, 0) AS gasto
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou;

-- Quem já tinha o cargo: eleito para o mesmo cargo na eleição ordinária anterior (4 anos antes; senador, também 8).
-- Separa o efeito do dinheiro do efeito de já estar no cargo (quem tem mandato costuma gastar mais e ganhar mais).
CREATE OR REPLACE TEMP TABLE eleitos_antes AS
SELECT DISTINCT c.id_candidato, c.ano, e.id_cargo
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
WHERE rr.eleito AND e.tipo_eleicao = 'ORDINARIA' AND c.id_candidato IS NOT NULL;

-- Faixa de gasto dentro da disputa: 0 = não gastou; 1 a 4 = quartos de quem gastou (4 = os 25% que mais gastaram).
-- percent_rank dá a mesma posição a valores iguais, então empates caem sempre no mesmo grupo (resultado estável).
CREATE OR REPLACE TEMP TABLE faixa_q2 AS
SELECT x.*,
       EXISTS (SELECT 1 FROM eleitos_antes a
               WHERE a.id_candidato = x.id_candidato AND a.id_cargo = x.id_cargo
                 AND (a.ano = x.ano - 4 OR (x.cargo = 'Senador' AND a.ano = x.ano - 8))) AS tinha_cargo,
       CASE WHEN x.gasto <= 0 THEN 0
            ELSE least(4, 1 + floor(4 * percent_rank() OVER (PARTITION BY x.ano, x.cargo, x.disputa, x.gasto > 0 ORDER BY x.gasto)))::INTEGER
       END AS faixa
FROM cand_q2 x;

-------------------------------------------------------------------------------
-- 1. Taxa de eleição por faixa de gasto, separando quem já tinha o cargo
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, tinha_cargo, faixa, count(*) AS candidaturas, count(*) FILTER (WHERE eleito) AS eleitos
    FROM faixa_q2
    GROUP BY ALL ORDER BY ano, cargo, uf, tinha_cargo, faixa
) TO 'painel_q2/faixas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. Disputas com poucos candidatos (prefeito, governador, senador, presidente): o que mais gastou venceu?
--    chance_sorteio = quantas vitórias o maior gastador teria se o gasto não importasse (vagas / candidatos de cada
--    disputa, somado). Empate no maior gasto: vale o de menor id (determinístico).
-------------------------------------------------------------------------------
COPY (
    WITH disputas AS (
        SELECT ano, cargo, uf, disputa, count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS vagas, max(gasto) AS maior
        FROM cand_q2
        WHERE cargo IN ('Prefeito', 'Governador', 'Senador', 'Presidente')
        GROUP BY ALL
        HAVING count(*) > 1 AND max(gasto) > 0
    ), topo AS (
        SELECT ano, cargo, disputa, eleito, tinha_cargo,
               row_number() OVER (PARTITION BY ano, cargo, disputa ORDER BY gasto DESC, id_candidatura) AS pos
        FROM faixa_q2
        WHERE cargo IN ('Prefeito', 'Governador', 'Senador', 'Presidente')
    )
    SELECT d.ano, d.cargo, d.uf, count(*) AS disputas,
           count(*) FILTER (WHERE t.eleito) AS maior_venceu,
           count(*) FILTER (WHERE t.tinha_cargo) AS maior_tinha_cargo,
           -- soma em inteiros (milionésimos) para o resultado não depender da ordem da soma
           round(sum((least(d.vagas, d.candidatos) * 1000000) // d.candidatos) / 1000000, 2) AS chance_sorteio
    FROM disputas d
    JOIN topo t ON t.ano = d.ano AND t.cargo = d.cargo AND t.disputa = d.disputa AND t.pos = 1
    GROUP BY ALL ORDER BY d.ano, d.cargo, d.uf
) TO 'painel_q2/maior_gasto.csv' (HEADER);

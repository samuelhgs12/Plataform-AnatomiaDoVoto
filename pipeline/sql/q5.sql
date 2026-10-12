-- Copiado do repositório de carga (consultas/q5_painel.sql). Se a regra mudar lá, atualize aqui.
-- Pergunta 5 — votos de legenda x partido (DuckDB). Roda no banco final (bdr_final.duckdb ou MotherDuck).
-- Uso: python rodar_paineis.py q5        (gera os CSVs em painel_q5/)
--
-- Só cargos PROPORCIONAIS (vereador, deputado federal e estadual): é onde existe voto de legenda. 1º turno,
-- só eleição ordinária. Percentual de legenda = legenda / (legenda + nominais).
-- Atenção: partidos que se fundiram aparecem separados (ex.: DEM e PSL em 2018 e 2020, UNIÃO em 2022 e 2024);
-- quando partido.id_partido_sucessor for preenchido, dá para agrupá-los.

CREATE OR REPLACE TEMP TABLE legenda AS
SELECT e.ano, g.nome AS cargo, m.uf, m.id_municipio, m.nome AS municipio, p.numero, p.sigla,
       v.votos_nominais, v.votos_legenda
FROM votos_partido_municipio v
JOIN eleicao e   ON e.id_eleicao = v.id_eleicao
JOIN cargo g     ON g.id_cargo = e.id_cargo
JOIN municipio m ON m.id_municipio = v.id_municipio
JOIN partido p   ON p.id_partido = v.id_partido
WHERE g.sistema = 'proporcional' AND v.turno = 1 AND e.tipo_eleicao = 'ORDINARIA'
  AND coalesce(v.votos_nominais, 0) + coalesce(v.votos_legenda, 0) > 0;   -- partido sem voto na UF não entra

-------------------------------------------------------------------------------
-- 1. Por partido, cargo, UF e ano: quanto do voto do partido foi de legenda
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, numero, sigla,
           sum(votos_nominais) AS votos_nominais, sum(votos_legenda) AS votos_legenda,
           round(100.0 * sum(votos_legenda) / nullif(sum(votos_legenda + votos_nominais), 0), 2) AS pct_legenda
    FROM legenda
    GROUP BY ALL ORDER BY ano, cargo, uf, sigla
) TO 'painel_q5/legenda_partido.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. Total geral por cargo, UF e ano (a referência para comparar cada partido)
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, sum(votos_nominais) AS votos_nominais, sum(votos_legenda) AS votos_legenda,
           round(100.0 * sum(votos_legenda) / nullif(sum(votos_legenda + votos_nominais), 0), 2) AS pct_legenda
    FROM legenda
    GROUP BY ALL ORDER BY ano, cargo, uf
) TO 'painel_q5/legenda_total.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. Por município (para mapa): legenda de todos os partidos somados
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, id_municipio, municipio,
           sum(votos_nominais) AS votos_nominais, sum(votos_legenda) AS votos_legenda,
           round(100.0 * sum(votos_legenda) / nullif(sum(votos_legenda + votos_nominais), 0), 2) AS pct_legenda
    FROM legenda
    GROUP BY ALL ORDER BY ano, cargo, uf, municipio
) TO 'painel_q5/legenda_municipio.csv' (HEADER);

-------------------------------------------------------------------------------
-- 4. Ranking: partidos que mais dependem de legenda (partido x ano x cargo, com pelo menos 10 mil votos)
-------------------------------------------------------------------------------
COPY (
    SELECT *, rank() OVER (PARTITION BY ano, cargo ORDER BY pct_legenda DESC) AS posicao
    FROM (SELECT ano, cargo, numero, sigla,
                 sum(votos_nominais) AS votos_nominais, sum(votos_legenda) AS votos_legenda,
                 round(100.0 * sum(votos_legenda) / nullif(sum(votos_legenda + votos_nominais), 0), 2) AS pct_legenda
          FROM legenda
          GROUP BY ano, cargo, numero, sigla
          HAVING sum(votos_legenda + votos_nominais) >= 10000)
    ORDER BY ano, cargo, posicao
) TO 'painel_q5/legenda_ranking.csv' (HEADER);

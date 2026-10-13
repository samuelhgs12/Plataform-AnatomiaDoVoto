-- Pergunta 5 — votos de legenda x partido (DuckDB). Regra copiada de q5_materializada.sql (repositório de carga).
-- Roda no banco final (bdr_final.duckdb ou MotherDuck), que é SOMENTE LEITURA: só TEMP TABLE e VALUES aqui.
-- Uso: python export_static.py  (cada COPY ... TO 'x.csv' vira a chave x de web/public/data/q5.json)
--
-- Regras:
--   * só cargos proporcionais (onde existe voto de legenda), 1º turno, eleição ordinária, 2018–2024
--   * partido identificado pelo NÚMERO dentro do ano (a sigla varia entre arquivos: 51 = PATRI/PATRIOTA)
--   * siglas renomeadas são unificadas; fusões (DEM/PSL → UNIÃO, PTB/PATRIOTA → PRD) ficam separadas
--   * proporção = votos_legenda / (votos_legenda + votos_nominais), calculada no front depois de somar

CREATE OR REPLACE TEMP TABLE renomeado AS
SELECT * FROM (VALUES ('PRB', 'REPUBLICANOS'), ('PR', 'PL'), ('PPS', 'CIDADANIA'), ('PATRI', 'PATRIOTA'),
                      ('PTC', 'AGIR'), ('PMN', 'MOBILIZA'), ('PODE', 'PODEMOS'), ('PC do B', 'PCdoB')) t(sigla, partido);

-------------------------------------------------------------------------------
-- 1. legenda: ano x cargo x UF x partido, com os eleitos de vw_eleito_efetivo
-------------------------------------------------------------------------------
COPY (
    WITH votos AS (
        SELECT e.ano, g.id_cargo, g.nome AS cargo, m.uf, p.numero,
               max(coalesce(r.partido, p.sigla))     AS partido,
               sum(coalesce(v.votos_nominais, 0))    AS votos_nominais,
               sum(coalesce(v.votos_legenda, 0))     AS votos_legenda
        FROM votos_partido_municipio v
        JOIN eleicao e   ON e.id_eleicao = v.id_eleicao
        JOIN cargo g     ON g.id_cargo = e.id_cargo
        JOIN municipio m ON m.id_municipio = v.id_municipio
        JOIN partido p   ON p.id_partido = v.id_partido
        LEFT JOIN renomeado r ON r.sigla = p.sigla
        WHERE g.sistema = 'proporcional'
          AND v.turno = 1
          AND e.tipo_eleicao = 'ORDINARIA'
          AND e.ano BETWEEN 2018 AND 2024
        GROUP BY e.ano, g.id_cargo, g.nome, m.uf, p.numero
    ),
    eleitos AS (
        SELECT el.ano, el.id_cargo, el.uf, p.numero, count(*) AS eleitos
        FROM vw_eleito_efetivo el
        JOIN partido p USING (id_partido)
        WHERE el.sistema = 'proporcional' AND el.ordinaria
        GROUP BY ALL
    )
    SELECT v.ano,
           CASE WHEN v.ano % 4 = 2 THEN 'geral' ELSE 'municipal' END AS tipo_eleicao,
           v.cargo, v.uf, v.numero, v.partido,
           v.votos_nominais, v.votos_legenda,
           coalesce(el.eleitos, 0) AS eleitos
    FROM votos v
    LEFT JOIN eleitos el USING (ano, id_cargo, uf, numero)
    WHERE v.votos_nominais + v.votos_legenda > 0
    ORDER BY v.ano, v.cargo, v.uf, v.votos_legenda DESC
) TO 'painel_q5/legenda.csv' (HEADER);

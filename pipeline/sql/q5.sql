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

-------------------------------------------------------------------------------
-- 2. eventos: mudanças nos partidos (copiado de q5_partido_evento.sql, passo 2). Mantida à mão.
--    ano = ano da aprovação pelo TSE; partido = nome já unificado, igual ao da tabela legenda.
--    Os absorvidos (rótulo "→ X") viram tipo 'extincao'; o partido que absorve fica com 'incorporacao' ou 'fusao'.
-------------------------------------------------------------------------------
CREATE OR REPLACE TEMP TABLE evento AS
SELECT partido, ano, CASE WHEN rotulo LIKE '→%' THEN 'extincao' ELSE tipo END AS tipo, rotulo, descricao
FROM (VALUES
    ('REPUBLICANOS',  2019, 'renomeacao',   'PRB → REPUBLICANOS', 'O PRB passa a se chamar Republicanos'),
    ('PL',            2019, 'renomeacao',   'PR → PL',            'O PR volta a se chamar PL'),
    ('CIDADANIA',     2019, 'renomeacao',   'PPS → CIDADANIA',    'O PPS passa a se chamar Cidadania'),
    ('PATRIOTA',      2019, 'incorporacao', '+ PRP',              'Incorpora o PRP'),
    ('PRP',           2019, 'incorporacao', '→ PATRIOTA',         'É incorporado pelo Patriota'),
    ('PODEMOS',       2019, 'incorporacao', '+ PHS',              'Incorpora o PHS'),
    ('PHS',           2019, 'incorporacao', '→ PODEMOS',          'É incorporado pelo Podemos'),
    ('PCdoB',         2019, 'incorporacao', '+ PPL',              'Incorpora o PPL'),
    ('PPL',           2019, 'incorporacao', '→ PCdoB',            'É incorporado pelo PCdoB'),
    ('UNIÃO',         2022, 'fusao',        'DEM + PSL',          'Nasce da fusão de DEM e PSL'),
    ('DEM',           2022, 'fusao',        '→ UNIÃO',            'Funde-se ao PSL e vira União Brasil'),
    ('PSL',           2022, 'fusao',        '→ UNIÃO',            'Funde-se ao DEM e vira União Brasil'),
    ('AGIR',          2022, 'renomeacao',   'PTC → AGIR',         'O PTC passa a se chamar Agir'),
    ('PT',            2022, 'federacao',    'federação',          'Forma federação com PCdoB e PV'),
    ('PCdoB',         2022, 'federacao',    'federação',          'Forma federação com PT e PV'),
    ('PV',            2022, 'federacao',    'federação',          'Forma federação com PT e PCdoB'),
    ('PSDB',          2022, 'federacao',    'federação',          'Forma federação com o Cidadania'),
    ('CIDADANIA',     2022, 'federacao',    'federação',          'Forma federação com o PSDB'),
    ('PSOL',          2022, 'federacao',    'federação',          'Forma federação com a Rede'),
    ('REDE',          2022, 'federacao',    'federação',          'Forma federação com o PSOL'),
    ('SOLIDARIEDADE', 2023, 'incorporacao', '+ PROS',             'Incorpora o PROS'),
    ('PROS',          2023, 'incorporacao', '→ SOLIDARIEDADE',    'É incorporado pelo Solidariedade'),
    ('PODEMOS',       2023, 'incorporacao', '+ PSC',              'Incorpora o PSC'),
    ('PSC',           2023, 'incorporacao', '→ PODEMOS',          'É incorporado pelo Podemos'),
    ('PRD',           2023, 'fusao',        'PTB + PATRIOTA',     'Nasce da fusão de PTB e Patriota'),
    ('PTB',           2023, 'fusao',        '→ PRD',              'Funde-se ao Patriota e vira PRD'),
    ('PATRIOTA',      2023, 'fusao',        '→ PRD',              'Funde-se ao PTB e vira PRD'),
    ('MOBILIZA',      2023, 'renomeacao',   'PMN → MOBILIZA',     'O PMN passa a se chamar Mobiliza')
) t(partido, ano, tipo, rotulo, descricao);

COPY (
    SELECT partido, ano, tipo, rotulo, descricao FROM evento ORDER BY ano, partido, tipo
) TO 'painel_q5/eventos.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. linhagem: cada partido absorvido → sucessor direto e partido atual (segue a cadeia: PRP → PATRIOTA → PRD)
-------------------------------------------------------------------------------
COPY (
    WITH RECURSIVE direto AS (
        SELECT partido, trim(replace(rotulo, '→', '')) AS sucessor, ano FROM evento WHERE tipo = 'extincao'
    ),
    cadeia AS (
        SELECT partido, sucessor, ano, sucessor AS atual FROM direto
        UNION ALL
        SELECT c.partido, c.sucessor, c.ano, d.sucessor FROM cadeia c JOIN direto d ON d.partido = c.atual
    )
    SELECT partido, sucessor, atual, ano
    FROM cadeia c
    WHERE NOT EXISTS (SELECT 1 FROM direto d WHERE d.partido = c.atual)
    ORDER BY ano, partido
) TO 'painel_q5/linhagem.csv' (HEADER);

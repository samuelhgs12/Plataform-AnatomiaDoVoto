-- Pergunta 4 — grau de instrução dos eleitos x o da população (DuckDB).
-- Roda no banco final (bdr_final.duckdb ou MotherDuck), que é SOMENTE LEITURA: só TEMP TABLE e VALUES aqui.
-- Servida pela API em GET /api/analises/q4 (cada COPY ... TO 'x.csv' vira a tabela x da resposta); lida pela camada
-- Comparar › Instrução do mapa da página inicial (web/src/lib/instrucao.ts).
--
-- Regras:
--   * a escala comum de 4 níveis da carga (nivel_instrucao.nivel, TSE x IBGE): 1 = até fundamental incompleto,
--     2 = fundamental completo ou médio incompleto, 3 = médio completo ou superior incompleto, 4 = superior completo.
--     São as 4 categorias da tabela 10061 do IBGE; os rótulos do TSE, mais detalhados, entram nelas
--   * população: Censo 2022 (populacao_instrucao), pessoas de 18 anos ou mais
--   * eleitos: só eleições municipais (prefeito e vereador) em volta do Censo 2022, 2020 e 2024; eleição ordinária,
--     titulares, o resultado final da candidatura (2º turno, quando houve)
--   * o município sai pelo cod_ibge, que casa com o mapa.json (o id_municipio muda a cada carga)

CREATE OR REPLACE TEMP TABLE eleito_q4 AS
SELECT c.ano, g.nome AS cargo, c.uf, m.cod_ibge, c.nome_urna, n.nivel
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
JOIN municipio m         ON m.id_municipio = c.id_municipio
LEFT JOIN nivel_instrucao n ON n.id_nivel_instrucao = c.id_nivel_instrucao
WHERE c.ano BETWEEN 2020 AND 2024
  AND e.tipo_eleicao = 'ORDINARIA' AND g.unidade = 'MUNICIPIO' AND g.eh_titular
  AND rr.eleito AND m.cod_ibge IS NOT NULL;

-------------------------------------------------------------------------------
-- 1. eleitos: ano x cargo x município x nível; quem não informou a instrução fica de fora
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, cod_ibge, nivel, count(*) AS eleitos
    FROM eleito_q4
    WHERE nivel IS NOT NULL
    GROUP BY ALL
    ORDER BY ano, uf, cod_ibge, cargo, nivel
) TO 'painel_q4/eleitos.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. prefeitos: o prefeito eleito de cada município, com o nível (nulo = não informou)
-------------------------------------------------------------------------------
COPY (
    SELECT ano, uf, cod_ibge, nome_urna, nivel
    FROM eleito_q4
    WHERE cargo = 'Prefeito'
    ORDER BY ano, uf, cod_ibge
) TO 'painel_q4/prefeitos.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. populacao: município x nível, pessoas de 18 anos ou mais no Censo 2022
-------------------------------------------------------------------------------
COPY (
    SELECT m.uf, m.cod_ibge, p.nivel, sum(p.populacao) AS populacao
    FROM populacao_instrucao p
    JOIN municipio m ON m.id_municipio = p.id_municipio
    WHERE p.ano_referencia = 2022 AND m.cod_ibge IS NOT NULL
    GROUP BY ALL
    ORDER BY m.uf, m.cod_ibge, p.nivel
) TO 'painel_q4/populacao.csv' (HEADER);

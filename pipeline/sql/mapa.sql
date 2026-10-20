-- Mapa da página inicial: abstenção por município em cada eleição e indicadores do Censo 2010 (Atlas do
-- Desenvolvimento Humano) para comparar com as eleições municipais em volta do Censo (2008 e 2012).
-- Roda no banco v2 (bdr_v2: tem cod_ibge e indicador_municipal). Uso: python export_static.py mapa
-- Antes dele, export_static.py cria tse_participacao (2008 a 2016, dos dados abertos do TSE).
-- TODO: provisório (decisão 10 em docs/DECISOES.md). Quando o load_BDR carregar esses anos em participacao_eleitoral,
-- apagar o UNION ALL com tse_participacao.
--
-- Regra da participação: eleição ordinária, 1º turno, governador nos anos gerais e prefeito nos municipais
-- (as suplementares do mesmo ano ficam de fora). Se mudar os indicadores, mude também web/src/lib/abstencao.ts.

CREATE OR REPLACE TEMP TABLE part AS
SELECT p.id_municipio, e.ano,
       sum(p.eleitorado_apto) AS aptos, sum(p.comparecimento) AS comparecimento, sum(p.abstencoes) AS abstencoes,
       sum(p.votos_brancos) AS brancos, sum(p.votos_nulos) AS nulos
FROM participacao_eleitoral p
JOIN eleicao e USING (id_eleicao)
WHERE p.turno = 1 AND e.tipo_eleicao = 'ORDINARIA' AND e.id_cargo = CASE WHEN e.ano % 4 = 0 THEN 11 ELSE 3 END
GROUP BY ALL
UNION ALL
SELECT m.id_municipio, t.ano, t.aptos, t.comparecimento, t.abstencoes, t.brancos, t.nulos
FROM tse_participacao t
JOIN municipio m ON m.cod_tse = t.cod_tse AND m.cod_ibge IS NOT NULL
WHERE t.ano < (SELECT min(ano) FROM eleicao e JOIN participacao_eleitoral USING (id_eleicao));

COPY (
    SELECT id_municipio, cod_ibge, nome, uf FROM municipio WHERE cod_ibge IS NOT NULL ORDER BY uf, nome
) TO 'municipios.csv' (HEADER);

COPY (
    SELECT * FROM part WHERE id_municipio IN (SELECT id_municipio FROM municipio WHERE cod_ibge IS NOT NULL)
    ORDER BY ano, id_municipio
) TO 'participacao.csv' (HEADER);

COPY (
    SELECT id_municipio, indicador, valor
    FROM indicador_municipal
    WHERE ano_referencia = 2010
      AND indicador IN ('pesotot', 'idhm', 'rdpc', 'gini', 'pmpob', 't_analf18m', 't_med18m', 'espvida', 't_des18m', 'p_formal', 't_agua')
    ORDER BY id_municipio, indicador
) TO 'indicadores.csv' (HEADER);

COPY (
    SELECT indicador, nome, definicao, fonte
    FROM indicador_dicionario
    WHERE indicador IN ('pesotot', 'idhm', 'rdpc', 'gini', 'pmpob', 't_analf18m', 't_med18m', 'espvida', 't_des18m', 'p_formal', 't_agua')
    ORDER BY indicador
) TO 'dicionario.csv' (HEADER);

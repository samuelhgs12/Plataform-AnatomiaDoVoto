-- Mapa da página inicial: abstenção por município em cada eleição e indicadores de dois Censos, cada um comparado com a
-- eleição do ano dele e as municipais em volta: Censo 2010 (Atlas do Desenvolvimento Humano) com 2008, 2010 e 2012 e
-- Censo 2022 (IBGE, SIDRA) com 2020, 2022 e 2024. Os do IBGE saem com a chave do equivalente no Atlas (a mesma escolha
-- de indicador vale nos dois Censos); o dicionário diz, por Censo, o que cada um mede de fato.
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

-- Equivalentes do Censo 2022 aos do Atlas. Sem par no Censo 2022 por município: IDHM, Gini, esperança de vida,
-- trabalho formal e água encanada (só aparecem com o Censo 2010)
CREATE OR REPLACE TEMP TABLE censo2022 AS
SELECT id_municipio, 'pesotot' AS indicador, populacao::DOUBLE AS valor
FROM censo_municipio WHERE ano_referencia = 2022
UNION ALL
SELECT id_municipio, 'rdpc', valor
FROM indicador_municipal WHERE ano_referencia = 2022 AND indicador = 'renda_dom_pc_media'
UNION ALL
-- a linha de pobreza do Atlas (R$ 140 em 2010) era 0,27 salário mínimo: o mais perto é até 1/4, somado a sem rendimento
SELECT id_municipio, 'pmpob', sum(valor)
FROM indicador_municipal WHERE ano_referencia = 2022 AND indicador IN ('pct_moradores_renda_ate_1_4', 'pct_moradores_renda_sem_rendimento')
GROUP BY id_municipio
UNION ALL
SELECT id_municipio, 't_analf18m', 100 - valor
FROM indicador_municipal WHERE ano_referencia = 2022 AND indicador = 'taxa_alfabetizacao_15mais_total'
UNION ALL
-- nível 3 (médio completo ou superior incompleto) e 4 (superior completo) entre as pessoas de 18 anos ou mais
SELECT id_municipio, 't_med18m', 100.0 * sum(populacao) FILTER (WHERE nivel >= 3) / sum(populacao)
FROM populacao_instrucao WHERE ano_referencia = 2022
GROUP BY id_municipio
UNION ALL
SELECT id_municipio, 't_des18m', valor
FROM indicador_municipal WHERE ano_referencia = 2022 AND indicador = 'taxa_desocupacao';

COPY (
    SELECT id_municipio, 2010 AS censo, indicador, valor
    FROM indicador_municipal
    WHERE ano_referencia = 2010
      AND indicador IN ('pesotot', 'idhm', 'rdpc', 'gini', 'pmpob', 't_analf18m', 't_med18m', 'espvida', 't_des18m', 'p_formal', 't_agua')
    UNION ALL
    SELECT id_municipio, 2022, indicador, valor FROM censo2022
    ORDER BY censo, id_municipio, indicador
) TO 'indicadores.csv' (HEADER);

COPY (
    SELECT indicador, 2010 AS censo, nome, definicao, fonte
    FROM indicador_dicionario
    WHERE indicador IN ('pesotot', 'idhm', 'rdpc', 'gini', 'pmpob', 't_analf18m', 't_med18m', 'espvida', 't_des18m', 'p_formal', 't_agua')
    UNION ALL
    SELECT * FROM (VALUES
        ('pesotot', 2022, 'População total', 'População residente.', 'IBGE, Censo Demográfico 2022, SIDRA 4709'),
        ('rdpc', 2022, 'Rendimento domiciliar per capita médio',
         'Média do rendimento nominal mensal domiciliar per capita nos domicílios particulares permanentes ocupados, sem pensionistas, empregados domésticos e parentes deles. Em reais de 2022.',
         'IBGE, Censo Demográfico 2022, SIDRA 10295'),
        ('pmpob', 2022, 'Moradores com renda domiciliar per capita até 1/4 de salário mínimo',
         'Percentual de moradores com renda domiciliar per capita de até 1/4 de salário mínimo, incluídos os sem rendimento. A linha do Atlas (R$ 140 em agosto de 2010) era 0,27 salário mínimo.',
         'IBGE, Censo Demográfico 2022, SIDRA 10296'),
        ('t_analf18m', 2022, 'Taxa de analfabetismo da população de 15 anos ou mais',
         '100 menos a taxa de alfabetização das pessoas de 15 anos ou mais (no Atlas, 18 anos ou mais).',
         'IBGE, Censo Demográfico 2022, SIDRA 9543'),
        ('t_med18m', 2022, 'Percentual da população de 18 anos ou mais com ensino médio completo',
         'Pessoas de 18 anos ou mais com ensino médio completo ou nível mais alto, sobre o total de pessoas de 18 anos ou mais.',
         'IBGE, Censo Demográfico 2022, SIDRA 10061'),
        ('t_des18m', 2022, 'Taxa de desocupação da população de 14 anos ou mais',
         'Pessoas desocupadas sobre a força de trabalho, de 14 anos ou mais (no Atlas, 18 anos ou mais).',
         'IBGE, Censo Demográfico 2022, SIDRA 10300')
    ) v(indicador, censo, nome, definicao, fonte)
    ORDER BY censo, indicador
) TO 'dicionario.csv' (HEADER);

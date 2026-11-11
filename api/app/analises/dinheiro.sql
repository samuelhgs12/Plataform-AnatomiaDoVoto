-- Onde o dinheiro das campanhas foi gasto (camada Dinheiro do mapa: perguntas 1, 2 e 8): as despesas declaradas em
-- grupos de categoria do TSE, por eleição, cargo, estado e, nas eleições municipais, por município.
-- Regras iguais às da análise municipios: só titulares, eleição ordinária, quem de fato disputou, prestação FINAL ou
-- REGULARIZACAO_OMISSAO, sem transferências a outros candidatos ou partidos (não são gasto da campanha). Os valores são
-- os contratados na prestação de contas, não o que foi pago. O município é o da candidatura (prefeito e vereador), não o
-- lugar em que o serviço foi prestado. Só os seis estados do projeto. Servida em GET /api/analises/dinheiro.
-- Despesas sem categoria entram no grupo sem_categoria, para a soma dos grupos bater com o gasto total.

CREATE OR REPLACE TEMP TABLE despesa_grupo AS
SELECT d.id_candidatura, d.valor_despesa,
       CASE WHEN k.id_categoria_despesa IS NULL THEN 'sem_categoria'   -- sem categoria: fica identificada, não some
            WHEN k.grupo_classificacao IN ('propaganda_fisica', 'propaganda_digital', 'propaganda_audiovisual') THEN k.grupo_classificacao
            WHEN k.grupo_classificacao = 'mobilizacao' OR k.origem_despesa ILIKE 'Eventos%' THEN 'mobilizacao'
            WHEN k.origem_despesa ILIKE 'Despesas com pessoal%' OR k.origem_despesa ILIKE 'Encargos sociais%' THEN 'pessoal'
            WHEN k.origem_despesa ILIKE 'Servi_os pr_prios prestados%' OR k.origem_despesa ILIKE 'Servi_os prestados por terceiros%' THEN 'terceiros'
            WHEN k.origem_despesa ILIKE 'Servi_os advocat%' OR k.origem_despesa ILIKE 'Servi_os cont%' OR k.origem_despesa ILIKE 'Pesquisas%' THEN 'profissionais'
            WHEN k.origem_despesa ILIKE '%ve_culos%' OR k.origem_despesa ILIKE 'Combust%' OR k.origem_despesa ILIKE '%transporte%' OR k.origem_despesa ILIKE 'Passagem%' THEN 'transporte'
            WHEN k.origem_despesa ILIKE 'Loca__o/cess_o%' OR k.origem_despesa ILIKE 'Energia%' OR k.origem_despesa ILIKE 'Telefone%' OR k.origem_despesa ILIKE '_gua%'
              OR k.origem_despesa ILIKE 'Materiais de expediente%' OR k.origem_despesa ILIKE 'Pr_-instala%' OR k.origem_despesa ILIKE '%Hospedagem%'
              OR k.origem_despesa ILIKE '%geradores%' OR k.origem_despesa ILIKE 'Alimenta%' THEN 'estrutura'
            ELSE 'outros' END AS grupo
FROM despesa_campanha d
LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa   -- LEFT, como vw_despesa_candidatura
WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO') AND NOT coalesce(k.transferencia, false);

-------------------------------------------------------------------------------
-- 1. Por eleição, cargo, estado, município (só prefeito e vereador; nulo nas gerais) e grupo: valor e número de despesas
-------------------------------------------------------------------------------
COPY (
    SELECT c.ano, g.nome AS cargo, c.uf,
           CASE WHEN g.nome IN ('Prefeito', 'Vereador') THEN c.id_municipio END AS id_municipio,
           dg.grupo, round(sum(dg.valor_despesa), 2) AS valor, count(*) AS despesas
    FROM despesa_grupo dg
    JOIN candidatura c       ON c.id_candidatura = dg.id_candidatura
    JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
    JOIN cargo g             ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
    WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou
      AND c.uf IN ('AP', 'ES', 'MG', 'PE', 'RJ', 'RR')
    GROUP BY ALL
    ORDER BY c.ano, g.nome, c.uf, id_municipio, dg.grupo
) TO 'dinheiro/despesas.csv' (HEADER);

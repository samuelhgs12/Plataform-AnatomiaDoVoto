-- Mediana do gasto por categoria entre as candidaturas do mesmo cargo, ano e UF (eleição ordinária),
-- considerando só quem gastou na categoria. TODO: pré-calcular em app.despesa_referencia (consulta pesada com todos os dados).
WITH alvo AS (
    SELECT e.id_cargo, c.ano, c.uf FROM candidatura c JOIN eleicao e ON e.id_eleicao = c.id_eleicao WHERE c.id_candidatura = ?
),
pares AS (
    SELECT c2.id_candidatura
    FROM candidatura c2
    JOIN eleicao e2 ON e2.id_eleicao = c2.id_eleicao
    JOIN alvo a ON a.id_cargo = e2.id_cargo AND a.ano = c2.ano AND a.uf = c2.uf
    WHERE e2.tipo_eleicao = 'ORDINARIA'
),
por_categoria AS (
    SELECT p.id_candidatura, coalesce(k.grupo_classificacao, 'outros') AS categoria, sum(d.valor_despesa) AS valor
    FROM pares p
    JOIN despesa_campanha d ON d.id_candidatura = p.id_candidatura
    LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
    WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO') AND NOT coalesce(k.transferencia, false)
    GROUP BY 1, 2
)
SELECT categoria, median(valor) AS mediana, count(*) AS n_candidaturas FROM por_categoria GROUP BY 1

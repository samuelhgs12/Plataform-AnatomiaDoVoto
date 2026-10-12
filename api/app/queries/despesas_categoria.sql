-- Gasto por grupo de categoria. Regra do projeto: prestação FINAL ou REGULARIZACAO_OMISSAO, sem transferências.
SELECT coalesce(k.grupo_classificacao, 'outros') AS categoria, coalesce(bool_or(k.publicidade), false) AS publicidade,
       sum(d.valor_despesa) AS valor
FROM despesa_campanha d
LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
WHERE d.id_candidatura = ?
  AND d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND NOT coalesce(k.transferencia, false)
GROUP BY 1
ORDER BY valor DESC

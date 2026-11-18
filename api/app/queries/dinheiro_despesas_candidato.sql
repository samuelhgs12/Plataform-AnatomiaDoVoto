-- Categorias originais do TSE: preserva materiais impressos, comícios, passagens etc., sem agrupar em "outros".
-- Mesmas regras do gasto total: prestação final/regularização, sem transferências, inclusive sem categoria.
SELECT coalesce(k.origem_despesa, 'Sem categoria informada') AS categoria,
       coalesce(bool_or(k.publicidade), false) AS publicidade,
       coalesce(sum(d.valor_despesa), 0) AS valor
FROM despesa_campanha d
LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
WHERE d.id_candidatura = ?
  AND d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND NOT coalesce(k.transferencia, false)
GROUP BY 1
ORDER BY valor DESC, categoria

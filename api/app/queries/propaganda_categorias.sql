-- Pergunta 9: propaganda de uma candidatura por categoria original do TSE (origem_despesa), com o grupo do projeto.
SELECT k.origem_despesa AS origem, coalesce(k.grupo_classificacao, 'outros') AS grupo, count(*) AS lancamentos,
       CAST(round(sum(d.valor_despesa) * 100) AS BIGINT) AS centavos
FROM despesa_campanha d
JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
WHERE d.id_candidatura = ?
  AND d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND k.publicidade AND NOT k.transferencia
GROUP BY ALL
ORDER BY centavos DESC, origem

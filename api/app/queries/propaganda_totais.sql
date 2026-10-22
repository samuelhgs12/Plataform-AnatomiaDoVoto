-- Pergunta 9, totais de uma candidatura (mesmas regras de despesas_categoria.sql): prestação FINAL ou REGULARIZACAO_OMISSAO,
-- sem transferências, valor CONTRATADO. Em centavos inteiros, para somas e percentuais exatos na página.
SELECT count(*) AS lancamentos,
       CAST(coalesce(round(sum(d.valor_despesa) * 100), 0) AS BIGINT) AS total_centavos,
       CAST(coalesce(round(sum(d.valor_despesa) FILTER (WHERE coalesce(k.publicidade, false)) * 100), 0) AS BIGINT) AS propaganda_centavos
FROM despesa_campanha d
LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
WHERE d.id_candidatura = ?
  AND d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND NOT coalesce(k.transferencia, false)

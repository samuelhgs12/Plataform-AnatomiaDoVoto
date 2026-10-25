-- Pergunta 9, nuvem de palavras: descrições das despesas de propaganda de uma candidatura, agrupadas (mesmas regras de
-- propaganda_categorias.sql). A descrição só é lida pela API (app/nuvem.py); a resposta leva apenas os termos canônicos.
SELECT d.descricao_despesa AS descricao, k.origem_despesa AS origem, coalesce(k.grupo_classificacao, 'outros') AS grupo,
       count(*) AS despesas, CAST(round(sum(d.valor_despesa) * 100) AS BIGINT) AS centavos
FROM despesa_campanha d
JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
WHERE d.id_candidatura = ?
  AND d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND k.publicidade AND NOT k.transferencia
GROUP BY ALL

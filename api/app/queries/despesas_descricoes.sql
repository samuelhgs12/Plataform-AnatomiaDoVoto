-- Descrições das despesas de propaganda (publicidade) da candidatura, para a nuvem de palavras.
-- Mesma regra do gasto por categoria: só prestação FINAL ou REGULARIZACAO_OMISSAO.
SELECT d.descricao_despesa
FROM despesa_campanha d
JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
WHERE d.id_candidatura = ?
  AND k.publicidade
  AND d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND d.descricao_despesa IS NOT NULL
LIMIT 5000

-- Camada Dinheiro do mapa: as descrições das despesas de propaganda das campanhas a um cargo numa cidade, para a nuvem
-- de palavras da cidade (app/routers/dinheiro.py). Parâmetros: id_municipio, ano, cargo, só eleitos (true/false).
-- Mesmas regras de pecas_geral.sql (pergunta 9). A descrição só é lida pela API: só as peças saem dela.
SELECT d.descricao_despesa AS descricao, k.origem_despesa AS origem, coalesce(k.grupo_classificacao, 'outros') AS grupo,
       count(*) AS despesas, CAST(round(sum(d.valor_despesa) * 100) AS BIGINT) AS centavos
FROM despesa_campanha d
JOIN categoria_despesa k  ON k.id_categoria_despesa = d.id_categoria_despesa
JOIN candidatura c        ON c.id_candidatura = d.id_candidatura
JOIN eleicao e            ON e.id_eleicao = c.id_eleicao
JOIN cargo g              ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr  ON rr.id_rotulo = c.id_rotulo_final
WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND k.publicidade AND NOT k.transferencia
  AND c.id_municipio = ? AND c.ano = ? AND g.nome = ?
  AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA'
  AND coalesce(c.disputou, rr.disputou, false) AND (NOT ? OR rr.eleito)
GROUP BY ALL
ORDER BY descricao, origem

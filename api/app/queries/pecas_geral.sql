-- Pergunta 9, visão geral: as descrições das despesas de propaganda agrupadas por ano, cargo e UF (presidente: 'BR'), para
-- o pré-cálculo das peças de cada recorte (app/pecas_geral.py). Mesmas regras da q9: só titulares, eleição ordinária e
-- quem disputou; prestação FINAL ou REGULARIZACAO_OMISSAO; só propaganda, sem transferências; valor contratado. Ordenadas
-- pela descrição, para que cada descrição distinta seja classificada uma vez só. A descrição só é lida pela API.
SELECT c.ano, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf,
       d.descricao_despesa AS descricao, k.origem_despesa AS origem, coalesce(k.grupo_classificacao, 'outros') AS grupo,
       count(*) AS despesas, CAST(round(sum(d.valor_despesa) * 100) AS BIGINT) AS centavos
FROM despesa_campanha d
JOIN categoria_despesa k  ON k.id_categoria_despesa = d.id_categoria_despesa
JOIN candidatura c        ON c.id_candidatura = d.id_candidatura
JOIN eleicao e            ON e.id_eleicao = c.id_eleicao
JOIN cargo g              ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr  ON rr.id_rotulo = c.id_rotulo_final
WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND k.publicidade AND NOT k.transferencia
  AND c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA'
  AND coalesce(c.disputou, rr.disputou, false)
GROUP BY ALL
ORDER BY descricao, origem

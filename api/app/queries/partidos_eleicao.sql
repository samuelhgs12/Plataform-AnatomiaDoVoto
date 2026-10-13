-- Parâmetros (nesta ordem): cargo, ano, uf, uf.
-- Partidos com ao menos um titular que disputou a eleição ordinária (mesmo recorte da listagem).
SELECT DISTINCT p.sigla
FROM candidatura c
JOIN eleicao e          ON e.id_eleicao = c.id_eleicao
JOIN rotulo_resultado r ON r.id_rotulo = c.id_rotulo_final
JOIN partido p          ON p.id_partido = c.id_partido
WHERE e.tipo_eleicao = 'ORDINARIA'
  AND r.categoria <> 'NAO_DISPUTOU'
  AND e.id_cargo = ?::INTEGER
  AND c.ano = ?::INTEGER
  AND (?::VARCHAR IS NULL OR c.uf = ?::VARCHAR)
ORDER BY p.sigla

-- Mediana do % de receita pública entre as candidaturas do mesmo cargo, ano e UF. TODO: pré-calcular.
WITH alvo AS (
    SELECT e.id_cargo, c.ano, c.uf FROM candidatura c JOIN eleicao e ON e.id_eleicao = c.id_eleicao WHERE c.id_candidatura = ?
)
SELECT median(coalesce(r.receita_publica, 0) / r.receita_total) AS mediana_pct_publica
FROM candidatura c2
JOIN eleicao e2 ON e2.id_eleicao = c2.id_eleicao
JOIN alvo a ON a.id_cargo = e2.id_cargo AND a.ano = c2.ano AND a.uf = c2.uf
JOIN vw_receita_candidatura r ON r.id_candidatura = c2.id_candidatura
WHERE e2.tipo_eleicao = 'ORDINARIA' AND r.receita_total > 0

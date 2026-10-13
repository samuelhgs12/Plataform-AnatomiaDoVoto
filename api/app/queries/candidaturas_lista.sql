-- Parâmetros (nesta ordem): incluir_suplementares, cargo, cargo, ano, ano, uf, uf, partido, partido, eleito, eleito, ordem, tamanho, deslocamento.
-- Só titulares que chegaram a disputar. Votos do 1º turno.
WITH base AS (
    SELECT c.id_candidatura, c.id_candidato, c.nome_urna, c.numero_urna, c.uf, c.ano,
           p.sigla AS partido, g.nome AS cargo, r.categoria AS resultado, r.eleito,
           coalesce(v.votos, 0) AS votos
    FROM candidatura c
    JOIN eleicao e          ON e.id_eleicao = c.id_eleicao
    JOIN cargo g            ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado r ON r.id_rotulo = c.id_rotulo_final
    LEFT JOIN partido p     ON p.id_partido = c.id_partido
    LEFT JOIN (SELECT id_candidatura, votos FROM resultado_candidatura WHERE turno = 1) v
           ON v.id_candidatura = c.id_candidatura
    WHERE g.eh_titular
      AND r.categoria <> 'NAO_DISPUTOU'
      AND (? OR e.tipo_eleicao = 'ORDINARIA')
      AND (?::INTEGER IS NULL OR e.id_cargo = ?::INTEGER)
      AND (?::INTEGER IS NULL OR c.ano = ?::INTEGER)
      AND (?::VARCHAR IS NULL OR c.uf = ?::VARCHAR)
      AND (?::VARCHAR IS NULL OR p.sigla = ?::VARCHAR)
      AND (?::BOOLEAN IS NULL OR r.eleito = ?::BOOLEAN)
)
SELECT *, count(*) OVER () AS total
FROM base
ORDER BY CASE WHEN ? = 'nome' THEN nome_urna END, votos DESC, nome_urna
LIMIT ? OFFSET ?

-- Parâmetros: padrão do nome civil, padrão do nome de urna (ambos já sem acento, minúsculos, com % e escape), limite.
-- Devolve a candidatura mais recente de cada pessoa que casa com a busca.
WITH achados AS (
    SELECT c.id_candidato, k.nome_civil, c.nome_urna, c.uf, c.ano, e.id_cargo,
           p.sigla AS partido, g.nome AS cargo, r.eleito
    FROM candidatura c
    JOIN candidato k        ON k.id_candidato = c.id_candidato
    JOIN eleicao e          ON e.id_eleicao = c.id_eleicao
    JOIN cargo g            ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado r ON r.id_rotulo = c.id_rotulo_final
    LEFT JOIN partido p     ON p.id_partido = c.id_partido
    WHERE strip_accents(lower(k.nome_civil)) LIKE ? ESCAPE '\'
       OR strip_accents(lower(c.nome_urna))  LIKE ? ESCAPE '\'
)
SELECT id_candidato, nome_civil, nome_urna, uf, ano AS ultimo_ano, partido, cargo AS ultimo_cargo, eleito AS ultimo_eleito
FROM achados
QUALIFY row_number() OVER (PARTITION BY id_candidato ORDER BY ano DESC, id_cargo DESC) = 1
ORDER BY ultimo_ano DESC, nome_civil
LIMIT ?

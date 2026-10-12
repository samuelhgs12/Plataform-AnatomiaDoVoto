SELECT c.id_candidatura, c.ano, c.uf, g.nome AS cargo
FROM candidatura c JOIN eleicao e ON e.id_eleicao = c.id_eleicao JOIN cargo g ON g.id_cargo = e.id_cargo
WHERE c.id_candidatura = ?

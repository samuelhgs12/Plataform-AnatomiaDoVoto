SELECT c.id_candidatura, c.ano, g.nome AS cargo, g.id_cargo, g.eh_titular, c.uf, m.nome AS municipio,
       p.sigla AS partido, c.nome_urna, c.numero_urna, c.ue, c.sequencial, e.tipo_eleicao,
       r.categoria AS resultado, r.eleito, coalesce(c.disputou, r.disputou, false) AS disputou,
       coalesce(v.votos, 0) AS votos_1t
FROM candidatura c
JOIN eleicao e          ON e.id_eleicao = c.id_eleicao
JOIN cargo g            ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado r ON r.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p     ON p.id_partido = c.id_partido
LEFT JOIN municipio m   ON m.id_municipio = c.id_municipio
LEFT JOIN (SELECT id_candidatura, votos FROM resultado_candidatura WHERE turno = 1) v
       ON v.id_candidatura = c.id_candidatura
WHERE c.id_candidato = ?
ORDER BY c.ano, g.id_cargo, c.id_candidatura

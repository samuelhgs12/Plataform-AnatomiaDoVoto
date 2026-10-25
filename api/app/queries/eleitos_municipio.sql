-- Eleitos de um município numa eleição municipal: prefeito, vice e vereadores. Parâmetros: id_municipio, ano.
-- Só eleição ordinária. Votos do 1º turno; gasto e recebido como nas análises (prestação final, sem transferências
-- nem repasses entre candidatos).
SELECT g.nome AS cargo, g.id_cargo, c.id_candidato, c.id_candidatura, c.nome_urna, p.sigla AS partido,
       coalesce(v.votos, 0) AS votos,
       coalesce(d.gasto_total, 0) AS gasto,
       coalesce(r.receita_total, 0) AS receita,
       coalesce(r.receita_publica, 0) AS receita_publica
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura) v
       ON v.id_candidatura = c.id_candidatura
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
LEFT JOIN vw_receita_candidatura r ON r.id_candidatura = c.id_candidatura
WHERE c.id_municipio = ? AND c.ano = ? AND rr.eleito AND e.tipo_eleicao = 'ORDINARIA'
  AND g.nome IN ('Prefeito', 'Vice-prefeito', 'Vereador')
ORDER BY g.id_cargo, votos DESC, c.nome_urna

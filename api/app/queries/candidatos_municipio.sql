-- Todos os candidatos de um cargo num município (eleição municipal), eleitos ou não. Parâmetros: id_municipio, ano, cargo.
-- Só eleição ordinária e quem de fato disputou. Votos do 1º turno; gasto e recebido como em eleitos_municipio.sql.
-- prestou = entregou a prestação de contas final (sem ela, gasto e recebido zero querem dizer "desconhecido").
SELECT g.nome AS cargo, g.id_cargo, c.id_candidato, c.id_candidatura, c.nome_urna, p.sigla AS partido,
       coalesce(v.votos, 0) AS votos,
       coalesce(d.gasto_total, 0) AS gasto,
       coalesce(r.receita_total, 0) AS receita,
       coalesce(r.receita_publica, 0) AS receita_publica,
       rr.eleito, rr.descricao AS resultado,
       EXISTS (SELECT 1 FROM despesa_campanha x WHERE x.id_candidatura = c.id_candidatura AND x.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO'))
         OR EXISTS (SELECT 1 FROM receita_campanha x WHERE x.id_candidatura = c.id_candidatura AND x.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')) AS prestou
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura) v
       ON v.id_candidatura = c.id_candidatura
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
LEFT JOIN vw_receita_candidatura r ON r.id_candidatura = c.id_candidatura
WHERE c.id_municipio = ? AND c.ano = ? AND g.nome = ? AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou
ORDER BY rr.eleito DESC, votos DESC, c.nome_urna

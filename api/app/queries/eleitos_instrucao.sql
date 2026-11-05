-- Prefeito e vereadores eleitos de um município numa eleição municipal, com o grau de instrução (pergunta 4: detalhes
-- do mapa em Comparar › Instrução). Parâmetros: cod_ibge, ano. O município vem pelo cod_ibge, que casa com o mapa.json
-- (o id_municipio muda a cada carga). Só eleição ordinária e titulares, como em analises/q4.sql. escolaridade = o rótulo
-- original do TSE; nivel = a escala comum de 4 níveis (nulo = não informou). ue e sequencial: a chave da foto.
SELECT g.nome AS cargo, c.id_candidato, c.id_candidatura, c.nome_urna, p.sigla AS partido,
       c.ano, c.ue, c.sequencial, c.escolaridade_candidatura AS escolaridade, n.nivel,
       coalesce(v.votos, 0) AS votos
FROM candidatura c
JOIN municipio m         ON m.id_municipio = c.id_municipio
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN nivel_instrucao n ON n.id_nivel_instrucao = c.id_nivel_instrucao
LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura) v
       ON v.id_candidatura = c.id_candidatura
WHERE m.cod_ibge = ? AND c.ano = ? AND rr.eleito AND e.tipo_eleicao = 'ORDINARIA'
  AND g.unidade = 'MUNICIPIO' AND g.eh_titular
ORDER BY g.id_cargo, votos DESC, c.nome_urna

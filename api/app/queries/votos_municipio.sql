-- Votos de uma candidatura ($1) em cada município e turno, para o mapa da visão Candidato.
-- Disputa = mesma eleição e mesma unidade (UF ou BR). Os municípios são os dos estados do projeto onde a disputa teve
-- voto; onde a candidatura não teve, vem com 0 (a tabela só guarda municípios com voto).
-- Válidos do cargo = nominais de todas as candidaturas da disputa + votos de legenda (estes só existem de 2018 em diante).
WITH alvo AS (
    SELECT id_candidatura, id_eleicao, ue FROM candidatura WHERE id_candidatura = $1
),
disputa AS (
    SELECT v.id_candidatura, v.id_municipio, v.turno, v.votos
    FROM votos_candidatura_municipio v
    JOIN candidatura c ON c.id_candidatura = v.id_candidatura
    JOIN alvo a        ON a.id_eleicao = c.id_eleicao AND a.ue = c.ue
    JOIN municipio m   ON m.id_municipio = v.id_municipio
    WHERE m.uf IN (SELECT DISTINCT uf FROM candidatura WHERE uf IS NOT NULL AND uf <> 'BR')
),
por_municipio AS (
    SELECT id_municipio, turno, sum(votos) AS nominais, count(*) AS com_voto
    FROM disputa GROUP BY id_municipio, turno
),
posicoes AS (
    SELECT id_candidatura, id_municipio, turno, votos,
           rank() OVER (PARTITION BY id_municipio, turno ORDER BY votos DESC) AS posicao
    FROM disputa
),
legenda AS (
    SELECT p.id_municipio, p.turno, sum(coalesce(p.votos_legenda, 0)) AS legenda
    FROM votos_partido_municipio p JOIN alvo a ON a.id_eleicao = p.id_eleicao
    GROUP BY p.id_municipio, p.turno
)
SELECT a.id_candidatura, t.id_municipio, m.uf, t.turno,
       coalesce(x.votos, 0) AS votos,
       t.nominais + coalesce(l.legenda, 0) AS validos_cargo,
       coalesce(x.posicao, t.com_voto + 1) AS posicao      -- sem voto: depois de todos que tiveram
FROM por_municipio t
CROSS JOIN alvo a
JOIN municipio m ON m.id_municipio = t.id_municipio
LEFT JOIN posicoes x ON x.id_candidatura = a.id_candidatura AND x.id_municipio = t.id_municipio AND x.turno = t.turno
LEFT JOIN legenda l  ON l.id_municipio = t.id_municipio AND l.turno = t.turno
-- só os turnos que a candidatura disputou (com voto em algum lugar)
WHERE t.turno IN (SELECT turno FROM votos_candidatura_municipio WHERE id_candidatura = $1)
ORDER BY t.turno, t.id_municipio

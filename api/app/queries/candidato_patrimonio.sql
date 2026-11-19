-- Patrimônio declarado em cada candidatura de uma pessoa ($1 = id_candidato), para a evolução no perfil.
-- Só titulares de eleição ordinária que de fato disputaram (as da linha do tempo), de 2006 em diante (bem_candidato
-- só existe desde então). Uma linha por candidatura e tipo de bem (cd_tipo_bem, o código da declaração do Imposto de
-- Renda); quem não declarou nenhum bem vem numa linha só, com cd_tipo_bem nulo e valor 0. Sem correção pela inflação.
WITH minhas AS (
    SELECT v.id_candidatura, v.ano, v.cargo, v.id_cargo, v.uf, v.eleito
    FROM vw_candidatura v
    WHERE v.id_candidato = $1 AND v.eh_titular AND v.ordinaria AND v.disputou AND v.ano >= 2006
)
SELECT m.id_candidatura, m.ano, m.cargo, m.uf, mu.nome AS municipio, m.eleito,
       b.cd_tipo_bem, coalesce(sum(b.valor_bem), 0) AS valor, count(b.id_bem) AS bens
FROM minhas m
JOIN candidatura c       ON c.id_candidatura = m.id_candidatura
LEFT JOIN municipio mu   ON mu.id_municipio = c.id_municipio
LEFT JOIN bem_candidato b ON b.id_candidatura = m.id_candidatura
GROUP BY m.id_candidatura, m.ano, m.cargo, m.id_cargo, m.uf, mu.nome, m.eleito, b.cd_tipo_bem
ORDER BY m.ano, m.id_cargo, m.id_candidatura, b.cd_tipo_bem

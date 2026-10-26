-- Visão Candidato do mapa: as candidaturas de uma pessoa ($1 = id_candidato) com os números do verso da ficha.
-- Só titulares de eleição ordinária que de fato disputaram (as mesmas da linha do tempo do perfil).
-- Disputa = mesma eleição (cargo e ano) e mesma unidade (UF, ou BR para presidente): é o grupo da mediana de gasto.
WITH minhas AS (
    SELECT v.*
    FROM vw_candidatura v
    WHERE v.id_candidato = $1 AND v.eh_titular AND v.ordinaria AND v.disputou
),
gastos AS (
    -- gasto de quem disputou as mesmas eleições (prestação de contas só existe de 2018 em diante)
    SELECT o.id_eleicao, o.ue, d.gasto_total
    FROM vw_candidatura o
    JOIN (SELECT DISTINCT id_eleicao, ue FROM minhas) k USING (id_eleicao, ue)
    JOIN vw_despesa_candidatura d USING (id_candidatura)
    WHERE o.disputou AND d.gasto_total > 0
),
medianas AS (
    SELECT id_eleicao, ue, median(gasto_total) AS mediana FROM gastos GROUP BY id_eleicao, ue
),
carreira AS (
    -- disputas e mandatos até esta candidatura, contando esta
    SELECT id_candidatura,
           count(*) OVER w AS disputas,
           count(*) FILTER (WHERE eleito) OVER w AS mandatos
    FROM minhas
    WINDOW w AS (ORDER BY ano, id_cargo, id_candidatura ROWS UNBOUNDED PRECEDING)
)
SELECT m.id_candidato, m.id_candidatura, m.ano, m.cargo,
       CASE WHEN m.ue = 'BR' THEN 'BR' ELSE m.uf END AS uf,
       p.sigla AS partido, c.numero_urna AS numero,
       coalesce(m.nome_urna, ca.nome_civil, '') AS nome_urna,   -- a ficha sempre tem um nome
       m.categoria AS resultado,
       coalesce(r.votos, 0) AS votos_total,
       d.gasto_total, md.mediana AS mediana_gasto_cargo,
       rc.receita_publica / nullif(rc.receita_total, 0) AS parte_publica,
       k.disputas, k.mandatos, m.ue, m.sequencial
FROM minhas m
JOIN candidatura c   USING (id_candidatura)
JOIN carreira k      USING (id_candidatura)
JOIN candidato ca    ON ca.id_candidato = m.id_candidato
LEFT JOIN partido p  ON p.id_partido = m.id_partido
LEFT JOIN resultado_candidatura r ON r.id_candidatura = m.id_candidatura AND r.turno = 1
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = m.id_candidatura
LEFT JOIN medianas md ON md.id_eleicao = m.id_eleicao AND md.ue = m.ue
LEFT JOIN vw_receita_candidatura rc ON rc.id_candidatura = m.id_candidatura
ORDER BY m.ano DESC, m.id_cargo DESC, m.id_candidatura DESC

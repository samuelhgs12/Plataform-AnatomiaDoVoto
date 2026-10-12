SELECT id_candidatura, coalesce(receita_publica, 0) AS publica, coalesce(receita_privada, 0) AS privada, coalesce(receita_total, 0) AS total
FROM vw_receita_candidatura WHERE id_candidatura = ?

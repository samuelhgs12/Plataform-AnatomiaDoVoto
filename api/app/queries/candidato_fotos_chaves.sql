-- Chaves de foto (ano, ue, sequencial) de todas as candidaturas de uma pessoa ($1 = id_candidato), da mais recente
-- para a mais antiga. O TSE só publica fotos de 2018 em diante; a primeira que existir no bdr_fotos é a da pessoa.
SELECT c.ano, c.ue, c.sequencial
FROM candidatura c
JOIN eleicao e ON e.id_eleicao = c.id_eleicao
WHERE c.id_candidato = $1 AND c.ano >= 2018 AND c.ue IS NOT NULL AND c.sequencial IS NOT NULL
ORDER BY c.ano DESC, e.id_cargo DESC, c.id_candidatura DESC

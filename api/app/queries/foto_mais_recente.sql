-- Banco de fotos (bdr_fotos). Parâmetros: tam ('mini' ou 'ficha'), e as listas de ano, ue e sequencial das candidaturas
-- da pessoa, já da mais recente para a mais antiga (candidato_fotos_chaves). Devolve a imagem da primeira que tem foto.
WITH chaves AS (
    SELECT unnest($2::INTEGER[]) AS ano, unnest($3::VARCHAR[]) AS ue, unnest($4::VARCHAR[]) AS sequencial,
           unnest(range(len($2::INTEGER[]))) AS ordem
)
SELECT CASE WHEN $1 = 'ficha' THEN coalesce(f.foto, f.miniatura) ELSE coalesce(f.miniatura, f.foto) END AS imagem
FROM chaves k
JOIN candidatura_foto f ON f.ano = k.ano AND f.ue = k.ue AND f.sequencial = k.sequencial
WHERE coalesce(f.foto, f.miniatura) IS NOT NULL
ORDER BY k.ordem
LIMIT 1

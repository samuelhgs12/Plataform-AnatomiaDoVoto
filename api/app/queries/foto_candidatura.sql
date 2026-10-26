-- Banco de fotos (bdr_fotos), não o principal. Parâmetros: tam ('mini' ou 'ficha'), ano, ue, sequencial.
-- mini: a miniatura WebP; ficha: o JPEG original do TSE. Sem a pedida, devolve a outra.
SELECT CASE WHEN ? = 'ficha' THEN coalesce(foto, miniatura) ELSE coalesce(miniatura, foto) END AS imagem
FROM candidatura_foto
WHERE ano = ? AND ue = ? AND sequencial = ?

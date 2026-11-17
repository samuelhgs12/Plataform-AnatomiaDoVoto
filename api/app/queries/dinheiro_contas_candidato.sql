SELECT EXISTS (
    SELECT 1 FROM despesa_campanha
    WHERE id_candidatura = $1 AND tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
) OR EXISTS (
    SELECT 1 FROM receita_campanha
    WHERE id_candidatura = $1 AND tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
) AS prestou

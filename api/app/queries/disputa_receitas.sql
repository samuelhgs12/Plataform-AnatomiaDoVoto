-- Os candidatos da mesma disputa de uma candidatura (pergunta 8 no perfil, cargos de uma vaga): presidente, o país;
-- governador e senador, a UF; prefeito, o município. Só titulares, eleição ordinária e quem disputou. % público = o que
-- cada um recebeu (prestação FINAL ou REGULARIZACAO_OMISSAO), inclusive repasses de outros candidatos, como em receitas.sql;
-- nulo = não declarou receitas. Só o necessário: candidatura, nome de urna, resultado e % público.
WITH alvo AS (
    SELECT c.ano, e.id_cargo, g.nome AS cargo, c.uf, c.id_municipio
    FROM candidatura c JOIN eleicao e ON e.id_eleicao = c.id_eleicao JOIN cargo g ON g.id_cargo = e.id_cargo
    WHERE c.id_candidatura = ?
), disputa AS (
    SELECT c.id_candidatura, c.nome_urna, rr.eleito
    FROM candidatura c
    JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
    JOIN cargo g             ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
    JOIN alvo a              ON a.ano = c.ano AND a.id_cargo = e.id_cargo AND c.uf IS NOT DISTINCT FROM a.uf
                            AND (a.cargo <> 'Prefeito' OR c.id_municipio = a.id_municipio)
    WHERE g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou
)
SELECT d.id_candidatura, d.nome_urna, d.eleito,
       coalesce(sum(r.valor_receita) FILTER (WHERE f.tipo = 'publico'), 0) / nullif(sum(r.valor_receita), 0) AS pct_publica
FROM disputa d
LEFT JOIN receita_campanha r ON r.id_candidatura = d.id_candidatura AND r.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
LEFT JOIN fonte_recurso f    ON f.id_fonte_recurso = r.id_fonte_recurso
GROUP BY d.id_candidatura, d.nome_urna, d.eleito
ORDER BY d.id_candidatura

-- Receita da candidatura nas 5 fontes da pergunta 8 (mesma classificação de pipeline/sql/q8.sql: se mudar lá, mude aqui).
-- Regras: prestação FINAL ou REGULARIZACAO_OMISSAO. Conta o que a campanha RECEBEU, inclusive repasses de outros candidatos,
-- pela fonte de origem (como as medianas e o "sucesso" de q8.sql): muito vereador recebe o Fundo Eleitoral pela campanha
-- do prefeito.
WITH r AS (
    SELECT CASE
               WHEN f.tipo = 'publico' AND upper(f.nome_fonte) LIKE '%ESPECIAL%' THEN 'fundo_eleitoral'
               WHEN f.tipo = 'publico' THEN 'fundo_partidario'
               WHEN r.origem_receita ILIKE '%pessoas f_sicas%' OR r.origem_receita ILIKE '%financiamento coletivo%'
                    OR r.origem_receita ILIKE '%internet%' THEN 'doacoes_pessoas'
               WHEN r.origem_receita ILIKE '%recursos pr_prios%' THEN 'recursos_proprios'
               ELSE 'outros_privados'
           END AS fonte,
           f.tipo, r.valor_receita AS valor
    FROM receita_campanha r
    LEFT JOIN fonte_recurso f ON f.id_fonte_recurso = r.id_fonte_recurso
    WHERE r.id_candidatura = ?
      AND r.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
)
SELECT coalesce(sum(valor) FILTER (WHERE tipo = 'publico'), 0)            AS publica,
       coalesce(sum(valor) FILTER (WHERE tipo IS DISTINCT FROM 'publico'), 0) AS privada,
       coalesce(sum(valor), 0)                                            AS total,
       coalesce(sum(valor) FILTER (WHERE fonte = 'fundo_eleitoral'), 0)   AS fundo_eleitoral,
       coalesce(sum(valor) FILTER (WHERE fonte = 'fundo_partidario'), 0)  AS fundo_partidario,
       coalesce(sum(valor) FILTER (WHERE fonte = 'doacoes_pessoas'), 0)   AS doacoes_pessoas,
       coalesce(sum(valor) FILTER (WHERE fonte = 'recursos_proprios'), 0) AS recursos_proprios,
       coalesce(sum(valor) FILTER (WHERE fonte = 'outros_privados'), 0)   AS outros_privados
FROM r

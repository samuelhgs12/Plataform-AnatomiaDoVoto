-- Pergunta 9: onde o candidato investe em propaganda — a campanha típica, para comparar no perfil.
-- Roda no banco final (bdr_final.duckdb ou MotherDuck). Servida pela API em GET /api/analises/q9 (cada COPY ... TO 'x.csv'
-- vira a tabela x da resposta); o perfil pede ?tabela=referencia.
--
-- Parcela de cada tipo de propaganda (grupo da categoria do TSE: física, audiovisual, digital) no total de propaganda de
-- cada campanha; a referência é a MEDIANA dessa parcela por cargo + ano + UF (presidente: 'BR'). Uma campanha sem nada
-- num tipo entra com parcela 0 nesse tipo.
--
-- Regras do projeto: só titulares, eleição ordinária e quem de fato disputou (o mesmo "disputou" do perfil:
-- candidatura.disputou, senão o do rótulo de resultado); prestação FINAL ou REGULARIZACAO_OMISSAO; só categorias de
-- propaganda (publicidade), sem transferências; valor contratado; só campanhas com propaganda > 0.
-- Vereador e prefeito também por UF (como a referência da seção de dinheiro), não por município.

CREATE OR REPLACE TEMP TABLE campanha_q9 AS
SELECT c.id_candidatura, c.ano, g.id_cargo, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf,
       CAST(sum(d.valor_despesa) AS DOUBLE) AS propaganda,
       CAST(coalesce(sum(d.valor_despesa) FILTER (WHERE k.grupo_classificacao = 'propaganda_fisica'), 0) AS DOUBLE) AS fisica,
       CAST(coalesce(sum(d.valor_despesa) FILTER (WHERE k.grupo_classificacao = 'propaganda_audiovisual'), 0) AS DOUBLE) AS audiovisual,
       CAST(coalesce(sum(d.valor_despesa) FILTER (WHERE k.grupo_classificacao = 'propaganda_digital'), 0) AS DOUBLE) AS digital
FROM despesa_campanha d
JOIN categoria_despesa k  ON k.id_categoria_despesa = d.id_categoria_despesa
JOIN candidatura c        ON c.id_candidatura = d.id_candidatura
JOIN eleicao e            ON e.id_eleicao = c.id_eleicao
JOIN cargo g              ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr  ON rr.id_rotulo = c.id_rotulo_final
WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND k.publicidade AND NOT k.transferencia
  AND c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA'
  AND coalesce(c.disputou, rr.disputou, false)
GROUP BY ALL
HAVING sum(d.valor_despesa) > 0;

-- referencia: uma linha por cargo + ano + UF + tipo, com a mediana da parcela (0 a 1) e o número de campanhas.
-- "campanhas" é o tamanho do grupo (cargo + ano + UF): toda campanha entra uma vez em cada tipo (com parcela 0 quando não
-- gastou nada nele), então o número é o mesmo nas três linhas do grupo. O perfil usa esse número para avisar quando a
-- típica vem de poucas campanhas.
COPY (
    SELECT ano, id_cargo, cargo, uf, grupo, median(parte) AS mediana, count(*) AS campanhas
    FROM (
        SELECT ano, id_cargo, cargo, uf, 'propaganda_fisica' AS grupo, fisica / propaganda AS parte FROM campanha_q9
        UNION ALL
        SELECT ano, id_cargo, cargo, uf, 'propaganda_audiovisual' AS grupo, audiovisual / propaganda AS parte FROM campanha_q9
        UNION ALL
        SELECT ano, id_cargo, cargo, uf, 'propaganda_digital' AS grupo, digital / propaganda AS parte FROM campanha_q9
    )
    GROUP BY ano, id_cargo, cargo, uf, grupo
    ORDER BY ano, id_cargo, uf, grupo
) TO 'painel_q9/referencia.csv' (HEADER);

-- parcelas: as parcelas de cada campanha dos grupos PEQUENOS (menos de 30 campanhas: governador, senador, presidente), para
-- o perfil calcular a típica SEM a própria campanha. Lida da tabela temporária acima: nenhuma nova varredura das despesas.
-- O 30 é LIMIAR_GRUPO_PEQUENO de web/src/lib/propaganda.ts (um teste confere que os dois são iguais). Nos grupos grandes a
-- própria campanha fica na mediana da referencia: tirar uma de 30 ou mais quase não a muda.
COPY (
    SELECT id_candidatura, ano, id_cargo, cargo, uf,
           fisica / propaganda AS propaganda_fisica,
           audiovisual / propaganda AS propaganda_audiovisual,
           digital / propaganda AS propaganda_digital
    FROM campanha_q9
    QUALIFY count(*) OVER (PARTITION BY ano, id_cargo, uf) < 30
    ORDER BY ano, id_cargo, uf, id_candidatura
) TO 'painel_q9/parcelas.csv' (HEADER);

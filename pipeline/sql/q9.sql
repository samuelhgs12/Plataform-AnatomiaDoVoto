-- Pergunta 9: onde o candidato investe em propaganda (análise por candidatura).
-- Roda no banco final (bdr_final.duckdb ou MotherDuck). Uso: python export_static.py q9
-- O export_static.py divide o resultado em web/public/data/q9/indice.json + um arquivo por eleição e UF
-- (web/public/data/q9/<ano>-<UF>.json; presidente em <ano>-BR.json): a página lê só o recorte escolhido.
--
-- Regras do projeto (as mesmas de api/app/queries/despesas_categoria.sql: se mudar aqui, mude lá):
--   * titulares de eleição ORDINÁRIA; prestação de contas FINAL ou REGULARIZACAO_OMISSAO (somar todos os tipos conta o
--     mesmo gasto mais de uma vez); sem transferências a outros candidatos/partidos (categoria_despesa.transferencia);
--   * valor = valor CONTRATADO (despesa_campanha.valor_despesa), não o pago; prestação de contas só existe de 2018 em diante;
--   * propaganda = categorias com categoria_despesa.publicidade (grupos propaganda_*); a categoria original do TSE
--     (origem_despesa) é exportada junto com o grupo;
--   * valores em centavos inteiros (BIGINT): somas e percentuais exatos na página.
-- Só leitura: dois SELECT (cada COPY é executado como o SELECT de dentro, em memória; nada é criado no banco) e a
-- agregação acontece no banco (só as linhas finais são transferidas).

-------------------------------------------------------------------------------
-- 1. Uma linha por candidatura do escopo (identificação pública e totais), inclusive as sem despesa registrada
--    (a página mostra "sem dados", não "R$ 0"). Sem CPF, título ou documento.
-------------------------------------------------------------------------------
COPY (
    WITH despesa AS (
        SELECT d.id_candidatura, count(*) AS lancamentos, sum(d.valor_despesa) AS total,
               sum(d.valor_despesa) FILTER (WHERE coalesce(k.publicidade, false)) AS propaganda
        FROM despesa_campanha d
        LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
        WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
          AND NOT coalesce(k.transferencia, false)
        GROUP BY d.id_candidatura
    )
    SELECT c.id_candidatura, c.ano, CASE WHEN g.unidade = 'BR' THEN 'BR' ELSE c.uf END AS uf, c.sequencial,
           g.nome AS cargo, m.cod_tse AS cod_municipio, m.nome AS municipio, c.nome_urna, c.numero_urna, p.sigla AS partido,
           coalesce(x.lancamentos, 0) AS lancamentos,
           CAST(coalesce(round(x.total * 100), 0) AS BIGINT) AS total_centavos,
           CAST(coalesce(round(x.propaganda * 100), 0) AS BIGINT) AS propaganda_centavos
    FROM candidatura c
    JOIN eleicao e        ON e.id_eleicao = c.id_eleicao
    JOIN cargo g          ON g.id_cargo = e.id_cargo
    LEFT JOIN municipio m ON m.id_municipio = c.id_municipio
    LEFT JOIN partido p   ON p.id_partido = c.id_partido
    LEFT JOIN despesa x   ON x.id_candidatura = c.id_candidatura
    WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA'
    ORDER BY c.ano, uf, cargo, municipio NULLS FIRST, c.nome_urna, c.sequencial
) TO 'painel_q9/candidaturas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. Propaganda por candidatura e categoria original do TSE (só categorias de propaganda), mesmo escopo.
-------------------------------------------------------------------------------
COPY (
    SELECT c.ano, CASE WHEN g.unidade = 'BR' THEN 'BR' ELSE c.uf END AS uf, c.sequencial,
           coalesce(k.grupo_classificacao, 'outros') AS grupo, k.origem_despesa AS origem, count(*) AS lancamentos,
           CAST(round(sum(d.valor_despesa) * 100) AS BIGINT) AS centavos
    FROM despesa_campanha d
    JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
    JOIN candidatura c       ON c.id_candidatura = d.id_candidatura
    JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
    JOIN cargo g             ON g.id_cargo = e.id_cargo
    WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
      AND k.publicidade AND NOT k.transferencia
      AND c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA'
    GROUP BY ALL
    ORDER BY c.ano, uf, c.sequencial, centavos DESC, origem
) TO 'painel_q9/categorias.csv' (HEADER);

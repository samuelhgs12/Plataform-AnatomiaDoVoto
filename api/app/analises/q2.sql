-- Pergunta 2: existe relação entre o volume de recursos/gastos e a taxa de sucesso eleitoral?
-- Roda no banco final (bdr_final.duckdb ou MotherDuck). Servida pela API em GET /api/analises/q2 (cada COPY ... TO
-- 'x.csv' vira a tabela x da resposta)
--
-- Três medidas, todas da prestação de contas FINAL ou REGULARIZACAO_OMISSAO (coluna "medida" nas tabelas exportadas):
--   * gasto:    despesas (vw_despesa_candidatura), sem transferências para outros candidatos ou partidos;
--   * receita:  tudo o que o candidato recebeu, INCLUSIVE de outros candidatos (material de campanha doado, comum entre
--               vereadores). Nas somas gerais do projeto esse repasse fica de fora para não contar o mesmo real duas vezes,
--               mas aqui cada candidato é comparado com os concorrentes, e o que recebeu é um recurso que de fato teve;
--   * recursos: o maior dos dois. Muitos candidatos declaram despesas com valor zero (material estimável) e recebem o
--               material de outro candidato: só com o gasto, dezenas de milhares pareceriam "sem dinheiro".
-- Só titulares, eleição ordinária e quem de fato disputou; não há receitas nem despesas antes de 2018.
-- Quem não entregou a prestação final fica na faixa -1 (valor desconhecido, não "zero"): fora dos grupos, das disputas
-- do item 2 e da correlação; a página só informa quantos são.
-- Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador) ou a UF
-- (deputados, senador e governador; presidente: o país).

-- Quem entregou a prestação de contas final (mesmo "sem movimentação", que vem como um lançamento de valor zero).
-- Quem não entregou não "gastou zero": o valor é desconhecido.
CREATE OR REPLACE TEMP TABLE prestou AS
SELECT id_candidatura FROM despesa_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
UNION
SELECT id_candidatura FROM receita_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO');

CREATE OR REPLACE TEMP TABLE cand_q2 AS
SELECT c.id_candidatura, c.id_candidato, c.ano, g.id_cargo, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf,
       CASE WHEN g.nome IN ('Prefeito', 'Vereador') THEN 'M' || c.id_municipio::VARCHAR ELSE coalesce(c.uf, 'BR') END AS disputa,
       rr.eleito,
       coalesce(d.gasto_total, 0) AS gasto,
       coalesce(r.recebido, 0) AS receita,
       coalesce(v.votos, 0) AS votos,
       c.id_candidatura IN (SELECT id_candidatura FROM prestou) AS prestou
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
LEFT JOIN (
    SELECT id_candidatura, sum(valor_receita) AS recebido
    FROM receita_campanha
    WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
    GROUP BY id_candidatura
) r ON r.id_candidatura = c.id_candidatura
LEFT JOIN (
    SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura
) v ON v.id_candidatura = c.id_candidatura
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou;

-- Quem já tinha o cargo: eleito para o mesmo cargo, NA MESMA LOCALIDADE (município ou UF), na eleição ordinária anterior
-- (4 anos antes; senador, também 8). Não prova que continuava no mandato, mas separa o efeito do dinheiro do efeito de
-- já ter sido eleito ali (quem tem mandato costuma ter mais recursos e ganhar mais).
CREATE OR REPLACE TEMP TABLE eleitos_antes AS
SELECT DISTINCT c.id_candidato, c.ano, e.id_cargo,
       CASE WHEN g.nome IN ('Prefeito', 'Vereador') THEN 'M' || c.id_municipio::VARCHAR ELSE coalesce(c.uf, 'BR') END AS disputa
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
WHERE rr.eleito AND e.tipo_eleicao = 'ORDINARIA' AND c.id_candidato IS NOT NULL;

-- Uma linha por candidatura e medida.
CREATE OR REPLACE TEMP TABLE medida_q2 AS
SELECT x.*,
       EXISTS (SELECT 1 FROM eleitos_antes a
               WHERE a.id_candidato = x.id_candidato AND a.id_cargo = x.id_cargo AND a.disputa = x.disputa
                 AND (a.ano = x.ano - 4 OR (x.cargo = 'Senador' AND a.ano = x.ano - 8))) AS tinha_cargo,
       m.medida,
       CASE m.medida WHEN 'gasto' THEN x.gasto WHEN 'receita' THEN x.receita ELSE greatest(x.gasto, x.receita) END AS valor
FROM cand_q2 x
CROSS JOIN (VALUES ('recursos'), ('gasto'), ('receita')) m(medida);

-- Faixa dentro da disputa: -1 = sem prestação final; 0 = nada declarado; 1 a 4 = cerca de um quarto cada de quem declarou (4 = os que mais têm).
-- percent_rank dá a mesma posição a valores iguais: empates caem sempre no mesmo grupo (resultado estável), por isso os
-- grupos têm tamanho aproximado; com 2 ou 3 candidatos na disputa, "o que mais tem" pode ser metade dela.
CREATE OR REPLACE TEMP TABLE faixa_q2 AS
SELECT *,
       CASE WHEN NOT prestou THEN -1
            WHEN valor <= 0 THEN 0
            ELSE least(4, 1 + floor(4 * percent_rank() OVER (PARTITION BY medida, ano, cargo, disputa, valor > 0 ORDER BY valor)))::INTEGER
       END AS faixa
FROM medida_q2;

-------------------------------------------------------------------------------
-- 1. Taxa de eleição por faixa, separando quem já tinha o cargo
-------------------------------------------------------------------------------
COPY (
    SELECT medida, ano, cargo, uf, tinha_cargo, faixa, count(*) AS candidaturas, count(*) FILTER (WHERE eleito) AS eleitos
    FROM faixa_q2
    GROUP BY ALL ORDER BY medida, ano, cargo, uf, tinha_cargo, faixa
) TO 'painel_q2/faixas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. Disputas com poucos candidatos (prefeito, governador, senador, presidente): o que tinha mais venceu?
--    chance_sorteio = vitórias esperadas se a medida não importasse (soma de p = vagas / candidatos de cada disputa);
--    var_sorteio = soma de p(1 - p), a variância dessa contagem, usada no teste estatístico da página.
--    Somas em inteiros (milionésimos): o resultado não depende da ordem da soma.
--    Entram só as disputas comparáveis; as outras são contadas por motivo (a cobertura que a página mostra):
--    excl_um_candidato, excl_sem_prestacao (alguém não entregou a prestação final: não se sabe quem tinha mais),
--    excl_sem_gasto (ninguém declarou nada) e excl_empate (mais de um com o maior valor, comparado pelo valor exato
--    da base, antes de qualquer arredondamento: em vez de escolher pelo código interno, a disputa sai da conta).
-------------------------------------------------------------------------------
COPY (
    WITH base AS (
        SELECT medida, ano, cargo, uf, disputa, count(*) AS candidatos, least(count(*) FILTER (WHERE eleito), count(*)) AS vagas,
               max(valor) AS maior, bool_and(prestou) AS todos_prestaram
        FROM faixa_q2
        WHERE cargo IN ('Prefeito', 'Governador', 'Senador', 'Presidente')
        GROUP BY ALL
    ), topo AS (
        SELECT f.medida, f.ano, f.cargo, f.disputa, count(*) AS no_topo, bool_or(f.eleito) AS eleito, bool_or(f.tinha_cargo) AS tinha_cargo
        FROM faixa_q2 f JOIN base b USING (medida, ano, cargo, disputa)
        WHERE f.valor = b.maior
        GROUP BY ALL
    ), classificada AS (
        SELECT b.*, t.eleito, t.tinha_cargo,
               CASE WHEN b.candidatos < 2 THEN 'um_candidato'
                    WHEN NOT b.todos_prestaram THEN 'sem_prestacao'
                    WHEN b.maior <= 0 THEN 'sem_gasto'
                    WHEN t.no_topo > 1 THEN 'empate' END AS excluida
        FROM base b JOIN topo t USING (medida, ano, cargo, disputa)
    )
    SELECT medida, ano, cargo, uf,
           count(*) FILTER (WHERE excluida IS NULL) AS disputas,
           count(*) FILTER (WHERE excluida IS NULL AND eleito) AS maior_venceu,
           count(*) FILTER (WHERE excluida IS NULL AND tinha_cargo) AS maior_tinha_cargo,
           round(coalesce(sum((vagas * 1000000) // candidatos) FILTER (WHERE excluida IS NULL), 0) / 1000000, 4) AS chance_sorteio,
           round(coalesce(sum((vagas * (candidatos - vagas) * 1000000) // (candidatos * candidatos)) FILTER (WHERE excluida IS NULL), 0) / 1000000, 4) AS var_sorteio,
           count(*) FILTER (WHERE excluida = 'um_candidato') AS excl_um_candidato,
           count(*) FILTER (WHERE excluida = 'sem_prestacao') AS excl_sem_prestacao,
           count(*) FILTER (WHERE excluida = 'sem_gasto') AS excl_sem_gasto,
           count(*) FILTER (WHERE excluida = 'empate') AS excl_empate
    FROM classificada
    GROUP BY ALL ORDER BY medida, ano, cargo, uf
) TO 'painel_q2/maior_gasto.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. Medida estatística: correlação entre a posição do candidato na medida e a posição nos votos, ambas dentro da
--    própria disputa. Posição = posto médio (valores iguais recebem a média das posições que ocupam, como no Spearman),
--    dividido pelo número de candidatos da disputa, para que disputas de tamanhos diferentes fiquem na mesma escala.
--    Os postos de todas as disputas do cargo são reunidos numa só correlação de Pearson. Vai de -1 a 1.
--    Somas exatas em HUGEINT (postos em milionésimos): o resultado não depende da ordem da soma. uf NULL = todas as UFs.
-------------------------------------------------------------------------------
COPY (
    WITH postos AS (
        SELECT medida, ano, cargo, uf,
               -- posto médio = rank + (empatados - 1) / 2; normalizado para (0, 1)
               (rank() OVER (PARTITION BY medida, ano, cargo, disputa ORDER BY valor)
                 + (count(*) OVER (PARTITION BY medida, ano, cargo, disputa, valor) - 1) / 2.0 - 0.5)
                 / count(*) OVER (PARTITION BY medida, ano, cargo, disputa) AS px,
               (rank() OVER (PARTITION BY medida, ano, cargo, disputa ORDER BY votos)
                 + (count(*) OVER (PARTITION BY medida, ano, cargo, disputa, votos) - 1) / 2.0 - 0.5)
                 / count(*) OVER (PARTITION BY medida, ano, cargo, disputa) AS py,
               count(*) OVER (PARTITION BY medida, ano, cargo, disputa) AS na_disputa
        FROM faixa_q2
        WHERE prestou   -- sem prestação: valor desconhecido, fora dos postos
    ), pos AS (
        SELECT medida, ano, cargo, uf, round(1000000 * px)::HUGEINT AS x, round(1000000 * py)::HUGEINT AS y
        FROM postos WHERE na_disputa > 1
    ), somas AS (
        SELECT medida, ano, cargo, uf, count(*)::HUGEINT AS n, sum(x) AS sx, sum(y) AS sy, sum(x * x) AS sxx, sum(y * y) AS syy, sum(x * y) AS sxy
        FROM pos
        GROUP BY GROUPING SETS ((medida, ano, cargo, uf), (medida, ano, cargo))
    ), termos AS (
        SELECT medida, ano, cargo, uf, n, n * sxy - sx * sy AS cov, n * sxx - sx * sx AS vx, n * syy - sy * sy AS vy FROM somas
    )
    SELECT medida, ano, cargo, uf, n::BIGINT AS n,
           round(cov::DOUBLE / (sqrt(vx::DOUBLE) * sqrt(vy::DOUBLE)), 3) AS correlacao
    FROM termos
    WHERE n > 2 AND vx > 0 AND vy > 0
    ORDER BY medida, ano, cargo, uf NULLS FIRST
) TO 'painel_q2/correlacao.csv' (HEADER);

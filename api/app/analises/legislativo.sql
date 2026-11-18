-- Legislativo: quem ocupa as cadeiras do Senado, da Câmara e das Assembleias Legislativas de AP, ES, MG, PE, RJ e RR,
-- com o viés ideológico do partido, o gasto de campanha e se a pessoa já tinha sido eleita antes.
-- Servida pela API em GET /api/analises/legislativo (cada COPY ... TO 'x.csv' vira a tabela x da resposta).
--
-- Composição (ano = eleição que formou a legislatura: 2018, 2022 ou 2026, os anos em que há viés):
--   * Câmara e Assembleia: os deputados federais e estaduais eleitos naquele ano;
--   * Senado: os senadores eleitos naquele ano e os eleitos quatro anos antes (o mandato é de oito anos).
-- Viés: o score do partido pelo qual a pessoa foi eleita, na eleição em que foi eleita (vies_partido, -100 esquerda a
-- +100 direita, da pesquisa BLS com parlamentares). Os senadores eleitos em 2014, antes da pesquisa, levam o score de 2018
-- do mesmo partido (o PMDB, que em 2017 virou MDB, leva o do MDB).
-- Gasto: despesas da prestação final ou regularização, sem transferências (vw_despesa_candidatura); nulo para quem não
-- entregou e para os eleitos antes de 2018 (não há despesas na base). Só titulares e eleições ordinárias.

CREATE OR REPLACE TEMP TABLE prestou_leg AS
SELECT id_candidatura FROM despesa_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
UNION
SELECT id_candidatura FROM receita_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO');

-- todas as vitórias em eleição ordinária, de titular, desde 1998: base da renovação
CREATE OR REPLACE TEMP TABLE vitorias AS
SELECT c.id_candidato, c.ano, e.id_cargo, c.uf
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
WHERE rr.eleito AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND c.id_candidato IS NOT NULL;

CREATE OR REPLACE TEMP TABLE eleitos_leg AS
SELECT c.id_candidatura, c.id_candidato, c.ano AS ano_eleicao, e.id_cargo, c.uf, c.nome_urna AS nome,
       p.id_partido, p.sigla,
       CASE WHEN c.ano >= 2018 AND c.id_candidatura IN (SELECT id_candidatura FROM prestou_leg)
            THEN coalesce(d.gasto_total, 0) END AS gasto
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
JOIN partido p           ON p.id_partido = c.id_partido
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
WHERE rr.eleito AND e.tipo_eleicao = 'ORDINARIA' AND e.id_cargo IN (5, 6, 7) AND c.ano >= 2014;

-- viés de cada eleito: o do partido na eleição dele. Para 2014, o de 2018 do partido com a mesma sigla (PMDB = MDB): a
-- sigla é única em `partido`, mas um partido que trocou de número tem outro id, e só um deles tem viés em 2018.
CREATE OR REPLACE TEMP TABLE vies_eleito AS
SELECT el.id_candidatura, v.score, v.erro_padrao, v.fonte
FROM eleitos_leg el
LEFT JOIN vies_partido v ON v.ano_eleicao = greatest(el.ano_eleicao, 2018)
 AND v.id_partido = CASE WHEN el.ano_eleicao >= 2018 THEN el.id_partido ELSE (
        SELECT min(v2.id_partido) FROM vies_partido v2 JOIN partido p2 ON p2.id_partido = v2.id_partido
        WHERE v2.ano_eleicao = 2018 AND p2.sigla = CASE el.sigla WHEN 'PMDB' THEN 'MDB' ELSE el.sigla END) END;

-------------------------------------------------------------------------------
-- 1. cadeiras: um eleito por linha, em cada composição (Senado: duas eleições por composição)
--    renovacao: reeleito = venceu para o mesmo cargo e estado na eleição anterior a esta (Senado: oito anos antes);
--    ja_eleito = venceu alguma outra eleição desde 1998 (outro cargo ou o mesmo cargo antes disso); estreante = nenhuma.
-------------------------------------------------------------------------------
COPY (
    WITH composicao AS (
        SELECT a.ano, el.*
        FROM (VALUES (2018), (2022), (2026)) a(ano)
        JOIN eleitos_leg el ON el.ano_eleicao = a.ano OR (el.id_cargo = 5 AND el.ano_eleicao = a.ano - 4)
    )
    SELECT k.ano,
           CASE k.id_cargo WHEN 5 THEN 'senado' WHEN 6 THEN 'camara' ELSE 'assembleia' END AS casa,
           k.uf, k.ano_eleicao, k.id_candidato, k.id_candidatura, k.nome, k.sigla,
           ve.score, ve.erro_padrao, ve.fonte, round(k.gasto, 2) AS gasto,
           CASE
               WHEN EXISTS (SELECT 1 FROM vitorias w WHERE w.id_candidato = k.id_candidato AND w.id_cargo = k.id_cargo
                              AND w.uf = k.uf AND w.ano = k.ano_eleicao - CASE k.id_cargo WHEN 5 THEN 8 ELSE 4 END)
                   THEN 'reeleito'
               WHEN EXISTS (SELECT 1 FROM vitorias w WHERE w.id_candidato = k.id_candidato AND w.ano < k.ano_eleicao)
                   THEN 'ja_eleito'
               ELSE 'estreante'
           END AS renovacao
    FROM composicao k
    LEFT JOIN vies_eleito ve ON ve.id_candidatura = k.id_candidatura
    ORDER BY k.ano, casa, ve.score NULLS LAST, k.sigla, k.uf, k.nome
) TO 'painel_legislativo/cadeiras.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. vagas: cadeiras de cada casa em cada estado e composição, conforme o TSE (Senado: três por estado)
-------------------------------------------------------------------------------
COPY (
    SELECT a.ano, CASE v.id_cargo WHEN 6 THEN 'camara' ELSE 'assembleia' END AS casa, v.uf, sum(v.qt_vagas) AS vagas
    FROM (VALUES (2018), (2022), (2026)) a(ano)
    JOIN vagas v ON v.ano = a.ano AND v.id_cargo IN (6, 7)
    GROUP BY ALL
    UNION ALL
    SELECT DISTINCT a.ano, 'senado', v.uf, 3
    FROM (VALUES (2018), (2022), (2026)) a(ano)
    JOIN vagas v ON v.ano = a.ano AND v.id_cargo = 5
    ORDER BY 1, 2, 3
) TO 'painel_legislativo/vagas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. gasto_partido: o que todas as campanhas de cada partido ao cargo gastaram naquela eleição (quem disputou e quem fez
--    campanha sem chegar a disputar, como na pergunta 1), e quantas cadeiras o partido ganhou. A página soma os partidos
--    para o custo da cadeira da casa. sem_prestacao: candidatos que disputaram sem entregar a prestação final.
-------------------------------------------------------------------------------
COPY (
    SELECT c.ano AS ano_eleicao, CASE e.id_cargo WHEN 5 THEN 'senado' WHEN 6 THEN 'camara' ELSE 'assembleia' END AS casa,
           c.uf, p.sigla,
           count(*) FILTER (WHERE rr.disputou) AS candidatos,
           count(*) FILTER (WHERE rr.eleito) AS eleitos,
           count(*) FILTER (WHERE rr.disputou AND c.id_candidatura NOT IN (SELECT id_candidatura FROM prestou_leg)) AS sem_prestacao,
           round(coalesce(sum(d.gasto_total), 0), 2) AS gasto
    FROM candidatura c
    JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
    JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
    JOIN partido p           ON p.id_partido = c.id_partido
    LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
    WHERE c.ano IN (2018, 2022, 2026) AND e.id_cargo IN (5, 6, 7) AND e.tipo_eleicao = 'ORDINARIA'
    GROUP BY ALL
    HAVING count(*) FILTER (WHERE rr.disputou) > 0 OR sum(d.gasto_total) > 0
    ORDER BY 1, 2, 3, 4
) TO 'painel_legislativo/gasto_partido.csv' (HEADER);

-------------------------------------------------------------------------------
-- 4. sem_resultado: casas e estados em que o TSE ainda não divulgou o resultado (há candidatos, nenhum eleito)
-------------------------------------------------------------------------------
COPY (
    SELECT c.ano, CASE e.id_cargo WHEN 5 THEN 'senado' WHEN 6 THEN 'camara' ELSE 'assembleia' END AS casa, c.uf,
           count(*) AS candidatos
    FROM candidatura c
    JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
    JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
    WHERE c.ano IN (2018, 2022, 2026) AND e.id_cargo IN (5, 6, 7) AND e.tipo_eleicao = 'ORDINARIA'
    GROUP BY ALL
    HAVING count(*) FILTER (WHERE rr.eleito) = 0
    ORDER BY 1, 2, 3
) TO 'painel_legislativo/sem_resultado.csv' (HEADER);

-- Onde o dinheiro das campanhas foi gasto (camada Dinheiro do mapa: perguntas 1, 2 e 8): as despesas declaradas em
-- grupos de categoria do TSE, por eleição, cargo, estado e, nas eleições municipais, por município.
-- Regras iguais às da análise municipios: só titulares, eleição ordinária, quem de fato disputou, prestação FINAL ou
-- REGULARIZACAO_OMISSAO, sem transferências a outros candidatos ou partidos (não são gasto da campanha). Os valores são
-- os contratados na prestação de contas, não o que foi pago. O município é o da candidatura (prefeito e vereador), não o
-- lugar em que o serviço foi prestado. Só os seis estados do projeto. Servida em GET /api/analises/dinheiro.
-- Despesas sem categoria entram no grupo sem_categoria, para a soma dos grupos bater com o gasto total.

CREATE OR REPLACE TEMP TABLE despesa_grupo AS
SELECT d.id_candidatura, d.valor_despesa,
       CASE WHEN k.id_categoria_despesa IS NULL THEN 'sem_categoria'   -- sem categoria: fica identificada, não some
            WHEN k.grupo_classificacao IN ('propaganda_fisica', 'propaganda_digital', 'propaganda_audiovisual') THEN k.grupo_classificacao
            WHEN k.grupo_classificacao = 'mobilizacao' OR k.origem_despesa ILIKE 'Eventos%' THEN 'mobilizacao'
            WHEN k.origem_despesa ILIKE 'Despesas com pessoal%' OR k.origem_despesa ILIKE 'Encargos sociais%' THEN 'pessoal'
            WHEN k.origem_despesa ILIKE 'Servi_os pr_prios prestados%' OR k.origem_despesa ILIKE 'Servi_os prestados por terceiros%' THEN 'terceiros'
            WHEN k.origem_despesa ILIKE 'Servi_os advocat%' OR k.origem_despesa ILIKE 'Servi_os cont%' OR k.origem_despesa ILIKE 'Pesquisas%' THEN 'profissionais'
            WHEN k.origem_despesa ILIKE '%ve_culos%' OR k.origem_despesa ILIKE 'Combust%' OR k.origem_despesa ILIKE '%transporte%' OR k.origem_despesa ILIKE 'Passagem%' THEN 'transporte'
            WHEN k.origem_despesa ILIKE 'Loca__o/cess_o%' OR k.origem_despesa ILIKE 'Energia%' OR k.origem_despesa ILIKE 'Telefone%' OR k.origem_despesa ILIKE '_gua%'
              OR k.origem_despesa ILIKE 'Materiais de expediente%' OR k.origem_despesa ILIKE 'Pr_-instala%' OR k.origem_despesa ILIKE '%Hospedagem%'
              OR k.origem_despesa ILIKE '%geradores%' OR k.origem_despesa ILIKE 'Alimenta%' THEN 'estrutura'
            ELSE 'outros' END AS grupo
FROM despesa_campanha d
LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa   -- LEFT, como vw_despesa_candidatura
WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO') AND NOT coalesce(k.transferencia, false);

-------------------------------------------------------------------------------
-- 1. Por eleição, cargo, estado, município (só prefeito e vereador; nulo nas gerais) e grupo: valor e número de despesas
-------------------------------------------------------------------------------
COPY (
    SELECT c.ano, g.nome AS cargo, c.uf,
           CASE WHEN g.nome IN ('Prefeito', 'Vereador') THEN c.id_municipio END AS id_municipio,
           dg.grupo, round(sum(dg.valor_despesa), 2) AS valor, count(*) AS despesas
    FROM despesa_grupo dg
    JOIN candidatura c       ON c.id_candidatura = dg.id_candidatura
    JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
    JOIN cargo g             ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
    WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou
      AND c.uf IN ('AP', 'ES', 'MG', 'PE', 'RJ', 'RR')
    GROUP BY ALL
    ORDER BY c.ano, g.nome, c.uf, id_municipio, dg.grupo
) TO 'dinheiro/despesas.csv' (HEADER);

-- Candidaturas dos seis estados com o que a camada Dinheiro precisa para as perguntas "quanto cada partido gastou",
-- "quanto custou um voto" e "como o gasto se divide entre os candidatos" (quartis). Mesmas regras de municipios.sql:
-- gasto = vw_despesa_candidatura, votos = 1º turno (votos nominais: o voto só na legenda não entra), quem não entregou a
-- prestação final fica com gasto desconhecido (contado à parte, fora dos quartis). porte = faixa de eleitores aptos da
-- cidade no ano, nas eleições municipais; os limites são os de PORTES em web/src/lib/territorio.ts (mude os dois juntos).
CREATE OR REPLACE TEMP TABLE cand_din AS
WITH ele AS (
    SELECT e.ano, p.id_municipio, max(p.eleitorado_apto) AS eleitorado
    FROM participacao_eleitoral p JOIN eleicao e ON e.id_eleicao = p.id_eleicao
    WHERE p.turno = 1 AND e.ano >= 2018
    GROUP BY ALL
)
SELECT c.id_candidatura, c.ano, g.nome AS cargo, c.uf, coalesce(p.sigla, '?') AS partido, rr.eleito,
       coalesce(v.votos, 0) AS votos, coalesce(d.gasto_total, 0) AS gasto, coalesce(r.receita_publica, 0) AS publico,
       c.id_candidatura IN (
           SELECT id_candidatura FROM despesa_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
           UNION SELECT id_candidatura FROM receita_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
       ) AS prestou,
       CASE WHEN g.nome NOT IN ('Prefeito', 'Vereador') OR coalesce(ele.eleitorado, 0) <= 0 THEN NULL
            WHEN ele.eleitorado < 5000 THEN 'ate5' WHEN ele.eleitorado < 10000 THEN 'ate10' WHEN ele.eleitorado < 20000 THEN 'ate20'
            WHEN ele.eleitorado < 50000 THEN 'ate50' WHEN ele.eleitorado < 200000 THEN 'ate200' ELSE 'mais200' END AS porte
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura) v
       ON v.id_candidatura = c.id_candidatura
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
LEFT JOIN vw_receita_candidatura r ON r.id_candidatura = c.id_candidatura
LEFT JOIN ele ON ele.ano = c.ano AND ele.id_municipio = c.id_municipio
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou
  AND c.uf IN ('AP', 'ES', 'MG', 'PE', 'RJ', 'RR');

-- Cada candidatura repetida em cada recorte em que ela entra: os seis estados (uf e porte nulos), o estado, o porte nos
-- seis e o porte no estado (os dois últimos só nas eleições municipais). A página escolhe a linha do recorte, sem somar.
CREATE OR REPLACE TEMP TABLE cand_recorte AS
SELECT c.*, k.uf_k, k.porte_k
FROM cand_din c,
     (VALUES (false, false), (true, false), (false, true), (true, true)) k0(com_uf, com_porte),
     LATERAL (SELECT CASE WHEN k0.com_uf THEN c.uf END AS uf_k, CASE WHEN k0.com_porte THEN c.porte END AS porte_k) k
WHERE NOT k0.com_porte OR c.porte IS NOT NULL;

-------------------------------------------------------------------------------
-- 2. Quanto cada partido gastou e quanto custou cada voto dele, por eleição, cargo e recorte (uf / porte nulos = todos).
--    gasto e votos somam todas as candidaturas que disputaram (sem prestação final = gasto desconhecido, contado em
--    sem_prestacao); publico = receita de fundos públicos (Fundo Eleitoral e Partidário), sem repasses entre candidatos.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf_k AS uf, porte_k AS porte, partido,
           count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos, count(*) FILTER (WHERE NOT prestou) AS sem_prestacao,
           round(sum(gasto), 2) AS gasto, sum(votos) AS votos, round(sum(publico), 2) AS publico
    FROM cand_recorte
    GROUP BY ALL
    ORDER BY ano, cargo, uf NULLS FIRST, porte NULLS FIRST, gasto DESC
) TO 'dinheiro/partidos.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. Os candidatos em quatro grupos de gasto (quartis), por eleição, cargo e recorte. faixa 1 = o quarto que menos gastou
--    entre os que declararam gasto; 4 = o quarto que mais gastou. faixa 0 = entregou as contas e não declarou gasto;
--    faixa -1 = sem prestação final (gasto desconhecido). percent_rank dá o mesmo grupo a valores iguais, como em q2 e q8:
--    os grupos têm tamanho aproximado, não exatamente 25%. Cada candidato é comparado com os do mesmo recorte.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf_k AS uf, porte_k AS porte, faixa,
           count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos,
           round(sum(gasto), 2) AS gasto, sum(votos) AS votos,
           round(min(gasto), 2) AS gasto_min, round(max(gasto), 2) AS gasto_max, round(median(gasto), 2) AS gasto_mediana
    FROM (
        SELECT *,
               CASE WHEN NOT prestou THEN -1
                    WHEN gasto <= 0 THEN 0
                    ELSE least(4, 1 + floor(4 * percent_rank() OVER (PARTITION BY ano, cargo, uf_k, porte_k, prestou AND gasto > 0 ORDER BY gasto)))::INTEGER
               END AS faixa
        FROM cand_recorte
    )
    GROUP BY ALL
    ORDER BY ano, cargo, uf NULLS FIRST, porte NULLS FIRST, faixa
) TO 'dinheiro/quartis.csv' (HEADER);

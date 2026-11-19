-- Pergunta 2: existe relação entre o patrimônio do candidato e a taxa de sucesso eleitoral?
-- Roda no banco final (bdr_final.duckdb ou MotherDuck). Servida pela API em GET /api/analises/q2 (cada COPY ... TO
-- 'x.csv' vira a tabela x da resposta)
--
-- A medida da pergunta (coluna "medida" = 'patrimonio'): o patrimônio declarado no registro da candidatura, soma de
-- valor_bem em bem_candidato (de 2006 em diante; o valor é o informado pelo candidato, sem correção pela inflação).
-- Sem nenhum bem na declaração = patrimônio zero ("nada declarado"): não há prestação a faltar, então ninguém fica de fora.
--
-- Para comparar, três medidas do dinheiro de campanha (a camada Dinheiro do mapa também as usa), só de 2018 em diante e
-- todas da prestação de contas FINAL ou REGULARIZACAO_OMISSAO:
--   * gasto:    despesas (vw_despesa_candidatura), sem transferências para outros candidatos ou partidos;
--   * receita:  tudo o que o candidato recebeu, INCLUSIVE de outros candidatos (material de campanha doado, comum entre
--               vereadores). Nas somas gerais do projeto esse repasse fica de fora para não contar o mesmo real duas vezes,
--               mas aqui cada candidato é comparado com os concorrentes, e o que recebeu é um recurso que de fato teve;
--   * recursos: o maior dos dois. Muitos candidatos declaram despesas com valor zero (material estimável) e recebem o
--               material de outro candidato: só com o gasto, dezenas de milhares pareceriam "sem dinheiro".
-- Só titulares, eleição ordinária e quem de fato disputou; não há receitas nem despesas antes de 2018.
-- Nas medidas de campanha, quem não entregou a prestação final fica na faixa -1 (valor desconhecido, não "zero"): fora dos grupos, das disputas
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
       coalesce(b.patrimonio, 0) AS patrimonio,
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
    SELECT id_candidatura, sum(valor_bem) AS patrimonio FROM bem_candidato GROUP BY id_candidatura
) b ON b.id_candidatura = c.id_candidatura
LEFT JOIN (
    SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura
) v ON v.id_candidatura = c.id_candidatura
WHERE c.ano >= 2006 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou;

-- Quem já tinha o cargo: eleito para o mesmo cargo, NA MESMA LOCALIDADE (município ou UF), na eleição ordinária anterior
-- (4 anos antes; senador, também 8). Não prova que continuava no mandato, mas separa o efeito do patrimônio (ou do
-- dinheiro) do efeito de já ter sido eleito ali (quem tem mandato costuma ter mais recursos e ganhar mais).
CREATE OR REPLACE TEMP TABLE eleitos_antes AS
SELECT DISTINCT c.id_candidato, c.ano, e.id_cargo,
       CASE WHEN g.nome IN ('Prefeito', 'Vereador') THEN 'M' || c.id_municipio::VARCHAR ELSE coalesce(c.uf, 'BR') END AS disputa
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
WHERE rr.eleito AND e.tipo_eleicao = 'ORDINARIA' AND c.id_candidato IS NOT NULL;

-- Uma linha por candidatura e medida. "prestou" = o valor é conhecido: no patrimônio, sempre; nas medidas de campanha,
-- só com a prestação final (e só de 2018 em diante, quando há receitas e despesas).
CREATE OR REPLACE TEMP TABLE medida_q2 AS
SELECT x.* EXCLUDE (prestou), m.medida = 'patrimonio' OR x.prestou AS prestou,
       EXISTS (SELECT 1 FROM eleitos_antes a
               WHERE a.id_candidato = x.id_candidato AND a.id_cargo = x.id_cargo AND a.disputa = x.disputa
                 AND (a.ano = x.ano - 4 OR (x.cargo = 'Senador' AND a.ano = x.ano - 8))) AS tinha_cargo,
       m.medida,
       CASE m.medida WHEN 'patrimonio' THEN x.patrimonio WHEN 'gasto' THEN x.gasto WHEN 'receita' THEN x.receita ELSE greatest(x.gasto, x.receita) END AS valor
FROM cand_q2 x
CROSS JOIN (VALUES ('patrimonio'), ('recursos'), ('gasto'), ('receita')) m(medida)
WHERE m.medida = 'patrimonio' OR x.ano >= 2018;

-- Faixa dentro da disputa: -1 = valor desconhecido (sem prestação final, só nas medidas de campanha); 0 = nada declarado; 1 a 4 = cerca de um quarto cada de quem declarou (4 = os que mais têm).
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

-------------------------------------------------------------------------------
-- PATRIMÔNIO DENTRO DA DISPUTA (camada Dinheiro do mapa, "2. Patrimônio elege?"; tabelas pat_*)
-- A pergunta é sobre relação: conforme o patrimônio declarado sobe, a chance de se eleger sobe junto? Cada candidato é
-- comparado só com os concorrentes da mesma disputa (o município para prefeito e vereador; a UF para deputados,
-- governador e senador). Isso controla cidades ricas × pobres e o número de vagas, e torna a inflação irrelevante: a
-- ordem dentro de uma eleição não muda com ela (os valores em reais só aparecem como rótulos, valores da época).
-- Patrimônio zero ("sem bens", cerca de 1/4 dos candidatos) é um grupo à parte, nunca o "menos rico": declarar zero não
-- quer dizer não ter nada. Os valores são os declarados ao TSE, com erros de digitação possíveis (bilhões para
-- vereador): nada é removido; como a regra usa a ORDEM dentro da disputa, um valor absurdo só muda a posição de uma pessoa.
-- Sucesso = eleito (rótulo final); votos = 1º turno. Eleições de 2006 a 2024, sem presidente (não há disputa por UF).
-- tinha_cargo (acima) é o fator de confusão principal: quem já tinha o cargo tem mais bens e ganha mais; toda tabela
-- traz o recorte para ver com e sem essas pessoas. Mostra associação, não causa.
-------------------------------------------------------------------------------

-- Uma linha por candidatura, com:
--   decil:     0 = sem bens; 1 a 10 = décimo do patrimônio entre os que declararam bens NA DISPUTA (10 = os mais ricos):
--              least(10, 1 + floor(10 * percent_rank)). percent_rank dá a mesma posição a valores iguais: empates ficam no
--              mesmo décimo, e os décimos têm tamanho aproximado. "Metade mais rica" = décimos 6 a 10 (percent_rank >= 0,5).
--   posicao:   1 = o mais rico da disputa; empates com a mesma posição; sem bens por último (todos com a mesma posição).
--   reeleicao: alguém na disputa já tinha o cargo (para prefeito, governador e senador, "sem quem já tinha o cargo" tira
--              a disputa inteira: com um prefeito tentando a reeleição, não dá para separar o patrimônio do mandato).
--   comparavel: a disputa teve mais de um candidato e algum eleito na base. Candidato único vence sempre (inflaria a
--              taxa do mais rico) e disputa sem eleito (anulada, sub judice) não diz quem venceu: as duas ficam fora das
--              escadas, medianas, faixas e listas (P1, P4 a P8); P2, P3 e P9 trazem todas, e a página conta as de fora.
CREATE OR REPLACE TEMP TABLE pat_q2 AS
WITH base AS (
    SELECT id_candidatura, id_candidato, ano, cargo, uf, disputa,
           CASE WHEN cargo IN ('Prefeito', 'Vereador') THEN substr(disputa, 2)::INTEGER END AS id_municipio,
           eleito, votos, tinha_cargo, round(valor, 2) AS patrimonio
    FROM medida_q2
    WHERE medida = 'patrimonio' AND ano BETWEEN 2006 AND 2024 AND cargo <> 'Presidente'
)
SELECT *,
       CASE WHEN patrimonio <= 0 THEN 0
            ELSE least(10, 1 + floor(10 * percent_rank() OVER (PARTITION BY ano, cargo, disputa, patrimonio > 0 ORDER BY patrimonio)))::INTEGER
       END AS decil,
       rank() OVER (PARTITION BY ano, cargo, disputa ORDER BY patrimonio DESC) AS posicao,
       count(*) OVER (PARTITION BY ano, cargo, disputa) AS na_disputa,
       count(*) FILTER (WHERE patrimonio > 0) OVER (PARTITION BY ano, cargo, disputa) AS com_bens_disputa,
       bool_or(tinha_cargo) OVER (PARTITION BY ano, cargo, disputa) AS reeleicao,
       count(*) OVER (PARTITION BY ano, cargo, disputa) > 1 AND bool_or(eleito) OVER (PARTITION BY ano, cargo, disputa) AS comparavel
FROM base;

-------------------------------------------------------------------------------
-- P1. A escada do estado: candidatos, eleitos e o patrimônio típico (mediana) de cada décimo, por eleição, cargo, UF e
--     tinha_cargo. Somando as duas linhas de tinha_cargo, "com todos"; só a false, "sem quem já tinha o cargo". A soma
--     dos décimos (0 a 10) é o total de candidatos. Os décimos são da disputa (a cidade, para vereador e prefeito): a
--     mediana do décimo junta candidatos de cidades diferentes e serve só de rótulo ("valor típico").
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, tinha_cargo, decil, count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos,
           round(median(patrimonio), 2) AS mediana
    FROM pat_q2
    WHERE comparavel
    GROUP BY ALL ORDER BY ano, cargo, uf, tinha_cargo, decil
) TO 'painel_q2/pat_decis.csv' (HEADER);

-------------------------------------------------------------------------------
-- P2. Vereador, cidade por cidade (cor do mapa): candidatos, quem declarou bens, eleitos, eleitos com bens e eleitos na
--     metade mais rica (décimos 6 a 10), por eleição, cidade e tinha_cargo. A cor é eleitos_rica ÷ eleitos_com_bens: os
--     eleitos sem bens ficam fora da conta (não são "menos ricos"), e a página informa quantos são.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, uf, id_municipio, tinha_cargo, count(*) AS candidatos, count(*) FILTER (WHERE decil > 0) AS com_bens,
           count(*) FILTER (WHERE eleito) AS eleitos, count(*) FILTER (WHERE eleito AND decil > 0) AS eleitos_com_bens,
           count(*) FILTER (WHERE eleito AND decil >= 6) AS eleitos_rica
    FROM pat_q2
    WHERE cargo = 'Vereador'
    GROUP BY ALL ORDER BY ano, uf, id_municipio, tinha_cargo
) TO 'painel_q2/pat_vereador.csv' (HEADER);

-------------------------------------------------------------------------------
-- P3. Disputas de um eleito só (prefeito, governador; senador: 1 ou 2 vagas), uma linha por disputa: candidatos, quantos
--     declararam bens, vagas (eleitos), a melhor posição de um eleito no patrimônio (pos_eleito; com duas vagas, a do
--     eleito mais rico), se esse eleito não declarou bens, se algum eleito já tinha o cargo, se alguém na disputa
--     tentava a reeleição e quantos dividem o 1º lugar (empate no topo). Sem eleito na base: pos_eleito nulo.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, id_municipio, any_value(na_disputa) AS candidatos, any_value(com_bens_disputa) AS com_bens,
           count(*) FILTER (WHERE eleito) AS vagas,
           min(posicao) FILTER (WHERE eleito) AS pos_eleito,
           coalesce(bool_and(patrimonio <= 0) FILTER (WHERE eleito), false) AS eleito_sem_bens,
           coalesce(bool_or(tinha_cargo) FILTER (WHERE eleito), false) AS eleito_tinha,
           any_value(reeleicao) AS reeleicao,
           count(*) FILTER (WHERE posicao = 1 AND patrimonio > 0) AS no_topo
    FROM pat_q2
    WHERE cargo IN ('Prefeito', 'Governador', 'Senador')
    GROUP BY ano, cargo, uf, id_municipio, disputa
    ORDER BY ano, cargo, uf, id_municipio
) TO 'painel_q2/pat_disputas.csv' (HEADER);

-------------------------------------------------------------------------------
-- P4. A escada dos majoritários: candidatos e vitórias por posição no patrimônio dentro da disputa (1 = o mais rico,
--     2, 3, 4 = 4º ou abaixo; 0 = sem bens, à parte), por eleição, cargo, UF e reeleicao (a disputa tinha alguém
--     tentando a reeleição), com a mediana do patrimônio de cada posição.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, reeleicao, CASE WHEN patrimonio <= 0 THEN 0 ELSE least(posicao, 4) END AS posicao,
           count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos, round(median(patrimonio), 2) AS mediana
    FROM pat_q2
    WHERE cargo IN ('Prefeito', 'Governador', 'Senador') AND comparavel
    GROUP BY ALL ORDER BY ano, cargo, uf, reeleicao, posicao
) TO 'painel_q2/pat_posicoes.csv' (HEADER);

-- Os dois recortes das tabelas seguintes: sem_cargo = false, todos; true, sem quem já tinha o cargo (vereador e
-- deputados: tira essas pessoas; prefeito, governador e senador: tira as disputas com alguém tentando a reeleição).
CREATE OR REPLACE TEMP TABLE pat_recorte AS
SELECT p.*, s.sem_cargo
FROM pat_q2 p, (VALUES (false), (true)) s(sem_cargo)
WHERE p.comparavel AND (NOT s.sem_cargo
   OR (p.cargo IN ('Prefeito', 'Governador', 'Senador') AND NOT p.reeleicao)
   OR (p.cargo NOT IN ('Prefeito', 'Governador', 'Senador') AND NOT p.tinha_cargo));

-------------------------------------------------------------------------------
-- P5. Eleitos e não eleitos: quanto declararam. Mediana do patrimônio de quem declarou bens (> 0) e quantos não
--     declararam nada, em cada grupo, por eleição, cargo, UF e recorte; mediana_todos = o candidato típico (> 0).
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, sem_cargo,
           count(*) FILTER (WHERE eleito) AS eleitos, count(*) FILTER (WHERE eleito AND patrimonio <= 0) AS eleitos_sem_bens,
           count(*) FILTER (WHERE NOT eleito) AS nao_eleitos, count(*) FILTER (WHERE NOT eleito AND patrimonio <= 0) AS nao_sem_bens,
           round(median(patrimonio) FILTER (WHERE eleito AND patrimonio > 0), 2) AS mediana_eleitos,
           round(median(patrimonio) FILTER (WHERE NOT eleito AND patrimonio > 0), 2) AS mediana_nao,
           round(median(patrimonio) FILTER (WHERE patrimonio > 0), 2) AS mediana_todos
    FROM pat_recorte
    GROUP BY ALL ORDER BY ano, cargo, uf, sem_cargo
) TO 'painel_q2/pat_medianas.csv' (HEADER);

-------------------------------------------------------------------------------
-- P6. Histograma em escala de 10 em 10 (para o gráfico eleitos × não eleitos, sem mandar dezenas de milhares de
--     pontos): faixa 0 = sem bens; 1 = menos de R$ 1 mil; 2 = R$ 1 mil a 10 mil; 3 = 10 mil a 100 mil; 4 = 100 mil a
--     1 milhão; 5 = 1 a 10 milhões; 6 = 10 milhões ou mais (valores da época). Por eleição, cargo, UF, recorte e eleito.
-------------------------------------------------------------------------------
COPY (
    SELECT ano, cargo, uf, sem_cargo, eleito,
           CASE WHEN patrimonio <= 0 THEN 0 WHEN patrimonio < 1000 THEN 1 WHEN patrimonio < 10000 THEN 2 WHEN patrimonio < 100000 THEN 3
                WHEN patrimonio < 1000000 THEN 4 WHEN patrimonio < 10000000 THEN 5 ELSE 6 END AS faixa,
           count(*) AS candidatos
    FROM pat_recorte
    GROUP BY ALL ORDER BY ano, cargo, uf, sem_cargo, eleito, faixa
) TO 'painel_q2/pat_faixas.csv' (HEADER);

-------------------------------------------------------------------------------
-- P7. Concordância por pares (a frase de resumo): dentro de cada disputa, entre pares de candidatos que declararam bens
--     e tiveram votos diferentes, em quantos o de maior patrimônio teve mais votos. pontos = 2 por par concordante + 1
--     por par com o mesmo patrimônio (vale meio): concordância = pontos ÷ (2 × pares); 50% = sem relação. Sem bens fica
--     fora (não é "menos rico"). Somas exatas em inteiros. Por eleição, cargo, UF e recorte.
-------------------------------------------------------------------------------
COPY (
    WITH p AS (
        SELECT ano, cargo, uf, disputa, patrimonio, votos, tinha_cargo, reeleicao FROM pat_q2 WHERE patrimonio > 0 AND comparavel
    ), par AS (
        SELECT a.ano, a.cargo, a.uf,
               CASE WHEN a.patrimonio > b.patrimonio THEN 2 WHEN a.patrimonio = b.patrimonio THEN 1 ELSE 0 END AS pts,
               CASE WHEN a.cargo IN ('Prefeito', 'Governador', 'Senador') THEN NOT a.reeleicao
                    ELSE NOT (a.tinha_cargo OR b.tinha_cargo) END AS sem_cargo_ok
        FROM p a JOIN p b ON a.ano = b.ano AND a.cargo = b.cargo AND a.disputa = b.disputa AND a.votos > b.votos   -- a: o mais votado do par
    ), somas AS (
        SELECT ano, cargo, uf, count(*)::BIGINT AS pares, sum(pts)::BIGINT AS pontos,
               count(*) FILTER (WHERE sem_cargo_ok)::BIGINT AS pares_sc, coalesce(sum(pts) FILTER (WHERE sem_cargo_ok), 0)::BIGINT AS pontos_sc
        FROM par GROUP BY ALL
    )
    SELECT ano, cargo, uf, false AS sem_cargo, pares, pontos FROM somas
    UNION ALL
    SELECT ano, cargo, uf, true, pares_sc, pontos_sc FROM somas
    ORDER BY ano, cargo, uf, sem_cargo
) TO 'painel_q2/pat_pares.csv' (HEADER);

-------------------------------------------------------------------------------
-- P8. Os candidatos, as 10 primeiras linhas de cada lista por eleição, cargo, UF e recorte: ricos = os de maior
--     patrimônio; perderam = os de maior patrimônio entre os não eleitos; menos = os eleitos com menos bens (menor
--     décimo da própria disputa; sem bens primeiro, depois o menor patrimônio e os mais votados). posicao e na_disputa
--     = a posição no patrimônio dentro da própria disputa e o número de candidatos dela ("1º mais rico de 842").
--     Empate: a candidatura de menor id primeiro. Nome de urna, partido e cidade são públicos; o id_candidato leva ao perfil.
-------------------------------------------------------------------------------
COPY (
    WITH l AS (
        SELECT r.*, k.lista,
               row_number() OVER (PARTITION BY r.ano, r.cargo, r.uf, r.sem_cargo, k.lista ORDER BY
                   CASE WHEN k.lista = 'menos' THEN r.decil END, CASE WHEN k.lista = 'menos' THEN r.patrimonio END,
                   CASE WHEN k.lista = 'menos' THEN -r.votos END, CASE WHEN k.lista <> 'menos' THEN -r.patrimonio END,
                   r.id_candidatura) AS pos
        FROM pat_recorte r, (VALUES ('ricos'), ('perderam'), ('menos')) k(lista)
        WHERE (k.lista = 'ricos' AND r.patrimonio > 0) OR (k.lista = 'perderam' AND NOT r.eleito AND r.patrimonio > 0)
           OR (k.lista = 'menos' AND r.eleito)
    )
    SELECT l.ano, l.cargo, l.uf, l.sem_cargo, l.lista, l.pos, l.id_candidato, l.id_candidatura, c.nome_urna,
           coalesce(p.sigla, '?') AS partido, m.nome AS municipio, l.patrimonio, l.decil, l.posicao, l.na_disputa,
           l.votos, l.eleito, l.tinha_cargo
    FROM l
    JOIN candidatura c    ON c.id_candidatura = l.id_candidatura
    LEFT JOIN partido p   ON p.id_partido = c.id_partido
    LEFT JOIN municipio m ON m.id_municipio = l.id_municipio
    WHERE l.pos <= 10
    ORDER BY l.ano, l.cargo, l.uf, l.sem_cargo, l.lista, l.pos
) TO 'painel_q2/pat_lista.csv' (HEADER);

-------------------------------------------------------------------------------
-- P9. A cidade escolhida (uma tabela por eleição municipal, para a página pedir só a do ano): o patrimônio e
--     tinha_cargo (1/0) de cada candidato a prefeito e vereador que declarou bens ou já tinha o cargo. A página junta com
--     a lista de candidatos da cidade (GET /api/municipios/<id>/candidatos) pelo id_candidatura; quem não está aqui
--     declarou zero e não tinha o cargo. Com ela, src/lib/patrimonio.ts refaz na cidade as mesmas contas (décimos,
--     posições, medianas e pares) com a mesma regra.
-------------------------------------------------------------------------------
COPY (
    SELECT id_candidatura, patrimonio, tinha_cargo::INTEGER AS tinha FROM pat_q2
    WHERE ano = 2008 AND cargo IN ('Prefeito', 'Vereador') AND (patrimonio > 0 OR tinha_cargo) ORDER BY id_candidatura
) TO 'painel_q2/pat_cidade_2008.csv' (HEADER);
COPY (
    SELECT id_candidatura, patrimonio, tinha_cargo::INTEGER AS tinha FROM pat_q2
    WHERE ano = 2012 AND cargo IN ('Prefeito', 'Vereador') AND (patrimonio > 0 OR tinha_cargo) ORDER BY id_candidatura
) TO 'painel_q2/pat_cidade_2012.csv' (HEADER);
COPY (
    SELECT id_candidatura, patrimonio, tinha_cargo::INTEGER AS tinha FROM pat_q2
    WHERE ano = 2016 AND cargo IN ('Prefeito', 'Vereador') AND (patrimonio > 0 OR tinha_cargo) ORDER BY id_candidatura
) TO 'painel_q2/pat_cidade_2016.csv' (HEADER);
COPY (
    SELECT id_candidatura, patrimonio, tinha_cargo::INTEGER AS tinha FROM pat_q2
    WHERE ano = 2020 AND cargo IN ('Prefeito', 'Vereador') AND (patrimonio > 0 OR tinha_cargo) ORDER BY id_candidatura
) TO 'painel_q2/pat_cidade_2020.csv' (HEADER);
COPY (
    SELECT id_candidatura, patrimonio, tinha_cargo::INTEGER AS tinha FROM pat_q2
    WHERE ano = 2024 AND cargo IN ('Prefeito', 'Vereador') AND (patrimonio > 0 OR tinha_cargo) ORDER BY id_candidatura
) TO 'painel_q2/pat_cidade_2024.csv' (HEADER);

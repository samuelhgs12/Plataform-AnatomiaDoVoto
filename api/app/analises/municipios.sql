-- Eleitos e dinheiro de campanha por município e por estado (página /municipios): as perguntas 1, 2 e 8 no mapa.
-- Regras do projeto: só titulares, eleição ordinária e quem de fato disputou. Gasto = vw_despesa_candidatura (prestação
-- FINAL ou REGULARIZACAO_OMISSAO, sem transferências). Recebido = vw_receita_candidatura (mesma prestação, sem repasses
-- entre candidatos: são somas, e o repasse contaria o mesmo real duas vezes). Dinheiro só existe de 2018 em diante.
-- Quem não entregou a prestação final entra com zero nas somas (valor desconhecido) e é contado em *_sem_prestacao;
-- "quem mais gastou venceu?" só vale nas cidades em que todos os candidatos a prefeito entregaram (como na pergunta 2).
-- Votos: 1º turno. A lista de eleitos de cada lugar vem de /api/municipios/<id>/eleitos e /api/estados/<uf>/eleitos.

CREATE OR REPLACE TEMP TABLE prestou AS
SELECT id_candidatura FROM despesa_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
UNION
SELECT id_candidatura FROM receita_campanha WHERE tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO');

CREATE OR REPLACE TEMP TABLE cand_lugar AS
SELECT c.id_candidatura, c.id_candidato, c.ano, g.id_cargo, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf, c.id_municipio,
       c.nome_urna, p.sigla AS partido, rr.eleito,
       coalesce(v.votos, 0) AS votos,
       coalesce(d.gasto_total, 0) AS gasto,
       coalesce(r.receita_total, 0) AS receita,
       coalesce(r.receita_publica, 0) AS receita_publica,
       -- por candidato (como nas perguntas 2 e 8): o que recebeu, inclusive de outros candidatos
       coalesce(rec.recebido, 0) AS recebido, coalesce(rec.publico_rec, 0) AS publico_rec,
       c.id_candidatura IN (SELECT id_candidatura FROM prestou) AS prestou
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura) v
       ON v.id_candidatura = c.id_candidatura
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
LEFT JOIN vw_receita_candidatura r ON r.id_candidatura = c.id_candidatura
LEFT JOIN (
    SELECT rc.id_candidatura, sum(rc.valor_receita) AS recebido, sum(rc.valor_receita) FILTER (WHERE f.tipo = 'publico') AS publico_rec
    FROM receita_campanha rc LEFT JOIN fonte_recurso f ON f.id_fonte_recurso = rc.id_fonte_recurso
    WHERE rc.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
    GROUP BY rc.id_candidatura
) rec ON rec.id_candidatura = c.id_candidatura
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou;

-- Cada disputa para prefeito e se ela entra na pergunta 2 ("quem mais gastou venceu?"). excluida = o motivo, na ordem:
-- um_candidato, sem_prestacao (alguém não entregou a prestação final: não se sabe quem gastou mais), sem_gasto (ninguém
-- declarou gasto) e empate (mais de um candidato com o maior gasto, comparado pelo valor exato da base). Nula = comparável.
CREATE OR REPLACE TEMP TABLE disputa_prefeito AS
WITH d AS (
    SELECT ano, uf, id_municipio, count(*) AS candidatos, max(gasto) AS maior, bool_and(prestou) AS todos_prestaram
    FROM cand_lugar WHERE cargo = 'Prefeito' GROUP BY ALL
), topo AS (
    SELECT c.ano, c.id_municipio, count(*) AS no_topo, bool_or(c.eleito) AS venceu
    FROM cand_lugar c JOIN d ON d.ano = c.ano AND d.id_municipio = c.id_municipio
    WHERE c.cargo = 'Prefeito' AND c.gasto = d.maior
    GROUP BY ALL
), classificada AS (
    SELECT d.ano, d.uf, d.id_municipio, topo.venceu,
           CASE WHEN d.candidatos < 2 THEN 'um_candidato'
                WHEN NOT d.todos_prestaram THEN 'sem_prestacao'
                WHEN d.maior <= 0 THEN 'sem_gasto'
                WHEN topo.no_topo > 1 THEN 'empate' END AS excluida
    FROM d JOIN topo ON topo.ano = d.ano AND topo.id_municipio = d.id_municipio
)
SELECT ano, uf, id_municipio, excluida, CASE WHEN excluida IS NULL THEN venceu END AS maior_venceu FROM classificada;

-- Vereadores de cada cidade em grupos (perguntas 2 e 8 no mapa): "mais" = cerca de 1/4 dos que declararam algum valor, os
-- de maior valor na cidade (percent_rank, valores iguais no mesmo grupo, como nas análises q2 e q8). Duas medidas:
-- recursos de campanha considerados (o maior entre gasto e recebido) e dinheiro público recebido. Quem não entregou a
-- prestação final fica de fora (valor desconhecido).
CREATE OR REPLACE TEMP TABLE grupos_vereador AS
WITH v AS (
    SELECT ano, id_municipio, eleito, greatest(gasto, recebido) AS recursos, publico_rec
    FROM cand_lugar WHERE cargo = 'Vereador' AND prestou
), r AS (
    SELECT *,
           recursos > 0 AND percent_rank() OVER (PARTITION BY ano, id_municipio, recursos > 0 ORDER BY recursos) >= 0.75 AS mais_rec,
           publico_rec > 0 AND percent_rank() OVER (PARTITION BY ano, id_municipio, publico_rec > 0 ORDER BY publico_rec) >= 0.75 AS mais_pub
    FROM v
)
SELECT ano, id_municipio,
       count(*) FILTER (WHERE mais_rec) AS rec_mais_cand, count(*) FILTER (WHERE mais_rec AND eleito) AS rec_mais_eleitos,
       count(*) FILTER (WHERE NOT mais_rec) AS rec_demais_cand, count(*) FILTER (WHERE NOT mais_rec AND eleito) AS rec_demais_eleitos,
       count(*) FILTER (WHERE mais_pub) AS pub_mais_cand, count(*) FILTER (WHERE mais_pub AND eleito) AS pub_mais_eleitos,
       count(*) FILTER (WHERE NOT mais_pub) AS pub_demais_cand, count(*) FILTER (WHERE NOT mais_pub AND eleito) AS pub_demais_eleitos
FROM r GROUP BY ALL;

-- Eleitorado apto de cada município em cada eleição (1º turno): o porte da cidade, para comparar cidades parecidas.
CREATE OR REPLACE TEMP TABLE eleitorado_mun AS
SELECT e.ano, p.id_municipio, max(p.eleitorado_apto) AS eleitorado
FROM participacao_eleitoral p JOIN eleicao e ON e.id_eleicao = p.id_eleicao
WHERE p.turno = 1 AND e.ano >= 2018
GROUP BY ALL;

-------------------------------------------------------------------------------
-- 1. Municípios dos seis estados, com o código IBGE (o desenho do mapa usa esse código)
-------------------------------------------------------------------------------
COPY (
    SELECT id_municipio, uf, nome, cod_ibge
    FROM municipio
    WHERE uf IN ('AP', 'ES', 'MG', 'PE', 'RJ', 'RR') AND cod_ibge IS NOT NULL
    ORDER BY uf, nome
) TO 'municipios/municipios.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. Por município, nas eleições municipais: vereadores (P1: custo da cadeira), prefeito eleito, dinheiro público (P8)
--    e se o candidato a prefeito que mais gastou venceu (P2): maior_venceu é nulo quando a disputa não é comparável, e
--    maior_excluida diz por quê (tabela disputa_prefeito). eleitorado = eleitores aptos no ano (porte da cidade).
-------------------------------------------------------------------------------
COPY (
    WITH vag AS (
        SELECT ano, id_municipio, sum(qt_vagas) AS vagas
        FROM vagas WHERE id_cargo = 13 AND id_municipio IS NOT NULL
        GROUP BY ALL
    ), ver AS (
        SELECT ano, id_municipio, count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos,
               sum(gasto) AS gasto, sum(receita) AS receita, sum(receita_publica) AS publica,
               count(*) FILTER (WHERE NOT prestou) AS sem_prestacao
        FROM cand_lugar WHERE cargo = 'Vereador' GROUP BY ALL
    ), pre AS (
        SELECT ano, id_municipio, count(*) AS candidatos, sum(gasto) AS gasto, sum(receita) AS receita, sum(receita_publica) AS publica,
               count(*) FILTER (WHERE NOT prestou) AS sem_prestacao
        FROM cand_lugar WHERE cargo = 'Prefeito' GROUP BY ALL
    ), eleito AS (
        SELECT ano, id_municipio, id_candidato, nome_urna, partido, votos, gasto
        FROM cand_lugar WHERE cargo = 'Prefeito' AND eleito
        QUALIFY row_number() OVER (PARTITION BY ano, id_municipio ORDER BY votos DESC, id_candidatura) = 1
    )
    SELECT ver.ano, ver.id_municipio, m.uf,
           ver.candidatos AS vereador_candidatos, ver.eleitos AS vereador_eleitos, coalesce(vag.vagas, 0) AS vereador_vagas,
           ver.sem_prestacao AS vereador_sem_prestacao, coalesce(pre.sem_prestacao, 0) AS prefeito_sem_prestacao,
           round(ver.gasto, 2) AS vereador_gasto, round(ver.receita, 2) AS vereador_receita, round(ver.publica, 2) AS vereador_publica,
           coalesce(pre.candidatos, 0) AS prefeito_candidatos, round(coalesce(pre.gasto, 0), 2) AS prefeito_gasto,
           round(coalesce(pre.receita, 0), 2) AS prefeito_receita, round(coalesce(pre.publica, 0), 2) AS prefeito_publica,
           eleito.id_candidato AS prefeito_id_candidato, eleito.nome_urna AS prefeito_nome, eleito.partido AS prefeito_partido,
           eleito.votos AS prefeito_votos, round(eleito.gasto, 2) AS prefeito_gasto_eleito,
           dp.maior_venceu, dp.excluida AS maior_excluida, el.eleitorado,
           gv.rec_mais_cand, gv.rec_mais_eleitos, gv.rec_demais_cand, gv.rec_demais_eleitos,
           gv.pub_mais_cand, gv.pub_mais_eleitos, gv.pub_demais_cand, gv.pub_demais_eleitos
    FROM ver
    JOIN municipio m ON m.id_municipio = ver.id_municipio
    LEFT JOIN vag    ON vag.ano = ver.ano AND vag.id_municipio = ver.id_municipio
    LEFT JOIN pre    ON pre.ano = ver.ano AND pre.id_municipio = ver.id_municipio
    LEFT JOIN eleito ON eleito.ano = ver.ano AND eleito.id_municipio = ver.id_municipio
    LEFT JOIN disputa_prefeito dp ON dp.ano = ver.ano AND dp.id_municipio = ver.id_municipio
    LEFT JOIN eleitorado_mun el   ON el.ano = ver.ano AND el.id_municipio = ver.id_municipio
    LEFT JOIN grupos_vereador gv  ON gv.ano = ver.ano AND gv.id_municipio = ver.id_municipio
    ORDER BY ver.ano, m.uf, ver.id_municipio
) TO 'municipios/resumo.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. Por estado e cargo, em todas as eleições (presidente fica na UF "BR"). Para prefeito (P2): quantas disputas são
--    comparáveis, em quantas o que mais gastou venceu e quantas ficaram de fora, por motivo (a cobertura da análise).
-------------------------------------------------------------------------------
COPY (
    WITH vag AS (
        SELECT ano, id_cargo, coalesce(uf, 'BR') AS uf, sum(qt_vagas) AS vagas FROM vagas GROUP BY ALL
    ), soma AS (
        SELECT ano, id_cargo, cargo, uf, count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos,
               sum(gasto) AS gasto, sum(receita) AS receita, sum(receita_publica) AS publica,
               count(*) FILTER (WHERE NOT prestou) AS sem_prestacao
        FROM cand_lugar GROUP BY ALL
    ), maior AS (
        SELECT ano, uf, count(*) FILTER (WHERE excluida IS NULL) AS disputas, count(*) FILTER (WHERE maior_venceu) AS venceu,
               count(*) FILTER (WHERE excluida = 'um_candidato') AS excl_um_candidato,
               count(*) FILTER (WHERE excluida = 'sem_prestacao') AS excl_sem_prestacao,
               count(*) FILTER (WHERE excluida = 'sem_gasto') AS excl_sem_gasto,
               count(*) FILTER (WHERE excluida = 'empate') AS excl_empate
        FROM disputa_prefeito GROUP BY ALL
    )
    SELECT s.ano, s.uf, s.cargo, s.candidatos, s.eleitos, coalesce(vag.vagas, 0) AS vagas, s.sem_prestacao,
           round(s.gasto, 2) AS gasto, round(s.receita, 2) AS receita, round(s.publica, 2) AS receita_publica,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.disputas, 0) END AS disputas_maior,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.venceu, 0) END AS maior_venceu,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.excl_um_candidato, 0) END AS excl_um_candidato,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.excl_sem_prestacao, 0) END AS excl_sem_prestacao,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.excl_sem_gasto, 0) END AS excl_sem_gasto,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.excl_empate, 0) END AS excl_empate
    FROM soma s
    LEFT JOIN vag   ON vag.ano = s.ano AND vag.id_cargo = s.id_cargo AND vag.uf = s.uf
    LEFT JOIN maior ON maior.ano = s.ano AND maior.uf = s.uf
    ORDER BY s.ano, s.uf, s.id_cargo
) TO 'municipios/estados.csv' (HEADER);

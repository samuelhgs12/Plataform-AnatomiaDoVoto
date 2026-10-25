-- Eleitos e dinheiro de campanha por município e por estado (página /municipios): as perguntas 1, 2 e 8 no mapa.
-- Regras do projeto: só titulares, eleição ordinária e quem de fato disputou. Gasto = vw_despesa_candidatura (prestação
-- FINAL ou REGULARIZACAO_OMISSAO, sem transferências). Recebido = vw_receita_candidatura (mesma prestação, sem repasses
-- entre candidatos: são somas, e o repasse contaria o mesmo real duas vezes). Dinheiro só existe de 2018 em diante.
-- Votos: 1º turno. A lista de eleitos de cada lugar vem de /api/municipios/<id>/eleitos e /api/estados/<uf>/eleitos.

CREATE OR REPLACE TEMP TABLE cand_lugar AS
SELECT c.id_candidatura, c.id_candidato, c.ano, g.id_cargo, g.nome AS cargo, coalesce(c.uf, 'BR') AS uf, c.id_municipio,
       c.nome_urna, p.sigla AS partido, rr.eleito,
       coalesce(v.votos, 0) AS votos,
       coalesce(d.gasto_total, 0) AS gasto,
       coalesce(r.receita_total, 0) AS receita,
       coalesce(r.receita_publica, 0) AS receita_publica
FROM candidatura c
JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
JOIN cargo g             ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura) v
       ON v.id_candidatura = c.id_candidatura
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
LEFT JOIN vw_receita_candidatura r ON r.id_candidatura = c.id_candidatura
WHERE c.ano >= 2018 AND g.eh_titular AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou;

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
--    e se o candidato a prefeito que mais gastou venceu (P2). maior_venceu é nulo com um só candidato ou sem gasto.
--    Empate no maior gasto: vale o de menor id (resultado estável).
-------------------------------------------------------------------------------
COPY (
    WITH vag AS (
        SELECT ano, id_municipio, sum(qt_vagas) AS vagas
        FROM vagas WHERE id_cargo = 13 AND id_municipio IS NOT NULL
        GROUP BY ALL
    ), ver AS (
        SELECT ano, id_municipio, count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos,
               sum(gasto) AS gasto, sum(receita) AS receita, sum(receita_publica) AS publica
        FROM cand_lugar WHERE cargo = 'Vereador' GROUP BY ALL
    ), pre AS (
        SELECT ano, id_municipio, count(*) AS candidatos, sum(gasto) AS gasto, sum(receita) AS receita, sum(receita_publica) AS publica,
               max(gasto) AS maior_gasto
        FROM cand_lugar WHERE cargo = 'Prefeito' GROUP BY ALL
    ), eleito AS (
        SELECT ano, id_municipio, id_candidato, nome_urna, partido, votos, gasto
        FROM cand_lugar WHERE cargo = 'Prefeito' AND eleito
        QUALIFY row_number() OVER (PARTITION BY ano, id_municipio ORDER BY votos DESC, id_candidatura) = 1
    ), topo AS (
        SELECT ano, id_municipio, eleito
        FROM cand_lugar WHERE cargo = 'Prefeito'
        QUALIFY row_number() OVER (PARTITION BY ano, id_municipio ORDER BY gasto DESC, id_candidatura) = 1
    )
    SELECT ver.ano, ver.id_municipio, m.uf,
           ver.candidatos AS vereador_candidatos, ver.eleitos AS vereador_eleitos, coalesce(vag.vagas, 0) AS vereador_vagas,
           round(ver.gasto, 2) AS vereador_gasto, round(ver.receita, 2) AS vereador_receita, round(ver.publica, 2) AS vereador_publica,
           coalesce(pre.candidatos, 0) AS prefeito_candidatos, round(coalesce(pre.gasto, 0), 2) AS prefeito_gasto,
           round(coalesce(pre.receita, 0), 2) AS prefeito_receita, round(coalesce(pre.publica, 0), 2) AS prefeito_publica,
           eleito.id_candidato AS prefeito_id_candidato, eleito.nome_urna AS prefeito_nome, eleito.partido AS prefeito_partido,
           eleito.votos AS prefeito_votos, round(eleito.gasto, 2) AS prefeito_gasto_eleito,
           CASE WHEN pre.candidatos > 1 AND pre.maior_gasto > 0 THEN topo.eleito END AS maior_venceu
    FROM ver
    JOIN municipio m ON m.id_municipio = ver.id_municipio
    LEFT JOIN vag    ON vag.ano = ver.ano AND vag.id_municipio = ver.id_municipio
    LEFT JOIN pre    ON pre.ano = ver.ano AND pre.id_municipio = ver.id_municipio
    LEFT JOIN eleito ON eleito.ano = ver.ano AND eleito.id_municipio = ver.id_municipio
    LEFT JOIN topo   ON topo.ano = ver.ano AND topo.id_municipio = ver.id_municipio
    ORDER BY ver.ano, m.uf, ver.id_municipio
) TO 'municipios/resumo.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. Por estado e cargo, em todas as eleições (presidente fica na UF "BR"). Para prefeito, quantas disputas tinham
--    mais de um candidato com gasto e em quantas o que mais gastou venceu (P2).
-------------------------------------------------------------------------------
COPY (
    WITH vag AS (
        SELECT ano, id_cargo, coalesce(uf, 'BR') AS uf, sum(qt_vagas) AS vagas FROM vagas GROUP BY ALL
    ), soma AS (
        SELECT ano, id_cargo, cargo, uf, count(*) AS candidatos, count(*) FILTER (WHERE eleito) AS eleitos,
               sum(gasto) AS gasto, sum(receita) AS receita, sum(receita_publica) AS publica
        FROM cand_lugar GROUP BY ALL
    ), disputas AS (
        SELECT ano, uf, id_municipio, count(*) AS candidatos, max(gasto) AS maior
        FROM cand_lugar WHERE cargo = 'Prefeito' GROUP BY ALL
    ), topo AS (
        SELECT ano, id_municipio, eleito
        FROM cand_lugar WHERE cargo = 'Prefeito'
        QUALIFY row_number() OVER (PARTITION BY ano, id_municipio ORDER BY gasto DESC, id_candidatura) = 1
    ), maior AS (
        SELECT d.ano, d.uf, count(*) AS disputas, count(*) FILTER (WHERE t.eleito) AS venceu
        FROM disputas d JOIN topo t ON t.ano = d.ano AND t.id_municipio = d.id_municipio
        WHERE d.candidatos > 1 AND d.maior > 0
        GROUP BY ALL
    )
    SELECT s.ano, s.uf, s.cargo, s.candidatos, s.eleitos, coalesce(vag.vagas, 0) AS vagas,
           round(s.gasto, 2) AS gasto, round(s.receita, 2) AS receita, round(s.publica, 2) AS receita_publica,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.disputas, 0) END AS disputas_maior,
           CASE WHEN s.cargo = 'Prefeito' THEN coalesce(maior.venceu, 0) END AS maior_venceu
    FROM soma s
    LEFT JOIN vag   ON vag.ano = s.ano AND vag.id_cargo = s.id_cargo AND vag.uf = s.uf
    LEFT JOIN maior ON maior.ano = s.ano AND maior.uf = s.uf
    ORDER BY s.ano, s.uf, s.id_cargo
) TO 'municipios/estados.csv' (HEADER);

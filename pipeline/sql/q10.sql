-- Copiado do repositório de carga (consultas/q10_painel.sql). Se a regra mudar lá, atualize aqui.
-- Pergunta 10 — consultas agregadas para o painel (DuckDB). Roda no banco final (bdr_final.duckdb ou MotherDuck).
-- Uso: python rodar_paineis.py q10        (gera os CSVs em painel_q10/)
--
-- Mudança em relação à versão anterior: só entram candidaturas de TITULARES (v.eh_titular). Vices e suplentes
-- vêm sem resultado até 2020 e com resultado em 2022 e 2024, o que deixaria a trajetória diferente por época.
-- Gera 6 CSVs pequenos na pasta ./painel_q10/ (crie a pasta antes):
--     mkdir painel_q10 && duckdb <seu_banco>.duckdb < q10_painel.sql
--
-- Correções em relação ao q10_trajetoria.sql:
--   * só eleições ORDINÁRIAS (suplementares criavam anos ímpares e quebravam a reeleição)
--   * subida/descida medida entre MANDATOS (o calendário municipal/geral não infla mais o número)
--   * troca de partido usa a SUCESSÃO partidária: fusão/incorporação (DEM->UNIÃO, PTB->PRD,
--     PSC->PODEMOS...) não conta como troca, e número reaproveitado (25 = DEM e depois PRD) não
--     esconde troca
--   * candidaturas barradas/sem resultado ficam fora da contagem de disputas

-------------------------------------------------------------------------------
-- 1. Partido de cada número em cada período
-------------------------------------------------------------------------------
CREATE OR REPLACE TEMP TABLE partido_periodo(numero, ano_ini, ano_fim, partido) AS VALUES
    (10, 1998, 2024, 'REPUBLICANOS'), (11, 1998, 2024, 'PP'),       (12, 1998, 2024, 'PDT'),
    (13, 1998, 2024, 'PT'),           (14, 1998, 2022, 'PTB'),      (15, 1998, 2024, 'MDB'),
    (16, 1998, 2024, 'PSTU'),         (17, 1998, 2022, 'PSL'),      (18, 1998, 2002, 'PST'),
    (18, 2014, 2024, 'REDE'),         (19, 1998, 2024, 'PODEMOS'),  (20, 1998, 2022, 'PSC'),
    (20, 2024, 2024, 'PODEMOS'),      (21, 1998, 2024, 'PCB'),      (22, 1998, 2024, 'PL'),
    (23, 1998, 2024, 'CIDADANIA'),    (25, 1998, 2022, 'DEM'),      (25, 2024, 2024, 'PRD'),
    (26, 1998, 2006, 'PAN'),          (27, 1998, 2024, 'DC'),       (28, 1998, 2024, 'PRTB'),
    (29, 1998, 2024, 'PCO'),          (30, 2014, 2024, 'NOVO'),     (31, 1998, 2018, 'PHS'),
    (33, 1998, 2024, 'MOBILIZA'),     (35, 2014, 2024, 'PMB'),      (36, 1998, 2024, 'AGIR'),
    (40, 1998, 2024, 'PSB'),          (41, 1998, 2002, 'PSD (1987)'), (43, 1998, 2024, 'PV'),
    (44, 1998, 2018, 'PRP'),          (44, 2022, 2024, 'UNIÃO'),    (45, 1998, 2024, 'PSDB'),
    (50, 2004, 2024, 'PSOL'),         (51, 2012, 2022, 'PATRIOTA'), (54, 2012, 2018, 'PPL'),
    (55, 2012, 2024, 'PSD'),          (56, 1998, 2006, 'PRONA'),    (65, 1998, 2024, 'PCdoB'),
    (70, 1998, 2024, 'AVANTE'),       (77, 2014, 2024, 'SOLIDARIEDADE'), (80, 2020, 2024, 'UP'),
    (90, 2014, 2022, 'PROS');
-- Número ausente desta tabela cai na própria sigla do banco (sem sucessão).

-- Fusões e incorporações: a partir da eleição `ano_efeito`, `partido` passa a ser `sucessor`
CREATE OR REPLACE TEMP TABLE sucessao(partido, ano_efeito, sucessor) AS VALUES
    ('PST', 2004, 'PL'),          ('PSD (1987)', 2004, 'PTB'), ('PAN', 2008, 'PTB'),
    ('PRONA', 2008, 'PL'),        ('PRP', 2020, 'PATRIOTA'),   ('PHS', 2020, 'PODEMOS'),
    ('PPL', 2020, 'PCdoB'),       ('DEM', 2022, 'UNIÃO'),      ('PSL', 2022, 'UNIÃO'),
    ('PROS', 2024, 'SOLIDARIEDADE'), ('PSC', 2024, 'PODEMOS'), ('PTB', 2024, 'PRD'),
    ('PATRIOTA', 2024, 'PRD');

-------------------------------------------------------------------------------
-- 2. Uma linha por político x ano (mesma regra de desempate do q10_trajetoria.sql)
-------------------------------------------------------------------------------
CREATE OR REPLACE TEMP TABLE traj AS
WITH nivel_cargo(id_cargo, nivel) AS (
    VALUES (13, 1), (11, 2), (12, 2), (7, 3), (8, 3), (6, 4), (9, 4), (10, 4),
           (3, 5), (4, 5), (5, 5), (1, 6), (2, 6)
),
votos AS (
    SELECT id_candidatura, sum(votos) FILTER (WHERE turno = 1) AS votos_1t
    FROM resultado_candidatura GROUP BY id_candidatura
)
SELECT v.id_candidato, v.ano, v.id_cargo, v.cargo, v.uf, v.ue,
       p.numero AS numero_partido, p.sigla AS sigla_partido,
       coalesce(pp.partido, p.sigla) AS partido,
       v.categoria, coalesce(v.eleito, false) AS eleito, coalesce(v.disputou, false) AS disputou,
       vo.votos_1t, n.nivel,
       CASE WHEN v.id_cargo IN (5, 9, 10) THEN 8 ELSE 4 END AS ciclo
FROM vw_candidatura v
LEFT JOIN partido p USING (id_partido)
LEFT JOIN partido_periodo pp ON pp.numero = p.numero AND v.ano BETWEEN pp.ano_ini AND pp.ano_fim
LEFT JOIN votos vo USING (id_candidatura)
LEFT JOIN nivel_cargo n ON n.id_cargo = v.id_cargo
WHERE v.id_candidato IS NOT NULL AND v.ordinaria AND v.eh_titular
QUALIFY row_number() OVER (
    PARTITION BY v.id_candidato, v.ano
    ORDER BY v.disputou DESC NULLS LAST, v.eleito DESC NULLS LAST,
             v.eh_titular DESC NULLS LAST, vo.votos_1t DESC NULLS LAST, v.id_candidatura
) = 1;

-- Uma linha por político (uf = UF da candidatura mais recente; é a UF usada nos filtros do painel)
CREATE OR REPLACE TEMP TABLE pessoa AS
SELECT t.id_candidato,
       coalesce(any_value(c.genero), 'NÃO INFORMADO')            AS genero,
       coalesce(arg_max(t.uf, t.ano) FILTER (WHERE t.uf <> 'BR'), 'BR') AS uf,
       min(t.ano)                                               AS estreia,
       max(t.ano)                                               AS ultimo_ano,
       max(t.ano) FILTER (WHERE t.eleito)                       AS ultimo_ano_eleito,
       arg_min(t.eleito, t.ano)                                 AS estreou_eleito,
       count(*) FILTER (WHERE t.disputou)                       AS disputas,
       count(*) FILTER (WHERE t.eleito)                         AS mandatos
FROM traj t
LEFT JOIN candidato c USING (id_candidato)
GROUP BY t.id_candidato;

-------------------------------------------------------------------------------
-- 3. Permanência por turma de estreia
--    ainda_candidato = voltou a se candidatar em (estreia + anos) ou depois
--    ainda_eleito    = foi eleito em (estreia + anos) ou depois
--    Atenção: a turma de 1998 inclui quem já tinha carreira antes (censura à esquerda).
-------------------------------------------------------------------------------
COPY (
    SELECT p.estreia AS turma, k.anos AS anos_desde_estreia, p.uf, p.genero, p.estreou_eleito,
           count(*)                                                        AS n_turma,
           count(*) FILTER (WHERE p.ultimo_ano >= p.estreia + k.anos)        AS ainda_candidato,
           count(*) FILTER (WHERE p.ultimo_ano_eleito >= p.estreia + k.anos) AS ainda_eleito
    FROM pessoa p
    CROSS JOIN (SELECT range AS anos FROM range(0, 27, 2)) k
    WHERE p.estreia + k.anos <= 2024
    GROUP BY ALL ORDER BY ALL
) TO 'painel_q10/permanencia.csv' (HEADER);

-------------------------------------------------------------------------------
-- 4. Insistência x carreira: nº de disputas x nº de mandatos
-------------------------------------------------------------------------------
COPY (
    SELECT disputas, mandatos, uf, genero, count(*) AS politicos
    FROM pessoa
    GROUP BY ALL ORDER BY ALL
) TO 'painel_q10/mapa.csv' (HEADER);

-------------------------------------------------------------------------------
-- 5. O que acontece depois de um mandato (fluxo + taxa de reeleição)
--    Para cada eleito em `ano_mandato`, olha:
--      meio  = candidatura entre o mandato e a eleição seguinte do mesmo tipo
--      prox  = candidatura na eleição seguinte do mesmo tipo (ano + 4; senador + 8)
-------------------------------------------------------------------------------
COPY (
    WITH mandato AS (
        SELECT * FROM traj WHERE eleito AND ano + ciclo <= 2024
    ),
    meio AS (
        SELECT m.id_candidato, m.ano,
               arg_max(t.cargo, (t.eleito::int) * 10 + t.nivel) AS cargo,
               bool_or(t.eleito)                                 AS eleito
        FROM mandato m
        JOIN traj t ON t.id_candidato = m.id_candidato
                   AND t.ano > m.ano AND t.ano < m.ano + m.ciclo AND t.disputou
        GROUP BY ALL
    )
    SELECT m.ano AS ano_mandato, m.ano + m.ciclo AS ano_seguinte, m.cargo AS cargo_origem,
           m.nivel AS nivel_origem, pe.uf, pe.genero,
           CASE WHEN me.eleito                                   THEN 'Eleito a outro cargo no meio do mandato'
                WHEN nx.id_candidato IS NULL                     THEN 'Não disputou a eleição seguinte'
                WHEN nx.id_cargo = m.id_cargo AND nx.ue = m.ue AND nx.eleito THEN 'Reeleito'
                WHEN nx.id_cargo = m.id_cargo AND nx.ue = m.ue   THEN 'Tentou a reeleição e perdeu'
                WHEN nx.eleito AND nx.nivel > m.nivel            THEN 'Eleito a cargo de nível acima'
                WHEN nx.eleito                                   THEN 'Eleito a outro cargo, mesmo nível ou abaixo'
                ELSE 'Tentou outro cargo e perdeu' END           AS destino,
           CASE WHEN me.eleito THEN me.cargo ELSE nx.cargo END   AS cargo_destino,
           count(*)                                              AS n
    FROM mandato m
    JOIN pessoa pe USING (id_candidato)
    LEFT JOIN meio me USING (id_candidato, ano)
    LEFT JOIN traj nx ON nx.id_candidato = m.id_candidato AND nx.ano = m.ano + m.ciclo AND nx.disputou
    GROUP BY ALL ORDER BY ALL
) TO 'painel_q10/fluxo.csv' (HEADER);

-------------------------------------------------------------------------------
-- 6. Troca de partido entre candidaturas consecutivas
-------------------------------------------------------------------------------
COPY (
    WITH seq AS (
        SELECT id_candidato, ano, partido,
               lag(partido) OVER w AS partido_anterior,
               lag(ano)     OVER w AS ano_anterior,
               lag(eleito)  OVER w AS eleito_anterior
        FROM traj
        WINDOW w AS (PARTITION BY id_candidato ORDER BY ano)
    ),
    -- partido anterior "atualizado" até o ano atual (segue até 3 fusões em cadeia)
    suc AS (
        SELECT s.*,
               CASE WHEN s1.ano_efeito IS NULL OR s1.ano_efeito > s.ano THEN s.partido_anterior
                    WHEN s2.ano_efeito IS NULL OR s2.ano_efeito > s.ano THEN s1.sucessor
                    WHEN s3.ano_efeito IS NULL OR s3.ano_efeito > s.ano THEN s2.sucessor
                    ELSE s3.sucessor END AS anterior_hoje
        FROM seq s
        LEFT JOIN sucessao s1 ON s1.partido = s.partido_anterior AND s1.ano_efeito > s.ano_anterior
        LEFT JOIN sucessao s2 ON s2.partido = s1.sucessor
        LEFT JOIN sucessao s3 ON s3.partido = s2.sucessor
        WHERE s.partido_anterior IS NOT NULL
    )
    SELECT ano, pe.uf, pe.genero, partido_anterior, partido AS partido_atual,
           coalesce(partido <> anterior_hoje AND partido <> partido_anterior, false) AS trocou,
           eleito_anterior, count(*) AS n
    FROM suc
    JOIN pessoa pe USING (id_candidato)
    GROUP BY ALL ORDER BY ALL
) TO 'painel_q10/trocas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 7. Trajetórias mais comuns: os 4 primeiros passos de cada carreira
--    Cada passo = cargo disputado + resultado (1 = eleito, 0 = não eleito).
--    Ex.: 'VER:1|VER:1|DEP.EST:0'. passos = nº de disputas, limitado a 4.
--    Sequências com 1 só pessoa no grupo UF x gênero ficam de fora (reduz o arquivo).
-------------------------------------------------------------------------------
COPY (
    WITH d AS (
        SELECT id_candidato, ano, eleito,
               CASE id_cargo WHEN 13 THEN 'VER'      WHEN 11 THEN 'PREF'    WHEN 12 THEN 'VICE-PREF'
                             WHEN 7  THEN 'DEP.EST'  WHEN 8  THEN 'DEP.DIST' WHEN 6 THEN 'DEP.FED'
                             WHEN 5  THEN 'SEN'      WHEN 3  THEN 'GOV'     WHEN 4  THEN 'VICE-GOV'
                             WHEN 1  THEN 'PRES'     WHEN 2  THEN 'VICE-PRES' ELSE 'SUPL-SEN' END AS c,
               row_number() OVER (PARTITION BY id_candidato ORDER BY ano) AS passo
        FROM traj
        WHERE disputou
    ),
    s AS (
        SELECT id_candidato,
               string_agg(c || ':' || eleito::int, '|' ORDER BY passo) AS sequencia,
               count(*) AS passos
        FROM d
        WHERE passo <= 4
        GROUP BY id_candidato
    )
    SELECT s.sequencia, s.passos, pe.uf, pe.genero, count(*) AS n
    FROM s
    JOIN pessoa pe USING (id_candidato)
    GROUP BY ALL
    HAVING count(*) >= 2
    ORDER BY n DESC
) TO 'painel_q10/sequencias.csv' (HEADER);

-------------------------------------------------------------------------------
-- 8. Linhas do tempo de exemplo: as 300 carreiras com mais mandatos
--    e os 100 que mais disputaram eleições
-------------------------------------------------------------------------------
COPY (
    WITH escolhidos AS (
        (SELECT id_candidato FROM pessoa ORDER BY mandatos DESC, disputas DESC, id_candidato LIMIT 300)
        UNION
        (SELECT id_candidato FROM pessoa ORDER BY disputas DESC, mandatos DESC, id_candidato LIMIT 100)
    )
    SELECT t.id_candidato, c.nome_civil AS nome, p.uf, t.ano, t.cargo, t.nivel,
           t.sigla_partido, t.partido, t.categoria, t.eleito, t.votos_1t
    FROM traj t
    JOIN escolhidos USING (id_candidato)
    JOIN pessoa p USING (id_candidato)
    LEFT JOIN candidato c USING (id_candidato)
    ORDER BY t.id_candidato, t.ano
) TO 'painel_q10/exemplos.csv' (HEADER);

-------------------------------------------------------------------------------
-- 9. Busca individual do painel: todos os políticos eleitos ao menos uma vez e suas candidaturas
--    (politicos.csv = 1 linha por pessoa; trajetorias.csv = 1 linha por pessoa x ano)
-------------------------------------------------------------------------------
COPY (
    SELECT p.id_candidato, c.nome_civil AS nome, p.uf, p.mandatos, p.disputas, p.estreia, p.ultimo_ano
    FROM pessoa p
    LEFT JOIN candidato c USING (id_candidato)
    WHERE p.mandatos >= 1
    ORDER BY p.mandatos DESC, p.disputas DESC, p.id_candidato
) TO 'painel_q10/politicos.csv' (HEADER);

COPY (
    SELECT t.id_candidato, t.ano, t.cargo, t.nivel, t.sigla_partido, t.partido, t.categoria, t.eleito, t.votos_1t
    FROM traj t
    JOIN pessoa p USING (id_candidato)
    WHERE p.mandatos >= 1
    ORDER BY t.id_candidato, t.ano
) TO 'painel_q10/trajetorias.csv' (HEADER);

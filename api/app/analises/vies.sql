-- Perguntas 6 e 7 — a idade do eleitorado e o viés político de cada município (DuckDB).
-- Roda no banco final (bdr_final.duckdb ou MotherDuck), que é SOMENTE LEITURA: só TEMP TABLE e VALUES aqui.
-- Servida pela API em GET /api/analises/vies (cada COPY ... TO 'x.csv' vira a tabela x da resposta); lida pelas
-- sub-abas Comparar › Idade e Comparar › Viés do mapa da página inicial (web/src/lib/vies.ts).
--
-- Regras:
--   * viés do município = média do score dos partidos (vies_partido, -100 esquerda a +100 direita, na eleição do ano),
--     ponderada pelos votos de cada partido no município (nominais + legenda), 1º turno, eleição ordinária. Presidente
--     não está em votos_partido_municipio: os votos de cada candidato (votos_candidatura_municipio) contam para o partido dele
--   * idade dos votados = média da idade dos candidatos na eleição (candidatura.idade_eleicao), ponderada pelos votos de
--     cada um no município, 1º turno, eleição ordinária, só titulares
--   * eleitorado: o perfil do TSE de cada eleição (perfil_eleitorado), por faixa etária; a idade de cada faixa é o ponto
--     médio dela (100 anos ou mais = 100); faixas inválidas ficam de fora
--   * população: Censo 2022 (populacao_idade), pessoas de 16 anos ou mais, para comparar com o eleitorado
--   * o município sai pelo cod_ibge, que casa com o mapa.json (o id_municipio muda a cada carga); as somas (soma_score,
--     soma_idade) vão junto para a página fazer as médias do estado e dos seis estados ponderadas pelos votos

-- um score por partido e eleição (se houver mais de uma versão do algoritmo, a mais recente)
CREATE OR REPLACE TEMP TABLE vies_ano AS
SELECT id_partido, ano_eleicao, score
FROM vies_partido
QUALIFY row_number() OVER (PARTITION BY id_partido, ano_eleicao ORDER BY versao_algoritmo DESC) = 1;

CREATE OR REPLACE TEMP TABLE eleicao_vies AS
SELECT e.id_eleicao, e.ano, g.nome AS cargo
FROM eleicao e JOIN cargo g ON g.id_cargo = e.id_cargo
WHERE e.tipo_eleicao = 'ORDINARIA' AND g.eh_titular
  AND g.nome IN ('Presidente', 'Deputado federal', 'Deputado estadual', 'Senador', 'Governador', 'Vereador', 'Prefeito');

-- votos em partido por eleição e município, 1º turno: a tabela por partido e, para presidente, os votos dos candidatos
CREATE OR REPLACE TEMP TABLE votos_vies AS
SELECT v.id_eleicao, v.id_partido, v.id_municipio, coalesce(v.votos_nominais, 0) + coalesce(v.votos_legenda, 0) AS votos
FROM votos_partido_municipio v
WHERE v.turno = 1
UNION ALL
SELECT c.id_eleicao, c.id_partido, vc.id_municipio, vc.votos
FROM votos_candidatura_municipio vc
JOIN candidatura c   ON c.id_candidatura = vc.id_candidatura
JOIN eleicao_vies el ON el.id_eleicao = c.id_eleicao
WHERE vc.turno = 1 AND el.cargo = 'Presidente' AND el.ano >= 2018;   -- o viés dos partidos só existe desde 2018

-------------------------------------------------------------------------------
-- 1. vies: ano x cargo x município. votos = todos os votos válidos em partido; votos_score = os de partidos com score
-------------------------------------------------------------------------------
COPY (
    SELECT el.ano, el.cargo, m.uf, m.cod_ibge,
           sum(v.votos) AS votos,
           sum(CASE WHEN s.score IS NOT NULL THEN v.votos END) AS votos_score,
           round(sum(v.votos * s.score), 2) AS soma_score
    FROM votos_vies v
    JOIN eleicao_vies el ON el.id_eleicao = v.id_eleicao
    JOIN municipio m     ON m.id_municipio = v.id_municipio
    LEFT JOIN vies_ano s ON s.id_partido = v.id_partido AND s.ano_eleicao = el.ano
    WHERE m.cod_ibge IS NOT NULL
    GROUP BY ALL
    HAVING sum(v.votos) > 0
    ORDER BY el.ano, el.cargo, m.uf, m.cod_ibge
) TO 'painel_vies/vies.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. votados: ano x cargo x município. A idade dos candidatos votados, ponderada pelos votos; votos_jovem = votos em
--    candidatos de até 29 anos (o mesmo corte do eleitorado jovem); votos_idade = votos em quem tem idade informada
-------------------------------------------------------------------------------
COPY (
    SELECT el.ano, el.cargo, m.uf, m.cod_ibge,
           sum(vc.votos) AS votos,
           sum(CASE WHEN c.idade_eleicao IS NOT NULL THEN vc.votos END) AS votos_idade,
           sum(vc.votos * c.idade_eleicao) AS soma_idade,
           sum(CASE WHEN c.idade_eleicao <= 29 THEN vc.votos ELSE 0 END) AS votos_jovem
    FROM votos_candidatura_municipio vc
    JOIN candidatura c   ON c.id_candidatura = vc.id_candidatura
    JOIN eleicao_vies el ON el.id_eleicao = c.id_eleicao
    JOIN municipio m     ON m.id_municipio = vc.id_municipio
    WHERE vc.turno = 1 AND m.cod_ibge IS NOT NULL AND el.ano >= 2018   -- o perfil do eleitorado só existe desde 2018
    GROUP BY ALL
    HAVING sum(vc.votos) > 0
    ORDER BY el.ano, el.cargo, m.uf, m.cod_ibge
) TO 'painel_vies/votados.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. eleitorado: ano x município. eleitores = com faixa válida; soma_idade = eleitores x ponto médio da faixa;
--    jovens = 16 a 29 anos (faixa_etaria.jovem); idosos = 60 anos ou mais
-------------------------------------------------------------------------------
COPY (
    SELECT p.ano, m.uf, m.cod_ibge,
           sum(p.eleitores) AS eleitores,
           sum(p.eleitores * coalesce(f.ponto_medio, f.idade_min)) AS soma_idade,
           sum(CASE WHEN f.jovem THEN p.eleitores ELSE 0 END) AS jovens,
           sum(CASE WHEN f.idade_min >= 60 THEN p.eleitores ELSE 0 END) AS idosos
    FROM perfil_eleitorado p
    JOIN faixa_etaria f ON f.id_faixa = p.id_faixa
    JOIN municipio m    ON m.id_municipio = p.id_municipio
    WHERE f.idade_min IS NOT NULL AND m.cod_ibge IS NOT NULL
    GROUP BY ALL
    ORDER BY p.ano, m.uf, m.cod_ibge
) TO 'painel_vies/eleitorado.csv' (HEADER);

-------------------------------------------------------------------------------
-- 4. populacao: município, Censo 2022, pessoas de 16 anos ou mais, nas mesmas medidas do eleitorado (cada idade conta
--    por ela mesma, sem faixa)
-------------------------------------------------------------------------------
COPY (
    SELECT m.uf, m.cod_ibge,
           sum(p.populacao) AS pessoas,
           sum(p.populacao * p.idade) AS soma_idade,
           sum(CASE WHEN p.idade <= 29 THEN p.populacao ELSE 0 END) AS jovens,
           sum(CASE WHEN p.idade >= 60 THEN p.populacao ELSE 0 END) AS idosos
    FROM populacao_idade p
    JOIN municipio m ON m.id_municipio = p.id_municipio
    WHERE p.ano_referencia = 2022 AND p.idade >= 16 AND m.cod_ibge IS NOT NULL
    GROUP BY ALL
    ORDER BY m.uf, m.cod_ibge
) TO 'painel_vies/populacao.csv' (HEADER);

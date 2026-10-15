-- Parâmetros: texto normalizado (palavras separadas por um espaço), padrão LIKE da maior palavra, limite.
-- O texto digitado precisa aparecer inteiro e na mesma ordem no nome civil ou no nome de urna, começando no início de
-- uma palavra ("lula" acha "LULA" e "CLAUDIO LULA", mas não "CELULAR"; "maria silva" acha "MARIA SILVA SANTOS", mas
-- não "MARIA DA SILVA" nem "SILVA MARIA"). Ordem: nome igual ao digitado, palavras inteiras, início de palavra;
-- no empate, quem teve mais votos numa eleição. Devolve a candidatura mais recente de cada pessoa
-- e, se o texto só aparece num nome de urna de outra eleição, esse nome em nome_urna_casado.
WITH candidatas AS (
    -- pré-filtro barato: só linhas que contêm a maior palavra em algum lugar
    SELECT c.id_candidato, c.nome_urna, c.ano,
           trim(regexp_replace(strip_accents(lower(coalesce(k.nome_civil, ''))), '[^a-z0-9]+', ' ', 'g')) AS civil_n,
           trim(regexp_replace(strip_accents(lower(coalesce(c.nome_urna, ''))),  '[^a-z0-9]+', ' ', 'g')) AS urna_n
    FROM candidatura c
    JOIN candidato k ON k.id_candidato = c.id_candidato
    WHERE strip_accents(lower(k.nome_civil)) LIKE $2 ESCAPE '\'
       OR strip_accents(lower(c.nome_urna))  LIKE $2 ESCAPE '\'
),
relevancias AS (
    -- urna_n/civil_n com espaço nas pontas: ' maria silva ' contém ' maria silva ' (palavras inteiras) e
    -- ' maria silvana' contém ' maria silva' (o trecho começa numa palavra). $1 só tem letras, números e espaços.
    SELECT *,
           CASE WHEN urna_n = $1 THEN 0 WHEN contains(' ' || urna_n || ' ', ' ' || $1 || ' ') THEN 1
                WHEN contains(' ' || urna_n, ' ' || $1) THEN 2 END AS rel_urna,
           CASE WHEN civil_n = $1 THEN 0 WHEN contains(' ' || civil_n || ' ', ' ' || $1 || ' ') THEN 1
                WHEN contains(' ' || civil_n, ' ' || $1) THEN 2 END AS rel_civil
    FROM candidatas
),
achados AS (
    -- uma linha por pessoa que casou em alguma candidatura
    SELECT id_candidato,
           min(least(rel_urna, rel_civil)) AS relevancia,          -- least ignora NULL
           bool_or(rel_civil IS NOT NULL) AS casou_civil,
           arg_max(nome_urna, ano) FILTER (WHERE rel_urna IS NOT NULL) AS urna_casada   -- nome de urna mais recente que casou
    FROM relevancias
    GROUP BY id_candidato
    HAVING min(least(rel_urna, rel_civil)) IS NOT NULL
),
ultima AS (
    -- candidatura mais recente de cada pessoa achada (entre todas, não só as que passaram no pré-filtro)
    SELECT c.id_candidato, k.nome_civil, c.nome_urna, c.uf, c.ano, e.id_cargo, p.sigla AS partido, g.nome AS cargo, r.eleito
    FROM candidatura c
    JOIN achados a          ON a.id_candidato = c.id_candidato
    JOIN candidato k        ON k.id_candidato = c.id_candidato
    JOIN eleicao e          ON e.id_eleicao = c.id_eleicao
    JOIN cargo g            ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado r ON r.id_rotulo = c.id_rotulo_final
    LEFT JOIN partido p     ON p.id_partido = c.id_partido
    QUALIFY row_number() OVER (PARTITION BY c.id_candidato ORDER BY c.ano DESC, e.id_cargo DESC) = 1
),
votos AS (
    -- quem teve mais votos numa eleição desempata a relevância
    SELECT c.id_candidato, max(v.votos) AS max_votos
    FROM candidatura c
    JOIN achados a ON a.id_candidato = c.id_candidato
    JOIN resultado_candidatura v ON v.id_candidatura = c.id_candidatura AND v.turno = 1
    GROUP BY c.id_candidato
)
SELECT u.id_candidato, u.nome_civil, u.nome_urna, u.uf, u.ano AS ultimo_ano, u.partido, u.cargo AS ultimo_cargo,
       u.eleito AS ultimo_eleito,
       -- o texto só aparece num nome de urna de outra eleição: mostra esse nome para explicar o resultado
       CASE WHEN NOT a.casou_civil AND a.urna_casada IS DISTINCT FROM u.nome_urna THEN a.urna_casada END AS nome_urna_casado
FROM ultima u
JOIN achados a USING (id_candidato)
LEFT JOIN votos v USING (id_candidato)
ORDER BY a.relevancia, coalesce(v.max_votos, 0) DESC, ultimo_ano DESC, u.nome_civil
LIMIT $3

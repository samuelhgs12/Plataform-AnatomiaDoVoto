-- Parâmetros: texto normalizado (palavras separadas por um espaço), lista dessas palavras, padrão LIKE da maior palavra, limite.
-- Cada palavra digitada precisa casar com o início de uma palavra do nome civil ou do nome de urna ("lula" acha
-- "LULA" e "CLAUDIO LULA", mas não "CELULAR"). Ordem: nome igual ao digitado, palavras inteiras, início de palavra;
-- no empate, quem teve mais votos numa eleição. Devolve a candidatura mais recente de cada pessoa.
WITH candidatas AS (
    -- pré-filtro barato: só linhas que contêm a maior palavra em algum lugar
    SELECT c.id_candidatura, c.id_candidato, k.nome_civil, c.nome_urna, c.uf, c.ano, e.id_cargo,
           p.sigla AS partido, g.nome AS cargo, r.eleito,
           trim(regexp_replace(strip_accents(lower(coalesce(k.nome_civil, ''))), '[^a-z0-9]+', ' ', 'g')) AS civil_n,
           trim(regexp_replace(strip_accents(lower(coalesce(c.nome_urna, ''))),  '[^a-z0-9]+', ' ', 'g')) AS urna_n
    FROM candidatura c
    JOIN candidato k        ON k.id_candidato = c.id_candidato
    JOIN eleicao e          ON e.id_eleicao = c.id_eleicao
    JOIN cargo g            ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado r ON r.id_rotulo = c.id_rotulo_final
    LEFT JOIN partido p     ON p.id_partido = c.id_partido
    WHERE strip_accents(lower(k.nome_civil)) LIKE $3 ESCAPE '\'
       OR strip_accents(lower(c.nome_urna))  LIKE $3 ESCAPE '\'
),
pontuadas AS (
    SELECT *,
           CASE
             WHEN urna_n = $1 OR civil_n = $1 THEN 0
             WHEN list_bool_and(list_transform($2::VARCHAR[], lambda t: list_contains(string_split(urna_n, ' '), t)))
               OR list_bool_and(list_transform($2::VARCHAR[], lambda t: list_contains(string_split(civil_n, ' '), t))) THEN 1
             WHEN list_bool_and(list_transform($2::VARCHAR[], lambda t: list_bool_or(list_transform(string_split(urna_n, ' '), lambda w: starts_with(w, t)))))
               OR list_bool_and(list_transform($2::VARCHAR[], lambda t: list_bool_or(list_transform(string_split(civil_n, ' '), lambda w: starts_with(w, t))))) THEN 2
           END AS relevancia
    FROM candidatas
),
pessoas AS (
    SELECT s.*,
           min(s.relevancia) OVER w AS melhor_relevancia,
           max(coalesce(v.votos, 0)) OVER w AS max_votos
    FROM pontuadas s
    LEFT JOIN (SELECT id_candidatura, votos FROM resultado_candidatura WHERE turno = 1) v
           ON v.id_candidatura = s.id_candidatura
    WINDOW w AS (PARTITION BY s.id_candidato)
)
SELECT id_candidato, nome_civil, nome_urna, uf, ano AS ultimo_ano, partido, cargo AS ultimo_cargo, eleito AS ultimo_eleito
FROM pessoas
WHERE melhor_relevancia IS NOT NULL
QUALIFY row_number() OVER (PARTITION BY id_candidato ORDER BY ano DESC, id_cargo DESC) = 1
ORDER BY melhor_relevancia, max_votos DESC, ultimo_ano DESC, nome_civil
LIMIT $4

-- Busca de candidatos pelo nome dentro do recorte da camada Dinheiro (pergunta 1: quanto custa uma cadeira).
-- Parâmetros: $1 texto normalizado (minúsculas, sem acento, só letras/números/espaços), $2 ano, $3 cargo, $4 UF (NULL = os seis estados),
-- $5 id_municipio (NULL = o estado todo; nas municipais, cada linha traz a cidade). Casa no nome de urna ou no nome civil,
-- a partir do início de uma palavra, mas devolve só o nome de urna. Gasto, recebido e "prestou" com as mesmas regras de
-- candidatos_municipio.sql. Ordem (serve ao autocompletar): nome de urna igual ao digitado, nome de urna que começa com
-- ele, depois eleitos e mais votados.
WITH recorte AS (
    SELECT c.*, g.nome AS cargo_nome, g.id_cargo AS cargo_id, rr.descricao AS resultado_desc, rr.eleito AS foi_eleito,
           trim(regexp_replace(strip_accents(lower(coalesce(c.nome_urna, ''))), '[^a-z0-9]+', ' ', 'g')) AS urna_n,
           trim(regexp_replace(strip_accents(lower(coalesce(k.nome_civil, ''))), '[^a-z0-9]+', ' ', 'g')) AS civil_n
    FROM candidatura c
    JOIN eleicao e           ON e.id_eleicao = c.id_eleicao
    JOIN cargo g             ON g.id_cargo = e.id_cargo
    JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
    LEFT JOIN candidato k    ON k.id_candidato = c.id_candidato
    WHERE c.ano = $2 AND g.nome = $3 AND ($4::VARCHAR IS NULL OR c.uf = $4::VARCHAR) AND ($5::INTEGER IS NULL OR c.id_municipio = $5::INTEGER)
      AND e.tipo_eleicao = 'ORDINARIA' AND rr.disputou
)
SELECT c.cargo_nome AS cargo, c.cargo_id AS id_cargo, c.resultado_desc AS resultado, c.id_candidato, c.id_candidatura,
       c.nome_urna, p.sigla AS partido,
       coalesce(v.votos, 0) AS votos,
       coalesce(d.gasto_total, 0) AS gasto,
       coalesce(r.receita_total, 0) AS receita,
       coalesce(r.receita_publica, 0) AS receita_publica,
       c.foi_eleito AS eleito, m.nome AS municipio, c.uf,
       EXISTS (SELECT 1 FROM despesa_campanha x WHERE x.id_candidatura = c.id_candidatura AND x.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO'))
         OR EXISTS (SELECT 1 FROM receita_campanha x WHERE x.id_candidatura = c.id_candidatura AND x.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')) AS prestou
FROM recorte c
LEFT JOIN municipio m    ON m.id_municipio = c.id_municipio
LEFT JOIN partido p      ON p.id_partido = c.id_partido
LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY id_candidatura) v
       ON v.id_candidatura = c.id_candidatura
LEFT JOIN vw_despesa_candidatura d ON d.id_candidatura = c.id_candidatura
LEFT JOIN vw_receita_candidatura r ON r.id_candidatura = c.id_candidatura
WHERE contains(' ' || c.urna_n, ' ' || $1) OR contains(' ' || c.civil_n, ' ' || $1)
ORDER BY c.urna_n = $1 DESC, starts_with(c.urna_n, $1) DESC, c.foi_eleito DESC, votos DESC, c.nome_urna
LIMIT 20

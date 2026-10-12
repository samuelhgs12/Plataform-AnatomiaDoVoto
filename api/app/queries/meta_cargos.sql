SELECT id_cargo, nome, unidade, sistema, eh_titular
FROM cargo
WHERE id_cargo IN (SELECT id_cargo FROM eleicao)
ORDER BY id_cargo

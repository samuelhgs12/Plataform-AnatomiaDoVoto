-- Quem puxou quem: como as vagas de deputado foram divididas entre as listas (partido isolado, coligação ou federação)
-- e quem sentou em cada uma. Servida em GET /api/analises/cadeiras (cada COPY vira uma tabela). Lida pela visão de
-- legenda do mapa; as contas (quociente eleitoral, quociente partidário, puxadores) ficam em web/src/lib/cadeiras.ts.
--
-- Regras:
--   * deputado federal e estadual de 2018, 2022 e 2026, eleição ordinária, 1º turno. Vereadores ficam para depois;
--   * a lista que disputa as cadeiras é a coligação (2018, última eleição com coligação nas proporcionais), a federação
--     (2022 em diante) ou o partido sozinho. Coligações e federações não estão no banco: vêm do TSE, dados abertos
--     consulta_coligacao_<ano> (TP_AGREMIACAO, SQ_COLIGACAO, NR_PARTIDO), só as de dois partidos ou mais, nos seis estados;
--   * o partido é o NÚMERO dentro do ano (o 25 era o DEM em 2018 e é o PRD em 2026);
--   * quem foi eleito, e se pelo quociente (QP) ou pelas sobras (média), vem do rótulo do TSE (rotulo_resultado), não
--     de conta nossa. A conta do quociente bate com os rótulos, salvo quando falta candidato com 10% do quociente
--     eleitoral e a vaga vai para as sobras.

CREATE OR REPLACE TEMP TABLE renomeado AS
SELECT * FROM (VALUES ('PRB', 'REPUBLICANOS'), ('PR', 'PL'), ('PPS', 'CIDADANIA'), ('PATRI', 'PATRIOTA'),
                      ('PTC', 'AGIR'), ('PMN', 'MOBILIZA'), ('PODE', 'PODEMOS'), ('PC do B', 'PCdoB'), ('PCDOB', 'PCdoB')) t(sigla, partido);

-- coligações (2018) e federações (2022, 2026) de deputado nos seis estados: TSE, consulta_coligacao_<ano>
CREATE OR REPLACE TEMP TABLE agremiacao AS
SELECT * FROM (VALUES
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050078', [22, 31]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050088', [17, 23]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050318', [14, 35, 90]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050499', [18, 54]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050574', [10, 12, 15, 27]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050588', [25, 45, 70]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050608', [33, 43, 50]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050622', [55, 77]),
    (2018, 'Deputado estadual', 'AP', 'coligacao', '30000050681', [44, 65]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050196', [10, 17, 22]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050361', [20, 45]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050464', [31, 43, 77]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050505', [11, 90]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050514', [23, 36, 70]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050600', [12, 25, 54, 55]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050651', [44, 65]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050656', [18, 19, 28, 33, 51]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050691', [27, 40]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050698', [21, 50]),
    (2018, 'Deputado estadual', 'ES', 'coligacao', '80000050761', [14, 35]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050091', [14, 33]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050181', [21, 50]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050269', [35, 36, 51]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050353', [11, 23, 25, 45, 55]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050468', [18, 28]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050541', [10, 12, 15, 19, 43]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050730', [44, 54]),
    (2018, 'Deputado estadual', 'MG', 'coligacao', '130000050734', [13, 22, 40]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050089', [20, 27, 35]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050194', [21, 50]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050274', [15, 40, 55]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050375', [11, 22, 33, 77]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050455', [10, 14, 19, 25, 45]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050457', [17, 28, 31, 43]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050461', [12, 70, 90]),
    (2018, 'Deputado estadual', 'PE', 'coligacao', '170000050723', [36, 44, 54]),
    (2018, 'Deputado estadual', 'RJ', 'coligacao', '190000050058', [21, 50]),
    (2018, 'Deputado estadual', 'RJ', 'coligacao', '190000050092', [14, 77]),
    (2018, 'Deputado estadual', 'RJ', 'coligacao', '190000050224', [23, 45]),
    (2018, 'Deputado estadual', 'RJ', 'coligacao', '190000050547', [19, 54]),
    (2018, 'Deputado estadual', 'RJ', 'coligacao', '190000050675', [27, 43]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050064', [40, 70]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050068', [27, 77]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050090', [10, 20]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050151', [51, 54, 90]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050154', [23, 25, 45]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050217', [22, 28]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050316', [17, 44]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050376', [16, 21, 50]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050429', [13, 14, 18]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050438', [11, 12, 65]),
    (2018, 'Deputado estadual', 'RR', 'coligacao', '230000050707', [19, 31]),
    (2018, 'Deputado federal', 'AP', 'coligacao', '30000050080', [17, 22, 31]),
    (2018, 'Deputado federal', 'AP', 'coligacao', '30000050369', [12, 15, 65, 90]),
    (2018, 'Deputado federal', 'AP', 'coligacao', '30000050458', [11, 20, 25, 45, 55]),
    (2018, 'Deputado federal', 'AP', 'coligacao', '30000050501', [18, 19, 54, 70, 77]),
    (2018, 'Deputado federal', 'AP', 'coligacao', '30000050608', [33, 43, 50]),
    (2018, 'Deputado federal', 'AP', 'coligacao', '30000050683', [10, 14, 27, 36, 44]),
    (2018, 'Deputado federal', 'ES', 'coligacao', '80000050196', [10, 17, 22]),
    (2018, 'Deputado federal', 'ES', 'coligacao', '80000050321', [11, 23, 31, 65, 90]),
    (2018, 'Deputado federal', 'ES', 'coligacao', '80000050351', [15, 18, 19, 33, 51]),
    (2018, 'Deputado federal', 'ES', 'coligacao', '80000050522', [20, 36, 40, 43, 54, 70]),
    (2018, 'Deputado federal', 'ES', 'coligacao', '80000050598', [12, 25, 44, 45, 55, 77]),
    (2018, 'Deputado federal', 'ES', 'coligacao', '80000050698', [21, 50]),
    (2018, 'Deputado federal', 'ES', 'coligacao', '80000050761', [14, 35]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050181', [21, 50]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050269', [35, 36, 51]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050297', [14, 20, 33]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050355', [11, 23, 25, 45, 55, 77]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050468', [18, 28]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050539', [10, 12, 15, 43]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050726', [31, 44]),
    (2018, 'Deputado federal', 'MG', 'coligacao', '130000050732', [13, 22, 27, 40, 65]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050149', [27, 35]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050194', [21, 50]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050271', [15, 40, 55, 65]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050375', [11, 22, 33, 77]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050453', [10, 14, 19, 20, 23, 25, 45]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050457', [17, 28, 31, 43]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050461', [12, 70, 90]),
    (2018, 'Deputado federal', 'PE', 'coligacao', '170000050723', [36, 44, 54]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050058', [21, 50]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050094', [23, 45, 77]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050120', [19, 22]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050195', [11, 14, 15, 25]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050205', [20, 90]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050362', [13, 65]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050393', [35, 36]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050414', [12, 40]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050433', [33, 70]),
    (2018, 'Deputado federal', 'RJ', 'coligacao', '190000050675', [27, 43]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050066', [15, 27, 55, 77]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050093', [40, 44, 70]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050132', [23, 25, 35, 45]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050161', [51, 54, 90]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050174', [10, 17, 20, 36]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050219', [22, 28]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050376', [16, 21, 50]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050381', [11, 12, 65]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050425', [13, 14, 18, 43]),
    (2018, 'Deputado federal', 'RR', 'coligacao', '230000050767', [19, 31]),
    (2022, 'Deputado estadual', 'AP', 'federacao', '30001681259', [18, 50]),
    (2022, 'Deputado estadual', 'AP', 'federacao', '30001681350', [13, 43, 65]),
    (2022, 'Deputado estadual', 'AP', 'federacao', '30001682257', [23, 45]),
    (2022, 'Deputado estadual', 'ES', 'federacao', '80001681183', [23, 45]),
    (2022, 'Deputado estadual', 'ES', 'federacao', '80001681564', [18, 50]),
    (2022, 'Deputado estadual', 'ES', 'federacao', '80001685325', [13, 43, 65]),
    (2022, 'Deputado estadual', 'MG', 'federacao', '130001681349', [13, 43, 65]),
    (2022, 'Deputado estadual', 'MG', 'federacao', '130001681666', [23, 45]),
    (2022, 'Deputado estadual', 'MG', 'federacao', '130001681768', [18, 50]),
    (2022, 'Deputado estadual', 'PE', 'federacao', '170001681287', [23, 45]),
    (2022, 'Deputado estadual', 'PE', 'federacao', '170001681413', [13, 43, 65]),
    (2022, 'Deputado estadual', 'PE', 'federacao', '170001682108', [18, 50]),
    (2022, 'Deputado estadual', 'RJ', 'federacao', '190001681049', [18, 50]),
    (2022, 'Deputado estadual', 'RJ', 'federacao', '190001681770', [23, 45]),
    (2022, 'Deputado estadual', 'RJ', 'federacao', '190001682224', [13, 43, 65]),
    (2022, 'Deputado estadual', 'RR', 'federacao', '230001681545', [13, 43, 65]),
    (2022, 'Deputado estadual', 'RR', 'federacao', '230001681557', [18, 50]),
    (2022, 'Deputado estadual', 'RR', 'federacao', '230001682985', [23, 45]),
    (2022, 'Deputado federal', 'AP', 'federacao', '30001681258', [18, 50]),
    (2022, 'Deputado federal', 'AP', 'federacao', '30001681348', [13, 43, 65]),
    (2022, 'Deputado federal', 'AP', 'federacao', '30001682195', [23, 45]),
    (2022, 'Deputado federal', 'ES', 'federacao', '80001681184', [23, 45]),
    (2022, 'Deputado federal', 'ES', 'federacao', '80001681591', [18, 50]),
    (2022, 'Deputado federal', 'ES', 'federacao', '80001685316', [13, 43, 65]),
    (2022, 'Deputado federal', 'MG', 'federacao', '130001681345', [13, 43, 65]),
    (2022, 'Deputado federal', 'MG', 'federacao', '130001681667', [23, 45]),
    (2022, 'Deputado federal', 'MG', 'federacao', '130001681766', [18, 50]),
    (2022, 'Deputado federal', 'PE', 'federacao', '170001681226', [23, 45]),
    (2022, 'Deputado federal', 'PE', 'federacao', '170001681377', [13, 43, 65]),
    (2022, 'Deputado federal', 'PE', 'federacao', '170001682182', [18, 50]),
    (2022, 'Deputado federal', 'RJ', 'federacao', '190001681050', [18, 50]),
    (2022, 'Deputado federal', 'RJ', 'federacao', '190001681672', [23, 45]),
    (2022, 'Deputado federal', 'RJ', 'federacao', '190001682173', [13, 43, 65]),
    (2022, 'Deputado federal', 'RR', 'federacao', '230001681537', [18, 50]),
    (2022, 'Deputado federal', 'RR', 'federacao', '230001681543', [13, 43, 65]),
    (2022, 'Deputado federal', 'RR', 'federacao', '230001682904', [23, 45]),
    (2026, 'Deputado estadual', 'AP', 'federacao', '30001800105', [18, 50]),
    (2026, 'Deputado estadual', 'AP', 'federacao', '30001800151', [13, 43, 65]),
    (2026, 'Deputado estadual', 'AP', 'federacao', '30001800406', [11, 44]),
    (2026, 'Deputado estadual', 'ES', 'federacao', '80001800531', [23, 45]),
    (2026, 'Deputado estadual', 'ES', 'federacao', '80001800983', [11, 44]),
    (2026, 'Deputado estadual', 'ES', 'federacao', '80001800986', [18, 50]),
    (2026, 'Deputado estadual', 'ES', 'federacao', '80001801007', [13, 43, 65]),
    (2026, 'Deputado estadual', 'ES', 'federacao', '80001801137', [25, 77]),
    (2026, 'Deputado estadual', 'MG', 'federacao', '130001800135', [25, 77]),
    (2026, 'Deputado estadual', 'MG', 'federacao', '130001800274', [13, 43, 65]),
    (2026, 'Deputado estadual', 'MG', 'federacao', '130001800455', [18, 50]),
    (2026, 'Deputado estadual', 'MG', 'federacao', '130001800494', [23, 45]),
    (2026, 'Deputado estadual', 'MG', 'federacao', '130001800627', [11, 44]),
    (2026, 'Deputado estadual', 'PE', 'federacao', '170001800139', [13, 43, 65]),
    (2026, 'Deputado estadual', 'PE', 'federacao', '170001800567', [25, 77]),
    (2026, 'Deputado estadual', 'PE', 'federacao', '170001800698', [11, 44]),
    (2026, 'Deputado estadual', 'PE', 'federacao', '170001801110', [18, 50]),
    (2026, 'Deputado estadual', 'RJ', 'federacao', '190001800180', [25, 77]),
    (2026, 'Deputado estadual', 'RJ', 'federacao', '190001800280', [18, 50]),
    (2026, 'Deputado estadual', 'RJ', 'federacao', '190001800575', [11, 44]),
    (2026, 'Deputado estadual', 'RJ', 'federacao', '190001800672', [13, 43, 65]),
    (2026, 'Deputado estadual', 'RJ', 'federacao', '190001801072', [23, 45]),
    (2026, 'Deputado estadual', 'RR', 'federacao', '230001800963', [23, 45]),
    (2026, 'Deputado estadual', 'RR', 'federacao', '230001801003', [13, 43, 65]),
    (2026, 'Deputado estadual', 'RR', 'federacao', '230001801005', [11, 44]),
    (2026, 'Deputado federal', 'AP', 'federacao', '30001800110', [18, 50]),
    (2026, 'Deputado federal', 'AP', 'federacao', '30001800150', [13, 43, 65]),
    (2026, 'Deputado federal', 'AP', 'federacao', '30001800256', [11, 44]),
    (2026, 'Deputado federal', 'ES', 'federacao', '80001800605', [11, 44]),
    (2026, 'Deputado federal', 'ES', 'federacao', '80001800980', [18, 50]),
    (2026, 'Deputado federal', 'ES', 'federacao', '80001800985', [13, 43, 65]),
    (2026, 'Deputado federal', 'ES', 'federacao', '80001801136', [25, 77]),
    (2026, 'Deputado federal', 'MG', 'federacao', '130001800136', [25, 77]),
    (2026, 'Deputado federal', 'MG', 'federacao', '130001800273', [13, 43, 65]),
    (2026, 'Deputado federal', 'MG', 'federacao', '130001800381', [18, 50]),
    (2026, 'Deputado federal', 'MG', 'federacao', '130001800492', [23, 45]),
    (2026, 'Deputado federal', 'MG', 'federacao', '130001800586', [11, 44]),
    (2026, 'Deputado federal', 'PE', 'federacao', '170001800138', [13, 43, 65]),
    (2026, 'Deputado federal', 'PE', 'federacao', '170001800476', [25, 77]),
    (2026, 'Deputado federal', 'PE', 'federacao', '170001800700', [11, 44]),
    (2026, 'Deputado federal', 'PE', 'federacao', '170001801151', [18, 50]),
    (2026, 'Deputado federal', 'PE', 'federacao', '170001801323', [23, 45]),
    (2026, 'Deputado federal', 'RJ', 'federacao', '190001800212', [25, 77]),
    (2026, 'Deputado federal', 'RJ', 'federacao', '190001800281', [18, 50]),
    (2026, 'Deputado federal', 'RJ', 'federacao', '190001800542', [11, 44]),
    (2026, 'Deputado federal', 'RJ', 'federacao', '190001800694', [13, 43, 65]),
    (2026, 'Deputado federal', 'RJ', 'federacao', '190001801058', [23, 45]),
    (2026, 'Deputado federal', 'RR', 'federacao', '230001800998', [18, 50]),
    (2026, 'Deputado federal', 'RR', 'federacao', '230001801014', [11, 44]),
    (2026, 'Deputado federal', 'RR', 'federacao', '230001801029', [13, 43, 65]),
    (2026, 'Deputado federal', 'RR', 'federacao', '230001801030', [23, 45]),
    (2026, 'Deputado federal', 'RR', 'federacao', '230001801130', [25, 77])
) t(ano, cargo, uf, tipo, sq, numeros);

CREATE OR REPLACE TEMP TABLE membro AS
SELECT ano, cargo, uf, tipo, sq, unnest(numeros) AS numero FROM agremiacao;

CREATE OR REPLACE TEMP TABLE sigla_partido AS
SELECT p.id_partido, coalesce(r.partido, p.sigla) AS partido, p.numero
FROM partido p LEFT JOIN renomeado r ON r.sigla = p.sigla;

-- a lista de cada candidatura: o sq da coligação ou federação, ou o próprio partido
CREATE OR REPLACE TEMP TABLE candidatura_lista AS
SELECT c.id_candidatura, c.ano, g.nome AS cargo, c.uf, s.partido, s.numero,
       coalesce(m.sq, 'p' || s.numero) AS id_lista
FROM candidatura c
JOIN eleicao e       ON e.id_eleicao = c.id_eleicao
JOIN cargo g         ON g.id_cargo = e.id_cargo
JOIN sigla_partido s ON s.id_partido = c.id_partido
LEFT JOIN membro m   ON m.ano = c.ano AND m.cargo = g.nome AND m.uf = c.uf AND m.numero = s.numero
WHERE g.nome IN ('Deputado federal', 'Deputado estadual') AND e.tipo_eleicao = 'ORDINARIA' AND c.ano IN (2018, 2022, 2026);

-------------------------------------------------------------------------------
-- 1. disputas: as vagas de cada cargo e UF
-------------------------------------------------------------------------------
COPY (
    SELECT v.ano, g.nome AS cargo, v.uf, v.qt_vagas AS vagas
    FROM vagas v JOIN cargo g ON g.id_cargo = v.id_cargo
    WHERE g.nome IN ('Deputado federal', 'Deputado estadual') AND v.ano IN (2018, 2022, 2026)
    ORDER BY v.ano, g.nome, v.uf
) TO 'painel_cadeiras/disputas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 2. listas: votos de cada lista e as cadeiras que ganhou, pelo quociente (QP) e pelas sobras (rótulos
--    'ELEITO POR MÉDIA' e 'MÉDIA'; qualquer outro rótulo de eleito conta como QP). lista = as siglas, da mais votada
-------------------------------------------------------------------------------
COPY (
    WITH votos AS (
        SELECT e.ano, g.nome AS cargo, m.uf, coalesce(a.sq, 'p' || s.numero) AS id_lista, coalesce(a.tipo, 'partido') AS tipo,
               s.partido,
               sum(coalesce(v.votos_nominais, 0)) AS votos_nominais,
               sum(coalesce(v.votos_legenda, 0))  AS votos_legenda
        FROM votos_partido_municipio v
        JOIN eleicao e       ON e.id_eleicao = v.id_eleicao
        JOIN cargo g         ON g.id_cargo = e.id_cargo
        JOIN municipio m     ON m.id_municipio = v.id_municipio
        JOIN sigla_partido s ON s.id_partido = v.id_partido
        LEFT JOIN membro a   ON a.ano = e.ano AND a.cargo = g.nome AND a.uf = m.uf AND a.numero = s.numero
        WHERE g.nome IN ('Deputado federal', 'Deputado estadual')
          AND v.turno = 1 AND e.tipo_eleicao = 'ORDINARIA' AND e.ano IN (2018, 2022, 2026)
        GROUP BY ALL
    ),
    eleitos AS (
        SELECT cl.ano, cl.cargo, cl.uf, cl.id_lista,
               count(*) FILTER (WHERE rr.descricao NOT LIKE '%MÉDIA') AS eleitos_qp,
               count(*) FILTER (WHERE rr.descricao LIKE '%MÉDIA') AS eleitos_media
        FROM candidatura_lista cl
        JOIN candidatura c       ON c.id_candidatura = cl.id_candidatura
        JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
        WHERE rr.eleito
        GROUP BY ALL
    )
    SELECT v.ano, v.cargo, v.uf, v.id_lista, any_value(v.tipo) AS tipo,
           string_agg(v.partido, '/' ORDER BY v.votos_nominais + v.votos_legenda DESC, v.partido) AS lista,
           sum(v.votos_nominais) AS votos_nominais, sum(v.votos_legenda) AS votos_legenda,
           coalesce(any_value(el.eleitos_qp), 0) AS eleitos_qp, coalesce(any_value(el.eleitos_media), 0) AS eleitos_media
    FROM votos v
    LEFT JOIN eleitos el USING (ano, cargo, uf, id_lista)
    GROUP BY v.ano, v.cargo, v.uf, v.id_lista
    HAVING sum(v.votos_nominais + v.votos_legenda) > 0
    ORDER BY v.ano, v.cargo, v.uf, sum(v.votos_nominais + v.votos_legenda) DESC
) TO 'painel_cadeiras/listas.csv' (HEADER);

-------------------------------------------------------------------------------
-- 3. candidatos: os eleitos de cada lista (resultado 'qp' ou 'media') e o mais votado dela sem cadeira ('suplente'),
--    com os votos do 1º turno e a chave da foto (ano, ue, sequencial). Quem teve o registro negado ou renunciou depois
--    da eleição não entra.
-------------------------------------------------------------------------------
COPY (
    WITH base AS (
        SELECT cl.ano, cl.cargo, cl.uf, cl.id_lista, cl.partido,
               c.id_candidato, c.id_candidatura, c.nome_urna, c.ue, c.sequencial,
               coalesce(rc.votos, 0) AS votos,
               CASE WHEN NOT rr.eleito THEN 'suplente' WHEN rr.descricao LIKE '%MÉDIA' THEN 'media' ELSE 'qp' END AS resultado
        FROM candidatura_lista cl
        JOIN candidatura c       ON c.id_candidatura = cl.id_candidatura
        JOIN rotulo_resultado rr ON rr.id_rotulo = c.id_rotulo_final
        LEFT JOIN (SELECT id_candidatura, sum(votos) AS votos FROM resultado_candidatura WHERE turno = 1 GROUP BY 1) rc
               ON rc.id_candidatura = c.id_candidatura
        WHERE rr.eleito OR rr.categoria = 'NAO_ELEITO'
    )
    SELECT ano, cargo, uf, id_lista, partido, id_candidato, id_candidatura, nome_urna, ue, sequencial, votos, resultado
    FROM base
    QUALIFY resultado <> 'suplente'
         OR row_number() OVER (PARTITION BY ano, cargo, uf, id_lista, resultado = 'suplente' ORDER BY votos DESC, nome_urna) = 1
    ORDER BY ano, cargo, uf, id_lista, votos DESC
) TO 'painel_cadeiras/candidatos.csv' (HEADER);

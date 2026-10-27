-- Massa de teste pequena e conhecida. Os valores são fictícios e servem para os testes automáticos.
INSERT INTO municipio (id_municipio, cod_tse, cod_ibge, nome, uf, regiao) VALUES
  (1, '11111', '3100001', 'Alvorada', 'MG', 'Sudeste'), (2, '22222', '2600002', 'Bela Vista', 'PE', 'Nordeste'), (3, '33333', '3300003', 'Campo Alegre', 'RJ', 'Sudeste'),
  (4, '44444', NULL, 'Serra Azul', 'MG', 'Sudeste');
INSERT INTO partido (id_partido, numero, sigla, nome) VALUES
  (1, 40, 'PSB', 'Partido Socialista Brasileiro'), (2, 55, 'PSD', 'Partido Social Democrático'), (3, 13, 'PT', 'Partido dos Trabalhadores'), (4, 22, 'PL', 'Partido Liberal');
INSERT INTO eleicao (id_eleicao, cd_eleicao_tse, ano, id_cargo, tipo_eleicao, turno, data) VALUES
  (1, '2016_13', 2016, 13, 'ORDINARIA', 1, '2016-10-02'), (2, '2016_11', 2016, 11, 'ORDINARIA', 1, '2016-10-02'),
  (3, '2018_6',  2018, 6,  'ORDINARIA', 1, '2018-10-07'), (4, '2020_13', 2020, 13, 'ORDINARIA', 1, '2020-11-15'),
  (5, '2020_11', 2020, 11, 'ORDINARIA', 1, '2020-11-15'), (6, '2022_6',  2022, 6,  'ORDINARIA', 1, '2022-10-02'),
  (7, '2022_7',  2022, 7,  'ORDINARIA', 1, '2022-10-02'), (8, '2024_13', 2024, 13, 'ORDINARIA', 1, '2024-10-06'),
  (9, '2020_S',  2020, 11, 'SUPLEMENTAR', 1, '2021-03-07');
INSERT INTO candidato (id_candidato, titulo_eleitoral, nome_civil, dt_nascimento, genero, ocupacao) VALUES
  (1, '000111222333', 'MARIA DA SILVA SANTOS', '1980-05-10', 'FEMININO',  'PROFESSOR'),
  (2, '000444555666', 'JOÃO PEREIRA LIMA',     '1971-02-20', 'MASCULINO', 'COMERCIANTE'),
  (3, '000777888999', 'ANA COSTA RIBEIRO',     '1975-09-30', 'FEMININO',  'ADVOGADO'),
  (4, '000123123123', 'MARIANA SILVA ALVES',   '1990-01-15', 'FEMININO',  'ESTUDANTE');
-- rótulos: 1 ELEITO, 3 ELEITO POR MÉDIA, 5 NÃO ELEITO, 6 SUPLENTE  (ver tabela rotulo_resultado)
INSERT INTO candidatura (id_candidatura, ano, ue, sequencial, id_eleicao, id_candidato, id_partido, id_municipio, uf, nome_urna, numero_urna, idade_eleicao, id_rotulo_final, disputou) VALUES
  (1, 2016, '11111', 'S1', 1, 1, 1, 1, 'MG', 'MARIA PROFESSORA', '40123', 36, 1, true),
  (2, 2020, '11111', 'S2', 4, 1, 1, 1, 'MG', 'MARIA PROFESSORA', '40123', 40, 1, true),
  (3, 2022, 'MG',    'S3', 7, 1, 2, NULL, 'MG', 'MARIA DA SILVA',   '55123', 42, 5, true),
  (4, 2016, '22222', 'S4', 2, 2, 3, 2, 'PE', 'JOÃO DO COMERCIO', '13', 45, 1, true),
  (5, 2020, '22222', 'S5', 5, 2, 3, 2, 'PE', 'JOÃO DO COMERCIO', '13', 49, 1, true),
  (6, 2018, 'RJ',    'S6', 3, 3, 4, NULL, 'RJ', 'ANA ADVOGADA',  '2255', 43, 3, true),
  (7, 2022, 'RJ',    'S7', 6, 3, 4, NULL, 'RJ', 'ANA ADVOGADA',  '2255', 47, 1, true),
  (8, 2024, '33333', 'S8', 8, 4, 2, 3, 'RJ', 'MARIANA',          '55777', 34, 6, true),
  (9, 2020, '22222', 'S9', 9, 2, 3, 2, 'PE', 'JOÃO DO COMERCIO', '13', 49, 1, true),
  (10, 2022, 'MG', 'S10', 7, NULL, 4, NULL, 'MG', 'ZÉ DA SERRA', '22100', 50, 6, true);   -- rival de Maria (mapa do candidato)
INSERT INTO resultado_candidatura (id_resultado, id_candidatura, turno, resultado, votos) VALUES
  (1, 1, 1, 'ELEITO', 1200), (2, 2, 1, 'ELEITO', 1500), (3, 3, 1, 'NÃO ELEITO', 30000), (4, 4, 1, 'ELEITO', 9000),
  (5, 5, 1, 'ELEITO', 11000), (6, 6, 1, 'ELEITO POR MÉDIA', 80000), (7, 7, 1, 'ELEITO', 120000), (8, 8, 1, 'SUPLENTE', 800), (9, 9, 1, 'ELEITO', 500),
  (10, 10, 1, 'SUPLENTE', 5000);
INSERT INTO fonte_recurso (id_fonte_recurso, nome_fonte, tipo) VALUES (1, 'Fundo Especial de Financiamento de Campanha (FEFC)', 'publico'), (2, 'Recursos de pessoas físicas', 'privado');
INSERT INTO categoria_despesa (id_categoria_despesa, origem_despesa, grupo_classificacao, publicidade, transferencia) VALUES
  (1, 'Publicidade por materiais impressos', 'propaganda_fisica', true, false), (2, 'Publicidade por mídia digital', 'propaganda_digital', true, false),
  (3, 'Serviços advocatícios', 'outros', false, false), (4, 'Doações financeiras a outros candidatos', 'transferencia', false, true);
INSERT INTO despesa_campanha (id_despesa, id_candidatura, id_categoria_despesa, descricao_despesa, valor_despesa, tipo_prestacao_contas) VALUES
  (1, 2, 1, 'Impressão de santinhos e adesivos para a campanha', 3000, 'FINAL'),
  (2, 2, 2, 'Impulsionamento de conteúdo nas redes sociais', 1500, 'FINAL'),
  (3, 2, 3, 'Serviços advocatícios e contábeis', 1000, 'FINAL'),
  (4, 2, 4, 'Doação para outro candidato', 700, 'FINAL'),
  (5, 2, 1, 'Impressão de santinhos', 500, 'PARCIAL'),
  (6, 5, 2, 'Impulsionamento de conteúdo', 4000, 'FINAL'),
  (7, 5, 1, 'Impressão de santinhos e adesivos', 1000, 'FINAL');
INSERT INTO receita_campanha (id_receita, id_candidatura, id_fonte_recurso, origem_receita, valor_receita, repasse_entre_candidatos, tipo_prestacao_contas) VALUES
  (1, 2, 1, 'Recursos de partido político', 4000, false, 'FINAL'), (2, 2, 2, 'Recursos de pessoas físicas', 1000, false, 'FINAL'),
  (5, 2, 2, 'Recursos próprios', 500, false, 'FINAL'), (3, 2, 2, 'Recursos de outros candidatos', 300, true, 'FINAL'),
  (4, 5, 2, 'Recursos de pessoas físicas', 5000, false, 'FINAL');
-- votos de partido (para os painéis agregados da pergunta 5): 2020 vereador e 2022 deputado
INSERT INTO votos_partido_municipio (id_votos, id_eleicao, id_partido, id_municipio, turno, votos_nominais, votos_legenda) VALUES
  (1, 4, 1, 1, 1, 400, 120), (2, 4, 2, 1, 1, 900, 60), (3, 4, 3, 2, 1, 1000, 50), (4, 7, 1, 1, 1, 700, 70), (5, 7, 4, 3, 1, 600, 0);
-- votos por município (mapa do candidato): Maria (3) só em Alvorada; o rival (10) nos dois municípios de MG
INSERT INTO votos_candidatura_municipio (id_votos_candidatura, id_candidatura, id_municipio, turno, votos) VALUES
  (1, 3, 1, 1, 30000), (2, 10, 1, 1, 3000), (3, 10, 4, 1, 2000);

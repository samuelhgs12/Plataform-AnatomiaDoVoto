-- Copiado do repositório de carga (sql/01_tabelas.sql e sql/02_views_indices.sql), adaptado ao DuckDB:
-- sem colunas IDENTITY e sem ON DELETE CASCADE; sem índices. Mantenha em sincronia com o banco real.

-- =====================================================================================
-- DDL FINAL (PROPOSTA) - PostgreSQL 14+
-- Projeto BDR: eleições (TSE) + IBGE + viés partidário.
-- Base: DER do draw.io ("DER - Votação"), com as correções descritas em docs/mapeamento_der.md.
--
-- Rode este arquivo ANTES da carga e o 02_views_indices.sql DEPOIS.
-- Convenções: snake_case sem acento; ids com IDENTITY "BY DEFAULT" (a carga insere ids explícitos
-- e depois acerta as sequências); valores em R$ com numeric(18,2).
-- =====================================================================================

-- ------------------------------ DOMÍNIOS -------------------------------------------

-- Corrige a FK invertida do DER (Cargo apontava para Candidatura). Agora Eleicao aponta para Cargo.
CREATE TABLE cargo (
    id_cargo      smallint     PRIMARY KEY,
    cd_cargo_tse  varchar(3)   NOT NULL UNIQUE,
    nome          varchar(40)  NOT NULL,
    unidade       varchar(9)   NOT NULL CHECK (unidade IN ('BR', 'UF', 'MUNICIPIO')),  -- onde a eleição é disputada
    sistema       varchar(12)  NOT NULL CHECK (sistema IN ('majoritario', 'proporcional')),
    eh_titular    boolean      NOT NULL   -- false para vice e suplente (não entram em taxas de sucesso)
);

INSERT INTO cargo (id_cargo, cd_cargo_tse, nome, unidade, sistema, eh_titular) VALUES
    (1,  '1',  'Presidente',             'BR',        'majoritario',  true),
    (2,  '2',  'Vice-presidente',        'BR',        'majoritario',  false),
    (3,  '3',  'Governador',             'UF',        'majoritario',  true),
    (4,  '4',  'Vice-governador',        'UF',        'majoritario',  false),
    (5,  '5',  'Senador',                'UF',        'majoritario',  true),
    (6,  '6',  'Deputado federal',       'UF',        'proporcional', true),
    (7,  '7',  'Deputado estadual',      'UF',        'proporcional', true),
    (8,  '8',  'Deputado distrital',     'UF',        'proporcional', true),
    (9,  '9',  '1º suplente de senador', 'UF',        'majoritario',  false),
    (10, '10', '2º suplente de senador', 'UF',        'majoritario',  false),
    (11, '11', 'Prefeito',               'MUNICIPIO', 'majoritario',  true),
    (12, '12', 'Vice-prefeito',          'MUNICIPIO', 'majoritario',  false),
    (13, '13', 'Vereador',               'MUNICIPIO', 'proporcional', true);

-- Rótulo de resultado do TSE -> categoria. É daqui que vêm "eleito" e "disputou" (a situação do
-- registro não é divulgada pelo TSE em 2024, então "disputou" não pode depender dela).
CREATE TABLE rotulo_resultado (
    id_rotulo  smallint     PRIMARY KEY,
    descricao  varchar(80)  NOT NULL UNIQUE,      -- texto exato do TSE
    categoria  varchar(14)  NOT NULL CHECK (categoria IN
                   ('ELEITO', 'NAO_ELEITO', 'NAO_ASSUMIU', 'NAO_DISPUTOU', 'SEM_RESULTADO')),
    eleito     boolean      NOT NULL,
    disputou   boolean                            -- NULL = não dá para saber só pelo rótulo
);

INSERT INTO rotulo_resultado (id_rotulo, descricao, categoria, eleito, disputou) VALUES
    (1,  'ELEITO',                                         'ELEITO',        true,  true),
    (2,  'ELEITO POR QP',                                  'ELEITO',        true,  true),
    (3,  'ELEITO POR MÉDIA',                               'ELEITO',        true,  true),
    (4,  'MÉDIA',                                          'ELEITO',        true,  true),   -- eleito por média em 1998, 2006 e 2010
    (5,  'NÃO ELEITO',                                     'NAO_ELEITO',    false, true),
    (6,  'SUPLENTE',                                       'NAO_ELEITO',    false, true),
    (7,  '2º TURNO',                                       'NAO_ELEITO',    false, true),
    (8,  'INDEFERIDO COM RECURSO',                         'NAO_ASSUMIU',   false, true),
    (9,  'REGISTRO NEGADO APÓS A ELEIÇÃO',                 'NAO_ASSUMIU',   false, true),
    (10, 'RENÚNCIA/FALECIMENTO/CASSAÇÃO APÓS A ELEIÇÃO',   'NAO_ASSUMIU',   false, true),
    (11, 'REGISTRO NEGADO ANTES DA ELEIÇÃO',               'NAO_DISPUTOU',  false, false),
    (12, 'RENÚNCIA/FALECIMENTO/CASSAÇÃO ANTES DA ELEIÇÃO', 'NAO_DISPUTOU',  false, false),
    (13, 'RENÚNCIA/FALECIMENTO COM SUBSTITUIÇÃO',          'NAO_DISPUTOU',  false, false),
    (14, 'SUBSTITUÍDO',                                    'NAO_DISPUTOU',  false, false),
    (15, 'SEM RESULTADO',                                  'SEM_RESULTADO', false, NULL);  -- resultado vazio no TSE

-- Escala comum de instrução (TSE x IBGE), usada na pergunta 4. Preenchida pela carga, que classifica
-- os rótulos encontrados: 1 = até fundamental incompleto, 2 = fundamental completo / médio incompleto,
-- 3 = médio completo / superior incompleto, 4 = superior completo. Rótulos antigos "1º grau" (fundamental) e
-- "2º grau" (médio) entram na mesma escala. NULL = não classificado ("NÃO INFORMADO", "NÃO DIVULGÁVEL").
CREATE TABLE nivel_instrucao (
    id_nivel_instrucao  smallint     PRIMARY KEY,
    descricao_tse       varchar(60)  NOT NULL UNIQUE,
    nivel               smallint     CHECK (nivel BETWEEN 1 AND 4)
);

-- ------------------------------ TERRITÓRIO E PARTIDOS -------------------------------

CREATE TABLE municipio (
    id_municipio  integer       PRIMARY KEY,
    cod_tse       varchar(5)   NOT NULL UNIQUE,
    cod_ibge      varchar(7)   UNIQUE,            -- preenchido na etapa do IBGE (de-para TSE x IBGE)
    nome          varchar(100),
    uf            char(2)      NOT NULL,
    regiao        varchar(12)
);

CREATE TABLE partido (
    id_partido           integer       PRIMARY KEY,
    numero               smallint     NOT NULL,
    sigla                varchar(20)  NOT NULL,
    nome                 varchar(100),
    id_partido_sucessor  integer      REFERENCES partido (id_partido),   -- ex.: PSL e DEM -> União Brasil
    ano_sucessao         smallint,
    UNIQUE (numero, sigla)
);

-- ------------------------------ ELEIÇÕES E CANDIDATOS -------------------------------

-- Uma linha por eleição (código do TSE) e cargo. O TSE dá um código a cada turno, então já está
-- no grão (pleito, cargo, turno) do DER original. tipo_eleicao é normalizado pela carga.
CREATE TABLE eleicao (
    id_eleicao      integer        PRIMARY KEY,
    cd_eleicao_tse  varchar(120)  NOT NULL,
    ano             smallint      NOT NULL,
    id_cargo        smallint      NOT NULL REFERENCES cargo (id_cargo),
    tipo_eleicao    varchar(14)   NOT NULL CHECK (tipo_eleicao IN ('ORDINARIA', 'SUPLEMENTAR', 'EXTRAORDINARIA')),
    turno           smallint      NOT NULL CHECK (turno IN (1, 2)),
    data            date,
    UNIQUE (ano, cd_eleicao_tse, id_cargo)
);

-- A pessoa ao longo das eleições (chave: título eleitoral). CPF fica de fora: o TSE deixou de
-- divulgar em 2024 e não é necessário para nenhuma das perguntas.
CREATE TABLE candidato (
    id_candidato      bigint         PRIMARY KEY,
    titulo_eleitoral  varchar(20)   NOT NULL UNIQUE,
    nome_civil        varchar(150),
    dt_nascimento     date,
    genero            varchar(20),
    raca              varchar(30),
    ocupacao          varchar(100)
);

CREATE TABLE candidatura (
    id_candidatura            bigint        PRIMARY KEY,
    ano                       smallint     NOT NULL,
    ue                        varchar(5)   NOT NULL,    -- 'BR', sigla da UF ou código TSE do município
    sequencial                varchar(20)  NOT NULL,    -- até 2008 se repete entre municípios
    id_eleicao                integer      NOT NULL REFERENCES eleicao (id_eleicao),  -- eleição do 1º turno
    id_candidato              bigint       REFERENCES candidato (id_candidato),       -- NULL: título não divulgado
    id_partido                integer      REFERENCES partido (id_partido),
    id_municipio              integer      REFERENCES municipio (id_municipio),       -- só eleições municipais
    uf                        char(2),
    nome_urna                 varchar(80),
    numero_urna               varchar(10),
    idade_eleicao             smallint,
    situacao_registro         varchar(60),              -- NULL em 2024: o TSE não divulgou
    escolaridade_candidatura  varchar(60),
    id_nivel_instrucao        smallint     REFERENCES nivel_instrucao (id_nivel_instrucao),
    id_rotulo_final           smallint     NOT NULL REFERENCES rotulo_resultado (id_rotulo),  -- resultado do último turno
    disputou                  boolean,                  -- do rótulo; sem resultado: true só se tiver voto
    UNIQUE (ano, ue, sequencial)
);

CREATE TABLE resultado_candidatura (
    id_resultado    bigint        PRIMARY KEY,
    id_candidatura  bigint       NOT NULL REFERENCES candidatura (id_candidatura),
    turno           smallint     NOT NULL CHECK (turno IN (1, 2)),
    resultado       varchar(80),
    votos           bigint,
    UNIQUE (id_candidatura, turno)
);

-- ------------------------------ VOTAÇÃO --------------------------------------------

CREATE TABLE votos_candidatura_municipio (
    id_votos_candidatura  bigint    PRIMARY KEY,
    id_candidatura        bigint    NOT NULL REFERENCES candidatura (id_candidatura),
    id_municipio          integer   NOT NULL REFERENCES municipio (id_municipio),
    turno                 smallint  NOT NULL CHECK (turno IN (1, 2)),
    votos                 bigint    NOT NULL,   -- só municípios com voto
    UNIQUE (id_candidatura, id_municipio, turno)
);

CREATE TABLE votos_partido_municipio (
    id_votos        bigint     PRIMARY KEY,
    id_eleicao      integer   NOT NULL REFERENCES eleicao (id_eleicao),
    id_partido      integer   NOT NULL REFERENCES partido (id_partido),
    id_municipio    integer   NOT NULL REFERENCES municipio (id_municipio),
    turno           smallint  NOT NULL CHECK (turno IN (1, 2)),
    votos_nominais  bigint,
    votos_legenda   bigint,   -- só existe em cargos proporcionais
    UNIQUE (id_eleicao, id_partido, id_municipio, turno)
);

-- Corrige o DER original: troca cargo/ano em texto por id_eleicao e acrescenta brancos e nulos.
CREATE TABLE participacao_eleitoral (
    id_participacao  bigint             PRIMARY KEY,
    id_eleicao       integer           NOT NULL REFERENCES eleicao (id_eleicao),
    id_municipio     integer           NOT NULL REFERENCES municipio (id_municipio),
    turno            smallint          NOT NULL CHECK (turno IN (1, 2)),
    eleitorado_apto  bigint,
    comparecimento   bigint,
    abstencoes       bigint,
    votos_brancos    bigint,
    votos_nulos      bigint,
    taxa_abstencao   double precision,
    UNIQUE (id_eleicao, id_municipio, turno)
);

-- Número de cadeiras por cargo e unidade (consulta_vagas). Não existia no DER; é o denominador
-- de "$ por cadeira" (pergunta 1).
CREATE TABLE vagas (
    id_vagas      integer    PRIMARY KEY,
    ano           smallint  NOT NULL,
    id_cargo      smallint  NOT NULL REFERENCES cargo (id_cargo),
    uf            char(2),                                        -- NULL para presidente
    id_municipio  integer   REFERENCES municipio (id_municipio),  -- só eleições municipais
    qt_vagas      smallint  NOT NULL
);
CREATE UNIQUE INDEX ux_vagas ON vagas (ano, id_cargo, COALESCE(uf, ''), COALESCE(id_municipio, 0));

-- ------------------------------ DINHEIRO DE CAMPANHA --------------------------------

CREATE TABLE fonte_recurso (
    id_fonte_recurso  smallint      PRIMARY KEY,
    nome_fonte        varchar(80)  NOT NULL UNIQUE,
    tipo              varchar(10)  CHECK (tipo IN ('publico', 'privado'))  -- NULL = a classificar
);

CREATE TABLE categoria_despesa (
    id_categoria_despesa  smallint      PRIMARY KEY,
    origem_despesa        varchar(120) NOT NULL UNIQUE,
    grupo_classificacao   varchar(30),
    publicidade           boolean      NOT NULL DEFAULT false,   -- filtro da pergunta 9
    transferencia         boolean      NOT NULL DEFAULT false    -- doação a outro candidato/partido: não é gasto
);

-- Doador (nome e CPF/CNPJ) fica de fora: dado pessoal e desnecessário para as perguntas.
CREATE TABLE receita_campanha (
    id_receita                bigint         PRIMARY KEY,
    id_candidatura            bigint        NOT NULL REFERENCES candidatura (id_candidatura),
    id_fonte_recurso          smallint      REFERENCES fonte_recurso (id_fonte_recurso),
    sequencial_receita        varchar(20),
    turno                     smallint,
    data_receita              date,
    origem_receita            varchar(100),
    natureza_receita          varchar(30),
    especie_receita           varchar(60),
    descricao_receita         text,
    valor_receita             numeric(18,2),
    repasse_entre_candidatos  boolean       NOT NULL DEFAULT false,   -- excluir ao somar receitas
    tipo_prestacao_contas     varchar(25)   NOT NULL CHECK (tipo_prestacao_contas IN
                                  ('FINAL', 'PARCIAL', 'RELATORIO_FINANCEIRO', 'REGULARIZACAO_OMISSAO')),
    data_prestacao_contas     date
);

CREATE TABLE despesa_campanha (
    id_despesa              bigint         PRIMARY KEY,
    id_candidatura          bigint        NOT NULL REFERENCES candidatura (id_candidatura),
    id_categoria_despesa    smallint      REFERENCES categoria_despesa (id_categoria_despesa),
    sequencial_despesa_tse  varchar(20),
    turno                   smallint,
    data_despesa            date,
    descricao_despesa       text,                                     -- base da nuvem de palavras (pergunta 9)
    valor_despesa           numeric(18,2),                            -- valor contratado
    nome_fornecedor         varchar(150),
    cnae_fornecedor         varchar(10),
    tipo_prestacao_contas   varchar(25)   NOT NULL CHECK (tipo_prestacao_contas IN
                                ('FINAL', 'PARCIAL', 'RELATORIO_FINANCEIRO', 'REGULARIZACAO_OMISSAO')),
    data_prestacao_contas   date
);

-- ------------------------------ ELEITORADO ------------------------------------------

CREATE TABLE faixa_etaria (
    id_faixa        smallint       PRIMARY KEY,
    faixa_original  varchar(40)   NOT NULL UNIQUE,
    idade_min       smallint,
    idade_max       smallint,                      -- NULL = sem limite superior
    ponto_medio     numeric(5,1),
    jovem           boolean       NOT NULL DEFAULT false   -- corte de 16 a 29 anos (ajustável)
);

CREATE TABLE perfil_eleitorado (
    id_perfil           bigint        PRIMARY KEY,
    id_municipio        integer      NOT NULL REFERENCES municipio (id_municipio),
    id_faixa            smallint     NOT NULL REFERENCES faixa_etaria (id_faixa),
    ano                 smallint     NOT NULL,
    genero              varchar(20)  NOT NULL,
    grau_instrucao      varchar(60)  NOT NULL,
    id_nivel_instrucao  smallint     REFERENCES nivel_instrucao (id_nivel_instrucao),
    eleitores           bigint       NOT NULL,
    UNIQUE (id_municipio, ano, id_faixa, grau_instrucao, genero)
);

-- ------------------------------ IBGE E VIÉS (preenchidos depois) --------------------

CREATE TABLE vies_partido (
    id_vies      bigint         PRIMARY KEY,
    id_partido   integer       NOT NULL REFERENCES partido (id_partido),
    ano_eleicao  smallint      NOT NULL,
    score        numeric(6,2)  NOT NULL,           -- -100 (esquerda) a +100 (direita)
    versao       varchar(30)   NOT NULL,
    UNIQUE (id_partido, ano_eleicao, versao)
);

-- A PK inclui o ano (o DER original tinha só id_municipio, o que permitia um único ano por município).
CREATE TABLE censo_municipio (
    id_municipio           integer       NOT NULL REFERENCES municipio (id_municipio),
    ano_referencia         smallint      NOT NULL,
    populacao              bigint,
    idhm                   numeric(5,3),
    pib                    numeric(18,2),
    idade_mediana          numeric(4,1),
    indice_envelhecimento  numeric(6,2),
    PRIMARY KEY (id_municipio, ano_referencia)
);

CREATE TABLE populacao_idade (
    id_municipio    integer   NOT NULL REFERENCES municipio (id_municipio),
    ano_referencia  smallint  NOT NULL,
    idade           smallint  NOT NULL,
    populacao       bigint    NOT NULL,
    PRIMARY KEY (id_municipio, ano_referencia, idade)
);


-- =====================================================================================
-- VIEWS E ÍNDICES - rode DEPOIS da carga (os índices ficam mais rápidos de criar com a tabela cheia).
-- As views registram as regras de análise sugeridas; se o grupo decidir outra regra, mude aqui.
-- =====================================================================================

-- Candidatura com cargo, tipo de eleição e flags de resultado. É a base das perguntas 1, 2, 8, 9 e 10.
-- Para gasto/receita (perguntas 1, 2, 8, 9) filtre ordinaria = true e eh_titular = true.
CREATE VIEW vw_candidatura AS
SELECT c.id_candidatura, c.ano, c.ue, c.uf, c.id_municipio, c.id_candidato, c.id_partido,
       c.nome_urna, c.sequencial, c.id_eleicao, e.id_cargo, g.nome AS cargo, g.sistema, g.eh_titular,
       e.tipo_eleicao, (e.tipo_eleicao = 'ORDINARIA') AS ordinaria, e.data AS data_eleicao,
       r.descricao AS rotulo_resultado, r.categoria, r.eleito,
       COALESCE(c.disputou, r.disputou) AS disputou
FROM candidatura c
JOIN eleicao e          ON e.id_eleicao = c.id_eleicao
JOIN cargo g            ON g.id_cargo = e.id_cargo
JOIN rotulo_resultado r ON r.id_rotulo = c.id_rotulo_final;

-- Quem ocupa a cadeira: para cada (ano, unidade, cargo), o eleito da eleição mais recente.
-- Uma suplementar/extraordinária substitui a ordinária anulada (ex.: Guarapari 2012).
CREATE VIEW vw_eleito_efetivo AS
SELECT * FROM (
    SELECT v.*, dense_rank() OVER (PARTITION BY v.ano, v.ue, v.id_cargo
                                   ORDER BY v.data_eleicao DESC NULLS LAST, v.id_eleicao DESC) AS ordem
    FROM vw_candidatura v
    WHERE v.eleito
) t
WHERE ordem = 1;

-- Receita por candidatura (prestação final ou regularização da omissão; sem repasses entre candidatos).
CREATE VIEW vw_receita_candidatura AS
SELECT r.id_candidatura,
       SUM(r.valor_receita) FILTER (WHERE f.tipo = 'publico')  AS receita_publica,
       SUM(r.valor_receita) FILTER (WHERE f.tipo = 'privado')  AS receita_privada,
       SUM(r.valor_receita)                                    AS receita_total
FROM receita_campanha r
LEFT JOIN fonte_recurso f ON f.id_fonte_recurso = r.id_fonte_recurso
WHERE r.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND NOT r.repasse_entre_candidatos
GROUP BY r.id_candidatura;

-- Gasto por candidatura (valor contratado, sem transferências para outros candidatos/partidos).
CREATE VIEW vw_despesa_candidatura AS
SELECT d.id_candidatura,
       SUM(d.valor_despesa)                                 AS gasto_total,
       SUM(d.valor_despesa) FILTER (WHERE k.publicidade)    AS gasto_propaganda
FROM despesa_campanha d
LEFT JOIN categoria_despesa k ON k.id_categoria_despesa = d.id_categoria_despesa
WHERE d.tipo_prestacao_contas IN ('FINAL', 'REGULARIZACAO_OMISSAO')
  AND NOT COALESCE(k.transferencia, false)
GROUP BY d.id_candidatura;

-- Índices das chaves estrangeiras usadas nas junções grandes (as UNIQUE já criam os seus).

-- =====================================================================
-- BANCO COMPLETO — PARIGOT PRESENTES   (script único para um banco NOVO)
-- =====================================================================
-- Reúne em um só arquivo:
--   * DW_proj_4B.sql                 (estrutura + dados de exemplo)
--   * migracao_notificacao_admin.sql (tabela notificacao_admin + índice único
--                                     + status padrão "Não confirmado")
--   * migracao_status_pedidos.sql    (status padronizados: pagamento
--                                     Não confirmado/Confirmado; pedido
--                                     Não confirmado/Em andamento/Pedido pronto/Entregue)
-- As migrações NÃO precisam mais ser rodadas: elas servem só para bancos antigos.
--
-- COMO USAR (banco novo)
--   1) Crie o banco, FORA deste script (CREATE DATABASE não roda dentro de transação):
--        CREATE DATABASE parigot_presentes;
--      (no pgAdmin: botão direito em "Databases" > Create > Database)
--   2) Conecte-se ao banco criado e execute este arquivo inteiro.
--   3) Em backend/.env use DB_NAME=parigot_presentes (ou o nome que você escolheu).
--
-- ATENÇÃO: este script APAGA as tabelas listadas abaixo e recria tudo.
-- Não rode em um banco que já tenha dados que você quer manter.
-- =====================================================================

BEGIN;

DROP TABLE IF EXISTS
    notificacao_admin,
    devolucao_has_produto,
    pagamento_has_forma_pagamento,
    pedido_has_produto,
    cargo_has_tabela,
    pagamento,
    devolucoes,
    pedido,
    funcionario,
    cliente,
    produto,
    forma_pagamento,
    unidade_medida,
    categoria,
    pessoa,
    tabelas_card_menu,
    recuperacao_senha,
    cargo;

CREATE TABLE cargo (
    id_cargo INTEGER PRIMARY KEY,
    nome_cargo VARCHAR(45)
);


CREATE TABLE tabelas_card_menu (
    id_tabela INTEGER PRIMARY KEY,
    nome_tabela VARCHAR(30) NOT NULL
);


CREATE TABLE cargo_has_tabela (
    id_cargo INTEGER NOT NULL,
    id_tabela INTEGER NOT NULL,
    FOREIGN KEY (id_cargo) REFERENCES cargo(id_cargo),
    FOREIGN KEY (id_tabela) REFERENCES tabelas_card_menu(id_tabela),
    PRIMARY KEY (id_cargo, id_tabela)
);


CREATE TABLE pessoa (
    cpf_pessoa VARCHAR(20) NOT NULL PRIMARY KEY,
    nome_pessoa VARCHAR(60),
    data_nascimento_pessoa date,
    endereco_pessoa VARCHAR(150),
    telefone_pessoa VARCHAR(20),
    senha_pessoa VARCHAR(50),
    email_pessoa VARCHAR(75),
    -- telefone só com dígitos e DDD (sem 55): 10 (fixo) ou 11 (celular)
    CONSTRAINT ck_pessoa_telefone CHECK (telefone_pessoa IS NULL OR telefone_pessoa ~ '^[1-9][1-9][0-9]{8,9}$')
);


-- E-mail único (sem diferenciar maiúsculas/minúsculas): o login usa o e-mail.
CREATE UNIQUE INDEX ux_pessoa_email ON pessoa (LOWER(email_pessoa));


CREATE TABLE cliente (
    pessoa_cpf_pessoa VARCHAR(20) NOT NULL PRIMARY KEY,
    renda_cliente double precision,
    data_cadastro_cliente date,
    foreign key (pessoa_cpf_pessoa) references pessoa(cpf_pessoa)
);


CREATE TABLE forma_pagamento (
    id_forma_pagamento integer NOT NULL PRIMARY KEY,
    nome_forma_pagamento VARCHAR(100)
);


CREATE TABLE funcionario (
    pessoa_cpf_pessoa VARCHAR(20) NOT NULL PRIMARY KEY,
    salario_funcionario double precision,
    cargo_id_cargo integer,
    porcentagem_comissao_funcionario double precision,
    foreign key (pessoa_cpf_pessoa) references pessoa(cpf_pessoa),
    foreign key (cargo_id_cargo) references cargo(id_cargo)
);


CREATE TABLE categoria (
    id_categoria integer NOT NULL PRIMARY KEY,
    nome_categoria VARCHAR(30)
);


CREATE TABLE unidade_medida (
    id_unidade_medida VARCHAR(2) NOT NULL PRIMARY KEY,
    nome_unidade_medida VARCHAR(30)
);


CREATE TABLE produto (
    id_produto integer NOT NULL PRIMARY KEY,
    nome_produto VARCHAR(45),
    quantidade_estoque_produto integer,
    preco_unitario_produto double precision,
    id_unidade_medida VARCHAR(2),
    id_categoria INTEGER,
    FOREIGN KEY (id_unidade_medida) REFERENCES unidade_medida(id_unidade_medida),
    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);


CREATE TABLE pedido (
    id_pedido SERIAL PRIMARY KEY,
    data_pedido date,
    cliente_pessoa_cpf_pessoa VARCHAR(20),
    funcionario_pessoa_cpf_pessoa VARCHAR(20),
    entrega_ou_retirada varchar(50),
    status_pedido varchar(100),
    status_pagamento varchar(100),
    endereco_entrega TEXT,
    FOREIGN KEY (cliente_pessoa_cpf_pessoa) REFERENCES cliente(pessoa_cpf_pessoa),
    FOREIGN KEY (funcionario_pessoa_cpf_pessoa) REFERENCES funcionario(pessoa_cpf_pessoa)
);


CREATE TABLE pedido_has_produto (
    produto_id_produto integer NOT NULL,
    pedido_id_pedido integer NOT NULL,
    embrulhar VARCHAR(20),
    quantidade integer,
    preco_unitario double precision,
    FOREIGN KEY (pedido_id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (produto_id_produto) REFERENCES produto(id_produto),
    PRIMARY KEY (produto_id_produto, pedido_id_pedido)
);


CREATE TABLE devolucoes (
    id_devolucao SERIAL PRIMARY KEY,
    pedido_id_pedido INTEGER NOT NULL UNIQUE,
    data_devolucao DATE,
    cliente_pessoa_cpf_pessoa VARCHAR(20),
    funcionario_pessoa_cpf_pessoa VARCHAR(20),
    motivo_devolucao VARCHAR(100),
    FOREIGN KEY (pedido_id_pedido) REFERENCES pedido(id_pedido),
    FOREIGN KEY (cliente_pessoa_cpf_pessoa) REFERENCES cliente(pessoa_cpf_pessoa),
    FOREIGN KEY (funcionario_pessoa_cpf_pessoa) REFERENCES funcionario(pessoa_cpf_pessoa)
);


CREATE TABLE devolucao_has_produto (
    devolucao_id_devolucao INTEGER NOT NULL,
    produto_id_produto INTEGER NOT NULL,
    quantidade INTEGER,
    preco_unitario DOUBLE PRECISION,
    FOREIGN KEY (devolucao_id_devolucao) REFERENCES devolucoes(id_devolucao),
    FOREIGN KEY (produto_id_produto) REFERENCES produto(id_produto),
    PRIMARY KEY (devolucao_id_devolucao, produto_id_produto)
);


CREATE TABLE pagamento (
    pedido_id_pedido integer NOT NULL PRIMARY KEY,
    data_pagamento timestamp without time zone,
    valor_total_pagamento double precision,
    subtotal_produtos NUMERIC(12,2),
    juros_total NUMERIC(12,2),
    taxa_entrega NUMERIC(12,2) NOT NULL DEFAULT 0,
    taxa_embrulho NUMERIC(12,2) NOT NULL DEFAULT 0,
    status_pagamento VARCHAR(40) NOT NULL DEFAULT 'Não confirmado',
    FOREIGN KEY (pedido_id_pedido) REFERENCES pedido(id_pedido)
);


CREATE TABLE pagamento_has_forma_pagamento (
    pagamento_id_pedido integer NOT NULL,
    forma_pagamento_id_forma_pagamento integer NOT NULL,
    valor_pago double precision,
    valor_previsto NUMERIC(12,2),
    valor_principal NUMERIC(12,2),
    percentual_juros NUMERIC(5,2) NOT NULL DEFAULT 0,
    valor_juros NUMERIC(12,2) NOT NULL DEFAULT 0,
    parcelas INTEGER,
    precisa_troco BOOLEAN NOT NULL DEFAULT FALSE,
    valor_troco NUMERIC(12,2),
    foreign key (pagamento_id_pedido) references pagamento(pedido_id_pedido),
    foreign key (forma_pagamento_id_forma_pagamento) references forma_pagamento(id_forma_pagamento)
);


-- Notificações para a administração conferir pagamentos (criada quando o cliente
-- conclui o pedido). A tela do admin lê esta tabela.
CREATE TABLE notificacao_admin (
    id_notificacao SERIAL PRIMARY KEY,
    pedido_id_pedido INTEGER NOT NULL,
    tipo VARCHAR(40) NOT NULL DEFAULT 'pagamento_a_verificar',
    criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lida BOOLEAN NOT NULL DEFAULT FALSE,
    lida_em TIMESTAMP,
    FOREIGN KEY (pedido_id_pedido) REFERENCES pedido(id_pedido)
);


CREATE UNIQUE INDEX ux_notificacao_pedido_tipo ON notificacao_admin (pedido_id_pedido, tipo);


CREATE TABLE recuperacao_senha (
    email_pessoa VARCHAR(75) PRIMARY KEY,
    codigo_hash VARCHAR(64),
    token_hash VARCHAR(64),
    expira_em TIMESTAMP NOT NULL,
    solicitado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verificado_em TIMESTAMP,
    tentativas INTEGER NOT NULL DEFAULT 0
);



-- =========================================
-- INSERTS DA TABELA CARGO
-- =========================================

INSERT INTO cargo (id_cargo, nome_cargo) VALUES
(0, 'Vendedor online'),
(1, 'Vendedor'),
(2, 'Gerente'),
(3, 'Caixa'),
(4, 'Supervisor'),
(5, 'Atendente'),
(6, 'Repositor'),
(7, 'Conferente'),
(8, 'Assistente'),
(9, 'Auxiliar'),
(10, 'Diretor');


-- =========================================
-- INSERTS DA TABELA PESSOA
-- =========================================
INSERT INTO pessoa
(cpf_pessoa, nome_pessoa, data_nascimento_pessoa, endereco_pessoa, senha_pessoa, email_pessoa)
VALUES
('10101010101', 'Juliana Dias', '1989-10-25', 'lins, 352 ssss', '1111', 'juliana@email.com'),
('44444444444', 'Ana Lima', '1995-04-25', 'Alameda do medo, 4534 apto 13', '.123456', 'ana@email.com'),
('55555555555', 'Lucas Mendes', '1988-05-30', 'Rua sexta_feira, 13 _ apto 666', '.123456', 'lucas@email.com'),
('66666666666', 'Fernanda Costa', '1993-06-05', 'muito longe, 243', '.123456', 'fernanda@email.com'),
('77777777777', 'Ricardo Alves', '1987-07-10', 'far far faraway, 34', '.123456', 'ricardo@email.com'),
('88888888888', 'Patrícia Gomes', '1994-08-15', 'acolá, 54', '.123456', 'patricia@email.com'),
('99999999999', 'Marcos Rocha', '1991-09-20', 'kaxa prego _ ilha de itaparica', '.123456', 'marcos@email.com'),
('22222222222', 'Maria Souza', '1985-02-15', 'lá longe, 1234', '.123456', 'maria@email.com'),
('12387980903', 'Berola', '2005-10-16', 'Lá onde Judas perdeu a unha, s/n', '12345', 'berola@gmail.com'),
('12345678910', 'Alice Reis', '2000-01-01', 'Loja', 'abc123', 'online@gmail.com'),
('33333333333', 'Carlos Pereira', '1992-03-20', 'Rua que Judas perdeu as botas, 234', '123456x', 'carlos@email.com'),
('05703371945', 'Quétima da Silva Reis Ferreira', '1980-09-19', 'Rua Xambrê, 64', 'dhiellys123', 'quetimareis@gmail.com'),
('92929292929', 'Renato Marinho Ferreira', '1982-09-19', 'Rua Xambrê, 64', '310606', 'renatomarinho@hotmail.com'),
('12381980903', 'Bianca Mariana Reis Ferreira', '2009-07-24', 'UTFPR, 32', '300606', 'biancamariana@gmail.com'),
('12388899903', 'Dhiellys Gabrieli Reis Ferreira', '2006-06-30', 'Rua Coroaves UEM, 23', '300606', 'dhireis@gmail.com');


-- =========================================
-- INSERTS DA TABELA FUNCIONARIO
-- =========================================

INSERT INTO funcionario
(pessoa_cpf_pessoa, salario_funcionario, cargo_id_cargo, porcentagem_comissao_funcionario)
VALUES
('92929292929', 3000.00, 3, 3),
('66666666666', 4000.00, 4, 5),
('55555555555', 5000.00, 5, 9),
('88888888888', 6000.00, 6, 8),
('44444444444', 7000.00, 7, 5),
('12388899903', 8000.00, 8, 0.5),
('77777777777', 9000.00, 9, 1),
('05703371945', 10000.00, 10, 0),
('12381980903', 2000.00, 2, 2),
('99999999999', 20000.00, 1, 10),
('10101010101', 2000.00, 2, 0);


-- =========================================
-- INSERTS DA TABELA CLIENTE
-- =========================================

INSERT INTO cliente
(pessoa_cpf_pessoa, renda_cliente, data_cadastro_cliente)
VALUES
('33333333333', 4675.98, '2020-09-08'),
('22222222222', 8000.00, '2023-07-08'),
('12387980903', 1500.00, '2020-09-08'),
('12345678910', 32000.00, '2020-09-08'),
('99999999999', 20000.00, '2026-09-08'),
('12381980903', 2000.00, '2020-09-08'),
('10101010101', 3500.00, '2026-09-15'),
('44444444444', 4200.00, '2026-09-16'),
('55555555555', 5100.00, '2026-09-17'),
('66666666666', 2800.00, '2026-09-18'),
('88888888888', NULL, NULL);


-- =========================================
-- INSERTS DA TABELA CATEGORIA
-- =========================================

INSERT INTO categoria (id_categoria, nome_categoria) VALUES
(1, 'papelaria'),
(2, 'acessório'),
(3, 'utensílio'),
(4, 'perfumaria'),
(5, 'vestimenta'),
(6, 'decoração'),
(7, 'pelúcias'),
(8, 'bolsas e mochilas'),
(9, 'colecionáveis'),
(10, 'presentes');


-- =========================================
-- INSERTS DA TABELA UNIDADE_MEDIDA
-- =========================================

INSERT INTO unidade_medida
(id_unidade_medida, nome_unidade_medida)
VALUES
('UN', 'Unidade'),
('PC', 'Pacote'),
('DZ', 'Dúzia'),
('CX', 'Caixa'),
('M', 'Metro'),
('KG', 'Quilograma'),
('LT', 'Litro'),
('CM', 'Centímetro'),
('ML', 'Mililitro'),
('JG', 'Jogo');


-- =========================================
-- INSERTS DA TABELA PRODUTO
-- =========================================

INSERT INTO produto
(id_produto, nome_produto, quantidade_estoque_produto, preco_unitario_produto, id_unidade_medida, id_categoria)
VALUES
(1, 'caderno brochura grande', 11, 13.00, 'UN', 1),
(2, 'caderno brochura pequeno', 19, 7.00, 'UN', 1),
(3, 'caderno espiral 10 matérias', 5, 29.00, 'UN', 1),
(4, 'caderno espiral 15 matérias', 8, 35.00, 'UN', 1),
(5, 'caderneta 96 folhas', 9, 10.00, 'UN', 1),
(6, 'caneta bic azul', 29, 2.00, 'UN', 1),
(7, 'caneta bic preta', 80, 2.00, 'UN', 1),
(8, 'kit caneta colorida', 20, 15.00, 'UN', 1),
(9, 'mochila', 7, 120.00, 'UN', 1),
(10, 'ramona marrom', 100, 1.00, 'DZ', 2),
(11, 'ramona preta', 30, 1.00, 'DZ', 2),
(12, 'presilha de cabelo', 10, 10.00, 'CX', 2),
(13, 'piranha de cabelo', 8, 15.00, 'UN', 2),
(14, 'bolsa', 3, 79.00, 'UN', 2),
(15, 'travessa', 4, 80.00, 'UN', 3),
(16, 'lixeira', 2, 20.00, 'UN', 3),
(17, 'escumadeira', 3, 10.00, 'UN', 3),
(18, 'concha', 1, 7.00, 'UN', 3),
(19, 'colônia luna feminino', 2, 189.00, 'UN', 4),
(20, 'colônia kaiak masculino', 3, 199.00, 'UN', 4),
(21, 'colônia kaiak feminino', 2, 199.00, 'UN', 4),
(22, 'colônia humor feminino', 1, 189.00, 'UN', 4),
(23, 'creme corporal tododia', 8, 78.00, 'UN', 4),
(24, 'sabonete corporal tododia', 7, 33.00, 'CX', 4),
(25, 'óleo corporal ekos', 3, 79.00, 'UN', 4);


-- =========================================
-- INSERTS DA TABELA FORMA_PAGAMENTO
-- =========================================

INSERT INTO forma_pagamento
(id_forma_pagamento, nome_forma_pagamento)
VALUES
(1, 'Dinheiro'),
(2, 'Cartão de Crédito'),
(3, 'Cartão de Débito'),
(4, 'Pix'),
(5, 'Boleto'),
(6, 'Vale Alimentação'),
(7, 'Transferência Bancária'),
(8, 'Cheque'),
(9, 'Crédito Loja'),
(10, 'Gift Card');


-- =========================================
-- INSERTS DA TABELA PEDIDO
-- =========================================

INSERT INTO pedido
(id_pedido, data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, status_pedido)
VALUES
(1, '2026-09-10', '33333333333', '92929292929', 'Entregue'),
(2, '2026-09-11', '22222222222', '66666666666', 'Entregue'),
(3, '2026-09-12', '12387980903', '55555555555', 'Entregue'),
(4, '2026-09-13', '12345678910', '88888888888', 'Entregue'),
(5, '2026-09-14', '99999999999', '12381980903', 'Entregue'),
(6, '2026-09-15', '10101010101', '92929292929', 'Entregue'),
(7, '2026-09-16', '44444444444', '66666666666', 'Entregue'),
(8, '2026-09-17', '55555555555', '55555555555', 'Entregue'),
(9, '2026-09-18', '66666666666', '88888888888', 'Entregue'),
(10, '2026-09-19', '88888888888', '12388899903', 'Em andamento');


-- =========================================
-- INSERTS DA TABELA PEDIDO_HAS_PRODUTO
-- =========================================

INSERT INTO pedido_has_produto
(produto_id_produto, pedido_id_pedido, quantidade, preco_unitario)
VALUES
(1, 1, 2, 13.00),
(6, 1, 5, 2.00),
(9, 1, 1, 120.00),
(14, 2, 1, 79.00),
(19, 3, 1, 189.00),
(24, 3, 3, 33.00),
(20, 4, 1, 199.00),
(7, 4, 10, 2.00),
(23, 5, 2, 78.00),
(15, 5, 1, 80.00),
(2, 6, 2, 7.00),
(6, 6, 3, 2.00),
(9, 7, 1, 120.00),
(20, 8, 1, 199.00),
(16, 9, 2, 20.00),
(14, 10, 2, 79.00);


-- =========================================
-- INSERTS DA TABELA PAGAMENTO
-- =========================================

INSERT INTO pagamento
(pedido_id_pedido, data_pagamento, valor_total_pagamento)
VALUES
(1, '2026-09-10 10:30:00', 156.00),
(2, '2026-09-11 14:15:00', 79.00),
(3, '2026-09-12 16:40:00', 288.00),
(4, '2026-09-13 11:20:00', 219.00),
(5, '2026-09-14 15:50:00', 236.00),
(6, '2026-09-15 10:15:00', 20.00),
(7, '2026-09-16 13:30:00', 120.00),
(8, '2026-09-17 15:45:00', 199.00),
(9, '2026-09-18 11:10:00', 40.00),
(10, '2026-09-19 16:20:00', 158.00);


-- Pagamentos de exemplo já foram recebidos.
UPDATE pagamento SET status_pagamento = 'Confirmado';


-- =========================================
-- INSERTS DA TABELA PAGAMENTO_HAS_FORMA_PAGAMENTO
-- =========================================

INSERT INTO pagamento_has_forma_pagamento
(pagamento_id_pedido, forma_pagamento_id_forma_pagamento, valor_pago)
VALUES
(1, 4, 156.00),
(2, 2, 79.00),
(3, 1, 288.00),
(4, 3, 219.00),
(5, 4, 236.00),
(6, 4, 20.00),
(7, 2, 120.00),
(8, 1, 199.00),
(9, 3, 40.00),
(10, 4, 158.00);


-- =========================================
-- INSERTS DA TABELA TABELAS_CARD_MENU
-- =========================================

INSERT INTO tabelas_card_menu
(id_tabela, nome_tabela)
VALUES
(1, 'pedidos'),
(2, 'cargos'),
(3, 'pessoas'),
(4, 'clientes'),
(5, 'funcionarios'),
(6, 'formas_pagamento'),
(7, 'categorias'),
(8, 'unidade_medida'),
(9, 'produtos'),
(10, 'devolucoes');


-- =========================================
-- PERMISSÕES DOS CARGOS (cargo_has_tabela)
-- =========================================
-- O funcionário só acessa os módulos (CRUDs) marcados no cargo dele (tela Cargos).
-- Gerente (cargo 2) e Diretor (cargo 10) começam com acesso a TODOS os módulos:
-- 1 pedidos, 2 cargos, 3 pessoas, 4 clientes, 5 funcionarios, 6 formas_pagamento,
-- 7 categorias, 8 unidade_medida, 9 produtos, 10 devolucoes.
-- Os demais cargos são configurados na tela Cargos.

INSERT INTO cargo_has_tabela
(id_cargo, id_tabela)
VALUES
-- Gerente
(2, 1),
(2, 2),
(2, 3),
(2, 4),
(2, 5),
(2, 6),
(2, 7),
(2, 8),
(2, 9),
(2, 10),
-- Diretor
(10, 1),
(10, 2),
(10, 3),
(10, 4),
(10, 5),
(10, 6),
(10, 7),
(10, 8),
(10, 9),
(10, 10);


-- =========================================
-- INSERTS DA TABELA devolucoes
-- =========================================


INSERT INTO devolucoes
(pedido_id_pedido, data_devolucao, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa)
VALUES
(1, '2026-09-10', '33333333333', '92929292929'),
(3, '2026-09-12', '12387980903', '55555555555'),
(4, '2026-09-13', '12345678910', '88888888888'),
(5, '2026-09-14', '99999999999', '12381980903'),
(6, '2026-09-15', '10101010101', '92929292929');


-- Produtos associados às devoluções.
-- Os IDs de devolução 1 a 5 correspondem à ordem dos INSERTs acima.
INSERT INTO devolucao_has_produto
(devolucao_id_devolucao, produto_id_produto, quantidade, preco_unitario)
VALUES
(1, 1, 2, 13.00),
(2, 19, 1, 189.00),
(3, 7, 10, 2.00),
(4, 15, 1, 80.00),
(5, 6, 3, 2.00);


-- Atualiza a sequence do pedido após os novos INSERTs.
SELECT setval(
    pg_get_serial_sequence('public.pedido', 'id_pedido'),
    COALESCE(MAX(id_pedido), 0),
    true
)
FROM public.pedido;

COMMIT;
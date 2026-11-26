-- Migração para bancos JÁ EXISTENTES (banco novo: use DW_proj_4B.sql).
-- Passa a valer o controle de acesso por cargo: o funcionário só entra nos módulos
-- marcados para o cargo dele (tabela cargo_has_tabela, configurada na tela Cargos).
BEGIN;

-- Garante que os 10 módulos existam (não altera os que já existem).
INSERT INTO tabelas_card_menu (id_tabela, nome_tabela) VALUES
(1, 'pedidos'), (2, 'cargos'), (3, 'pessoas'), (4, 'clientes'), (5, 'funcionarios'),
(6, 'formas_pagamento'), (7, 'categorias'), (8, 'unidade_medida'), (9, 'produtos'), (10, 'devolucoes')
ON CONFLICT (id_tabela) DO NOTHING;

-- Evita ficar sem ninguém para administrar: se Gerente/Diretor ainda NÃO têm nenhuma permissão
-- marcada, libera todos os módulos para eles. Cargos que já têm permissões não são alterados.
INSERT INTO cargo_has_tabela (id_cargo, id_tabela)
SELECT c.id_cargo, t.id_tabela
FROM cargo c
CROSS JOIN tabelas_card_menu t
WHERE c.nome_cargo IN ('Gerente', 'Diretor')
  AND NOT EXISTS (SELECT 1 FROM cargo_has_tabela x WHERE x.id_cargo = c.id_cargo);

COMMIT;

-- Conferir quem acessa o quê:
-- SELECT c.nome_cargo, string_agg(t.nome_tabela, ', ' ORDER BY t.id_tabela) AS modulos
-- FROM cargo c
-- LEFT JOIN cargo_has_tabela ct ON ct.id_cargo = c.id_cargo
-- LEFT JOIN tabelas_card_menu t ON t.id_tabela = ct.id_tabela
-- GROUP BY c.id_cargo, c.nome_cargo ORDER BY c.id_cargo;

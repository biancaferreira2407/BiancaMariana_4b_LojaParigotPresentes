-- Migração para bancos JÁ EXISTENTES (banco novo: use DW_proj_4B.sql).
BEGIN;

-- Telefone/WhatsApp do cliente (com DDD, só dígitos ou formatado).
ALTER TABLE pessoa ADD COLUMN IF NOT EXISTS telefone_pessoa VARCHAR(20);

-- Padroniza telefones já salvos (só dígitos) e impede formatos inválidos daqui para frente.
UPDATE pessoa SET telefone_pessoa = NULLIF(regexp_replace(telefone_pessoa, '\D', '', 'g'), '')
WHERE telefone_pessoa IS NOT NULL;
UPDATE pessoa SET telefone_pessoa = NULL
WHERE telefone_pessoa IS NOT NULL AND telefone_pessoa !~ '^[1-9][1-9][0-9]{8,9}$';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_pessoa_telefone') THEN
        ALTER TABLE pessoa ADD CONSTRAINT ck_pessoa_telefone
            CHECK (telefone_pessoa IS NULL OR telefone_pessoa ~ '^[1-9][1-9][0-9]{8,9}$');
    END IF;
END $$;

-- O status "Entregando" foi substituído por "Pedido pronto".
UPDATE pedido SET status_pedido = 'Pedido pronto' WHERE status_pedido = 'Entregando';

COMMIT;

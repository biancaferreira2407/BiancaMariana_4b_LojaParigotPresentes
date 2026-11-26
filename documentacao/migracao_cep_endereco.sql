-- Execute uma única vez em bancos já existentes.
ALTER TABLE pessoa ADD COLUMN IF NOT EXISTS cep_pessoa VARCHAR(8);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_pessoa_cep') THEN
        ALTER TABLE pessoa ADD CONSTRAINT ck_pessoa_cep
            CHECK (cep_pessoa IS NULL OR cep_pessoa ~ '^[0-9]{8}$');
    END IF;
END $$;

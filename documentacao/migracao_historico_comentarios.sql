-- Execute uma única vez no banco parigot_presentes já existente.

CREATE TABLE IF NOT EXISTS public.historico_movimentacao (
    id_historico BIGSERIAL PRIMARY KEY,
    cpf_pessoa VARCHAR(20),
    descricao VARCHAR(500) NOT NULL,
    metodo VARCHAR(10) NOT NULL,
    rota VARCHAR(250) NOT NULL,
    data_hora TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_historico_data_hora
    ON public.historico_movimentacao (data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_historico_cpf
    ON public.historico_movimentacao (cpf_pessoa);

CREATE TABLE IF NOT EXISTS public.comentarios (
    id_comentario BIGSERIAL PRIMARY KEY,
    cpf_comentador VARCHAR(20) NOT NULL,
    id_produto INTEGER NOT NULL,
    avaliacao SMALLINT NOT NULL CHECK (avaliacao BETWEEN 1 AND 5),
    texto_comentario TEXT NOT NULL CHECK (length(trim(texto_comentario)) BETWEEN 1 AND 1500),
    data_comentario TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comentario_pessoa FOREIGN KEY (cpf_comentador)
        REFERENCES public.pessoa(cpf_pessoa) ON DELETE CASCADE,
    CONSTRAINT fk_comentario_produto FOREIGN KEY (id_produto)
        REFERENCES public.produto(id_produto) ON DELETE CASCADE,
    CONSTRAINT uq_comentario_cliente_produto UNIQUE (cpf_comentador, id_produto)
);
CREATE INDEX IF NOT EXISTS idx_comentarios_produto
    ON public.comentarios (id_produto);

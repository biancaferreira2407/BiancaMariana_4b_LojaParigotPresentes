const { pool } = require('../database');

// Cria a tabela de notificações se ela ainda não existir (bancos já em uso não
// precisam rodar nenhum script). Chamada uma vez na inicialização do servidor.
exports.garantirTabela = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS public.notificacao_admin (
            id_notificacao SERIAL PRIMARY KEY,
            pedido_id_pedido INTEGER NOT NULL REFERENCES public.pedido(id_pedido),
            tipo VARCHAR(40) NOT NULL DEFAULT 'pagamento_a_verificar',
            criada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            lida BOOLEAN NOT NULL DEFAULT FALSE,
            lida_em TIMESTAMP
        )
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS ux_notificacao_pedido_tipo
        ON public.notificacao_admin (pedido_id_pedido, tipo)
    `);
};

// Lista as notificações (mais recentes primeiro) já com tudo o que o admin precisa
// conferir: produtos, embrulhos e as formas de pagamento com o valor de cada uma.
exports.listar = async (req, res) => {
    try {
        const somenteNaoLidas = req.query.somente_nao_lidas === '1';
        const result = await pool.query(`
            SELECT
                n.id_notificacao,
                n.tipo,
                n.criada_em,
                n.lida,
                p.id_pedido,
                p.data_pedido,
                p.entrega_ou_retirada,
                p.endereco_entrega,
                p.status_pedido,
                pg.status_pagamento,
                pg.subtotal_produtos,
                pg.taxa_entrega,
                pg.taxa_embrulho,
                pg.juros_total,
                pg.valor_total_pagamento AS valor_total,
                pc.nome_pessoa AS nome_cliente,
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'nome_produto', pr.nome_produto,
                        'quantidade', php.quantidade,
                        'preco_unitario', php.preco_unitario,
                        'embrulhar', (php.embrulhar = 'sim')
                    ) ORDER BY pr.nome_produto)
                    FROM public.pedido_has_produto php
                    INNER JOIN public.produto pr ON pr.id_produto = php.produto_id_produto
                    WHERE php.pedido_id_pedido = p.id_pedido
                ), '[]'::json) AS produtos,
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'forma', fp.nome_forma_pagamento,
                        'valor_a_pagar', COALESCE(phfp.valor_previsto, phfp.valor_pago),
                        'valor_principal', phfp.valor_principal,
                        'percentual_juros', phfp.percentual_juros,
                        'valor_juros', phfp.valor_juros,
                        'parcelas', phfp.parcelas,
                        'precisa_troco', phfp.precisa_troco,
                        'valor_troco', phfp.valor_troco
                    ) ORDER BY fp.nome_forma_pagamento)
                    FROM public.pagamento_has_forma_pagamento phfp
                    INNER JOIN public.forma_pagamento fp
                        ON fp.id_forma_pagamento = phfp.forma_pagamento_id_forma_pagamento
                    WHERE phfp.pagamento_id_pedido = p.id_pedido
                ), '[]'::json) AS pagamentos
            FROM public.notificacao_admin n
            INNER JOIN public.pedido p ON p.id_pedido = n.pedido_id_pedido
            LEFT JOIN public.pagamento pg ON pg.pedido_id_pedido = p.id_pedido
            LEFT JOIN public.pessoa pc ON pc.cpf_pessoa = p.cliente_pessoa_cpf_pessoa
            ${somenteNaoLidas ? 'WHERE n.lida = FALSE' : ''}
            ORDER BY n.criada_em DESC, n.id_notificacao DESC
            LIMIT 100
        `);
        const naoLidas = await pool.query('SELECT COUNT(*)::int AS total FROM public.notificacao_admin WHERE lida = FALSE');
        res.json({ sucesso: true, nao_lidas: naoLidas.rows[0].total, notificacoes: result.rows });
    } catch (error) {
        console.error('Erro ao listar notificações:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar as notificações.' });
    }
};

exports.contarNaoLidas = async (req, res) => {
    try {
        const r = await pool.query('SELECT COUNT(*)::int AS total, COALESCE(MAX(id_notificacao), 0) AS ultimo_id FROM public.notificacao_admin WHERE lida = FALSE');
        res.json({ sucesso: true, nao_lidas: r.rows[0].total, ultimo_id: Number(r.rows[0].ultimo_id) });
    } catch (error) {
        console.error('Erro ao contar notificações:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao consultar as notificações.' });
    }
};

exports.marcarLida = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID da notificação inválido.' });
    }
    try {
        const r = await pool.query(
            'UPDATE public.notificacao_admin SET lida = TRUE, lida_em = CURRENT_TIMESTAMP WHERE id_notificacao = $1 AND lida = FALSE',
            [id]
        );
        res.json({ sucesso: true, atualizadas: r.rowCount });
    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível marcar como lida.' });
    }
};

exports.marcarTodasLidas = async (req, res) => {
    try {
        const r = await pool.query('UPDATE public.notificacao_admin SET lida = TRUE, lida_em = CURRENT_TIMESTAMP WHERE lida = FALSE');
        res.json({ sucesso: true, atualizadas: r.rowCount });
    } catch (error) {
        console.error('Erro ao marcar notificações como lidas:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível marcar como lidas.' });
    }
};

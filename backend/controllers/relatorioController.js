const { query } = require('../database');

exports.listarHistorico = async (req, res) => {
    try {
        const limite = Math.min(Math.max(Number(req.query.limite) || 200, 1), 500);
        const resultado = await query(
            `SELECT h.id_historico, h.data_hora, h.descricao, h.metodo, h.rota,
                    h.cpf_pessoa, COALESCE(p.nome_pessoa, 'Pessoa não encontrada') AS nome_pessoa
               FROM public.historico_movimentacao h
               LEFT JOIN public.pessoa p ON p.cpf_pessoa = h.cpf_pessoa
              ORDER BY h.data_hora DESC, h.id_historico DESC
              LIMIT $1`, [limite]
        );
        res.json({ sucesso: true, movimentacoes: resultado.rows });
    } catch (erro) {
        console.error('Erro ao listar histórico:', erro);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar o histórico.' });
    }
};

exports.rankingProdutos = async (req, res) => {
    try {
        const resultado = await query(
            `SELECT pr.id_produto, pr.nome_produto,
                    COALESCE(SUM(pp.quantidade) FILTER (WHERE LOWER(COALESCE(pg.status_pagamento, pe.status_pagamento, '')) = 'confirmado'
                        AND NOT EXISTS (SELECT 1 FROM public.devolucoes d WHERE d.pedido_id_pedido = pe.id_pedido)), 0)::integer AS quantidade_vendida,
                    COUNT(DISTINCT pe.id_pedido) FILTER (WHERE LOWER(COALESCE(pg.status_pagamento, pe.status_pagamento, '')) = 'confirmado'
                        AND NOT EXISTS (SELECT 1 FROM public.devolucoes d WHERE d.pedido_id_pedido = pe.id_pedido))::integer AS quantidade_pedidos,
                    COALESCE(SUM(pp.quantidade * pp.preco_unitario) FILTER (WHERE LOWER(COALESCE(pg.status_pagamento, pe.status_pagamento, '')) = 'confirmado'
                        AND NOT EXISTS (SELECT 1 FROM public.devolucoes d WHERE d.pedido_id_pedido = pe.id_pedido)), 0)::numeric(12,2) AS total_vendido
               FROM public.produto pr
               LEFT JOIN public.pedido_has_produto pp ON pp.produto_id_produto = pr.id_produto
               LEFT JOIN public.pedido pe ON pe.id_pedido = pp.pedido_id_pedido
               LEFT JOIN public.pagamento pg ON pg.pedido_id_pedido = pe.id_pedido
              GROUP BY pr.id_produto, pr.nome_produto
              ORDER BY quantidade_vendida DESC, total_vendido DESC, pr.nome_produto ASC
              LIMIT 50`
        );
        res.json({ sucesso: true, ranking: resultado.rows });
    } catch (erro) {
        console.error('Erro ao gerar ranking:', erro);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível gerar o ranking de produtos.' });
    }
};

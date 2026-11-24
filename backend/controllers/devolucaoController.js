const { pool } = require('../database');

// Motivos aceitos. Somente "Pessoal" devolve o produto ao estoque
// (no caso de "Defeito" o item não pode ser revendido).
const MOTIVOS = { pessoal: 'Pessoal', defeito: 'Defeito' };
const normalizarMotivo = valor => MOTIVOS[String(valor || '').trim().toLowerCase()] || null;
const voltaAoEstoque = motivo => String(motivo || '').trim().toLowerCase() === 'pessoal';

exports.listarDevolucoes = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.id_devolucao, d.pedido_id_pedido, d.data_devolucao,
                   d.motivo_devolucao, pc.nome_pessoa AS nome_cliente,
                   pf.nome_pessoa AS nome_funcionario,
                   COALESCE(SUM(dhp.quantidade * dhp.preco_unitario), 0) AS valor_total
            FROM public.devolucoes d
            LEFT JOIN public.pessoa pc ON pc.cpf_pessoa = d.cliente_pessoa_cpf_pessoa
            LEFT JOIN public.pessoa pf ON pf.cpf_pessoa = d.funcionario_pessoa_cpf_pessoa
            LEFT JOIN public.devolucao_has_produto dhp ON dhp.devolucao_id_devolucao = d.id_devolucao
            GROUP BY d.id_devolucao, pc.nome_pessoa, pf.nome_pessoa
            ORDER BY d.id_devolucao DESC
        `);
        res.json({ sucesso: true, devolucoes: result.rows });
    } catch (error) {
        console.error('Erro ao listar devoluções:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar devoluções.' });
    }
};

exports.listarPedidosDisponiveis = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.id_pedido, p.data_pedido, pc.nome_pessoa AS nome_cliente,
                   p.cliente_pessoa_cpf_pessoa, p.funcionario_pessoa_cpf_pessoa
            FROM public.pedido p
            LEFT JOIN public.pessoa pc ON pc.cpf_pessoa = p.cliente_pessoa_cpf_pessoa
            LEFT JOIN public.devolucoes d ON d.pedido_id_pedido = p.id_pedido
            WHERE d.id_devolucao IS NULL
            ORDER BY p.id_pedido DESC
        `);
        res.json({ sucesso: true, pedidos: result.rows });
    } catch (error) {
        console.error('Erro ao listar pedidos disponíveis:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao carregar pedidos.' });
    }
};

exports.obterDevolucao = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
    try {
        const cabecalho = await pool.query(`
            SELECT d.*, pc.nome_pessoa AS nome_cliente, pf.nome_pessoa AS nome_funcionario
            FROM public.devolucoes d
            LEFT JOIN public.pessoa pc ON pc.cpf_pessoa = d.cliente_pessoa_cpf_pessoa
            LEFT JOIN public.pessoa pf ON pf.cpf_pessoa = d.funcionario_pessoa_cpf_pessoa
            WHERE d.id_devolucao = $1
        `, [id]);
        if (!cabecalho.rowCount) return res.status(404).json({ sucesso: false, mensagem: 'Devolução não encontrada.' });
        const produtos = await pool.query(`
            SELECT pr.id_produto, pr.nome_produto, dhp.quantidade, dhp.preco_unitario
            FROM public.devolucao_has_produto dhp
            JOIN public.produto pr ON pr.id_produto = dhp.produto_id_produto
            WHERE dhp.devolucao_id_devolucao = $1 ORDER BY pr.nome_produto
        `, [id]);
        res.json({ sucesso: true, devolucao: { ...cabecalho.rows[0], produtos: produtos.rows } });
    } catch (error) {
        console.error('Erro ao obter devolução:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao consultar devolução.' });
    }
};

exports.criarDevolucao = async (req, res) => {
    const { pedido_id_pedido, data_devolucao, produtos } = req.body;
    const motivo_devolucao = normalizarMotivo(req.body.motivo_devolucao);
    const pedidoId = Number(pedido_id_pedido);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(data_devolucao || '')) || !motivo_devolucao)
        return res.status(400).json({ sucesso: false, mensagem: 'Informe o pedido, a data e o motivo da devolução (Pessoal ou Defeito).' });
    if (!Array.isArray(produtos) || produtos.length === 0)
        return res.status(400).json({ sucesso: false, mensagem: 'Selecione pelo menos um produto para devolver.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pedido = await client.query(`SELECT * FROM public.pedido WHERE id_pedido = $1 FOR UPDATE`, [pedidoId]);

        if (!pedido.rowCount) throw new Error('Pedido não encontrado.');

        const jaDevolvido = await client.query('SELECT 1 FROM public.devolucoes WHERE pedido_id_pedido = $1', [pedidoId]);
        if (jaDevolvido.rowCount) throw new Error('Este pedido já possui uma devolução cadastrada.');

        const devolucaoResult = await client.query(`
            INSERT INTO public.devolucoes
                (pedido_id_pedido, data_devolucao, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, motivo_devolucao)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `, [pedidoId, data_devolucao, pedido.rows[0].cliente_pessoa_cpf_pessoa, pedido.rows[0].funcionario_pessoa_cpf_pessoa, motivo_devolucao]);

        const devolucao = devolucaoResult.rows[0];
        const ids = new Set();
        for (const item of produtos) {
            const produtoId = Number(item.produto_id_produto);
            const quantidade = Number(item.quantidade);
            if (!Number.isInteger(produtoId) || !Number.isInteger(quantidade) || quantidade <= 0 || ids.has(produtoId)) throw new Error('Produto ou quantidade inválida.');
            ids.add(produtoId);
            const vendido = await client.query(`
                SELECT quantidade, preco_unitario FROM public.pedido_has_produto
                WHERE pedido_id_pedido = $1 AND produto_id_produto = $2
            `, [pedidoId, produtoId]);

            if (!vendido.rowCount) throw new Error(`O produto ${produtoId} não pertence ao pedido selecionado.`);

            if (quantidade > Number(vendido.rows[0].quantidade)) throw new Error('A quantidade devolvida não pode ser maior que a quantidade comprada.');

            await client.query(
                `INSERT INTO public.devolucao_has_produto 
                (devolucao_id_devolucao, produto_id_produto, quantidade, preco_unitario) 
                VALUES ($1, $2, $3, $4)`, [devolucao.id_devolucao, produtoId, quantidade, vendido.rows[0].preco_unitario]
            );

            if (voltaAoEstoque(motivo_devolucao)) {
                await client.query(
                    `UPDATE public.produto
                    SET quantidade_estoque_produto = quantidade_estoque_produto + $1
                    WHERE id_produto = $2`,
                    [quantidade, produtoId]
                );
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ sucesso: true, mensagem: 'Devolução cadastrada com sucesso!', devolucao });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao criar devolução:', error);
        res.status(400).json({ sucesso: false, mensagem: error.message || 'Não foi possível cadastrar a devolução.' });
    } finally { client.release(); }
};

exports.atualizarDevolucao = async (req, res) => {
    const id = Number(req.params.id);
    const { data_devolucao } = req.body;
    const motivo = normalizarMotivo(req.body.motivo_devolucao);
    if (!Number.isInteger(id) || id <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(data_devolucao || '')) || !motivo)
        return res.status(400).json({ sucesso: false, mensagem: 'Informe uma data e um motivo válidos (Pessoal ou Defeito).' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const atual = await client.query('SELECT motivo_devolucao FROM public.devolucoes WHERE id_devolucao = $1 FOR UPDATE', [id]);
        if (!atual.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ sucesso: false, mensagem: 'Devolução não encontrada.' });
        }

        // Se o motivo passou a (ou deixou de) devolver ao estoque, o estoque é ajustado.
        const antes = voltaAoEstoque(atual.rows[0].motivo_devolucao);
        const depois = voltaAoEstoque(motivo);
        if (antes !== depois) {
            const sinal = depois ? 1 : -1;
            await client.query(`
                UPDATE public.produto pr
                SET quantidade_estoque_produto = GREATEST(0, pr.quantidade_estoque_produto + $2 * dhp.quantidade)
                FROM public.devolucao_has_produto dhp
                WHERE dhp.devolucao_id_devolucao = $1 AND dhp.produto_id_produto = pr.id_produto
            `, [id, sinal]);
        }

        const result = await client.query('UPDATE public.devolucoes SET data_devolucao = $1, motivo_devolucao = $2 WHERE id_devolucao = $3 RETURNING *', [data_devolucao, motivo, id]);
        await client.query('COMMIT');
        res.json({ sucesso: true, mensagem: 'Devolução atualizada com sucesso!', devolucao: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao atualizar devolução:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar devolução.' });
    } finally { client.release(); }
};

exports.excluirDevolucao = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ sucesso: false, mensagem: 'ID inválido.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const devolucao = await client.query('SELECT motivo_devolucao FROM public.devolucoes WHERE id_devolucao = $1 FOR UPDATE', [id]);
        if (!devolucao.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ sucesso: false, mensagem: 'Devolução não encontrada.' });
        }

        // O estoque só foi acrescido na criação quando o motivo era "Pessoal";
        // portanto só nesse caso ele é estornado (antes era estornado sempre).
        const estornaEstoque = voltaAoEstoque(devolucao.rows[0].motivo_devolucao);
        if (estornaEstoque) {
            const itens = await client.query('SELECT produto_id_produto, quantidade FROM public.devolucao_has_produto WHERE devolucao_id_devolucao = $1', [id]);
            for (const item of itens.rows) await client.query('UPDATE public.produto SET quantidade_estoque_produto = GREATEST(0, quantidade_estoque_produto - $1) WHERE id_produto = $2', [item.quantidade, item.produto_id_produto]);
        }
        await client.query('DELETE FROM public.devolucao_has_produto WHERE devolucao_id_devolucao = $1', [id]);
        await client.query('DELETE FROM public.devolucoes WHERE id_devolucao = $1', [id]);
        await client.query('COMMIT');
        res.json({ sucesso: true, mensagem: estornaEstoque ? 'Devolução excluída. O estoque dos produtos foi ajustado.' : 'Devolução excluída.' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao excluir devolução:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao excluir devolução.' });
    } finally { client.release(); }
};


exports.listarDevolucoesCliente = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                d.id_devolucao,
                d.pedido_id_pedido,
                d.data_devolucao,
                d.motivo_devolucao,
                COALESCE((
                    SELECT SUM(dhp.quantidade * dhp.preco_unitario)
                    FROM public.devolucao_has_produto dhp
                    WHERE dhp.devolucao_id_devolucao = d.id_devolucao
                ), 0) AS valor_total,
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'nome_produto', pr.nome_produto,
                        'quantidade', dhp.quantidade,
                        'preco_unitario', dhp.preco_unitario
                    ))
                    FROM public.devolucao_has_produto dhp
                    INNER JOIN public.produto pr
                        ON pr.id_produto = dhp.produto_id_produto
                    WHERE dhp.devolucao_id_devolucao = d.id_devolucao
                ), '[]'::json) AS produtos
            FROM public.devolucoes d
            WHERE d.cliente_pessoa_cpf_pessoa = $1
            ORDER BY d.id_devolucao DESC
        `, [req.usuario.cpf]);

        res.json({ sucesso: true, devolucoes: result.rows });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao carregar suas devoluções.'
        });
    }
};
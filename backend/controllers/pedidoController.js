const { pool } = require('../database');

const IDS_FORMAS = { dinheiro: 1, credito: 2, debito: 3, pix: 4 };
const JUROS_CREDITO = { 1: 0, 2: 20, 3: 30 };
const TAXA_ENTREGA_CENTAVOS = 700;
const TAXA_EMBRULHO_UNIDADE_CENTAVOS = 150;
const centavos = valor => Math.round(Number(valor || 0) * 100);
const reais = valor => Number((valor / 100).toFixed(2));

function normalizarItens(itens) {
    if (!Array.isArray(itens) || itens.length === 0) throw new Error('O carrinho está vazio ou inválido.');
    const mapa = new Map();
    for (const item of itens) {
        const id = Number(item.id_produto ?? item.produto_id_produto);
        const quantidade = Number(item.quantidade);
        if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(quantidade) || quantidade <= 0) throw new Error('Produto ou quantidade inválida.');
        const embrulhar = item.embrulhar === true || item.embrulhar === 'sim';
        if (mapa.has(id)) {
            const atual = mapa.get(id); atual.quantidade += quantidade; atual.embrulhar = atual.embrulhar || embrulhar;
        } else mapa.set(id, { id_produto: id, quantidade, embrulhar });
    }
    return [...mapa.values()];
}

async function validarPreferencias(preferencias, db, cpf, itens) {
    if (!preferencias || !['entrega', 'retirada'].includes(preferencias.recebimento)) throw new Error('Escolha entrega ou retirada.');
    let endereco = null;
    if (preferencias.recebimento === 'entrega') {
        const cadastro = await db.query('SELECT endereco_pessoa FROM public.pessoa WHERE cpf_pessoa = $1', [cpf]);
        endereco = String(cadastro.rows[0]?.endereco_pessoa || '').trim();
        if (!endereco || endereco.length < 8 || endereco.length > 300) throw new Error('Não há endereço válido cadastrado. Atualize seu endereço no cadastro antes de escolher entrega.');
    }
    const embrulhos = preferencias.embrulhos && typeof preferencias.embrulhos === 'object' ? preferencias.embrulhos : {};
    const idsValidos = new Set(itens.map(item => String(item.id_produto)));
    for (const chave of Object.keys(embrulhos)) if (!idsValidos.has(String(chave))) delete embrulhos[chave];
    return { recebimento: preferencias.recebimento, enderecoEntrega: endereco, embrulhos };
}

function calcularTaxas(preferencias, itens) {
    const unidadesEmbrulhadas = itens.reduce((total, item) => total + (item.embrulhar ? item.quantidade : 0), 0);
    const taxaEntregaCentavos = preferencias.recebimento === 'entrega' ? TAXA_ENTREGA_CENTAVOS : 0;
    const taxaEmbrulhoCentavos = unidadesEmbrulhadas * TAXA_EMBRULHO_UNIDADE_CENTAVOS;
    return { unidadesEmbrulhadas, taxa_entrega_centavos: taxaEntregaCentavos, taxa_embrulho_centavos: taxaEmbrulhoCentavos, total_base_centavos: taxaEntregaCentavos + taxaEmbrulhoCentavos };
}

async function consultarProdutos(client, itens, bloquear = false) {
    const ids = itens.map(i => i.id_produto);
    const result = await client.query(
        `SELECT id_produto, nome_produto, preco_unitario_produto, quantidade_estoque_produto
         FROM public.produto WHERE id_produto = ANY($1::integer[]) ${bloquear ? 'FOR UPDATE' : ''}`, [ids]
    );
    const banco = new Map(result.rows.map(p => [Number(p.id_produto), p]));
    const validados = []; let subtotal = 0;
    for (const item of itens) {
        const produto = banco.get(item.id_produto);
        if (!produto) throw new Error(`O produto ${item.id_produto} não foi encontrado.`);
        const estoque = Number(produto.quantidade_estoque_produto || 0);
        if (item.quantidade > estoque) throw new Error(`Estoque insuficiente para "${produto.nome_produto}". Disponível: ${estoque}.`);
        const preco = centavos(produto.preco_unitario_produto);
        const parcial = preco * item.quantidade; subtotal += parcial;
        validados.push({ ...item, nome_produto: produto.nome_produto, preco_unitario_centavos: preco, subtotal_centavos: parcial, quantidade_estoque: estoque });
    }
    return { itens: validados, subtotal_centavos: subtotal };
}

function validarPagamentos(pagamentos, subtotalCentavos) {
    if (!Array.isArray(pagamentos) || pagamentos.length === 0) throw new Error('Selecione pelo menos uma forma de pagamento.');
    const usados = new Set(); let somaPrincipal = 0; let jurosTotal = 0;
    const validados = pagamentos.map(p => {
        const metodo = String(p.metodo || '').toLowerCase(); const idForma = IDS_FORMAS[metodo];
        const principal = centavos(p.valor);
        if (!idForma || !Number.isFinite(Number(p.valor)) || principal <= 0) throw new Error('Forma de pagamento ou valor inválido.');
        if (usados.has(metodo)) throw new Error('Não envie a mesma forma de pagamento mais de uma vez.');
        usados.add(metodo); somaPrincipal += principal;
        let parcelas = null, percentual = 0, juros = 0;
        if (metodo === 'credito') {
            parcelas = Number(p.parcelas);
            if (![1,2,3].includes(parcelas)) throw new Error('O cartão de crédito permite pagamento à vista, em 2 ou em 3 parcelas.');
            percentual = JUROS_CREDITO[parcelas]; juros = Math.round(principal * percentual / 100); jurosTotal += juros;
        }
        let precisaTroco = false, valorTroco = null;
        if (metodo === 'dinheiro' && p.precisaTroco) {
            precisaTroco = true; valorTroco = centavos(p.valorTroco);
            if (!Number.isFinite(Number(p.valorTroco)) || valorTroco <= principal) throw new Error('O valor informado para troco deve ser maior que a parte paga em dinheiro.');
        }
        return { metodo, id_forma: idForma, principal_centavos: principal, percentual_juros: percentual, juros_centavos: juros, total_centavos: principal + juros, parcelas, precisa_troco: precisaTroco, valor_troco_centavos: valorTroco };
    });
    if (somaPrincipal !== subtotalCentavos) throw new Error(`A soma das partes destinadas às formas de pagamento deve ser igual ao subtotal da compra com as taxas (${reais(subtotalCentavos).toFixed(2)}).`);
    return { pagamentos: validados, juros_total_centavos: jurosTotal, total_centavos: subtotalCentavos + jurosTotal };
}

exports.obterEnderecoCliente = async (req, res) => {
    try {
        const result = await pool.query('SELECT endereco_pessoa FROM public.pessoa WHERE cpf_pessoa = $1', [req.usuario.cpf]);
        if (!result.rowCount) return res.status(404).json({ sucesso: false, mensagem: 'Cadastro de pessoa não encontrado.' });
        return res.json({ sucesso: true, endereco: result.rows[0].endereco_pessoa || '' });
    } catch (error) { console.error('Erro ao consultar endereço:', error); return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível consultar o endereço cadastrado.' }); }
};

exports.validarCarrinho = async (req, res) => {
    try {
        const itens = normalizarItens(req.body.itens || req.body.produtos);
        const dados = await consultarProdutos(pool, itens);
        return res.json({ sucesso: true, itens: dados.itens.map(i => ({ id_produto: i.id_produto, nome_produto: i.nome_produto, preco_unitario: reais(i.preco_unitario_centavos), quantidade: i.quantidade, quantidade_estoque: i.quantidade_estoque, subtotal: reais(i.subtotal_centavos) })), total: reais(dados.subtotal_centavos) });
    } catch (error) { const status = /Estoque insuficiente/.test(error.message) ? 409 : 400; return res.status(status).json({ sucesso: false, mensagem: error.message || 'Não foi possível validar o carrinho.' }); }
};

exports.validarPagamento = async (req, res) => {
    try {
        const cliente = await pool.query('SELECT 1 FROM public.cliente WHERE pessoa_cpf_pessoa = $1', [req.usuario.cpf]);
        if (!cliente.rowCount) return res.status(403).json({ sucesso: false, mensagem: 'A conta autenticada não está cadastrada como cliente.' });
        const itens = normalizarItens(req.body.itens || req.body.produtos);
        const preferencias = await validarPreferencias(req.body.preferenciasPedido, pool, req.usuario.cpf, itens);
        for (const item of itens) item.embrulhar = preferencias.embrulhos[String(item.id_produto)] === true;
        const dados = await consultarProdutos(pool, itens);
        const taxas = calcularTaxas(preferencias, itens);
        const subtotalComTaxas = dados.subtotal_centavos + taxas.total_base_centavos;
        const pagamento = validarPagamentos(req.body.pagamentos, subtotalComTaxas);
        const ids = pagamento.pagamentos.map(p => p.id_forma);
        const formas = await pool.query('SELECT id_forma_pagamento FROM public.forma_pagamento WHERE id_forma_pagamento = ANY($1::integer[])', [ids]);
        const existentes = new Set(formas.rows.map(f => Number(f.id_forma_pagamento)));
        if (ids.some(id => !existentes.has(id))) return res.status(409).json({ sucesso: false, mensagem: 'Uma das formas de pagamento selecionadas não está cadastrada.' });
        return res.json({
            sucesso: true, mensagem: 'Dados da compra validados. Nenhum pedido foi criado.',
            subtotal_produtos: reais(dados.subtotal_centavos), taxa_entrega: reais(taxas.taxa_entrega_centavos), taxa_embrulho: reais(taxas.taxa_embrulho_centavos), juros_total: reais(pagamento.juros_total_centavos), total: reais(pagamento.total_centavos),
            recebimento: preferencias.recebimento, endereco_entrega: preferencias.enderecoEntrega,
            itens: dados.itens.map(i => ({ id_produto: i.id_produto, nome_produto: i.nome_produto, quantidade: i.quantidade, preco_unitario: reais(i.preco_unitario_centavos), subtotal: reais(i.subtotal_centavos), embrulhar: i.embrulhar })),
            pagamentos: pagamento.pagamentos.map(p => ({ metodo: p.metodo, forma_pagamento_id_forma_pagamento: p.id_forma, valor: reais(p.principal_centavos), valor_principal: reais(p.principal_centavos), percentual_juros: p.percentual_juros, valor_juros: reais(p.juros_centavos), valor_total: reais(p.total_centavos), parcelas: p.parcelas, valor_troco: p.valor_troco_centavos == null ? null : reais(p.valor_troco_centavos), precisaTroco: p.precisa_troco }))
        });
    } catch (error) { console.error('Erro ao validar pagamento:', error); const status = /Estoque insuficiente/.test(error.message) ? 409 : 400; return res.status(status).json({ sucesso: false, mensagem: error.message || 'Não foi possível validar o pagamento.' }); }
};

exports.criarPedido = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cliente = await client.query('SELECT 1 FROM public.cliente WHERE pessoa_cpf_pessoa = $1', [req.usuario.cpf]);
        if (!cliente.rowCount) throw new Error('A conta autenticada não está cadastrada como cliente.');
        const itens = normalizarItens(req.body.itens || req.body.produtos);
        const preferencias = await validarPreferencias(req.body.preferenciasPedido, client, req.usuario.cpf, itens);
        for (const item of itens) item.embrulhar = preferencias.embrulhos[String(item.id_produto)] === true;
        const dados = await consultarProdutos(client, itens, true);
        const taxas = calcularTaxas(preferencias, itens);
        const subtotalComTaxas = dados.subtotal_centavos + taxas.total_base_centavos;
        const pagamento = validarPagamentos(req.body.pagamentos, subtotalComTaxas);
        const ids = pagamento.pagamentos.map(p => p.id_forma);
        const formas = await client.query('SELECT id_forma_pagamento FROM public.forma_pagamento WHERE id_forma_pagamento = ANY($1::integer[])', [ids]);
        const existentes = new Set(formas.rows.map(f => Number(f.id_forma_pagamento)));
        if (ids.some(id => !existentes.has(id))) throw new Error('Uma das formas de pagamento selecionadas não está cadastrada.');

        const pedidoResult = await client.query(
            `INSERT INTO public.pedido (data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, entrega_ou_retirada, status_pedido, endereco_entrega)
             VALUES (CURRENT_DATE, $1, NULL, $2, 'Não confirmado', $3) RETURNING *`,
            [req.usuario.cpf, preferencias.recebimento, preferencias.enderecoEntrega]
        );
        const pedido = pedidoResult.rows[0];
        for (const item of dados.itens) {
            await client.query(
                `INSERT INTO public.pedido_has_produto (produto_id_produto, pedido_id_pedido, embrulhar, quantidade, preco_unitario)
                 VALUES ($1, $2, $3, $4, $5)`,
                [item.id_produto, pedido.id_pedido, item.embrulhar ? 'sim' : 'nao', item.quantidade, reais(item.preco_unitario_centavos)]
            );
            await client.query('UPDATE public.produto SET quantidade_estoque_produto = quantidade_estoque_produto - $1 WHERE id_produto = $2', [item.quantidade, item.id_produto]);
        }
        await client.query(
            `INSERT INTO public.pagamento (pedido_id_pedido, data_pagamento, valor_total_pagamento, subtotal_produtos, taxa_entrega, taxa_embrulho, juros_total, status_pagamento)
             VALUES ($1, NULL, $2, $3, $4, $5, $6, 'Não confirmado')`,
            [pedido.id_pedido, reais(pagamento.total_centavos), reais(dados.subtotal_centavos), reais(taxas.taxa_entrega_centavos), reais(taxas.taxa_embrulho_centavos), reais(pagamento.juros_total_centavos)]
        );
        for (const p of pagamento.pagamentos) {
            await client.query(
                `INSERT INTO public.pagamento_has_forma_pagamento
                 (pagamento_id_pedido, forma_pagamento_id_forma_pagamento, valor_pago, valor_previsto, valor_principal, percentual_juros, valor_juros, parcelas, precisa_troco, valor_troco)
                 VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9)`,
                [pedido.id_pedido, p.id_forma, reais(p.total_centavos), reais(p.principal_centavos), p.percentual_juros, reais(p.juros_centavos), p.parcelas, p.precisa_troco, p.valor_troco_centavos == null ? null : reais(p.valor_troco_centavos)]
            );
        }
        await client.query('COMMIT');
        return res.status(201).json({ sucesso: true, mensagem: 'Pedido registrado com sucesso. A loja confirmará os detalhes da entrega e do pagamento.', pedido: { id_pedido: pedido.id_pedido, data_pedido: pedido.data_pedido, status_pedido: pedido.status_pedido, recebimento: preferencias.recebimento, endereco_entrega: preferencias.enderecoEntrega, subtotal: reais(dados.subtotal_centavos), taxa_entrega: reais(taxas.taxa_entrega_centavos), taxa_embrulho: reais(taxas.taxa_embrulho_centavos), juros: reais(pagamento.juros_total_centavos), total: reais(pagamento.total_centavos) } });
    } catch (error) {
        await client.query('ROLLBACK'); console.error('Erro ao criar pedido:', error);
        const status = /Estoque insuficiente/.test(error.message) ? 409 : 400;
        return res.status(status).json({ sucesso: false, mensagem: error.message || 'Não foi possível registrar o pedido.' });
    } finally { client.release(); }
};

// Pedido lançado pelo balcão (administração): informa cliente, funcionário,
// produtos e as formas de pagamento já recebidas. Os preços vêm sempre do banco.
exports.criarPedidoAdmin = async (req, res) => {
    const client = await pool.connect();
    try {
        const { data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, produtos, pagamentos } = req.body;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data_pedido || ''))) throw new Error('Informe uma data de pedido válida.');
        if (!cliente_pessoa_cpf_pessoa) throw new Error('Selecione o cliente do pedido.');
        if (!Array.isArray(pagamentos) || pagamentos.length === 0) throw new Error('Informe pelo menos uma forma de pagamento.');

        const itens = normalizarItens((produtos || []).map(p => ({ id_produto: p.produto_id_produto ?? p.id_produto, quantidade: p.quantidade })));

        await client.query('BEGIN');

        const cliente = await client.query('SELECT 1 FROM public.cliente WHERE pessoa_cpf_pessoa = $1', [cliente_pessoa_cpf_pessoa]);
        if (!cliente.rowCount) throw new Error('Cliente não encontrado.');

        if (funcionario_pessoa_cpf_pessoa) {
            const funcionario = await client.query('SELECT 1 FROM public.funcionario WHERE pessoa_cpf_pessoa = $1', [funcionario_pessoa_cpf_pessoa]);
            if (!funcionario.rowCount) throw new Error('Funcionário não encontrado.');
        }

        const dados = await consultarProdutos(client, itens, true);

        const ids = new Set();
        let somaPago = 0;
        const formas = [];
        for (const p of pagamentos) {
            const idForma = Number(p.forma_pagamento_id_forma_pagamento);
            const valor = centavos(p.valor_pago);
            if (!Number.isInteger(idForma) || idForma <= 0 || valor <= 0) throw new Error('Forma de pagamento ou valor inválido.');
            if (ids.has(idForma)) throw new Error('Não repita a mesma forma de pagamento no pedido.');
            ids.add(idForma);
            somaPago += valor;
            formas.push({ idForma, valor });
        }
        if (somaPago !== dados.subtotal_centavos) throw new Error(`O pagamento precisa totalizar ${reais(dados.subtotal_centavos).toFixed(2)}.`);

        const existentes = await client.query('SELECT id_forma_pagamento FROM public.forma_pagamento WHERE id_forma_pagamento = ANY($1::integer[])', [[...ids]]);
        if (existentes.rowCount !== ids.size) throw new Error('Uma das formas de pagamento selecionadas não está cadastrada.');

        const pedidoResult = await client.query(
            `INSERT INTO public.pedido (data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa, entrega_ou_retirada, status_pedido, endereco_entrega)
             VALUES ($1, $2, $3, 'retirada', 'Entregue', NULL) RETURNING *`,
            [data_pedido, cliente_pessoa_cpf_pessoa, funcionario_pessoa_cpf_pessoa || null]
        );
        const pedido = pedidoResult.rows[0];

        for (const item of dados.itens) {
            await client.query(
                `INSERT INTO public.pedido_has_produto (produto_id_produto, pedido_id_pedido, embrulhar, quantidade, preco_unitario)
                 VALUES ($1, $2, 'nao', $3, $4)`,
                [item.id_produto, pedido.id_pedido, item.quantidade, reais(item.preco_unitario_centavos)]
            );
            await client.query('UPDATE public.produto SET quantidade_estoque_produto = quantidade_estoque_produto - $1 WHERE id_produto = $2', [item.quantidade, item.id_produto]);
        }

        await client.query(
            `INSERT INTO public.pagamento (pedido_id_pedido, data_pagamento, valor_total_pagamento, subtotal_produtos, taxa_entrega, taxa_embrulho, juros_total, status_pagamento)
             VALUES ($1, NOW(), $2, $3, 0, 0, 0, 'Confirmado')`,
            [pedido.id_pedido, reais(dados.subtotal_centavos), reais(dados.subtotal_centavos)]
        );
        for (const f of formas) {
            await client.query(
                `INSERT INTO public.pagamento_has_forma_pagamento
                 (pagamento_id_pedido, forma_pagamento_id_forma_pagamento, valor_pago, valor_previsto, valor_principal, percentual_juros, valor_juros, parcelas, precisa_troco, valor_troco)
                 VALUES ($1, $2, $3, $4, $5, 0, 0, NULL, FALSE, NULL)`,
                [pedido.id_pedido, f.idForma, reais(f.valor), reais(f.valor), reais(f.valor)]
            );
        }

        await client.query('COMMIT');
        return res.status(201).json({ sucesso: true, mensagem: 'Pedido registrado com sucesso.', pedido: { id_pedido: pedido.id_pedido, data_pedido: pedido.data_pedido, total: reais(dados.subtotal_centavos) } });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao criar pedido (admin):', error);
        const status = /Estoque insuficiente/.test(error.message) ? 409 : 400;
        return res.status(status).json({ sucesso: false, mensagem: error.message || 'Não foi possível registrar o pedido.' });
    } finally { client.release(); }
};

exports.listarPedidos = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id_pedido,
                p.data_pedido,
                p.entrega_ou_retirada,
                p.endereco_entrega,
                p.status_pedido,
                pc.nome_pessoa AS nome_cliente,
                pc.telefone_pessoa AS telefone_cliente,
                pf.nome_pessoa AS nome_funcionario,
                pg.valor_total_pagamento AS valor_total,
                pg.subtotal_produtos,
                pg.taxa_entrega,
                pg.taxa_embrulho,
                pg.juros_total,
                pg.status_pagamento
            FROM public.pedido p
            LEFT JOIN public.pessoa pc
                ON pc.cpf_pessoa = p.cliente_pessoa_cpf_pessoa
            LEFT JOIN public.pessoa pf
                ON pf.cpf_pessoa = p.funcionario_pessoa_cpf_pessoa
            LEFT JOIN public.pagamento pg
                ON pg.pedido_id_pedido = p.id_pedido
            ORDER BY p.id_pedido DESC
        `);

        res.json({ sucesso: true, pedidos: result.rows });
    } catch (error) {
        console.error('Erro ao listar pedidos:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar pedidos.' });
    }
};

exports.obterPedido = async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do pedido inválido.' });
    }

    try {
        const pedidoResult = await pool.query(`
            SELECT
                p.id_pedido,
                p.data_pedido,
                p.entrega_ou_retirada,
                p.endereco_entrega,
                p.status_pedido,
                pc.nome_pessoa AS nome_cliente,
                pc.telefone_pessoa AS telefone_cliente,
                pf.nome_pessoa AS nome_funcionario,
                pg.valor_total_pagamento AS valor_total,
                pg.subtotal_produtos,
                pg.taxa_entrega,
                pg.taxa_embrulho,
                pg.juros_total,
                pg.status_pagamento
            FROM public.pedido p
            LEFT JOIN public.pessoa pc
                ON pc.cpf_pessoa = p.cliente_pessoa_cpf_pessoa
            LEFT JOIN public.pessoa pf
                ON pf.cpf_pessoa = p.funcionario_pessoa_cpf_pessoa
            LEFT JOIN public.pagamento pg
                ON pg.pedido_id_pedido = p.id_pedido
            WHERE p.id_pedido = $1
        `, [id]);

        if (pedidoResult.rowCount === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }

        const produtosResult = await pool.query(`
            SELECT
                pr.id_produto,
                pr.nome_produto,
                php.quantidade,
                php.preco_unitario,
                php.embrulhar
            FROM public.pedido_has_produto php
            INNER JOIN public.produto pr
                ON pr.id_produto = php.produto_id_produto
            WHERE php.pedido_id_pedido = $1
            ORDER BY pr.nome_produto
        `, [id]);

        const pagamentosResult = await pool.query(`
            SELECT
                fp.nome_forma_pagamento,
                COALESCE(phfp.valor_previsto, phfp.valor_pago) AS valor_previsto,
                COALESCE(phfp.valor_pago, phfp.valor_previsto) AS valor_pago,
                phfp.valor_principal,
                phfp.percentual_juros,
                phfp.valor_juros,
                phfp.parcelas
            FROM public.pagamento_has_forma_pagamento phfp
            INNER JOIN public.forma_pagamento fp
                ON fp.id_forma_pagamento = phfp.forma_pagamento_id_forma_pagamento
            WHERE phfp.pagamento_id_pedido = $1
            ORDER BY fp.nome_forma_pagamento
        `, [id]);

        const totalPago = pagamentosResult.rows.reduce(
            (total, pagamento) => total + Number(pagamento.valor_previsto || 0),
            0
        );

        res.json({
            sucesso: true,
            pedido: {
                ...pedidoResult.rows[0],
                produtos: produtosResult.rows,
                pagamentos: pagamentosResult.rows,
                total_previsto: Math.round(totalPago * 100) / 100,
                total_pago: Math.round(totalPago * 100) / 100
            }
        });
    } catch (error) {
        console.error('Erro ao obter pedido:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao obter detalhes do pedido.' });
    }
};


exports.listarPedidosCliente = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id_pedido,
                p.data_pedido,
                pg.valor_total_pagamento AS valor_total,
                pg.subtotal_produtos,
                pg.taxa_entrega,
                pg.taxa_embrulho,
                pg.juros_total,
                p.entrega_ou_retirada,
                p.endereco_entrega,
                p.status_pedido,
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'nome_produto', pr.nome_produto,
                        'quantidade', php.quantidade,
                        'preco_unitario', php.preco_unitario,
                        'embrulhar', php.embrulhar
                    ))
                    FROM public.pedido_has_produto php
                    INNER JOIN public.produto pr
                        ON pr.id_produto = php.produto_id_produto
                    WHERE php.pedido_id_pedido = p.id_pedido
                ), '[]'::json) AS produtos
            FROM public.pedido p
            LEFT JOIN public.pagamento pg
                ON pg.pedido_id_pedido = p.id_pedido
            WHERE p.cliente_pessoa_cpf_pessoa = $1
            ORDER BY p.id_pedido DESC
        `, [req.usuario.cpf]);

        res.json({ sucesso: true, pedidos: result.rows });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao carregar seus pedidos.'
        });
    }
};

// O cliente informa que fez o pagamento ("Concluir pedido"). Gera a notificação
// para a administração conferir. O pedido e o pagamento continuam "Não confirmado".
exports.avisarPagamento = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do pedido inválido.' });
    }
    try {
        const pedido = await pool.query(
            `SELECT p.id_pedido, pg.status_pagamento
             FROM public.pedido p
             LEFT JOIN public.pagamento pg ON pg.pedido_id_pedido = p.id_pedido
             WHERE p.id_pedido = $1 AND p.cliente_pessoa_cpf_pessoa = $2`,
            [id, req.usuario.cpf]
        );
        if (!pedido.rowCount) {
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }
        if (pedido.rows[0].status_pagamento !== 'Não confirmado') {
            return res.json({ sucesso: true, mensagem: 'Este pagamento já foi analisado pela loja.' });
        }
        // Índice único (pedido, tipo): avisar duas vezes não duplica a notificação.
        await pool.query(
            `INSERT INTO public.notificacao_admin (pedido_id_pedido, tipo)
             VALUES ($1, 'pagamento_a_verificar')
             ON CONFLICT (pedido_id_pedido, tipo) DO NOTHING`,
            [id]
        );
        return res.json({ sucesso: true, mensagem: 'A loja foi avisada e vai conferir o seu pagamento.' });
    } catch (error) {
        console.error('Erro ao avisar pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível avisar a loja. Tente novamente.' });
    }
};

const STATUS_PAGAMENTO_CONFIRMADO = ['Confirmado', 'Pago']; // "Pago" = pedidos antigos do balcão
const STATUS_PEDIDO_PERMITIDOS = ['Em andamento', 'Pedido pronto', 'Entregue'];

// Admin confirma que conferiu o pagamento. O pagamento vira "Confirmado" e o pedido
// passa a "Em andamento" (a partir daí o admin escolhe: Pedido pronto / Entregue).
exports.confirmarPagamento = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do pedido inválido.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const atual = await client.query(
            `SELECT pg.status_pagamento
             FROM public.pedido p
             INNER JOIN public.pagamento pg ON pg.pedido_id_pedido = p.id_pedido
             WHERE p.id_pedido = $1 FOR UPDATE OF pg, p`, [id]
        );
        if (!atual.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }
        if (STATUS_PAGAMENTO_CONFIRMADO.includes(atual.rows[0].status_pagamento)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ sucesso: false, mensagem: 'O pagamento deste pedido já está confirmado.' });
        }
        await client.query(`UPDATE public.pagamento SET status_pagamento = 'Confirmado', data_pagamento = NOW() WHERE pedido_id_pedido = $1`, [id]);
        // O que estava "previsto" passa a ser o valor efetivamente pago.
        await client.query(
            `UPDATE public.pagamento_has_forma_pagamento
             SET valor_pago = valor_previsto
             WHERE pagamento_id_pedido = $1 AND valor_pago IS NULL`, [id]
        );
        // Registra quem confirmou (se o admin logado for funcionário) sem apagar um funcionário já gravado.
        await client.query(
            `UPDATE public.pedido
             SET status_pedido = 'Em andamento',
                 funcionario_pessoa_cpf_pessoa = COALESCE(
                     (SELECT pessoa_cpf_pessoa FROM public.funcionario WHERE pessoa_cpf_pessoa = $2),
                     funcionario_pessoa_cpf_pessoa)
             WHERE id_pedido = $1`, [id, req.usuario.cpf]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao confirmar pagamento:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível confirmar o pagamento.' });
    } finally { client.release(); }

    // A notificação deste pedido já foi tratada: marca como lida (não impede a confirmação se falhar).
    try {
        await pool.query(`UPDATE public.notificacao_admin SET lida = TRUE, lida_em = CURRENT_TIMESTAMP WHERE pedido_id_pedido = $1 AND lida = FALSE`, [id]);
    } catch (error) { console.error('Aviso: não foi possível marcar a notificação como lida:', error.message); }

    return res.json({ sucesso: true, mensagem: 'Pagamento confirmado. O pedido está em andamento.' });
};

// Admin altera o andamento do pedido (somente com o pagamento confirmado).
exports.atualizarStatusPedido = async (req, res) => {
    const id = Number(req.params.id);
    const status = String(req.body.status_pedido || '').trim();
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do pedido inválido.' });
    }
    if (!STATUS_PEDIDO_PERMITIDOS.includes(status)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Status inválido. Use: Em andamento, Pedido pronto ou Entregue.' });
    }
    try {
        const atual = await pool.query(
            `SELECT pg.status_pagamento
             FROM public.pedido p
             LEFT JOIN public.pagamento pg ON pg.pedido_id_pedido = p.id_pedido
             WHERE p.id_pedido = $1`, [id]
        );
        if (!atual.rowCount) return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        if (!STATUS_PAGAMENTO_CONFIRMADO.includes(atual.rows[0].status_pagamento)) {
            return res.status(409).json({ sucesso: false, mensagem: 'Confirme o pagamento antes de alterar o status do pedido.' });
        }
        await pool.query('UPDATE public.pedido SET status_pedido = $1 WHERE id_pedido = $2', [status, id]);
        return res.json({ sucesso: true, mensagem: `Pedido #${id} marcado como "${status}".`, status_pedido: status });
    } catch (error) {
        console.error('Erro ao atualizar status do pedido:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o status do pedido.' });
    }
};

// Admin desfaz uma confirmação feita por engano: pagamento e pedido voltam a "Não confirmado".
// Não permite desfazer pedido já "Entregue" (primeiro volte o status para Pedido pronto/Em andamento).
exports.desfazerConfirmacaoPagamento = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'ID do pedido inválido.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const atual = await client.query(
            `SELECT pg.status_pagamento, p.status_pedido
             FROM public.pedido p
             INNER JOIN public.pagamento pg ON pg.pedido_id_pedido = p.id_pedido
             WHERE p.id_pedido = $1 FOR UPDATE OF pg, p`, [id]
        );
        if (!atual.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
        }
        const { status_pagamento, status_pedido } = atual.rows[0];
        if (!STATUS_PAGAMENTO_CONFIRMADO.includes(status_pagamento)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ sucesso: false, mensagem: 'O pagamento deste pedido não está confirmado.' });
        }
        const entregue = ['entregue', 'concluido', 'concluído'].includes(String(status_pedido || '').toLowerCase());
        if (entregue) {
            await client.query('ROLLBACK');
            return res.status(409).json({ sucesso: false, mensagem: 'Este pedido já foi entregue. Altere o status para "Pedido pronto" ou "Em andamento" antes de desfazer a confirmação.' });
        }
        await client.query(`UPDATE public.pagamento SET status_pagamento = 'Não confirmado', data_pagamento = NULL WHERE pedido_id_pedido = $1`, [id]);
        // Sem confirmação não há valor efetivamente pago (o valor previsto continua guardado).
        await client.query(`UPDATE public.pagamento_has_forma_pagamento SET valor_pago = NULL WHERE pagamento_id_pedido = $1`, [id]);
        await client.query(`UPDATE public.pedido SET status_pedido = 'Não confirmado' WHERE id_pedido = $1`, [id]);
        await client.query('COMMIT');
        return res.json({ sucesso: true, mensagem: 'Confirmação desfeita. O pedido voltou para "Pagamento não confirmado".' });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao desfazer confirmação:', error);
        return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível desfazer a confirmação.' });
    } finally { client.release(); }
};

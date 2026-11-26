const { query } = require('../database');

exports.criar = async (req, res) => {
    try {
        const idProduto = Number(req.body.id_produto);
        const avaliacao = Number(req.body.avaliacao);
        const texto = String(req.body.texto_comentario || '').trim();
        if (!Number.isInteger(idProduto) || idProduto <= 0) return res.status(400).json({ sucesso: false, mensagem: 'Produto inválido.' });
        if (!Number.isInteger(avaliacao) || avaliacao < 1 || avaliacao > 5) return res.status(400).json({ sucesso: false, mensagem: 'A avaliação deve ser de 1 a 5 estrelas.' });
        if (!texto || texto.length > 1500) return res.status(400).json({ sucesso: false, mensagem: 'Escreva um comentário de até 1.500 caracteres.' });

        const produto = await query('SELECT 1 FROM public.produto WHERE id_produto = $1', [idProduto]);
        if (!produto.rowCount) return res.status(404).json({ sucesso: false, mensagem: 'Produto não encontrado.' });

        const resultado = await query(
            `INSERT INTO public.comentarios (cpf_comentador, id_produto, avaliacao, texto_comentario)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (cpf_comentador, id_produto)
             DO UPDATE SET avaliacao = EXCLUDED.avaliacao,
                           texto_comentario = EXCLUDED.texto_comentario,
                           data_comentario = CURRENT_TIMESTAMP
             RETURNING id_comentario`,
            [req.usuario.cpf, idProduto, avaliacao, texto]
        );
        res.status(201).json({ sucesso: true, mensagem: 'Sua avaliação foi enviada para a loja.', id_comentario: resultado.rows[0].id_comentario });
    } catch (erro) {
        console.error('Erro ao salvar comentário:', erro);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível enviar sua avaliação.' });
    }
};

// Somente média e quantidade são públicas; textos e autores nunca são enviados aos clientes.
exports.avaliacoesPublicas = async (req, res) => {
    try {
        const resultado = await query(
            `SELECT id_produto, ROUND(AVG(avaliacao)::numeric, 2) AS media_avaliacao,
                    COUNT(*)::integer AS qtd_avaliacoes
               FROM public.comentarios GROUP BY id_produto ORDER BY id_produto`
        );
        res.json({ sucesso: true, avaliacoes: resultado.rows });
    } catch (erro) {
        console.error('Erro ao consultar médias:', erro);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar as avaliações.' });
    }
};

exports.listarAdmin = async (req, res) => {
    try {
        const resultado = await query(
            `SELECT c.id_comentario, c.cpf_comentador, p.nome_pessoa,
                    c.id_produto, pr.nome_produto, c.avaliacao,
                    c.texto_comentario, c.data_comentario
               FROM public.comentarios c
               JOIN public.pessoa p ON p.cpf_pessoa = c.cpf_comentador
               JOIN public.produto pr ON pr.id_produto = c.id_produto
              ORDER BY c.data_comentario DESC, c.id_comentario DESC`
        );
        res.json({ sucesso: true, comentarios: resultado.rows });
    } catch (erro) {
        console.error('Erro ao listar comentários administrativos:', erro);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível carregar os comentários.' });
    }
};

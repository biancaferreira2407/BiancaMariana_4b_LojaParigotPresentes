const { query } = require('../database');
const jwt = require('jsonwebtoken');
const { buscarPermissoes } = require('../middlewares/authMiddleware');

exports.login = async (req, res) => {
    try {
        const { senha_pessoa, perfil } = req.body;
        const email_pessoa = String(req.body.email_pessoa || '').trim().toLowerCase();

        if (!email_pessoa || !senha_pessoa) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Preencha o e-mail e a senha.'
            });
        }

        const resultado = await query(
            `SELECT
                p.cpf_pessoa,
                p.nome_pessoa,
                p.email_pessoa,
                p.senha_pessoa,
                (c.pessoa_cpf_pessoa IS NOT NULL) AS eh_cliente,
                (f.pessoa_cpf_pessoa IS NOT NULL) AS eh_funcionario
             FROM pessoa p
             LEFT JOIN cliente c
                ON c.pessoa_cpf_pessoa = p.cpf_pessoa
             LEFT JOIN funcionario f
                ON f.pessoa_cpf_pessoa = p.cpf_pessoa
             WHERE LOWER(p.email_pessoa) = $1`,
            [email_pessoa]
        );

        if (
            resultado.rows.length === 0 ||
            resultado.rows[0].senha_pessoa !== senha_pessoa
        ) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'E-mail ou senha incorretos.'
            });
        }

        const pessoa = resultado.rows[0];

        const perfis = [];

        if (pessoa.eh_funcionario) perfis.push('admin');
        if (pessoa.eh_cliente) perfis.push('cliente');

        if (perfis.length === 0) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Usuário sem perfil de acesso.'
            });
        }

        // Se estiver nos dois cadastros, solicita a escolha.
        if (perfis.length === 2 && !perfil) {
            return res.json({
                sucesso: true,
                escolherPerfil: true,
                perfis: perfis
            });
        }

        // Se estiver em apenas um cadastro, seleciona automaticamente.
        const perfilEscolhido = perfil || perfis[0];

        if (!perfis.includes(perfilEscolhido)) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Perfil de acesso inválido.'
            });
        }

        const token = jwt.sign(
            {
                cpf: pessoa.cpf_pessoa,
                email: pessoa.email_pessoa,
                perfil: perfilEscolhido
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Funcionário: lista os módulos que o cargo dele pode acessar (cargo_has_tabela).
        const permissoes = perfilEscolhido === 'admin'
            ? await buscarPermissoes(pessoa.cpf_pessoa)
            : [];

        res.json({
            sucesso: true,
            mensagem: 'Login realizado com sucesso!',
            token: token,
            perfil: perfilEscolhido,
            permissoes: permissoes,
            cliente: {
                cpf_pessoa: pessoa.cpf_pessoa,
                nome_pessoa: pessoa.nome_pessoa,
                email_pessoa: pessoa.email_pessoa
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno do servidor.'
        });
    }
};

// Permissões atuais do funcionário logado (sempre lidas do banco).
exports.permissoes = async (req, res) => {
    try {
        const permissoes = await buscarPermissoes(req.usuario.cpf);
        res.json({ sucesso: true, permissoes });
    } catch (error) {
        console.error('Erro ao buscar permissões:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
    }
};

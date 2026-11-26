const { query } = require('../database');
const { normalizarTelefone, telefoneValido, MENSAGEM_TELEFONE } = require('../utils/telefone');
const { formatarNome, nomeValido, MENSAGEM_NOME } = require('../utils/nome');

// Retorna somente os dados da pessoa que está autenticada.
exports.obterMinhaConta = async (req, res) => {
    try {
        const cpf = req.usuario.cpf;

        if (!cpf) {
            return res.status(401).json({ sucesso: false, mensagem: 'Token sem identificação de usuário.' });
        }

        const resultado = await query(
            `SELECT p.cpf_pessoa, p.nome_pessoa, p.data_nascimento_pessoa,
                    p.endereco_pessoa, p.telefone_pessoa, p.email_pessoa
             FROM pessoa p
             INNER JOIN cliente c ON c.pessoa_cpf_pessoa = p.cpf_pessoa
             WHERE p.cpf_pessoa = $1`,
            [cpf]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Cadastro de cliente não encontrado.' });
        }

        return res.json({ sucesso: true, pessoa: resultado.rows[0] });
    } catch (erro) {
        console.error('Erro ao carregar minha conta:', erro);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao carregar os dados da conta.' });
    }
};

// Atualiza os campos permitidos somente após confirmar a senha atual.
exports.atualizarMinhaConta = async (req, res) => {
    try {
        const cpf = req.usuario.cpf;
        const { nome_pessoa, data_nascimento_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa, senha_atual } = req.body;

        if (!cpf) {
            return res.status(401).json({ sucesso: false, mensagem: 'Token sem identificação de usuário.' });
        }

        if (!senha_atual) {
            return res.status(400).json({ sucesso: false, mensagem: 'Informe sua senha atual para confirmar as alterações.' });
        }

        const nome = typeof nome_pessoa === 'string' ? formatarNome(nome_pessoa) : '';
        const email = typeof email_pessoa === 'string' ? email_pessoa.trim().toLowerCase() : '';
        const endereco = typeof endereco_pessoa === 'string' ? endereco_pessoa.trim() : '';
        const telefone = normalizarTelefone(telefone_pessoa);
        const nascimento = data_nascimento_pessoa || null;

        if (!telefoneValido(telefone)) {
            return res.status(400).json({ sucesso: false, mensagem: MENSAGEM_TELEFONE });
        }

        if (!nome || !email || !endereco) {
            return res.status(400).json({ sucesso: false, mensagem: 'Nome, e-mail, endereço e telefone são obrigatórios.' });
        }

        if (!nomeValido(nome)) {
            return res.status(400).json({ sucesso: false, mensagem: MENSAGEM_NOME });
        }

        if (nome.length > 60 || endereco.length > 150 || email.length > 75) {
            return res.status(400).json({ sucesso: false, mensagem: 'Um ou mais campos ultrapassaram o limite permitido.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ sucesso: false, mensagem: 'Informe um e-mail válido.' });
        }

        // Confere que o CPF do token pertence a um cliente e valida a senha atual.
        const pessoaAtual = await query(
            `SELECT p.senha_pessoa
             FROM pessoa p
             INNER JOIN cliente c ON c.pessoa_cpf_pessoa = p.cpf_pessoa
             WHERE p.cpf_pessoa = $1`,
            [cpf]
        );

        if (pessoaAtual.rows.length === 0) {
            return res.status(404).json({ sucesso: false, mensagem: 'Cadastro de cliente não encontrado.' });
        }

        // O projeto atual compara senhas em texto puro no login; esta validação
        // mantém compatibilidade com o cadastro existente.
        if (pessoaAtual.rows[0].senha_pessoa !== senha_atual) {
            return res.status(401).json({ sucesso: false, mensagem: 'Senha atual incorreta.' });
        }

        // O banco antigo não tinha UNIQUE no e-mail: confere aqui para não duplicar.
        const emailEmUso = await query(
            'SELECT 1 FROM pessoa WHERE LOWER(email_pessoa) = $1 AND cpf_pessoa <> $2',
            [email, cpf]
        );
        if (emailEmUso.rows.length > 0) {
            return res.status(409).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado em outra conta.' });
        }

        const resultado = await query(
            `UPDATE pessoa
             SET nome_pessoa = $1,
                 data_nascimento_pessoa = $2,
                 endereco_pessoa = $3,
                 email_pessoa = $4,
                 telefone_pessoa = $5
             WHERE cpf_pessoa = $6
             RETURNING cpf_pessoa, nome_pessoa, data_nascimento_pessoa,
                       endereco_pessoa, telefone_pessoa, email_pessoa`,
            [nome, nascimento, endereco, email, telefone, cpf]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Dados atualizados com sucesso!',
            pessoa: resultado.rows[0]
        });
    } catch (erro) {
        console.error('Erro ao atualizar minha conta:', erro);

        if (erro.code === '23505') {
            return res.status(409).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado em outra conta.' });
        }

        if (erro.code === '22007' || erro.code === '22008') {
            return res.status(400).json({ sucesso: false, mensagem: 'A data de nascimento informada é inválida.' });
        }

        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao atualizar os dados da conta.' });
    }
};

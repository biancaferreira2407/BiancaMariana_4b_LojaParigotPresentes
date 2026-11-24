
const { pool } = require('../database');

// Validar os dígitos do CPF
function validarCPF(cpf) {
    cpf = String(cpf).replace(/\D/g, '');

    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    let soma = 0;

    for (let i = 0; i < 9; i++) {
        soma += Number(cpf[i]) * (10 - i);
    }

    let digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;

    if (digito !== Number(cpf[9])) return false;

    soma = 0;

    for (let i = 0; i < 10; i++) {
        soma += Number(cpf[i]) * (11 - i);
    }

    digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;

    return digito === Number(cpf[10]);
}

// Cadastrar pessoa e cliente
exports.cadastrarCliente = async (req, res) => {
    const conexao = await pool.connect();

    try {
        const {
            cpf_pessoa,
            nome_pessoa,
            data_nascimento_pessoa,
            endereco_pessoa,
            email_pessoa,
            senha_pessoa
        } = req.body;

        const cpf = String(cpf_pessoa || '').replace(/\D/g, '');
        const nome = String(nome_pessoa || '').trim();
        const endereco = String(endereco_pessoa || '').trim();
        const email = String(email_pessoa || '').trim().toLowerCase();
        const senha = String(senha_pessoa || '');

        if (
            !cpf || !nome || !data_nascimento_pessoa ||
            !endereco || !email || !senha
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Preencha todos os campos.'
            });
        }

        if (!validarCPF(cpf)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'CPF inválido.'
            });
        }

        if (nome.length > 60 || endereco.length > 150 || email.length > 75) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Um ou mais campos ultrapassaram o limite permitido.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe um e-mail válido.'
            });
        }

        if (senha.length < 8 || senha.length > 50) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A senha deve ter entre 8 e 50 caracteres.'
            });
        }


        const partesData = String(data_nascimento_pessoa).split('-').map(Number);
        const [ano, mes, dia] = partesData;

        const dataValida =
            /^\d{4}-\d{2}-\d{2}$/.test(data_nascimento_pessoa) &&
            new Date(Date.UTC(ano, mes - 1, dia)).getUTCFullYear() === ano &&
            new Date(Date.UTC(ano, mes - 1, dia)).getUTCMonth() === mes - 1 &&
            new Date(Date.UTC(ano, mes - 1, dia)).getUTCDate() === dia;

        const hoje = new Date();
        const hojeFormatado = [
            hoje.getFullYear(),
            String(hoje.getMonth() + 1).padStart(2, '0'),
            String(hoje.getDate()).padStart(2, '0')
        ].join('-');

        if (!dataValida || data_nascimento_pessoa > hojeFormatado) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Data de nascimento inválida.'
            });
        }


        // A partir daqui, as verificações e as duas inserções fazem parte
        // da mesma transação: não pode existir pessoa sem o respectivo cliente.
        await conexao.query('BEGIN');

        const cpfExistente = await conexao.query(
            'SELECT 1 FROM pessoa WHERE cpf_pessoa = $1',
            [cpf]
        );

        if (cpfExistente.rows.length > 0) {
            await conexao.query('ROLLBACK');
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este CPF já está cadastrado.'
            });
        }

        // Verifica se o e-mail já existe
        const emailExistente = await conexao.query(
            'SELECT 1 FROM pessoa WHERE LOWER(email_pessoa) = $1',
            [email]
        );

        if (emailExistente.rows.length > 0) {
            await conexao.query('ROLLBACK');

            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este e-mail já está cadastrado.'
            });
        }

        // Insere a pessoa
        await conexao.query(
            `INSERT INTO pessoa (
                cpf_pessoa,
                nome_pessoa,
                data_nascimento_pessoa,
                endereco_pessoa,
                senha_pessoa,
                email_pessoa
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                cpf,
                nome,
                data_nascimento_pessoa,
                endereco,
                senha,
                email
            ]
        );

        // Insere automaticamente o cliente
        await conexao.query(
            `INSERT INTO cliente (
                pessoa_cpf_pessoa,
                renda_cliente,
                data_cadastro_cliente
            ) VALUES ($1, NULL, CURRENT_DATE)`,
            [cpf]
        );

        await conexao.query('COMMIT');

        return res.status(201).json({
            sucesso: true,
            mensagem: 'Cadastro realizado com sucesso!'
        });

    } catch (error) {
        await conexao.query('ROLLBACK').catch(() => {});

        console.error('Erro ao cadastrar cliente:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao realizar o cadastro.'
        });

    } finally {
        conexao.release();
    }
};

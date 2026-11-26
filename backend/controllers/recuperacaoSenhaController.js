
const { query } = require('../database');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configuração do Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: (process.env.EMAIL_APP_PASSWORD || '').replace(/\s/g, '')
    }
});

// Gera um hash SHA-256
function gerarHash(valor) {
    return crypto.createHash('sha256').update(valor).digest('hex');
}

// Compara hashes sem comparação direta simples
function compararHash(valor, hashSalvo) {
    const hashGerado = Buffer.from(gerarHash(valor), 'hex');
    const hashBanco = Buffer.from(hashSalvo, 'hex');

    return crypto.timingSafeEqual(hashGerado, hashBanco);
}

// Envia o código por e-mail
async function enviarCodigo(email, codigo, primeiroAcesso = false) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        throw new Error('As configurações do Gmail não foram preenchidas.');
    }

    await transporter.sendMail({
        from: `"Parigot Presentes" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: primeiroAcesso ? 'Código para criar sua senha' : 'Código para recuperação de senha',
        html: `
            <div style="font-family: Arial, sans-serif; color: #4D3328;">
                <h2 style="color: #CC6060;">Parigot Presentes</h2>

                <p>${primeiroAcesso
                    ? 'Seu cadastro foi criado na Parigot Presentes. Use o código abaixo para criar a sua senha de acesso.'
                    : 'Recebemos uma solicitação para recuperar sua senha.'}</p>

                <p>Seu código de ${primeiroAcesso ? 'verificação' : 'recuperação'} é:</p>

                <h1 style="
                    color: #CC6060;
                    letter-spacing: 8px;
                    text-align: center;
                ">${codigo}</h1>

                <p>Esse código é válido por 10 minutos.</p>

                <p>Se você não solicitou isso, ignore este e-mail.</p>
            </div>
        `
    });
}

// Resposta genérica para não revelar se o e-mail existe
const mensagemSolicitacao =
    'Se o e-mail estiver cadastrado, você receberá um código de recuperação.';

// ETAPA 1: SOLICITAR CÓDIGO
exports.solicitarCodigo = async (req, res) => {
    try {
        const email = String(req.body.email_pessoa || '')
            .trim()
            .toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe um e-mail válido.'
            });
        }

        // Verifica se existe uma pessoa com esse e-mail
        const pessoa = await query(
            `SELECT email_pessoa, (senha_pessoa IS NULL) AS primeiro_acesso
             FROM pessoa
             WHERE LOWER(email_pessoa) = $1`,
            [email]
        );

        // Não revela se o e-mail está cadastrado
        if (pessoa.rows.length === 0) {
            return res.json({
                sucesso: true,
                mensagem: mensagemSolicitacao
            });
        }

        // Evita solicitações repetidas em menos de 1 minuto
        const solicitacaoRecente = await query(
            `SELECT email_pessoa
             FROM recuperacao_senha
             WHERE email_pessoa = $1
             AND solicitado_em > NOW() - INTERVAL '1 minute'`,
            [email]
        );

        if (solicitacaoRecente.rows.length > 0) {
            return res.json({
                sucesso: true,
                mensagem: mensagemSolicitacao
            });
        }

        // Gera um código numérico de 6 dígitos
        const codigo = String(crypto.randomInt(100000, 1000000));
        const codigoHash = gerarHash(codigo);

        // Salva somente o hash do código
        await query(
            `INSERT INTO recuperacao_senha (
                email_pessoa,
                codigo_hash,
                token_hash,
                expira_em,
                solicitado_em,
                verificado_em,
                tentativas
            )
            VALUES (
                $1, $2, NULL,
                NOW() + INTERVAL '10 minutes',
                NOW(), NULL, 0
            )
            ON CONFLICT (email_pessoa)
            DO UPDATE SET
                codigo_hash = EXCLUDED.codigo_hash,
                token_hash = NULL,
                expira_em = EXCLUDED.expira_em,
                solicitado_em = NOW(),
                verificado_em = NULL,
                tentativas = 0`,
            [email, codigoHash]
        );

        await enviarCodigo(email, codigo, pessoa.rows[0].primeiro_acesso);

        return res.json({
            sucesso: true,
            mensagem: mensagemSolicitacao
        });

    } catch (error) {
        console.error('Erro ao solicitar recuperação:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível enviar o código. Tente novamente.'
        });
    }
};

// ETAPA 2: VERIFICAR CÓDIGO
exports.verificarCodigo = async (req, res) => {
    try {
        const email = String(req.body.email_pessoa || '')
            .trim()
            .toLowerCase();

        const codigo = String(req.body.codigo || '').trim();

        if (!/^[0-9]{6}$/.test(codigo)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe um código válido de 6 dígitos.'
            });
        }

        const resultado = await query(
            `SELECT *
             FROM recuperacao_senha
             WHERE email_pessoa = $1
             AND expira_em > NOW()`,
            [email]
        );

        if (resultado.rows.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Código inválido ou expirado.'
            });
        }

        const recuperacao = resultado.rows[0];

        if (recuperacao.tentativas >= 5 || !recuperacao.codigo_hash) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Limite de tentativas atingido. Solicite outro código.'
            });
        }

        if (!compararHash(codigo, recuperacao.codigo_hash)) {
            await query(
                `UPDATE recuperacao_senha
                 SET tentativas = tentativas + 1
                 WHERE email_pessoa = $1`,
                [email]
            );

            return res.status(400).json({
                sucesso: false,
                mensagem: 'Código incorreto.'
            });
        }

        // Cria um token temporário para permitir a redefinição
        const tokenRecuperacao = crypto.randomBytes(32).toString('hex');
        const tokenHash = gerarHash(tokenRecuperacao);

        await query(
            `UPDATE recuperacao_senha
             SET codigo_hash = NULL,
                 token_hash = $2,
                 verificado_em = NOW()
             WHERE email_pessoa = $1`,
            [email, tokenHash]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Código verificado com sucesso!',
            tokenRecuperacao: tokenRecuperacao
        });

    } catch (error) {
        console.error('Erro ao verificar código:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao verificar o código.'
        });
    }
};

// ETAPA 3: REDEFINIR SENHA
exports.redefinirSenha = async (req, res) => {
    try {
        const email = String(req.body.email_pessoa || '')
            .trim()
            .toLowerCase();

        const token = String(req.body.tokenRecuperacao || '');
        const novaSenha = String(req.body.novaSenha || '');

        if (!email || !token || !novaSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Preencha todos os campos.'
            });
        }

        if (novaSenha.length < 6 || novaSenha.length > 50) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A senha deve ter entre 6 e 50 caracteres.'
            });
        }

        const resultado = await query(
            `SELECT *
             FROM recuperacao_senha
             WHERE email_pessoa = $1
             AND expira_em > NOW()
             AND verificado_em IS NOT NULL`,
            [email]
        );

        if (resultado.rows.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Solicitação inválida ou expirada. Faça a recuperação novamente.'
            });
        }

        const recuperacao = resultado.rows[0];

        if (
            !recuperacao.token_hash ||
            !compararHash(token, recuperacao.token_hash)
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Não foi possível validar a recuperação.'
            });
        }

        // Atualiza a senha da pessoa
        await query(
            `UPDATE pessoa
             SET senha_pessoa = $1
             WHERE LOWER(email_pessoa) = $2`,
            [novaSenha, email]
        );

        // Exclui o código e o token para impedir reutilização
        await query(
            `DELETE FROM recuperacao_senha
             WHERE email_pessoa = $1`,
            [email]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Senha alterada com sucesso!'
        });

    } catch (error) {
        console.error('Erro ao redefinir senha:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Não foi possível alterar a senha.'
        });
    }
};

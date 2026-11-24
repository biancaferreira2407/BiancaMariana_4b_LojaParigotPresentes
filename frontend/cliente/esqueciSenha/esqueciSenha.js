
const API = 'http://localhost:3001/esqueci-senha';

const formEmail = document.getElementById('formEmail');
const formCodigo = document.getElementById('formCodigo');
const formSenha = document.getElementById('formSenha');

const mensagem = document.getElementById('mensagem');

let emailRecuperacao = '';
let codigoVerificado = '';

function mostrarEtapa(etapa) {
    formEmail.classList.add('escondido');
    formCodigo.classList.add('escondido');
    formSenha.classList.add('escondido');

    etapa.classList.remove('escondido');
    mensagem.className = 'mensagem';
    mensagem.textContent = '';
}

function mostrarMensagem(texto, tipo) {
    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
}

// ETAPA 1: SOLICITAR CÓDIGO
formEmail.addEventListener('submit', async (e) => {
    e.preventDefault();

    emailRecuperacao = document.getElementById('email').value.trim();

    try {
        const resposta = await fetch(`${API}/solicitar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_pessoa: emailRecuperacao
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || 'Não foi possível solicitar o código.');
        }

        mostrarEtapa(formCodigo);
        mostrarMensagem(
            dados.mensagem || 'Se o e-mail estiver cadastrado, você receberá um código de recuperação.',
            'sucesso'
        );

    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
    }
});

// ETAPA 2: VERIFICAR CÓDIGO
formCodigo.addEventListener('submit', async (e) => {
    e.preventDefault();

    const codigo = document.getElementById('codigo').value.trim();

    try {
        const resposta = await fetch(`${API}/verificar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_pessoa: emailRecuperacao,
                codigo: codigo
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || 'Código inválido ou expirado.');
        }

        codigoVerificado = dados.tokenRecuperacao;

        mostrarEtapa(formSenha);

    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
    }
});

// VOLTAR PARA O E-MAIL
document.getElementById('voltarEmail').addEventListener('click', () => {
    mostrarEtapa(formEmail);
});

// ETAPA 3: ALTERAR SENHA
formSenha.addEventListener('submit', async (e) => {
    e.preventDefault();

    const novaSenha = document.getElementById('novaSenha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if (novaSenha !== confirmarSenha) {
        mostrarMensagem('As senhas não coincidem.', 'erro');
        return;
    }

    if (novaSenha.length < 8) {
        mostrarMensagem('A senha deve ter pelo menos 8 caracteres.', 'erro');
        return;
    }

    try {
        const resposta = await fetch(`${API}/redefinir`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_pessoa: emailRecuperacao,
                tokenRecuperacao: codigoVerificado,
                novaSenha: novaSenha
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || 'Não foi possível alterar a senha.');
        }

        mostrarEtapa(formSenha);
        formSenha.classList.add('escondido');

        mostrarMensagem('Senha alterada com sucesso! Você será redirecionado para o login.', 'sucesso');

        setTimeout(() => {
            window.location.href = '../login/login.html';
        }, 2500);

    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
    }
});

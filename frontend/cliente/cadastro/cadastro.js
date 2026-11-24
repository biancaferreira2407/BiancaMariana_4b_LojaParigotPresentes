const formCadastro = document.getElementById('formCadastro');
const mensagemCadastro = document.getElementById('mensagemCadastro');
const botaoCadastrar = document.getElementById('botaoCadastrar');
const campoCpf = document.getElementById('cpf_pessoa');
const campoDataNascimento = document.getElementById('data_nascimento_pessoa');

// Impede a seleção de uma data futura.
const hoje = new Date();
const dataLocal = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];
campoDataNascimento.max = dataLocal;

// Formata o CPF enquanto a pessoa digita.
campoCpf.addEventListener('input', () => {
    let cpf = campoCpf.value.replace(/\D/g, '').slice(0, 11);
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d)/, '$1.$2');
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    campoCpf.value = cpf;
});

// Mostrar ou ocultar cada campo de senha.
document.querySelectorAll('.alternar-senha').forEach(botao => {
    botao.addEventListener('click', () => {
        const campo = document.getElementById(botao.dataset.alvo);
        const mostrar = campo.type === 'password';
        campo.type = mostrar ? 'text' : 'password';
        botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
        botao.innerHTML = mostrar
            ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.1 3.8"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 3-.5"/></svg>`
            : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
});

function validarCpf(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
    let digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;
    if (digito !== Number(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
    digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;
    return digito === Number(cpf[10]);
}

formCadastro.addEventListener('submit', async evento => {
    evento.preventDefault();
    mensagemCadastro.classList.remove('sucesso');
    mensagemCadastro.textContent = '';

    if (!formCadastro.reportValidity()) return;

    const cpf = campoCpf.value.replace(/\D/g, '');
    const senha = document.getElementById('senha_pessoa').value;
    const confirmarSenha = document.getElementById('confirmar_senha').value;

    if (!validarCpf(cpf)) {
        mensagemCadastro.textContent = 'Digite um CPF válido.';
        campoCpf.focus();
        return;
    }

    if (senha.length < 8) {
        mensagemCadastro.textContent = 'A senha deve ter pelo menos 8 caracteres.';
        document.getElementById('senha_pessoa').focus();
        return;
    }

    if (senha !== confirmarSenha) {
        mensagemCadastro.textContent = 'As senhas não coincidem.';
        document.getElementById('confirmar_senha').focus();
        return;
    }

    const dadosCadastro = {
        cpf_pessoa: cpf,
        nome_pessoa: document.getElementById('nome_pessoa').value.trim(),
        data_nascimento_pessoa: campoDataNascimento.value,
        endereco_pessoa: document.getElementById('endereco_pessoa').value.trim(),
        email_pessoa: document.getElementById('email_pessoa').value.trim(),
        senha_pessoa: senha
    };

    try {
        botaoCadastrar.disabled = true;
        botaoCadastrar.textContent = 'Cadastrando...';
        mensagemCadastro.textContent = 'Enviando cadastro...';

        const resposta = await fetch('http://localhost:3001/cadastro/cliente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosCadastro)
        });

        const resultado = await resposta.json();
        if (!resposta.ok) {
            throw new Error(resultado.mensagem || resultado.error || 'Não foi possível realizar o cadastro.');
        }

        mensagemCadastro.textContent = 'Cadastro realizado! Você já pode fazer login.';
        mensagemCadastro.classList.add('sucesso');
        formCadastro.reset();
    } catch (erro) {
        console.error('Erro ao cadastrar pessoa:', erro);
        mensagemCadastro.textContent = erro.message === 'Failed to fetch'
            ? 'Não foi possível conectar ao servidor. Verifique se o backend está ligado.'
            : erro.message;
    } finally {
        botaoCadastrar.disabled = false;
        botaoCadastrar.textContent = 'Criar conta';
    }
});

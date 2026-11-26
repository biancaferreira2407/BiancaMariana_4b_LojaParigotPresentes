const formCadastro = document.getElementById('formCadastro');
const mensagemCadastro = document.getElementById('mensagemCadastro');
const botaoCadastrar = document.getElementById('botaoCadastrar');
const campoCpf = document.getElementById('cpf_pessoa');
const campoDataNascimento = document.getElementById('data_nascimento_pessoa');
const campoCep = document.getElementById('cep_pessoa');
const campoNumeroCasa = document.getElementById('numero_casa');
const campoEndereco = document.getElementById('endereco_pessoa');
const mensagemCep = document.getElementById('mensagemCep');
let enderecoViaCep = null;

campoCep.addEventListener('input', () => {
    const digitos = campoCep.value.replace(/\D/g, '').slice(0, 8);
    campoCep.value = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    enderecoViaCep = null; campoEndereco.value = '';
    if (digitos.length === 8) consultarCep(digitos);
});

async function consultarCep(cep) {
    mensagemCep.textContent = 'Consultando CEP...';
    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await resposta.json();
        if (!resposta.ok || dados.erro) throw new Error('CEP não encontrado.');
        enderecoViaCep = dados;
        campoEndereco.value = [dados.logradouro, dados.bairro, dados.localidade, dados.uf].filter(Boolean).join(', ');
        mensagemCep.textContent = 'Endereço encontrado. Informe apenas o número da residência.';
    } catch (erro) { enderecoViaCep = null; campoEndereco.value = ''; mensagemCep.textContent = erro.message || 'Não foi possível consultar o CEP.'; }
}


// Mesma regra do backend: só letras (com acentos) e espaços; cada palavra começa com letra maiúscula.
function formatarNome(valor) {
    return String(valor ?? '')
        .normalize('NFC')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase('pt-BR')
        .replace(/(^|\s)(\p{L})/gu, (trecho, inicio, letra) => inicio + letra.toLocaleUpperCase('pt-BR'));
}

function nomeValido(nome) {
    return /^\p{L}+(?: \p{L}+)*$/u.test(nome);
}

// Enquanto digita: tira tudo que não é letra/espaço e põe a 1ª letra de cada palavra em maiúscula,
// mantendo o cursor no lugar.
function mascararNome(campo) {
    const limpar = texto => texto
        .normalize('NFC')
        .replace(/[^\p{L} ]/gu, '')
        .replace(/ {2,}/g, ' ')
        .replace(/^ /, '')
        .toLocaleLowerCase('pt-BR')
        .replace(/(^|\s)(\p{L})/gu, (trecho, inicio, letra) => inicio + letra.toLocaleUpperCase('pt-BR'));
    const cursor = campo.selectionStart ?? campo.value.length;
    const novoCursor = limpar(campo.value.slice(0, cursor)).length;
    campo.value = limpar(campo.value);
    campo.setSelectionRange(novoCursor, novoCursor);
}

const campoNome = document.getElementById('nome_pessoa');
campoNome.addEventListener('input', () => mascararNome(campoNome));

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

// Mesma regra do backend: DDD + número (10 dígitos fixo / 11 celular começando com 9).
function telefoneValido(valor) {
    const d = String(valor || '').replace(/\D/g, '');
    if (!/^[1-9][1-9]\d{8,9}$/.test(d)) return false;
    return d.length === 10 ? /^\d{2}[2-5]/.test(d) : d[2] === '9';
}

function mascararTelefone(valor) {
    const t = String(valor || '').replace(/\D/g, '').slice(0, 11);
    if (t.length <= 2) return t;
    if (t.length <= 6) return `(${t.slice(0, 2)}) ${t.slice(2)}`;
    // 11 dígitos (celular) = 5+4; até 10 dígitos (fixo ou ainda digitando) = 4+resto.
    const corte = t.length === 11 ? 7 : 6;
    return `(${t.slice(0, 2)}) ${t.slice(2, corte)}-${t.slice(corte)}`;
}

// Formata o telefone enquanto a pessoa digita: (44) 99999-9999.
const campoTelefone = document.getElementById('telefone_pessoa');
campoTelefone.addEventListener('input', () => {
    campoTelefone.value = mascararTelefone(campoTelefone.value);
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

    const nome = formatarNome(campoNome.value);
    campoNome.value = nome;
    if (!nomeValido(nome)) {
        mensagemCadastro.textContent = 'Digite o nome usando apenas letras.';
        campoNome.focus();
        return;
    }

    if (!validarCpf(cpf)) {
        mensagemCadastro.textContent = 'Digite um CPF válido.';
        campoCpf.focus();
        return;
    }

    if (!telefoneValido(campoTelefone.value)) {
        mensagemCadastro.textContent = 'Digite um telefone válido com DDD.';
        campoTelefone.focus();
        return;
    }

    if (senha.length < 6) {
        mensagemCadastro.textContent = 'A senha deve ter pelo menos 6 caracteres.';
        document.getElementById('senha_pessoa').focus();
        return;
    }

    if (senha !== confirmarSenha) {
        mensagemCadastro.textContent = 'As senhas não coincidem.';
        document.getElementById('confirmar_senha').focus();
        return;
    }

    if (!/^\d{8}$/.test(campoCep.value.replace(/\D/g, '')) || !enderecoViaCep || !campoNumeroCasa.value.trim()) {
        mensagemCadastro.textContent = 'Informe um CEP válido e o número da residência.'; campoCep.focus(); return;
    }

    const dadosCadastro = {
        cpf_pessoa: cpf,
        nome_pessoa: nome,
        data_nascimento_pessoa: campoDataNascimento.value,
        cep_pessoa: campoCep.value.replace(/\D/g, ''),
        numero_casa: campoNumeroCasa.value.trim(),
        endereco_pessoa: `${enderecoViaCep.logradouro || 'Logradouro não informado'}, ${campoNumeroCasa.value.trim()} - ${enderecoViaCep.bairro || ''}, ${enderecoViaCep.localidade}/${enderecoViaCep.uf}`,
        telefone_pessoa: document.getElementById('telefone_pessoa').value.replace(/\D/g, ''),
        email_pessoa: document.getElementById('email_pessoa').value.trim(),
        senha_pessoa: senha
    };

    let redirecionando = false;
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

        // Conta criada: vai direto para o login (que avisa que deu certo e já traz o e-mail preenchido).
        sessionStorage.setItem('contaCriada', dadosCadastro.email_pessoa);
        redirecionando = true;
        window.location.href = '../login/login.html';
        return;
    } catch (erro) {
        console.error('Erro ao cadastrar pessoa:', erro);
        mensagemCadastro.textContent = erro.message === 'Failed to fetch'
            ? 'Não foi possível conectar ao servidor. Verifique se o backend está ligado.'
            : erro.message;
    } finally {
        if (!redirecionando) {
            botaoCadastrar.disabled = false;
            botaoCadastrar.textContent = 'Criar conta';
        }
    }
});

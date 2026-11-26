const API = 'http://localhost:3001';

const formConta = document.getElementById('formConta');
const mensagemConta = document.getElementById('mensagemConta');
const botaoAlterar = document.getElementById('botaoAlterar');
const botaoCancelar = document.getElementById('botaoCancelar');
const botaoConfirmar = document.getElementById('botaoConfirmar');

const modalSenha = document.getElementById('modalSenha');
const senhaAtual = document.getElementById('senhaAtual');
const mensagemSenha = document.getElementById('mensagemSenha');
const botaoValidarSenha = document.getElementById('botaoValidarSenha');

const token = sessionStorage.getItem('token');
const perfil = sessionStorage.getItem('perfil');

let dadosOriginais = null;

if (!token || perfil !== 'cliente') {
    alert('Faça o login como cliente para acessar sua conta.');
    window.location.href = '../login/login.html';
} else {
    carregarDadosPessoa();
}

// Busca os dados usando o CPF que está guardado no token.
// O backend identifica a pessoa autenticada, sem confiar em um CPF enviado pela página.
async function carregarDadosPessoa() {
    try {
        mensagemConta.textContent = 'Carregando seus dados...';

        const resposta = await fetch(`${API}/conta`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.pessoa) {
            throw new Error(dados.mensagem || 'Não foi possível carregar seus dados.');
        }

        preencherFormulario(dados.pessoa);
        mensagemConta.textContent = '';
    } catch (erro) {
        console.error('Erro ao carregar conta:', erro);
        mensagemConta.textContent = erro.message || 'Erro ao carregar os dados da conta.';
    }
}

function preencherFormulario(pessoa) {
    dadosOriginais = {
        nome_pessoa: pessoa.nome_pessoa || '',
        cpf_pessoa: pessoa.cpf_pessoa || '',
        data_nascimento_pessoa: pessoa.data_nascimento_pessoa
            ? String(pessoa.data_nascimento_pessoa).slice(0, 10)
            : '',
        email_pessoa: pessoa.email_pessoa || '',
        endereco_pessoa: pessoa.endereco_pessoa || '',
        telefone_pessoa: pessoa.telefone_pessoa || ''
    };

    document.getElementById('nome').value = dadosOriginais.nome_pessoa;
    document.getElementById('cpf').value = dadosOriginais.cpf_pessoa;
    document.getElementById('nascimento').value = dadosOriginais.data_nascimento_pessoa;
    document.getElementById('email').value = dadosOriginais.email_pessoa;
    document.getElementById('endereco').value = dadosOriginais.endereco_pessoa;
    document.getElementById('telefone').value = formatarTelefone(dadosOriginais.telefone_pessoa);
}

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

function formatarTelefone(valor) {
    return mascararTelefone(String(valor || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''));
}

document.getElementById('telefone').addEventListener('input', evento => {
    evento.target.value = mascararTelefone(evento.target.value);
});

function obterDadosFormulario() {
    return {
        nome_pessoa: document.getElementById('nome').value.trim(),
        data_nascimento_pessoa: document.getElementById('nascimento').value || null,
        email_pessoa: document.getElementById('email').value.trim(),
        endereco_pessoa: document.getElementById('endereco').value.trim(),
        telefone_pessoa: document.getElementById('telefone').value.replace(/\D/g, '')
    };
}

function definirEdicao(ativa) {
    ['nome', 'nascimento', 'email', 'endereco', 'telefone'].forEach(id => {
        document.getElementById(id).disabled = !ativa;
    });

    botaoAlterar.hidden = ativa;
    botaoCancelar.hidden = !ativa;
    botaoConfirmar.hidden = !ativa;

    if (ativa) {
        mensagemConta.textContent = 'Altere os campos desejados e clique em confirmar.';
    } else {
        mensagemConta.textContent = '';
    }
}

botaoAlterar.addEventListener('click', () => {
    mensagemConta.textContent = '';
    definirEdicao(true);
});

botaoCancelar.addEventListener('click', () => {
    if (dadosOriginais) preencherFormulario(dadosOriginais);
    definirEdicao(false);
});

formConta.addEventListener('submit', evento => {
    evento.preventDefault();

    if (!formConta.reportValidity()) return;

    const dados = obterDadosFormulario();
    if (!dados.nome_pessoa || !dados.email_pessoa || !dados.endereco_pessoa) {
        mensagemConta.textContent = 'Preencha nome, e-mail e endereço.';
        return;
    }

    if (!telefoneValido(dados.telefone_pessoa)) {
        mensagemConta.textContent = 'Informe um telefone válido com DDD, por exemplo (44) 99999-9999.';
        document.getElementById('telefone').focus();
        return;
    }

    mensagemSenha.textContent = '';
    senhaAtual.value = '';
    modalSenha.hidden = false;
    senhaAtual.focus();
});

function fecharModalSenha() {
    modalSenha.hidden = true;
    mensagemSenha.textContent = '';
    senhaAtual.value = '';
}

document.getElementById('botaoVoltarSenha').addEventListener('click', fecharModalSenha);

document.querySelectorAll('[data-fechar-senha]').forEach(elemento => {
    elemento.addEventListener('click', fecharModalSenha);
});

// Confirma a senha no backend e, se estiver correta, atualiza os dados.
botaoValidarSenha.addEventListener('click', salvarAlteracoes);

senhaAtual.addEventListener('keydown', evento => {
    if (evento.key === 'Enter') salvarAlteracoes();
});

async function salvarAlteracoes() {
    const senha = senhaAtual.value;

    if (!senha) {
        mensagemSenha.textContent = 'Digite sua senha atual.';
        senhaAtual.focus();
        return;
    }

    botaoValidarSenha.disabled = true;
    botaoValidarSenha.textContent = 'Salvando...';
    mensagemSenha.textContent = '';

    try {
        const resposta = await fetch(`${API}/conta`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                ...obterDadosFormulario(),
                senha_atual: senha
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            mensagemSenha.textContent = dados.mensagem || 'Não foi possível atualizar seus dados.';
            return;
        }

        preencherFormulario(dados.pessoa);

        // Mantém os dados básicos da sessão sincronizados com o cadastro atualizado.
        const clienteSessao = JSON.parse(sessionStorage.getItem('cliente') || '{}');
        sessionStorage.setItem('cliente', JSON.stringify({
            ...clienteSessao,
            cpf_pessoa: dados.pessoa.cpf_pessoa,
            nome_pessoa: dados.pessoa.nome_pessoa,
            email_pessoa: dados.pessoa.email_pessoa
        }));

        fecharModalSenha();
        definirEdicao(false);
        mensagemConta.textContent = dados.mensagem || 'Dados atualizados com sucesso!';
    } catch (erro) {
        console.error('Erro ao atualizar conta:', erro);
        mensagemSenha.textContent = 'Não foi possível conectar ao servidor.';
    } finally {
        botaoValidarSenha.disabled = false;
        botaoValidarSenha.textContent = 'Confirmar';
    }
}

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !modalSenha.hidden) fecharModalSenha();
});


const formLogin = document.getElementById('formLogin');
const mensagemLogin = document.getElementById('mensagemLogin');
const campoSenha = document.getElementById('senha');
const alternarSenha = document.getElementById('alternarSenha');

const modalPerfil = document.getElementById('modalPerfil');
const btnCliente = document.getElementById('btnCliente');
const btnAdmin = document.getElementById('btnAdmin');

let usuarioLogin = '';
let senhaLogin = '';

// Mostrar ou ocultar senha
alternarSenha.addEventListener('click', () => {
    const senhaVisivel = campoSenha.type === 'text';

    campoSenha.type = senhaVisivel ? 'password' : 'text';

    alternarSenha.innerHTML = senhaVisivel
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
             <circle cx="12" cy="12" r="3"/>
           </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
             <path d="M3 3l18 18"/>
             <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/>
             <path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.1 3.8"/>
             <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 0 0 3-.5"/>
           </svg>`;

    alternarSenha.setAttribute(
        'aria-label',
        senhaVisivel ? 'Mostrar senha' : 'Ocultar senha'
    );
});

// Primeira validação do login
formLogin.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const senha = campoSenha.value;

    if (!usuario || !senha) {
        mensagemLogin.textContent = 'Preencha o e-mail e a senha.';
        return;
    }

    try {
        mensagemLogin.textContent = 'Validando login...';

        const resposta = await fetch('http://localhost:3001/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_pessoa: usuario,
                senha_pessoa: senha
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            mensagemLogin.textContent = dados.mensagem;
            return;
        }

        // Se possuir os dois perfis, abre a janela.
        if (dados.escolherPerfil) {
            usuarioLogin = usuario;
            senhaLogin = senha;

            mensagemLogin.textContent = '';
            modalPerfil.hidden = false;
            return;
        }

        // Se possuir apenas um perfil, finaliza o login.
        finalizarLogin(dados);

    } catch (erro) {
        console.error('Erro no login:', erro);
        mensagemLogin.textContent = 'Não foi possível conectar ao servidor.';
    }
});

// Escolher entre cliente e administrador
async function escolherPerfil(perfil) {
    try {
        btnCliente.disabled = true;
        btnAdmin.disabled = true;

        const resposta = await fetch('http://localhost:3001/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email_pessoa: usuarioLogin,
                senha_pessoa: senhaLogin,
                perfil: perfil
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            mensagemLogin.textContent = dados.mensagem;
            btnCliente.disabled = false;
            btnAdmin.disabled = false;
            return;
        }

        finalizarLogin(dados);

    } catch (erro) {
        console.error('Erro ao escolher perfil:', erro);
        mensagemLogin.textContent = 'Erro ao conectar ao servidor.';

        btnCliente.disabled = false;
        btnAdmin.disabled = false;
    }
}

// Armazenar dados e redirecionar
function finalizarLogin(dados) {
    sessionStorage.setItem('token', dados.token);
    sessionStorage.setItem('cliente', JSON.stringify(dados.cliente));
    sessionStorage.setItem('perfil', dados.perfil);

    if (dados.perfil === 'admin') {
        window.location.href = '../../admin/menu/menu.html';
    } else {
        window.location.href = '../dashboard/dashboard.html';
    }
}

// Eventos dos botões
btnCliente.addEventListener('click', () => {
    escolherPerfil('cliente');
});

btnAdmin.addEventListener('click', () => {
    escolherPerfil('admin');
});

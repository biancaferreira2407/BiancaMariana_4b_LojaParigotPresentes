const URL_API = 'http://localhost:3001';

// Mostra no menu só os módulos que o cargo do funcionário pode acessar.
function aplicarPermissoesNoMenu(permissoes) {
    let visiveis = 0;
    document.querySelectorAll('[data-modulo]').forEach(card => {
        const liberado = permissoes.includes(card.dataset.modulo);
        card.style.display = liberado ? '' : 'none';
        if (liberado) visiveis++;
    });
    document.getElementById('semAcesso').hidden = visiveis > 0;
}

aplicarPermissoesNoMenu(window.permissoesAdmin || []);

// Relê o cargo no servidor: se o gerente mudou as permissões, o menu acompanha sem novo login.
async function atualizarPermissoes() {
    try {
        const resposta = await fetch(`${URL_API}/login/permissoes`);
        const dados = await resposta.json();
        if (resposta.ok && dados.sucesso && Array.isArray(dados.permissoes)) {
            sessionStorage.setItem('permissoes', JSON.stringify(dados.permissoes));
            window.permissoesAdmin = dados.permissoes;
            aplicarPermissoesNoMenu(dados.permissoes);
        }
    } catch (erro) {
        console.warn('Não foi possível atualizar as permissões do cargo.', erro);
    }
}
atualizarPermissoes();

// Verifica a conexão com o servidor backend ao carregar a página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const resposta = await fetch(`${URL_API}/produto/listar`);
        if (resposta.ok) {
            console.log('Servidor backend conectado com sucesso!');
        }
    } catch (erro) {
        console.warn('Aviso: Não foi possível conectar ao servidor backend em ' + URL_API);
    }
});


const btnPedidos = document.getElementById('btnPedidos');
const submenuPedidos = document.getElementById('submenuPedidos');

if (btnPedidos && submenuPedidos) {
    btnPedidos.addEventListener('click', () => {
        submenuPedidos.classList.toggle('aberto');
        btnPedidos.classList.toggle('aberto');
    });
}


const btnSair = document.getElementById('btnSair');
if (btnSair) btnSair.addEventListener('click', () => window.sairDoAdmin && window.sairDoAdmin());

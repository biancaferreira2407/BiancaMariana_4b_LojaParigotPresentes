const CHAVE_CARRINHO = 'carrinhoParigot';
const DESTINO_PREFERENCIAS = '../entregaPresente/entregaPresente.html';

const itensCarrinho = document.getElementById('itensCarrinho');
const quantidadeItens = document.getElementById('quantidadeItens');
const subtotalElemento = document.getElementById('subtotal');
const totalElemento = document.getElementById('total');
const botaoFinalizar = document.getElementById('finalizarCompra');

function carregarCarrinho() {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '[]');
        return Array.isArray(dados) ? dados : [];
    } catch (erro) {
        console.error('Não foi possível ler o carrinho:', erro);
        return [];
    }
}

let carrinho = carregarCarrinho();

function salvarCarrinho() {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
}

function formatarPreco(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
    });
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);
}

const EXTENSOES_IMAGEM = ['jpeg', 'png', 'jpg'];
const IMAGEM_PADRAO = '../../../imagens/silhueta.jpeg';
const API_IMAGENS = 'http://localhost:3001/imagens';

// onerror das imagens: tenta .jpeg, .png, .jpg e por fim a silhueta.
function proximaImagem(img) {
    const tentativa = Number(img.dataset.tentativa || 0) + 1;
    if (!img.dataset.id || tentativa >= EXTENSOES_IMAGEM.length) {
        img.onerror = null;
        img.src = IMAGEM_PADRAO;
        return;
    }
    img.dataset.tentativa = String(tentativa);
    img.src = `${API_IMAGENS}/${encodeURIComponent(img.dataset.id)}.${EXTENSOES_IMAGEM[tentativa]}`;
}

function renderizarCarrinho() {
    const quantidadeTotal = carrinho.reduce((soma, item) => soma + Number(item.quantidade || 0), 0);
    const subtotal = carrinho.reduce((soma, item) => soma + Number(item.preco || 0) * Number(item.quantidade || 0), 0);

    quantidadeItens.textContent = `${quantidadeTotal} ${quantidadeTotal === 1 ? 'item' : 'itens'}`;
    subtotalElemento.textContent = formatarPreco(subtotal);
    totalElemento.textContent = formatarPreco(subtotal);
    botaoFinalizar.disabled = carrinho.length === 0;

    if (carrinho.length === 0) {
        itensCarrinho.innerHTML = `
            <div class="carrinho-vazio">
                <span class="icone-vazio" aria-hidden="true">♡</span>
                <h2>Seu carrinho está vazio</h2>
                <p>Que tal encontrar algo especial para presentear?</p>
                <a class="botao-continuar" href="../dashboard/dashboard.html">Explorar produtos</a>
            </div>`;
        return;
    }

    itensCarrinho.innerHTML = carrinho.map((item, indice) => `
        <article class="item-carrinho">
            <div class="imagem-item">
                <img src="${API_IMAGENS}/${encodeURIComponent(item.id_produto)}.${EXTENSOES_IMAGEM[0]}"
                     data-id="${escaparHTML(item.id_produto)}"
                     alt="${escaparHTML(item.nome)}"
                     onerror="proximaImagem(this)">
            </div>
            <div class="dados-item">
                <h3 class="nome-item">${escaparHTML(item.nome)}</h3>
                <p class="preco-unitario">${formatarPreco(item.preco)} cada</p>
                <div class="controles-item">
                    <div class="seletor-quantidade" aria-label="Quantidade de ${escaparHTML(item.nome)}">
                        <button type="button" data-acao="diminuir" data-indice="${indice}" aria-label="Diminuir quantidade">−</button>
                        <output>${Number(item.quantidade)}</output>
                        <button type="button" data-acao="aumentar" data-indice="${indice}" aria-label="Aumentar quantidade">+</button>
                    </div>
                    <button type="button" class="remover-item" data-acao="remover" data-indice="${indice}" aria-label="Remover ${escaparHTML(item.nome)} do carrinho" title="Remover do carrinho">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M3 6h18"></path>
                            <path d="M8 6V4h8v2"></path>
                            <path d="M6 6l1 14h10l1-14"></path>
                            <path d="M10 10v6M14 10v6"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <strong class="total-item">${formatarPreco(Number(item.preco) * Number(item.quantidade))}</strong>
        </article>
    `).join('');
}

itensCarrinho.addEventListener('click', evento => {
    const botao = evento.target.closest('button[data-acao]');
    if (!botao) return;

    const indice = Number(botao.dataset.indice);
    const acao = botao.dataset.acao;
    if (!carrinho[indice]) return;

    if (acao === 'aumentar') {
        const estoque = Number(carrinho[indice].estoque);
        // Não passa do estoque conhecido (o servidor confere de novo no pagamento).
        if (Number.isFinite(estoque) && estoque > 0 && carrinho[indice].quantidade >= estoque) return;
        carrinho[indice].quantidade += 1;
    }
    if (acao === 'diminuir') {
        carrinho[indice].quantidade -= 1;
        if (carrinho[indice].quantidade <= 0) carrinho.splice(indice, 1);
    }
    if (acao === 'remover') carrinho.splice(indice, 1);

    salvarCarrinho();
    renderizarCarrinho();
});

botaoFinalizar.addEventListener('click', () => {
    if (carrinho.length === 0) return;

    const token = sessionStorage.getItem('token');
    const perfil = sessionStorage.getItem('perfil');

    if (token && perfil === 'cliente') {
        window.location.href = DESTINO_PREFERENCIAS;
        return;
    }

    // O carrinho permanece no localStorage. Após o login como cliente,
    // a tela de login redirecionará para a etapa de entrega e presente.
    sessionStorage.setItem('redirecionarAposLogin', DESTINO_PREFERENCIAS);
    window.location.href = '../login/login.html';
});

window.addEventListener('storage', evento => {
    if (evento.key === CHAVE_CARRINHO) {
        carrinho = carregarCarrinho();
        renderizarCarrinho();
    }
});

renderizarCarrinho();

const API = 'http://localhost:3001';

const btnCategorias = document.getElementById('btnCategorias');
const btnContato = document.getElementById('btnContato');
const painelContato = document.getElementById('painelContato');
const listaCategorias = document.getElementById('listaCategorias');
const opcoesCategorias = document.getElementById('opcoesCategorias');
const formPesquisa = document.getElementById('formPesquisa');
const campoPesquisa = document.getElementById('buscarProduto');
const gradeProdutos = document.getElementById('gradeProdutos');
const quantidadeProdutos = document.getElementById('quantidadeProdutos');
const modalProduto = document.getElementById('modalProduto');
const conteudoModalProduto = document.getElementById('conteudoModalProduto');

const botaoLogin = document.getElementById('botaoLogin');
const botaoConta = document.getElementById('botaoConta');

const btnConta = document.getElementById('btnConta');
const painelConta = document.getElementById('painelConta');
const botaoSair = document.getElementById('botaoSair');
const contadorCarrinho = document.getElementById('contadorCarrinho');
const linkCarrinho = document.querySelector('.botao-carrinho');

function clienteLogado() {
    return Boolean(sessionStorage.getItem('token')) && sessionStorage.getItem('perfil') === 'cliente';
}

function fecharMenuConta() {
    painelConta.hidden = true;
    btnConta.setAttribute('aria-expanded', 'false');
}

// Mostra "Login" ou o ícone da conta conforme a sessão.
function atualizarCabecalhoLogin() {
    const logado = clienteLogado();
    botaoLogin.style.display = logado ? 'none' : 'flex';
    botaoConta.hidden = !logado;
    if (!logado) fecharMenuConta();
}

atualizarCabecalhoLogin();

let produtos = [];
let categorias = [];
let unidades = [];
let categoriaSelecionada = 'todas';
let produtoSelecionado = null;
let quantidadeSelecionada = 1;
const CHAVE_CARRINHO = 'carrinhoParigot';
let carrinho = carregarCarrinhoSalvo();

function carregarCarrinhoSalvo() {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '[]');
        return Array.isArray(dados) ? dados : [];
    } catch (erro) {
        console.error('Erro ao recuperar carrinho:', erro);
        return [];
    }
}

function salvarCarrinhoSalvo() {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
    atualizarContadorCarrinho();
}

// Mostra no botão do carrinho quantas unidades há nele (some quando está vazio).
function atualizarContadorCarrinho() {
    const total = carrinho.reduce((soma, item) => soma + Number(item.quantidade || 0), 0);
    contadorCarrinho.textContent = total > 99 ? '99+' : String(total);
    contadorCarrinho.hidden = total <= 0;
    linkCarrinho.setAttribute('aria-label', total > 0
        ? `Carrinho de compras, ${total} ${total === 1 ? 'item' : 'itens'}`
        : 'Carrinho de compras');
}

// O carrinho também é alterado na tela do carrinho: relê do navegador ao voltar para a loja.
function sincronizarCarrinho() {
    carrinho = carregarCarrinhoSalvo();
    atualizarContadorCarrinho();
}

window.addEventListener('storage', evento => {
    if (evento.key === CHAVE_CARRINHO || evento.key === null) sincronizarCarrinho();
});
window.addEventListener('pageshow', () => {
    sincronizarCarrinho();
    atualizarCabecalhoLogin();
});
window.addEventListener('focus', sincronizarCarrinho);
atualizarContadorCarrinho();

// O upload do admin sempre grava .jpeg; produtos antigos podem ter .png ou .jpg.
const EXTENSOES_IMAGEM = ['jpeg', 'png', 'jpg'];
const IMAGEM_PADRAO = '../../../imagens/silhueta.jpeg';

// Chamada pelo onerror das imagens: tenta a próxima extensão e, por fim, a silhueta.
function proximaImagem(img) {
    const tentativa = Number(img.dataset.tentativa || 0) + 1;
    if (!img.dataset.id || tentativa >= EXTENSOES_IMAGEM.length) {
        img.onerror = null;
        img.src = IMAGEM_PADRAO;
        return;
    }
    img.dataset.tentativa = String(tentativa);
    img.src = `${API}/imagens/${encodeURIComponent(img.dataset.id)}.${EXTENSOES_IMAGEM[tentativa]}`;
}

btnCategorias.addEventListener('click', () => {
    const aberto = btnCategorias.getAttribute('aria-expanded') === 'true';
    btnCategorias.setAttribute('aria-expanded', String(!aberto));
    listaCategorias.hidden = aberto;
});

btnContato.addEventListener('click', () => {
    const aberto = btnContato.getAttribute('aria-expanded') === 'true';

    btnContato.setAttribute('aria-expanded', String(!aberto));
    painelContato.hidden = aberto;
});

btnConta.addEventListener('click', () => {
    const aberto = btnConta.getAttribute('aria-expanded') === 'true';
    btnConta.setAttribute('aria-expanded', String(!aberto));
    painelConta.hidden = aberto;
});

botaoSair.addEventListener('click', () => {
    // Encerra a sessão do cliente. O carrinho continua salvo neste navegador.
    sessionStorage.clear();
    atualizarCabecalhoLogin();
    secaoHistorico.hidden = true;
    secaoProdutos.hidden = false;
});

document.addEventListener('click', (evento) => {
    if (!evento.target.closest('.menu-conta')) fecharMenuConta();

    if (!evento.target.closest('.menu-categorias')) {
        listaCategorias.hidden = true;
        btnCategorias.setAttribute('aria-expanded', 'false');
    }

    if (evento.target.closest('[data-fechar-modal]')) fecharModal();

    if (!evento.target.closest('.menu-contato')) {
        painelContato.hidden = true;
        btnContato.setAttribute('aria-expanded', 'false');
    }
});

document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
        fecharMenuConta();
        painelContato.hidden = true;
        btnContato.setAttribute('aria-expanded', 'false');
        listaCategorias.hidden = true;
        btnCategorias.setAttribute('aria-expanded', 'false');
        fecharModal();
    }
});

async function carregarCategorias() {
    try {
        const resposta = await fetch(`${API}/categoria/listar`);
        if (!resposta.ok) throw new Error('Falha ao carregar categorias');
        const dados = await resposta.json();
        categorias = dados.categorias || [];
        renderizarCategorias();
    } catch (erro) {
        console.error(erro);
        opcoesCategorias.innerHTML = '<span class="estado-categorias">Não foi possível carregar. Verifique se o servidor está ligado.</span>';
    }
}

function renderizarCategorias() {
    const opcoes = [{ id: 'todas', nome: 'todas' }, ...categorias.map(c => ({ id: String(c.id_categoria), nome: c.nome_categoria }))];
    opcoesCategorias.innerHTML = opcoes.map(c => `
        <button type="button" data-categoria="${escaparHTML(c.id)}" class="${String(categoriaSelecionada) === String(c.id) ? 'categoria-ativa' : ''}">
            ${escaparHTML(c.nome)}${c.id === 'todas' ? ' <span class="texto-sem-filtro">(sem filtros)</span>' : ''}
        </button>
    `).join('');
    opcoesCategorias.querySelectorAll('button').forEach(botao => {
        botao.addEventListener('click', () => {
            categoriaSelecionada = botao.dataset.categoria;
            campoPesquisa.value = '';
            renderizarCategorias();
            renderizarProdutos();
            listaCategorias.hidden = true;
            btnCategorias.setAttribute('aria-expanded', 'false');
        });
    });
}

async function carregarProdutos() {
    try {
        const [resProdutos, resUnidades] = await Promise.all([
            fetch(`${API}/produto/listar`),
            fetch(`${API}/unidade_medida/listar`)
        ]);
        if (!resProdutos.ok) throw new Error('Falha ao carregar produtos');
        const dadosProdutos = await resProdutos.json();
        produtos = dadosProdutos.produtos || [];
        if (resUnidades.ok) {
            const dadosUnidades = await resUnidades.json();
            unidades = dadosUnidades.unidades || [];
        }
        renderizarProdutos();
    } catch (erro) {
        console.error(erro);
        gradeProdutos.innerHTML = '<p class="estado-produtos">Não foi possível carregar os produtos. Confira se o servidor e o banco de dados estão funcionando.</p>';
    }
}

function obterNomeCategoria(id) {
    const categoria = categorias.find(c => String(c.id_categoria) === String(id));
    return categoria ? categoria.nome_categoria : 'Não informada';
}

function obterNomeUnidade(id) {
    const unidade = unidades.find(u => String(u.id_unidade_medida) === String(id));
    return unidade ? unidade.nome_unidade_medida : (id || 'Não informada');
}

function obterImagem(produto) {
    return `${API}/imagens/${encodeURIComponent(produto.id_produto)}.${EXTENSOES_IMAGEM[0]}`;
}

function formatarPreco(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Preço não informado';
}

// Minúsculas e sem acentos: "cafe" encontra "Café", "acucar" encontra "Açúcar".
function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
}

function renderizarProdutos() {
    const termo = normalizarTexto(campoPesquisa.value.trim());
    const filtrados = produtos.filter(produto => {
        const correspondeCategoria = categoriaSelecionada === 'todas' || String(produto.id_categoria) === String(categoriaSelecionada);
        const correspondeBusca = !termo || normalizarTexto(produto.nome_produto).includes(termo);
        return correspondeCategoria && correspondeBusca;
    });

    quantidadeProdutos.textContent = `${filtrados.length} ${filtrados.length === 1 ? 'produto' : 'produtos'}`;
    if (!filtrados.length) {
        gradeProdutos.innerHTML = '<p class="estado-produtos">Nenhum produto encontrado nesta seleção.</p>';
        return;
    }

    // Produto sem estoque fica visível, mas bloqueado (aria-disabled, sem clique): não abre os detalhes nem vai para o carrinho.
    gradeProdutos.innerHTML = filtrados.map(produto => {
        const semEstoque = estoqueDoProduto(produto) <= 0;
        return `
        <button class="card-produto${semEstoque ? ' esgotado' : ''}" type="button" data-produto="${escaparHTML(produto.id_produto)}" ${semEstoque ? 'aria-disabled="true" tabindex="-1"' : ''} aria-label="${semEstoque ? `${escaparHTML(produto.nome_produto)} — produto esgotado` : `Ver detalhes de ${escaparHTML(produto.nome_produto)}`}">
            <span class="imagem-card"><img src="${obterImagem(produto)}" data-id="${escaparHTML(produto.id_produto)}" alt="${escaparHTML(produto.nome_produto)}" loading="lazy" onerror="proximaImagem(this)">${semEstoque ? '<span class="selo-esgotado">Esgotado</span>' : ''}</span>
            <span class="informacoes-card">
                <strong>${escaparHTML(produto.nome_produto)}</strong>
                <span class="preco-card">${formatarPreco(produto.preco_unitario_produto)}</span>
            </span>
        </button>`;
    }).join('');

    gradeProdutos.querySelectorAll('.card-produto:not(.esgotado)').forEach(card => {
        card.addEventListener('click', () => abrirDetalhes(card.dataset.produto));
    });
}

function abrirDetalhes(id) {
    produtoSelecionado = produtos.find(p => String(p.id_produto) === String(id));
    if (!produtoSelecionado) return;
    quantidadeSelecionada = 1;
    const p = produtoSelecionado;
    conteudoModalProduto.innerHTML = `
        <div class="detalhes-produto">
            <div class="imagem-detalhe"><img src="${obterImagem(p)}" data-id="${escaparHTML(p.id_produto)}" alt="${escaparHTML(p.nome_produto)}" onerror="proximaImagem(this)"></div>
            <div class="dados-detalhe">
                <p class="categoria-detalhe">${escaparHTML(obterNomeCategoria(p.id_categoria))}</p>
                <h2 id="modalNomeProduto">${escaparHTML(p.nome_produto)}</h2>
                <p><strong>Unidade de medida:</strong> ${escaparHTML(obterNomeUnidade(p.id_unidade_medida))}</p>
                <p><strong>Categoria:</strong> ${escaparHTML(obterNomeCategoria(p.id_categoria))}</p>
                <p class="preco-detalhe">${formatarPreco(p.preco_unitario_produto)}</p>
                <div class="controle-quantidade">
                    <span>Quantidade</span>
                    <div class="seletor-quantidade">
                        <button type="button" id="diminuirQuantidade" aria-label="Diminuir quantidade">−</button>
                        <output id="valorQuantidade">1</output>
                        <button type="button" id="aumentarQuantidade" aria-label="Aumentar quantidade">+</button>
                    </div>
                </div>
                <p class="categoria-detalhe">${estoqueDoProduto(p) > 0 ? `${estoqueDoProduto(p)} em estoque` : 'Produto sem estoque'}</p>
                <button class="adicionar-carrinho" type="button" id="adicionarCarrinho" ${estoqueDoProduto(p) > 0 ? '' : 'disabled'}>${estoqueDoProduto(p) > 0 ? 'Adicionar ao carrinho' : 'Indisponível'}</button>
                <p class="mensagem-carrinho" id="mensagemCarrinho" aria-live="polite"></p>
            </div>
        </div>
    `;
    modalProduto.hidden = false;
    document.body.classList.add('modal-aberto');
    document.getElementById('diminuirQuantidade').addEventListener('click', () => alterarQuantidade(-1));
    document.getElementById('aumentarQuantidade').addEventListener('click', () => alterarQuantidade(1));
    document.getElementById('adicionarCarrinho').addEventListener('click', adicionarAoCarrinho);
}

function estoqueDoProduto(produto) {
    const estoque = Number(produto?.quantidade_estoque_produto);
    return Number.isFinite(estoque) ? Math.max(0, estoque) : 0;
}

// Quantas unidades ainda podem ser colocadas no carrinho (estoque − o que já está nele).
function disponivelParaAdicionar(produto) {
    const noCarrinho = carrinho.find(item => String(item.id_produto) === String(produto.id_produto));
    return Math.max(0, estoqueDoProduto(produto) - (noCarrinho ? Number(noCarrinho.quantidade) : 0));
}

function alterarQuantidade(delta) {
    const limite = Math.max(1, disponivelParaAdicionar(produtoSelecionado));
    quantidadeSelecionada = Math.min(limite, Math.max(1, quantidadeSelecionada + delta));
    document.getElementById('valorQuantidade').textContent = quantidadeSelecionada;
}

function adicionarAoCarrinho() {
    const mensagemCarrinho = document.getElementById('mensagemCarrinho');
    const disponivel = disponivelParaAdicionar(produtoSelecionado);

    if (estoqueDoProduto(produtoSelecionado) <= 0) {
        mensagemCarrinho.textContent = 'Produto sem estoque no momento.';
        return;
    }
    if (disponivel <= 0) {
        mensagemCarrinho.textContent = 'Você já colocou no carrinho todo o estoque disponível deste produto.';
        return;
    }

    const quantidade = Math.min(quantidadeSelecionada, disponivel);
    const existente = carrinho.find(item => String(item.id_produto) === String(produtoSelecionado.id_produto));
    if (existente) {
        existente.quantidade += quantidade;
        existente.estoque = estoqueDoProduto(produtoSelecionado);
    } else carrinho.push({
        id_produto: produtoSelecionado.id_produto,
        nome: produtoSelecionado.nome_produto,
        preco: Number(produtoSelecionado.preco_unitario_produto),
        quantidade,
        estoque: estoqueDoProduto(produtoSelecionado),
        imagem: obterImagem(produtoSelecionado)
    });
    salvarCarrinhoSalvo();
    mensagemCarrinho.textContent = quantidade < quantidadeSelecionada
        ? `Adicionamos ${quantidade} unidade(s): é o máximo disponível em estoque.`
        : 'Produto adicionado ao carrinho!';
    quantidadeSelecionada = 1;
    document.getElementById('valorQuantidade').textContent = quantidadeSelecionada;
}

function fecharModal() {
    modalProduto.hidden = true;
    document.body.classList.remove('modal-aberto');
}

// Datas do banco chegam como 'AAAA-MM-DD': formata sem passar por Date (evita voltar um dia).
function formatarDataBR(valor) {
    const partes = String(valor || '').slice(0, 10).split('-');
    return partes.length === 3 && partes[0].length === 4 ? `${partes[2]}/${partes[1]}/${partes[0]}` : '-';
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);
}

campoPesquisa.addEventListener('input', renderizarProdutos);
formPesquisa.addEventListener('submit', evento => {
    evento.preventDefault();
    renderizarProdutos();
});

carregarCategorias();
carregarProdutos();


const botaoPedidos = document.getElementById('botaoPedidos');
const botaoDevolucoes = document.getElementById('botaoDevolucoes');

const secaoProdutos = document.querySelector('.secao-produtos');
const secaoHistorico = document.getElementById('secaoHistorico');
const tituloHistorico = document.getElementById('tituloHistorico');
const listaHistorico = document.getElementById('listaHistorico');
const botaoVoltarProdutos = document.getElementById('botaoVoltarProdutos');

function verificarLogin() {
    const tokenAtual = sessionStorage.getItem('token');
    const perfilAtual = sessionStorage.getItem('perfil');

    if (!tokenAtual || perfilAtual !== 'cliente') {
        alert('Faça o login primeiro!');
        return false;
    }

    return true;
}

async function carregarHistorico(tipo) {
    if (!verificarLogin()) return;

    secaoProdutos.hidden = true;
    secaoHistorico.hidden = false;

    tituloHistorico.textContent =
        tipo === 'pedidos' ? 'Pedidos realizados' : 'Devoluções';

    listaHistorico.innerHTML = '<p>Carregando...</p>';

    try {
        const tokenAtual = sessionStorage.getItem('token');

        const rota = tipo === 'pedidos'
            ? '/pedido/meus-pedidos'
            : '/devolucao/minhas-devolucoes';

        const resposta = await fetch(`${API}${rota}`, {
            headers: {
                Authorization: `Bearer ${tokenAtual}`
            }
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.mensagem || 'Não foi possível carregar os dados.');
        }

        const registros = tipo === 'pedidos'
            ? dados.pedidos
            : dados.devolucoes;

        if (!registros || registros.length === 0) {
            listaHistorico.innerHTML = '<p>Nenhum registro encontrado.</p>';
            return;
        }

        listaHistorico.innerHTML = registros.map(registro => `
            <article class="item-historico">
                <h3>
                    ${tipo === 'pedidos' ? 'Pedido' : 'Devolução'}
                    #${registro.id_pedido || registro.id_devolucao}
                </h3>

                <p><strong>Data:</strong> ${formatarDataBR(registro.data_pedido || registro.data_devolucao)}</p>

                ${tipo === 'devolucoes' ? `
                    <p><strong>Pedido relacionado:</strong> #${registro.pedido_id_pedido}</p>
                    <p><strong>Motivo:</strong> ${escaparHTML(registro.motivo_devolucao)}</p>
                ` : ''}

                <p><strong>Valor:</strong> ${formatarPreco(registro.valor_total)}</p>

                <h4>Produtos:</h4>

                <ul>
                    ${(registro.produtos || []).map(produto => `
                        <li>
                            ${escaparHTML(produto.nome_produto)}
                            — Quantidade: ${produto.quantidade}
                        </li>
                    `).join('')}
                </ul>
            </article>
        `).join('');

    } catch (erro) {
        console.error(erro);
        listaHistorico.innerHTML = `<p>${escaparHTML(erro.message)}</p>`;
    }
}

botaoPedidos.addEventListener('click', () => {
    carregarHistorico('pedidos');
});

botaoDevolucoes.addEventListener('click', () => {
    carregarHistorico('devolucoes');
});

// Volta para a vitrine (sem filtros) vindo de Pedidos realizados/Devoluções ou de qualquer ponto da página.
function mostrarProdutos() {
    secaoHistorico.hidden = true;
    secaoProdutos.hidden = false;
    categoriaSelecionada = 'todas';
    campoPesquisa.value = '';
    renderizarCategorias();
    renderizarProdutos();
    secaoProdutos.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

botaoVoltarProdutos.addEventListener('click', mostrarProdutos);
document.getElementById('botaoProdutos').addEventListener('click', mostrarProdutos);
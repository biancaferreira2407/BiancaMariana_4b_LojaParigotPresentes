const CHAVE_CARRINHO = 'carrinhoParigot';
const CHAVE_PREFERENCIAS = 'preferenciasPedidoParigot';
const DESTINO_PAGAMENTO = '../formaPagamento/formaPagamento.html';
const DESTINO_LOGIN = '../login/login.html';
const API_ENDERECO = 'http://localhost:3001/pedido/endereco-cliente';
const TAXA_ENTREGA_CENTAVOS = 700;
const TAXA_EMBRULHO_UNIDADE_CENTAVOS = 150;

const listaProdutos = document.getElementById('listaProdutos');
const quantidadeItens = document.getElementById('quantidadeItens');
const subtotal = document.getElementById('subtotal');
const taxaEntregaEl = document.getElementById('taxaEntrega');
const taxaEmbrulhoEl = document.getElementById('taxaEmbrulho');
const totalParcialEl = document.getElementById('totalParcial');
const resumoRecebimento = document.getElementById('resumoRecebimento');
const resumoEmbrulho = document.getElementById('resumoEmbrulho');
const observacaoEntrega = document.getElementById('observacaoEntrega');
const botaoContinuar = document.getElementById('continuarPagamento');
const mensagem = document.getElementById('mensagemPreferencias');
const opcoesEmbrulho = document.getElementById('opcoesEmbrulho');
const campoEndereco = document.getElementById('campoEndereco');
const enderecoEntrega = document.getElementById('enderecoEntrega');

function lerJSON(chave, padrao) {
    try { const valor = JSON.parse(localStorage.getItem(chave) || 'null'); return valor ?? padrao; }
    catch (erro) { console.error(`Erro ao ler ${chave}:`, erro); return padrao; }
}
const carrinho = lerJSON(CHAVE_CARRINHO, []);
const preferenciasSalvas = lerJSON(CHAVE_PREFERENCIAS, null);
let enderecoCarregado = false;
function moedaCentavos(valor) { return (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function escaparHTML(valor) { return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function recebimentoSelecionado() { return document.querySelector('input[name="recebimento"]:checked')?.value || ''; }
function idProduto(item) { return Number(item.id_produto ?? item.id ?? item.produto_id_produto); }
function mapaEmbrulhos() {
    const mapa = {};
    opcoesEmbrulho.querySelectorAll('input[data-id-produto]').forEach(input => { mapa[String(input.dataset.idProduto)] = input.checked; });
    return mapa;
}
function calcularValores() {
    const subtotalCentavos = carrinho.reduce((s, i) => s + Math.round(Number(i.preco || 0) * 100) * Math.max(0, Number(i.quantidade) || 0), 0);
    const mapa = mapaEmbrulhos();
    const unidadesEmbrulhadas = carrinho.reduce((s, item) => s + (mapa[String(idProduto(item))] ? Math.max(0, Number(item.quantidade) || 0) : 0), 0);
    const entregaCentavos = recebimentoSelecionado() === 'entrega' ? TAXA_ENTREGA_CENTAVOS : 0;
    const embrulhoCentavos = unidadesEmbrulhadas * TAXA_EMBRULHO_UNIDADE_CENTAVOS;
    return { subtotalCentavos, entregaCentavos, embrulhoCentavos, totalParcialCentavos: subtotalCentavos + entregaCentavos + embrulhoCentavos, unidadesEmbrulhadas };
}
function renderizarOpcoesEmbrulho() {
    if (!Array.isArray(carrinho) || carrinho.length === 0) { opcoesEmbrulho.innerHTML = '<p class="nota">Seu carrinho está vazio.</p>'; return; }
    const salvos = preferenciasSalvas?.embrulhos && typeof preferenciasSalvas.embrulhos === 'object' ? preferenciasSalvas.embrulhos : {};
    opcoesEmbrulho.innerHTML = carrinho.map(item => {
        const id = idProduto(item); const marcado = Boolean(salvos[String(id)]);
        return `<label class="produto-embrulho"><span class="produto-embrulho-info"><strong>${escaparHTML(item.nome || item.nome_produto || `Produto ${id}`)}</strong><small>Quantidade: ${Number(item.quantidade) || 0} · ${marcado ? moedaCentavos(Math.max(0, Number(item.quantidade)||0) * TAXA_EMBRULHO_UNIDADE_CENTAVOS) : 'Sem taxa de embrulho'}</small></span><span class="produto-embrulho-check"><input type="checkbox" data-id-produto="${id}" ${marcado ? 'checked' : ''}><span>Embrulhar · R$ 1,50/un.</span></span></label>`;
    }).join('');
    opcoesEmbrulho.querySelectorAll('input').forEach(input => input.addEventListener('change', atualizarInterface));
}
function renderizarResumo() {
    if (!Array.isArray(carrinho) || carrinho.length === 0) {
        listaProdutos.innerHTML = '<p class="nota">Seu carrinho está vazio. Volte à loja e adicione produtos.</p>';
        botaoContinuar.disabled = true; mensagem.textContent = 'Adicione produtos ao carrinho antes de continuar.'; return;
    }
    const qtd = carrinho.reduce((s, i) => s + Math.max(0, Number(i.quantidade) || 0), 0);
    const total = carrinho.reduce((s, i) => s + Math.round(Number(i.preco || 0) * 100) * Math.max(0, Number(i.quantidade) || 0), 0);
    quantidadeItens.textContent = String(qtd); subtotal.textContent = moedaCentavos(total);
    listaProdutos.innerHTML = carrinho.map(i => `<div class="produto"><span>${escaparHTML(i.nome || i.nome_produto)} × ${Number(i.quantidade)||0}</span><strong>${moedaCentavos(Math.round((Number(i.preco)||0)*100)*(Number(i.quantidade)||0))}</strong></div>`).join('');
}
function restaurarPreferencias() {
    if (preferenciasSalvas?.recebimento) {
        const input = document.querySelector(`input[name="recebimento"][value="${preferenciasSalvas.recebimento}"]`);
        if (input) input.checked = true;
    }
}
async function carregarEnderecoCadastrado() {
    enderecoCarregado = false; enderecoEntrega.value = '';
    if (!sessionStorage.getItem('token')) return false;
    try {
        const resposta = await fetch(API_ENDERECO, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível consultar o endereço cadastrado.');
        enderecoEntrega.value = dados.endereco || '';
        enderecoCarregado = Boolean(enderecoEntrega.value.trim());
        return enderecoCarregado;
    } catch (erro) { console.warn(erro); mensagem.textContent = erro.message || 'Não foi possível carregar seu endereço.'; return false; }
}
function atualizarInterface() {
    const recebimento = recebimentoSelecionado(); const mapa = mapaEmbrulhos();
    const valores = calcularValores();
    resumoRecebimento.textContent = recebimento === 'retirada' ? 'Retirada na loja' : recebimento === 'entrega' ? 'Entrega' : 'A escolher';
    resumoEmbrulho.textContent = valores.unidadesEmbrulhadas ? `${valores.unidadesEmbrulhadas} unidade(s)` : 'Nenhum';
    campoEndereco.hidden = recebimento !== 'entrega';
    observacaoEntrega.textContent = recebimento === 'entrega' ? 'Endereço cadastrado na sua conta. O campo não pode ser editado nesta etapa.' : recebimento === 'retirada' ? 'A loja informará os detalhes e o horário disponíveis para retirada.' : 'Selecione como deseja receber seu pedido.';
    document.querySelectorAll('.opcao').forEach(opcao => { const input = opcao.querySelector('input'); opcao.classList.toggle('selecionada', input.checked); });
    taxaEntregaEl.textContent = moedaCentavos(valores.entregaCentavos);
    taxaEmbrulhoEl.textContent = moedaCentavos(valores.embrulhoCentavos);
    totalParcialEl.textContent = moedaCentavos(valores.totalParcialCentavos);
    const enderecoValido = recebimento !== 'entrega' || enderecoCarregado || !sessionStorage.getItem('token');
    botaoContinuar.disabled = !recebimento || !enderecoValido || carrinho.length === 0;
    if (!recebimento) mensagem.textContent = 'Escolha retirada ou entrega.';
    else if (recebimento === 'entrega' && !sessionStorage.getItem('token')) mensagem.textContent = 'Para usar entrega, entre na sua conta para carregar o endereço cadastrado.';
    else if (recebimento === 'entrega' && !enderecoValido) mensagem.textContent = 'Não há endereço cadastrado na sua conta. Atualize seu cadastro para solicitar entrega.';
    else mensagem.textContent = '';
}
document.querySelectorAll('input[name="recebimento"]').forEach(input => input.addEventListener('change', async () => {
    if (input.value === 'entrega' && input.checked && sessionStorage.getItem('token')) await carregarEnderecoCadastrado();
    atualizarInterface();
}));
botaoContinuar.addEventListener('click', async () => {
    const recebimento = recebimentoSelecionado();
    if (recebimento === 'entrega' && !sessionStorage.getItem('token')) {
        sessionStorage.setItem('redirecionarAposLogin', '../entregaPresente/entregaPresente.html');
        localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify({ recebimento: 'entrega', embrulhos: mapaEmbrulhos() }));
        window.location.href = DESTINO_LOGIN; return;
    }
    if (recebimento === 'entrega' && !enderecoCarregado) await carregarEnderecoCadastrado();
    atualizarInterface();
    if (botaoContinuar.disabled) return;
    const preferencias = { recebimento, enderecoEntrega: recebimento === 'entrega' ? enderecoEntrega.value.trim() : null, embrulhos: mapaEmbrulhos(), atualizadoEm: new Date().toISOString() };
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
    window.location.href = DESTINO_PAGAMENTO;
});
restaurarPreferencias(); renderizarOpcoesEmbrulho(); renderizarResumo();
if (recebimentoSelecionado() === 'entrega' && sessionStorage.getItem('token')) carregarEnderecoCadastrado().then(atualizarInterface);
atualizarInterface();

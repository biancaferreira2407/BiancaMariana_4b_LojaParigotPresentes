const CHAVE_CARRINHO = 'carrinhoParigot';
const CHAVE_SELECAO_PAGAMENTO = 'pagamentoParigot';
const CHAVE_PREFERENCIAS_PEDIDO = 'preferenciasPedidoParigot';
const API_VALIDAR_PAGAMENTO = 'http://localhost:3001/pedido/validar-pagamento';

const JUROS_CREDITO = { 1: 0, 2: 20, 3: 30 };

const metodos = [
    { id: 'pix', nome: 'PIX', checkbox: 'usarPix', valor: 'valorPix', detalhes: 'detalhesPix' },
    { id: 'credito', nome: 'Cartão de crédito', checkbox: 'usarCredito', valor: 'valorCredito', detalhes: 'detalhesCredito' },
    { id: 'debito', nome: 'Cartão de débito', checkbox: 'usarDebito', valor: 'valorDebito', detalhes: 'detalhesDebito' },
    { id: 'dinheiro', nome: 'Dinheiro', checkbox: 'usarDinheiro', valor: 'valorDinheiro', detalhes: 'detalhesDinheiro' }
];

const listaResumo = document.getElementById('listaResumo');
const subtotalResumo = document.getElementById('subtotalResumo');
const jurosResumo = document.getElementById('jurosResumo');
const totalResumo = document.getElementById('totalResumo');
const distribuicao = document.getElementById('distribuicao');
const valorRestante = document.getElementById('valorRestante');
const botaoContinuar = document.getElementById('continuarPagamento');
const mensagem = document.getElementById('mensagemPagamento');
const campoParcelas = document.getElementById('parcelasCredito');

function mostrarPreferenciasPedido() {
    let preferencias = null;
    try { preferencias = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS_PEDIDO) || 'null'); } catch (erro) { console.error(erro); }
    const recebimento = document.getElementById('tipoRecebimentoResumo');
    const embrulho = document.getElementById('embrulhoResumo');
    const entrega = document.getElementById('entregaResumo');
    if (!recebimento || !embrulho || !entrega) return;
    recebimento.textContent = preferencias?.recebimento === 'entrega' ? 'Entrega' : preferencias?.recebimento === 'retirada' ? 'Retirada na loja' : 'Não selecionado';
    const mapa = preferencias?.embrulhos || {};
    const qtd = carrinho.reduce((total, item) => { const id = String(item.id_produto ?? item.id ?? item.produto_id_produto); return total + (mapa[id] === true ? Math.max(0, Number(item.quantidade) || 0) : 0); }, 0);
    embrulho.textContent = qtd ? `${qtd} unidade(s) · ${moedaCentavos(qtd * 150)}` : 'Nenhum';
    entrega.textContent = preferencias?.recebimento === 'entrega' ? `${preferencias.enderecoEntrega || 'Endereço cadastrado'} · R$ 7,00` : preferencias?.recebimento === 'retirada' ? 'Sem taxa' : 'A combinar';
}
function lerCarrinho() {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '[]');
        return Array.isArray(dados) ? dados : [];
    } catch (erro) {
        console.error('Erro ao ler carrinho:', erro);
        return [];
    }
}

const carrinho = lerCarrinho();
const totalProdutosCentavos = carrinho.reduce((soma, item) => {
    const preco = Math.round(Number(item.preco) * 100);
    const quantidade = Number(item.quantidade);
    if (!Number.isFinite(preco) || !Number.isInteger(quantidade) || quantidade <= 0) return soma;
    return soma + preco * quantidade;
}, 0);
const preferenciasCheckout = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS_PEDIDO) || 'null') || {}; } catch { return {}; } })();
const unidadesEmbrulhadas = carrinho.reduce((soma, item) => {
    const id = String(item.id_produto ?? item.id ?? item.produto_id_produto);
    return soma + (preferenciasCheckout.embrulhos?.[id] === true ? Math.max(0, Number(item.quantidade) || 0) : 0);
}, 0);
const taxaEntregaCentavos = preferenciasCheckout.recebimento === 'entrega' ? 700 : 0;
const taxaEmbrulhoCentavos = unidadesEmbrulhadas * 150;
const totalCarrinhoCentavos = totalProdutosCentavos + taxaEntregaCentavos + taxaEmbrulhoCentavos;

function moedaCentavos(centavos) {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caractere]);
}

function parcelasSelecionadas() {
    return Number(campoParcelas.value || 1);
}

function jurosCreditoCentavos(valorCreditoCentavos) {
    const percentual = JUROS_CREDITO[parcelasSelecionadas()] ?? 0;
    return Math.round(valorCreditoCentavos * percentual / 100);
}

function metodosSelecionados() {
    return metodos.filter(metodo => document.getElementById(metodo.checkbox).checked);
}

function valorDoMetodoCentavos(metodo) {
    const campo = document.getElementById(metodo.valor);
    if (campo.value === '') return 0;
    const valor = Number(campo.value);
    return Number.isFinite(valor) && valor >= 0 ? Math.round(valor * 100) : 0;
}

function mostrarResumo() {
    if (carrinho.length === 0) {
        listaResumo.innerHTML = '<p class="vazio-resumo">Seu carrinho está vazio.</p>';
        mensagem.textContent = 'Adicione produtos ao carrinho antes de escolher o pagamento.';
        botaoContinuar.disabled = true;
        return;
    }

    listaResumo.innerHTML = carrinho.map(item => {
        const quantidade = Number(item.quantidade);
        const precoCentavos = Math.round(Number(item.preco) * 100);
        return `
            <div class="produto-resumo">
                <span>${escaparHTML(item.nome)} × ${quantidade}</span>
                <strong>${moedaCentavos(precoCentavos * quantidade)}</strong>
            </div>
        `;
    }).join('');
}

function atualizarInterface() {
    const selecionados = metodosSelecionados();
    let somaPrincipalCentavos = 0;

    metodos.forEach(metodo => {
        const checkbox = document.getElementById(metodo.checkbox);
        const campoValor = document.getElementById(metodo.valor);
        const detalhes = document.getElementById(metodo.detalhes);
        const selecionado = checkbox.checked;

        detalhes.hidden = !selecionado;
        campoValor.disabled = !selecionado;
        checkbox.closest('.opcao-pagamento').classList.toggle('selecionada', selecionado);

        if (metodo.id === 'credito') campoParcelas.disabled = !selecionado;

        if (metodo.id === 'dinheiro') {
            const precisaTroco = document.getElementById('precisaTroco');
            precisaTroco.disabled = !selecionado;
            document.getElementById('campoTroco').hidden = !selecionado || !precisaTroco.checked;
            document.getElementById('valorTroco').disabled = !selecionado || !precisaTroco.checked;
        }

        if (selecionado) somaPrincipalCentavos += valorDoMetodoCentavos(metodo);
    });

    const creditoSelecionado = selecionados.some(metodo => metodo.id === 'credito');
    const principalCreditoCentavos = creditoSelecionado
        ? valorDoMetodoCentavos(metodos.find(metodo => metodo.id === 'credito'))
        : 0;
    const jurosCentavos = creditoSelecionado ? jurosCreditoCentavos(principalCreditoCentavos) : 0;
    const totalFinalCentavos = totalCarrinhoCentavos + jurosCentavos;
    const restanteCentavos = totalCarrinhoCentavos - somaPrincipalCentavos;

    subtotalResumo.textContent = moedaCentavos(totalProdutosCentavos);
    document.getElementById('freteResumo').textContent = moedaCentavos(taxaEntregaCentavos);
    document.getElementById('embrulhoTaxaResumo').textContent = moedaCentavos(taxaEmbrulhoCentavos);
    jurosResumo.textContent = moedaCentavos(jurosCentavos);
    totalResumo.textContent = moedaCentavos(totalFinalCentavos);
    valorRestante.textContent = moedaCentavos(restanteCentavos);
    valorRestante.style.color = restanteCentavos < 0 ? '#b0443c' : '';

    if (selecionados.length === 0) {
        distribuicao.innerHTML = '<p>Selecione uma forma de pagamento para distribuir o subtotal dos produtos.</p>';
    } else {
        distribuicao.innerHTML = selecionados.map(metodo => {
            const principal = valorDoMetodoCentavos(metodo);
            if (metodo.id === 'credito') {
                const juros = jurosCreditoCentavos(principal);
                const percentual = JUROS_CREDITO[parcelasSelecionadas()] ?? 0;
                return `<div class="item-distribuicao"><span>Crédito (${percentual}% de juros)</span><strong>${moedaCentavos(principal + juros)}</strong></div>`;
            }
            return `<div class="item-distribuicao"><span>${metodo.nome}</span><strong>${moedaCentavos(principal)}</strong></div>`;
        }).join('');
    }

    const valoresPreenchidos = selecionados.every(metodo => valorDoMetodoCentavos(metodo) > 0);
    const totalPrincipalCorreto = restanteCentavos === 0;
    botaoContinuar.disabled = carrinho.length === 0 || selecionados.length === 0 || !valoresPreenchidos || !totalPrincipalCorreto;

    if (restanteCentavos < 0) {
        mensagem.textContent = `A distribuição ultrapassa o subtotal em ${moedaCentavos(Math.abs(restanteCentavos))}.`;
        mensagem.classList.remove('sucesso');
    } else if (selecionados.length > 0 && restanteCentavos > 0 && valoresPreenchidos) {
        mensagem.textContent = `Ainda faltam ${moedaCentavos(restanteCentavos)} para distribuir entre as formas de pagamento.`;
        mensagem.classList.remove('sucesso');
    } else if (totalPrincipalCorreto && selecionados.length > 0 && valoresPreenchidos) {
        mensagem.textContent = jurosCentavos > 0
            ? `Distribuição correta. Os juros do crédito acrescentam ${moedaCentavos(jurosCentavos)} ao total.`
            : 'A distribuição do pagamento está correta.';
        mensagem.classList.add('sucesso');
    } else {
        mensagem.textContent = '';
        mensagem.classList.remove('sucesso');
    }
}

metodos.forEach(metodo => {
    document.getElementById(metodo.checkbox).addEventListener('change', atualizarInterface);
    document.getElementById(metodo.valor).addEventListener('input', atualizarInterface);
});

campoParcelas.addEventListener('change', atualizarInterface);
document.getElementById('precisaTroco').addEventListener('change', atualizarInterface);
document.getElementById('valorTroco').addEventListener('input', atualizarInterface);

async function validarPagamentoNoServidor(pagamentos) {
    const token = sessionStorage.getItem('token');
    if (!token) throw new Error('Faça login para continuar com a finalização da compra.');

    const resposta = await fetch(API_VALIDAR_PAGAMENTO, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
            itens: carrinho.map(item => ({ id_produto: item.id_produto, quantidade: Number(item.quantidade) })),
            preferenciasPedido: JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS_PEDIDO) || 'null'),
            pagamentos
        })
    });

    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível validar o pagamento.');
    return dados;
}

botaoContinuar.addEventListener('click', async () => {
    if (botaoContinuar.disabled) return;

    const selecionados = metodosSelecionados();
    const pagamentos = selecionados.map(metodo => ({
        metodo: metodo.id,
        // O valor informado é a parte do subtotal destinada a esta forma, antes dos juros.
        valor: valorDoMetodoCentavos(metodo) / 100,
        ...(metodo.id === 'credito' ? { parcelas: parcelasSelecionadas() } : {}),
        ...(metodo.id === 'dinheiro' ? {
            precisaTroco: document.getElementById('precisaTroco').checked,
            valorTroco: document.getElementById('precisaTroco').checked
                ? Number(document.getElementById('valorTroco').value || 0)
                : null
        } : {})
    }));

    if (pagamentos.some(pagamento => pagamento.metodo === 'dinheiro' && pagamento.precisaTroco && pagamento.valorTroco <= pagamento.valor)) {
        mensagem.textContent = 'O valor informado para troco precisa ser maior que a parte paga em dinheiro.';
        mensagem.classList.remove('sucesso');
        return;
    }

    botaoContinuar.disabled = true;
    botaoContinuar.textContent = 'Conferindo compra...';
    mensagem.textContent = '';

    try {
        const validacao = await validarPagamentoNoServidor(pagamentos);
        const preferenciasConfirmadas = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS_PEDIDO) || 'null') || {};
        preferenciasConfirmadas.recebimento = validacao.recebimento;
        preferenciasConfirmadas.enderecoEntrega = validacao.endereco_entrega || null;
        localStorage.setItem(CHAVE_PREFERENCIAS_PEDIDO, JSON.stringify(preferenciasConfirmadas));
        sessionStorage.setItem(CHAVE_SELECAO_PAGAMENTO, JSON.stringify({
            pagamentos: validacao.pagamentos,
            subtotalProdutos: validacao.subtotal_produtos,
            taxaEntrega: validacao.taxa_entrega,
            taxaEmbrulho: validacao.taxa_embrulho,
            jurosCredito: validacao.juros_total,
            totalComJuros: validacao.total,
            itensValidados: validacao.itens,
            atualizadoEm: new Date().toISOString()
        }));
        window.location.href = '../revisaoPedido/revisaoPedido.html';
        return;
    } catch (erro) {
        console.error('Erro ao validar pagamento:', erro);
        mensagem.textContent = erro.message || 'Não foi possível conferir o pagamento. Tente novamente.';
        mensagem.classList.remove('sucesso');
    } finally {
        botaoContinuar.textContent = 'Continuar →';
        atualizarInterface();
    }
});


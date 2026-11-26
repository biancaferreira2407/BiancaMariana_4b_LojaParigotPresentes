const URL_API = 'http://localhost:3001';

const STATUS_PEDIDO = ['Em andamento', 'Pedido pronto', 'Entregue'];

let pedidos = [];
let abaAtual = 'nao_confirmado';
let pedidoAberto = null; // pedido exibido no modal de detalhes

const tabelaCabecalho = document.getElementById('tabelaCabecalho');
const tabelaCorpo = document.getElementById('tabelaCorpo');
const buscar = document.getElementById('buscar');
const filtroStatus = document.getElementById('filtroStatus');
const campoFiltroStatus = document.getElementById('campoFiltroStatus');
const mensagem = document.getElementById('mensagem');
const modal = document.getElementById('modalDetalhes');
const detalhesPedido = document.getElementById('detalhesPedido');
const tituloDetalhes = document.getElementById('tituloDetalhes');

/* ---------- Normalização (inclui pedidos antigos do banco) ---------- */

function semAcento(texto) {
    return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// "Confirmado" e "Pago" (pedidos antigos do balcão) contam como confirmados.
function pagamentoConfirmado(pedido) {
    return ['confirmado', 'pago'].includes(semAcento(pedido.status_pagamento));
}

function statusPedidoNormalizado(pedido) {
    const s = semAcento(pedido.status_pedido);
    if (s === 'entregue' || s === 'concluido') return 'Entregue';
    if (s === 'pedido pronto' || s === 'entregando') return 'Pedido pronto'; // "Entregando" = pedidos antigos
    return 'Em andamento';
}

/* ---------- Carregamento ---------- */

async function carregarPedidos() {
    try {
        const resposta = await fetch(`${URL_API}/pedido`);
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'Erro ao carregar pedidos.');
        pedidos = Array.isArray(dados.pedidos) ? dados.pedidos : [];
        renderizar();
    } catch (erro) {
        console.error('Erro ao carregar pedidos:', erro);
        tabelaCabecalho.innerHTML = '';
        tabelaCorpo.innerHTML = '<tr><td class="gp-vazio">Servidor offline ou erro ao carregar os pedidos.</td></tr>';
    }
}

/* ---------- Renderização ---------- */

function pedidosDaAba() {
    const confirmados = abaAtual === 'confirmado';
    const termo = semAcento(buscar.value);
    const status = filtroStatus.value;

    return pedidos.filter(p => {
        if (pagamentoConfirmado(p) !== confirmados) return false;
        if (confirmados && status && statusPedidoNormalizado(p) !== status) return false;
        if (!termo) return true;
        const texto = [p.id_pedido, p.data_pedido, formatarData(p.data_pedido), p.nome_cliente || ''].join(' ');
        return semAcento(texto).includes(termo);
    });
}

function renderizar() {
    const totalConfirmados = pedidos.filter(pagamentoConfirmado).length;
    document.getElementById('contConfirmado').textContent = totalConfirmados;
    document.getElementById('contNaoConfirmado').textContent = pedidos.length - totalConfirmados;

    const confirmados = abaAtual === 'confirmado';
    campoFiltroStatus.hidden = !confirmados;

    tabelaCabecalho.innerHTML = confirmados
        ? '<tr><th>ID</th><th>Data</th><th>Cliente</th><th>Recebimento</th><th>Total</th><th>Status do pedido</th><th>Ações</th></tr>'
        : '<tr><th>ID</th><th>Data</th><th>Cliente</th><th>Recebimento</th><th>Total</th><th>Pagamento</th><th>Ações</th></tr>';

    const lista = pedidosDaAba();
    const colunas = 7;
    if (!lista.length) {
        tabelaCorpo.innerHTML = `<tr><td colspan="${colunas}" class="gp-vazio">${
            confirmados ? 'Nenhum pedido com pagamento confirmado encontrado.' : 'Nenhum pedido aguardando confirmação de pagamento.'
        }</td></tr>`;
        return;
    }

    tabelaCorpo.innerHTML = lista.map(p => {
        const recebimento = p.entrega_ou_retirada === 'entrega' ? 'Entrega' : (p.entrega_ou_retirada === 'retirada' ? 'Retirada' : '-');
        const comuns = `
            <td>${p.id_pedido}</td>
            <td>${formatarData(p.data_pedido)}</td>
            <td>${escapeHtml(p.nome_cliente || 'Sem cliente')}</td>
            <td>${recebimento}</td>
            <td>${formatarMoeda(p.valor_total)}</td>`;

        if (confirmados) {
            const atual = statusPedidoNormalizado(p);
            const entregue = atual === 'Entregue';
            return `<tr>${comuns}
                <td>
                    <select class="gp-select-status ${classeStatus(atual)}" data-status-pedido="${p.id_pedido}" aria-label="Status do pedido ${p.id_pedido}">
                        ${STATUS_PEDIDO.map(s => `<option value="${s}" ${s === atual ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </td>
                <td><div class="gp-acoes">
                    <button type="button" class="gp-btn" data-detalhes="${p.id_pedido}">👁 Detalhes</button>
                    <button type="button" class="gp-btn gp-desfazer" data-desfazer="${p.id_pedido}" ${entregue ? 'disabled title="Pedido já entregue: mude o status para Pedido pronto ou Em andamento antes de desfazer."' : 'title="Voltar este pedido para Pagamento não confirmado"'}>↩ Desfazer confirmação</button>
                </div></td>
            </tr>`;
        }
        return `<tr>${comuns}
            <td><span class="gp-selo">Não confirmado</span></td>
            <td><div class="gp-acoes">
                <button type="button" class="gp-btn" data-detalhes="${p.id_pedido}">👁 Detalhes</button>
                <button type="button" class="gp-btn gp-principal" data-confirmar="${p.id_pedido}">✔ Confirmar pagamento</button>
            </div></td>
        </tr>`;
    }).join('');
}

function classeStatus(status) {
    return { 'Em andamento': 'gp-andamento', 'Pedido pronto': 'gp-pronto', 'Entregue': 'gp-entregue' }[status] || '';
}

/* ---------- Ações ---------- */

function mostrarMensagem(texto, tipo) {
    mensagem.textContent = texto || '';
    mensagem.className = 'gp-msg' + (tipo === 'ok' ? ' gp-ok' : tipo === 'erro' ? ' gp-erro' : '');
}

// Monta o link do WhatsApp (wa.me) com a mensagem já digitada. Ele só ABRE a conversa:
// quem envia é o gerente, apertando o botão de enviar no próprio WhatsApp.
function telefoneParaWhatsapp(telefone) {
    let t = String(telefone ?? '').replace(/\D/g, '');
    if (t.length === 10 || t.length === 11) t = '55' + t; // DDD + número => acrescenta o DDI do Brasil
    return t.length >= 12 && t.length <= 13 ? t : null;
}

function linkWhatsapp(telefone, texto) {
    const numero = telefoneParaWhatsapp(telefone);
    if (!numero) return null;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function linkWhatsappPedidoConfirmado(telefone, recebimento) {
    // Pedido para retirada na loja não tem "entrega": o prazo passa a ser o de retirada.
    const prazo = recebimento === 'retirada' ? 'prazo de retirada' : 'prazo de entrega';
    return linkWhatsapp(telefone, `olá, tudo bem?\nseu pedido foi confirmado.\n${prazo}: `);
}

function linkWhatsappPedidoPronto(telefone, recebimento) {
    let texto = 'olá, tudo bem?\nseu pedido está pronto';
    if (recebimento === 'entrega') texto += '\nsaindo para entrega';
    return linkWhatsapp(telefone, texto);
}

async function confirmarPagamento(id, botao) {
    const pedido = pedidos.find(p => Number(p.id_pedido) === Number(id));
    const cliente = pedido ? ` de ${pedido.nome_cliente || 'cliente'}` : '';
    if (!confirm(`Confirmar que o pagamento do pedido #${id}${cliente} foi recebido?\n\nO pedido passará para "Em andamento" e o WhatsApp do cliente será aberto com a mensagem pronta (você decide quando enviar).`)) return;

    // A aba precisa ser aberta já no clique, senão o navegador bloqueia o pop-up depois do fetch.
    const abaWhatsapp = window.open('', '_blank');
    if (abaWhatsapp) abaWhatsapp.document.title = 'Abrindo WhatsApp...';

    if (botao) botao.disabled = true;
    mostrarMensagem('');
    try {
        const resposta = await fetch(`${URL_API}/pedido/${id}/confirmar-pagamento`, { method: 'PATCH' });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'Não foi possível confirmar o pagamento.');

        // O telefone vem do cadastro do cliente (pedido da lista ou, se aberto pelo modal, dos detalhes).
        const telefone = pedido?.telefone_cliente ?? (pedidoAberto && Number(pedidoAberto.id_pedido) === Number(id) ? pedidoAberto.telefone_cliente : null);
        const detalhe = pedidoAberto && Number(pedidoAberto.id_pedido) === Number(id) ? pedidoAberto : null;
        const link = linkWhatsappPedidoConfirmado(telefone, pedido?.entrega_ou_retirada ?? detalhe?.entrega_ou_retirada);

        fecharModal();
        let aviso = `Pagamento do pedido #${id} confirmado. Ele agora está na aba "Pagamento confirmado" como "Em andamento".`;
        if (link && abaWhatsapp) {
            abaWhatsapp.location.href = link;
            aviso += ' O WhatsApp foi aberto com a mensagem pronta: preencha o prazo de entrega e envie.';
        } else {
            if (abaWhatsapp) abaWhatsapp.close();
            aviso += link
                ? ' O navegador bloqueou a abertura do WhatsApp: permita pop-ups para este site.'
                : ' Este cliente não tem telefone válido cadastrado, então o WhatsApp não foi aberto.';
        }
        mostrarMensagem(aviso, 'ok');
        await carregarPedidos();
    } catch (erro) {
        if (abaWhatsapp) abaWhatsapp.close();
        mostrarMensagem(erro.message, 'erro');
        if (botao) botao.disabled = false;
    }
}

async function desfazerConfirmacao(id, botao) {
    const pedido = pedidos.find(p => Number(p.id_pedido) === Number(id));
    const cliente = pedido ? ` de ${pedido.nome_cliente || 'cliente'}` : '';
    if (!confirm(`Desfazer a confirmação do pagamento do pedido #${id}${cliente}?\n\nO pedido voltará para "Pagamento não confirmado".`)) return;

    if (botao) botao.disabled = true;
    mostrarMensagem('');
    try {
        const resposta = await fetch(`${URL_API}/pedido/${id}/desfazer-confirmacao`, { method: 'PATCH' });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'Não foi possível desfazer a confirmação.');
        fecharModal();
        mostrarMensagem(`Confirmação do pedido #${id} desfeita. Ele voltou para a aba "Pagamento não confirmado".`, 'ok');
        await carregarPedidos();
    } catch (erro) {
        mostrarMensagem(erro.message, 'erro');
        if (botao) botao.disabled = false;
    }
}

async function alterarStatusPedido(id, novoStatus, select) {
    const pedido = pedidos.find(p => Number(p.id_pedido) === Number(id));
    const anterior = pedido ? statusPedidoNormalizado(pedido) : 'Em andamento';
    const avisarPronto = novoStatus === 'Pedido pronto' && anterior !== 'Pedido pronto';

    // A aba do WhatsApp precisa ser aberta já no clique/seleção, senão o navegador bloqueia o pop-up após o fetch.
    const abaWhatsapp = avisarPronto ? window.open('', '_blank') : null;
    if (abaWhatsapp) abaWhatsapp.document.title = 'Abrindo WhatsApp...';

    select.disabled = true;
    mostrarMensagem('');
    try {
        const resposta = await fetch(`${URL_API}/pedido/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_pedido: novoStatus })
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'Não foi possível atualizar o status.');
        if (pedido) pedido.status_pedido = novoStatus;

        let aviso = dados.mensagem;
        if (avisarPronto) {
            // Só ABRE a conversa com a mensagem pronta: quem envia é o gerente, no próprio WhatsApp.
            const link = linkWhatsappPedidoPronto(pedido?.telefone_cliente, pedido?.entrega_ou_retirada);
            if (link && abaWhatsapp) {
                abaWhatsapp.location.href = link;
                aviso += ' O WhatsApp foi aberto com a mensagem pronta: confira e envie.';
            } else {
                if (abaWhatsapp) abaWhatsapp.close();
                aviso += link
                    ? ' O navegador bloqueou a abertura do WhatsApp: permita pop-ups para este site.'
                    : ' Este cliente não tem telefone válido cadastrado, então o WhatsApp não foi aberto.';
            }
        }
        mostrarMensagem(aviso, 'ok');
        renderizar(); // reaplica o filtro por status, se estiver ativo
    } catch (erro) {
        if (abaWhatsapp) abaWhatsapp.close();
        select.value = anterior;
        select.disabled = false;
        mostrarMensagem(erro.message, 'erro');
    }
}

/* ---------- Detalhes ---------- */

async function abrirDetalhes(id) {
    pedidoAberto = null;
    detalhesPedido.innerHTML = '<p>Carregando detalhes...</p>';
    tituloDetalhes.textContent = `Pedido #${id}`;
    modal.classList.add('gp-aberto');
    modal.setAttribute('aria-hidden', 'false');
    try {
        const resposta = await fetch(`${URL_API}/pedido/${id}`);
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || 'Não foi possível carregar os detalhes.');
        const p = dados.pedido;
        pedidoAberto = p;

        const produtos = p.produtos || [];
        const embrulhados = produtos.filter(i => semAcento(i.embrulhar) === 'sim');
        const confirmado = pagamentoConfirmado(p);

        const recebimento = p.entrega_ou_retirada === 'entrega'
            ? `Entrega em: ${escapeHtml(p.endereco_entrega || 'endereço não informado')}`
            : 'Retirada na loja';

        const taxas = [];
        if (Number(p.taxa_entrega) > 0) taxas.push(['Taxa de entrega', p.taxa_entrega]);
        if (Number(p.taxa_embrulho) > 0) taxas.push(['Taxa de embrulho', p.taxa_embrulho]);
        if (Number(p.juros_total) > 0) taxas.push(['Juros do crédito', p.juros_total]);

        detalhesPedido.innerHTML = `
            <div class="gp-dados">
                <div><strong>Cliente:</strong> ${escapeHtml(p.nome_cliente || 'Sem cliente')}</div>
                <div><strong>Data:</strong> ${formatarData(p.data_pedido)}</div>
                <div><strong>Status do pagamento:</strong> <span class="gp-selo ${confirmado ? 'gp-confirmado' : ''}">${escapeHtml(confirmado ? 'Confirmado' : (p.status_pagamento || 'Não confirmado'))}</span></div>
                <div><strong>Status do pedido:</strong> ${confirmado ? escapeHtml(statusPedidoNormalizado(p)) : 'Não confirmado'}</div>
            </div>

            <div class="gp-bloco"><h3>Produtos</h3><ul>
                ${produtos.length ? produtos.map(i => `<li><span>${Number(i.quantidade)}× ${escapeHtml(i.nome_produto)}</span><strong>${formatarMoeda(Number(i.quantidade) * Number(i.preco_unitario))}</strong></li>`).join('') : '<li>Nenhum produto.</li>'}
            </ul>
            <div class="gp-embrulho">${embrulhados.length
                ? `🎁 <strong>Embrulhar para presente:</strong> ${embrulhados.map(i => `${escapeHtml(i.nome_produto)} (${Number(i.quantidade)} un.)`).join(', ')}`
                : 'Nenhum produto para embrulhar.'}</div></div>

            <div class="gp-bloco"><h3>Recebimento</h3><p>${recebimento}</p></div>

            <div class="gp-bloco"><h3>Formas de pagamento</h3><ul>
                ${(p.pagamentos || []).length ? p.pagamentos.map(f => {
                    const det = [];
                    if (f.parcelas) det.push(`${Number(f.parcelas)}x`);
                    if (Number(f.valor_juros) > 0) det.push(`${formatarMoeda(f.valor_principal)} + ${formatarMoeda(f.valor_juros)} de juros`);
                    return `<li><span>${escapeHtml(f.nome_forma_pagamento)}${det.length ? `<small>${escapeHtml(det.join(' · '))}</small>` : ''}</span><strong>${formatarMoeda(f.valor_previsto ?? f.valor_pago)}</strong></li>`;
                }).join('') : '<li>Nenhuma forma de pagamento.</li>'}
            </ul></div>

            <div class="gp-bloco"><h3>Valores</h3><ul>
                <li><span>Subtotal dos produtos</span><strong>${formatarMoeda(p.subtotal_produtos)}</strong></li>
                ${taxas.map(([nome, valor]) => `<li><span>${nome}</span><strong>${formatarMoeda(valor)}</strong></li>`).join('')}
            </ul>
            <div class="gp-total"><span>Total do pedido</span><span>${formatarMoeda(p.valor_total)}</span></div></div>

            ${confirmado
                ? (statusPedidoNormalizado(p) === 'Entregue' ? '' : `<div class="gp-rodape-modal"><button type="button" class="gp-btn gp-desfazer" data-desfazer-modal="${p.id_pedido}">↩ Desfazer confirmação</button></div>`)
                : `<div class="gp-rodape-modal"><button type="button" class="gp-btn gp-principal" data-confirmar-modal="${p.id_pedido}">✔ Confirmar pagamento</button></div>`}
        `;
    } catch (erro) {
        console.error('Erro ao visualizar pedido:', erro);
        detalhesPedido.innerHTML = `<p>Erro: ${escapeHtml(erro.message)}</p>`;
    }
}

function fecharModal() {
    modal.classList.remove('gp-aberto');
    modal.setAttribute('aria-hidden', 'true');
    pedidoAberto = null;
}

/* ---------- Utilitários ---------- */

function formatarData(data) {
    if (!data) return '-';
    const partes = String(data).slice(0, 10).split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : data;
}

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ---------- Eventos ---------- */

document.querySelectorAll('.gp-aba').forEach(botao => {
    botao.addEventListener('click', () => {
        abaAtual = botao.dataset.aba;
        document.querySelectorAll('.gp-aba').forEach(b => {
            const ativa = b === botao;
            b.classList.toggle('gp-ativa', ativa);
            b.setAttribute('aria-selected', String(ativa));
        });
        mostrarMensagem('');
        renderizar();
    });
});

buscar.addEventListener('input', renderizar);
filtroStatus.addEventListener('change', renderizar);
document.getElementById('btnLimpar').addEventListener('click', () => {
    buscar.value = '';
    filtroStatus.value = '';
    renderizar();
});

tabelaCorpo.addEventListener('click', evento => {
    const detalhes = evento.target.closest('[data-detalhes]');
    if (detalhes) return abrirDetalhes(detalhes.dataset.detalhes);
    const confirmar = evento.target.closest('[data-confirmar]');
    if (confirmar) return confirmarPagamento(confirmar.dataset.confirmar, confirmar);
    const desfazer = evento.target.closest('[data-desfazer]');
    if (desfazer) return desfazerConfirmacao(desfazer.dataset.desfazer, desfazer);
});

tabelaCorpo.addEventListener('change', evento => {
    const select = evento.target.closest('[data-status-pedido]');
    if (select) alterarStatusPedido(select.dataset.statusPedido, select.value, select);
});

detalhesPedido.addEventListener('click', evento => {
    const botao = evento.target.closest('[data-confirmar-modal]');
    if (botao) confirmarPagamento(botao.dataset.confirmarModal, botao);
    const desfazer = evento.target.closest('[data-desfazer-modal]');
    if (desfazer) desfazerConfirmacao(desfazer.dataset.desfazerModal, desfazer);
});

document.getElementById('btnFecharModal').addEventListener('click', fecharModal);
modal.addEventListener('click', evento => { if (evento.target === modal) fecharModal(); });
document.addEventListener('keydown', evento => { if (evento.key === 'Escape') fecharModal(); });

window.addEventListener('DOMContentLoaded', carregarPedidos);

/*
 * Notificações da administração.
 *
 * Quando o cliente conclui o pedido (avisando que pagou), o servidor cria uma
 * notificação. Este script mostra um sino com o número de avisos não lidos, um
 * aviso na tela quando chega um novo e um painel com os dados que o admin precisa
 * conferir: produtos, embrulhos, formas de pagamento e valor de cada uma.
 *
 * Uso: <script src="../notificacoes.js" defer></script> (depois de auth-admin.js,
 * que coloca o token em todas as chamadas à API).
 */
(function () {
    'use strict';

    const API = 'http://localhost:3001';
    const INTERVALO_MS = 10000;
    const script = document.currentScript;
    const base = script ? script.src : location.href;

    if (!sessionStorage.getItem('token') || sessionStorage.getItem('perfil') !== 'admin') return;

    // Estilos
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('notificacoes.css', base).href;
    document.head.appendChild(css);

    const urlPedidos = new URL('pedido/pedidosRealizados/pedidosRealizados.html', base).href;

    let ultimoIdVisto = null;   // maior id de notificação não lida já "anunciado"
    let primeiraConsulta = true;
    let painelAberto = false;
    let timerToast = null;
    let sino, badge, toast, fundo, lista;

    const moeda = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function formatarQuando(valor) {
        const d = new Date(valor);
        if (isNaN(d)) return '';
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function montarInterface() {
        sino = document.createElement('button');
        sino.type = 'button';
        sino.className = 'ntf-sino';
        sino.setAttribute('aria-label', 'Abrir notificações');
        sino.innerHTML = '<span class="ntf-icone">🔔</span><span>Notificações</span><span class="ntf-badge" id="ntfBadge">0</span>';
        badge = sino.querySelector('.ntf-badge');
        sino.addEventListener('click', abrirPainel);

        toast = document.createElement('div');
        toast.className = 'ntf-toast';
        toast.setAttribute('role', 'status');
        toast.addEventListener('click', () => { esconderToast(); abrirPainel(); });

        fundo = document.createElement('div');
        fundo.className = 'ntf-fundo';
        fundo.innerHTML = `
            <div class="ntf-painel" role="dialog" aria-modal="true" aria-label="Notificações">
                <div class="ntf-topo">
                    <h2>🔔 Pagamentos para conferir</h2>
                    <div class="ntf-topo-acoes">
                        <button type="button" class="ntf-btn" id="ntfTodasLidas">Marcar todas como lidas</button>
                        <button type="button" class="ntf-btn ntf-fechar" id="ntfFechar" aria-label="Fechar">&times;</button>
                    </div>
                </div>
                <div class="ntf-lista" id="ntfLista"></div>
            </div>`;
        lista = fundo.querySelector('#ntfLista');
        fundo.addEventListener('click', e => { if (e.target === fundo) fecharPainel(); });
        fundo.querySelector('#ntfFechar').addEventListener('click', fecharPainel);
        fundo.querySelector('#ntfTodasLidas').addEventListener('click', marcarTodasLidas);
        lista.addEventListener('click', e => {
            const b = e.target.closest('[data-marcar-lida]');
            if (b) marcarLida(Number(b.dataset.marcarLida));
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && painelAberto) fecharPainel(); });

        document.body.append(sino, toast, fundo);
    }

    function atualizarBadge(total) {
        badge.textContent = total > 99 ? '99+' : String(total);
        sino.classList.toggle('ntf-tem-novas', total > 0);
    }

    function mostrarToast(titulo, texto) {
        toast.innerHTML = `<strong>${esc(titulo)}</strong>${esc(texto)}`;
        toast.classList.add('ntf-visivel');
        clearTimeout(timerToast);
        timerToast = setTimeout(esconderToast, 9000);
    }
    function esconderToast() { toast.classList.remove('ntf-visivel'); }

    async function consultar() {
        try {
            const r = await fetch(`${API}/notificacao/nao-lidas`);
            const d = await r.json();
            if (!r.ok || !d.sucesso) return;

            atualizarBadge(d.nao_lidas);

            if (primeiraConsulta) {
                if (d.nao_lidas > 0) {
                    mostrarToast('Pagamentos para conferir', `Você tem ${d.nao_lidas} aviso(s) não lido(s). Clique para ver.`);
                }
            } else if (d.ultimo_id > (ultimoIdVisto ?? 0)) {
                mostrarToast('Novo pagamento para conferir', 'Um cliente concluiu um pedido. Clique para ver os detalhes.');
            }
            // Se o painel está aberto e chegou algo novo, atualiza a lista.
            if (painelAberto && d.ultimo_id !== ultimoIdVisto) await carregarLista();

            ultimoIdVisto = d.ultimo_id;
            primeiraConsulta = false;
        } catch (e) {
            /* servidor offline: tenta de novo no próximo ciclo */
        }
    }

    function htmlNotificacao(n) {
        const produtos = Array.isArray(n.produtos) ? n.produtos : [];
        const pagamentos = Array.isArray(n.pagamentos) ? n.pagamentos : [];
        const embrulhados = produtos.filter(p => p.embrulhar);

        const itensProdutos = produtos.length
            ? produtos.map(p => `<li><span>${Number(p.quantidade)}× ${esc(p.nome_produto)}</span><span class="ntf-valor">${moeda(Number(p.quantidade) * Number(p.preco_unitario))}</span></li>`).join('')
            : '<li>Nenhum produto.</li>';

        const blocoEmbrulho = embrulhados.length
            ? `<div class="ntf-embrulho">🎁 <strong>Embrulhar para presente:</strong> ${embrulhados.map(p => `${esc(p.nome_produto)} (${Number(p.quantidade)} un.)`).join(', ')}</div>`
            : '<div class="ntf-embrulho ntf-nenhum">Nenhum produto para embrulhar.</div>';

        const itensPagamentos = pagamentos.length
            ? pagamentos.map(p => {
                const detalhes = [];
                if (p.parcelas) detalhes.push(`${Number(p.parcelas)}x`);
                if (Number(p.valor_juros) > 0) detalhes.push(`${moeda(p.valor_principal)} + ${moeda(p.valor_juros)} de juros (${Number(p.percentual_juros)}%)`);
                if (p.precisa_troco && p.valor_troco) detalhes.push(`troco para ${moeda(p.valor_troco)}`);
                return `<li><span>${esc(p.forma)}${detalhes.length ? `<small>${esc(detalhes.join(' · '))}</small>` : ''}</span><span class="ntf-valor">${moeda(p.valor_a_pagar)}</span></li>`;
            }).join('')
            : '<li>Nenhuma forma de pagamento.</li>';

        const recebimento = n.entrega_ou_retirada === 'entrega'
            ? `Entrega em: ${esc(n.endereco_entrega || 'endereço não informado')}`
            : 'Retirada na loja';

        const taxas = [];
        if (Number(n.taxa_entrega) > 0) taxas.push(`entrega ${moeda(n.taxa_entrega)}`);
        if (Number(n.taxa_embrulho) > 0) taxas.push(`embrulho ${moeda(n.taxa_embrulho)}`);
        if (Number(n.juros_total) > 0) taxas.push(`juros ${moeda(n.juros_total)}`);

        return `
        <article class="ntf-item ${n.lida ? 'ntf-ja-lida' : 'ntf-nao-lida'}">
            <div class="ntf-cab">
                <span class="ntf-titulo">Pedido #${Number(n.id_pedido)} · ${esc(n.nome_cliente || 'Cliente')}</span>
                <span class="ntf-quando">${esc(formatarQuando(n.criada_em))}</span>
            </div>
            <p class="ntf-msg"><strong>${esc(n.nome_cliente || 'O cliente')}</strong> informou que realizou o pagamento. Confira as informações no banco/maquininha e confirme com o cliente.</p>

            <div class="ntf-bloco"><h3>Produtos</h3><ul>${itensProdutos}</ul></div>
            <div class="ntf-bloco"><h3>Embrulho</h3>${blocoEmbrulho}</div>
            <div class="ntf-bloco"><h3>Recebimento</h3><div>${recebimento}</div></div>
            <div class="ntf-bloco"><h3>Formas de pagamento e valor a pagar em cada uma</h3><ul>${itensPagamentos}</ul></div>

            <div class="ntf-total"><span>Total do pedido${taxas.length ? ` <small style="font-weight:500">(inclui ${esc(taxas.join(', '))})</small>` : ''}</span><span>${moeda(n.valor_total)}</span></div>

            <div class="ntf-status">
                <span class="ntf-selo">Pedido: ${esc(String(n.status_pedido || 'Não confirmado').replace(/^entregando$/i, 'Pedido pronto'))}</span>
                <span class="ntf-selo">Pagamento: ${esc(n.status_pagamento || 'Não confirmado')}</span>
            </div>

            <div class="ntf-acoes">
                ${n.lida ? '' : `<button type="button" class="ntf-btn ntf-principal" data-marcar-lida="${Number(n.id_notificacao)}">Marcar como lida</button>`}
                <a class="ntf-btn" href="${esc(urlPedidos)}">Ver em pedidos realizados</a>
            </div>
        </article>`;
    }

    async function carregarLista() {
        lista.innerHTML = '<p class="ntf-vazio">Carregando...</p>';
        try {
            const r = await fetch(`${API}/notificacao`);
            const d = await r.json();
            if (!r.ok || !d.sucesso) throw new Error(d.mensagem || 'Erro ao carregar as notificações.');
            atualizarBadge(d.nao_lidas);
            lista.innerHTML = d.notificacoes.length
                ? d.notificacoes.map(htmlNotificacao).join('')
                : '<p class="ntf-vazio">Nenhuma notificação por enquanto.</p>';
        } catch (e) {
            lista.innerHTML = `<p class="ntf-vazio">${esc(e.message || 'Servidor offline.')}</p>`;
        }
    }

    async function abrirPainel() {
        esconderToast();
        painelAberto = true;
        fundo.classList.add('ntf-aberto');
        await carregarLista();
    }
    function fecharPainel() {
        painelAberto = false;
        fundo.classList.remove('ntf-aberto');
    }

    async function marcarLida(id) {
        try {
            await fetch(`${API}/notificacao/${id}/lida`, { method: 'PATCH' });
        } catch (e) { /* ignora */ }
        await carregarLista();
    }
    async function marcarTodasLidas() {
        try {
            await fetch(`${API}/notificacao/lidas`, { method: 'PATCH' });
        } catch (e) { /* ignora */ }
        await carregarLista();
    }

    function iniciar() {
        montarInterface();
        consultar();
        setInterval(consultar, INTERVALO_MS);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();

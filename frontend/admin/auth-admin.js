/*
 * Proteção das telas administrativas.
 *
 * 1) Exige login com perfil "admin" (funcionário). Sem login, volta para a tela de login.
 *    Cada tela só abre se o cargo do funcionário tiver o módulo correspondente (cargo_has_tabela);
 *    senão volta para o menu. O servidor confere de novo em toda chamada à API.
 * 2) Envia automaticamente o token (Authorization: Bearer ...) em toda chamada
 *    feita à API do backend, pois as rotas administrativas exigem autenticação.
 * 3) Se o servidor responder 401 (sessão expirada), volta para o login.
 *
 * Deve ser incluído no <head>, de forma síncrona (sem defer), ANTES dos demais scripts.
 */
(function () {
    'use strict';

    const API = 'http://localhost:3001';
    const urlLogin = new URL('../cliente/login/login.html', document.currentScript.src).href;

    const urlMenu = new URL('menu/menu.html', document.currentScript.src).href;

    function irParaLogin() {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('perfil');
        sessionStorage.removeItem('cliente');
        sessionStorage.removeItem('permissoes');
        window.location.replace(urlLogin);
    }

    // Pasta da tela -> módulo do cargo (tabelas_card_menu.nome_tabela) exigido para abri-la.
    const MODULO_POR_PASTA = {
        '/admin/produto/': 'produtos',
        '/admin/pedido/': 'pedidos',
        '/admin/devolucao/': 'devolucoes',
        '/admin/cargo/': 'cargos',
        '/admin/unidade_medida/': 'unidade_medida',
        '/admin/pessoa/': 'pessoas',
        '/admin/categoria/': 'categorias',
        '/admin/forma_pagamento/': 'formas_pagamento',
        '/admin/relatorios/': 'pedidos'
    };

    const token = sessionStorage.getItem('token');
    const perfil = sessionStorage.getItem('perfil');

    if (!token || perfil !== 'admin') {
        irParaLogin();
        return;
    }

    // Sessão iniciada antes do controle por cargo (sem a lista de módulos): entra de novo para carregá-la.
    let permissoes;
    try { permissoes = JSON.parse(sessionStorage.getItem('permissoes')); } catch (erro) { permissoes = null; }
    if (!Array.isArray(permissoes)) {
        irParaLogin();
        return;
    }

    const caminho = decodeURIComponent(window.location.pathname);
    const pasta = Object.keys(MODULO_POR_PASTA).find(chave => caminho.includes(chave));
    if (pasta && !permissoes.includes(MODULO_POR_PASTA[pasta])) {
        alert('Seu cargo não tem acesso a este módulo.');
        window.location.replace(urlMenu);
        return;
    }

    // Usado pelo menu e pelas notificações.
    window.permissoesAdmin = permissoes;
    window.temAcessoModulo = modulo => permissoes.includes(modulo);

    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async function (entrada, opcoes) {
        const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
        const chamadaDaApi = url.startsWith(API);
        let configuracao = opcoes || {};

        if (chamadaDaApi) {
            const cabecalhos = new Headers(configuracao.headers || {});
            if (!cabecalhos.has('Authorization')) cabecalhos.set('Authorization', `Bearer ${token}`);
            configuracao = { ...configuracao, headers: cabecalhos };
        }

        const resposta = await fetchOriginal(entrada, configuracao);

        if (chamadaDaApi && resposta.status === 401) {
            alert('Sua sessão expirou. Faça login novamente.');
            irParaLogin();
        }

        // O servidor também confere o cargo a cada chamada (ex.: o cargo foi alterado com a sessão aberta).
        if (chamadaDaApi && resposta.status === 403) {
            try {
                const corpo = await resposta.clone().json();
                if (corpo && corpo.moduloNegado) {
                    alert(corpo.mensagem || 'Seu cargo não tem acesso a este módulo.');
                    if (!window.location.href.startsWith(urlMenu)) window.location.replace(urlMenu);
                }
            } catch (erro) { /* resposta sem JSON: segue o fluxo normal */ }
        }

        return resposta;
    };

    // Disponível para o botão "Sair" do menu.
    window.sairDoAdmin = irParaLogin;
})();


// CPF, identificadores e quantidades aceitam somente números.
document.addEventListener('DOMContentLoaded', () => {
    const seletoresInteiros = 'input[id*="cpf" i], input[name*="cpf" i], input[id*="quantidade" i], input[name*="quantidade" i], input[class*="qtd" i], input[id*="id_" i]:not([id*="unidade_medida" i]), input[name*="id_" i]:not([name*="unidade_medida" i]), #searchId';
    document.querySelectorAll(seletoresInteiros).forEach(campo => {
        campo.addEventListener('input', () => { campo.value = campo.value.replace(/\D/g, ''); });
    });
    // Campos monetários podem usar centavos; remove letras e símbolos, sem perder o decimal.
    document.querySelectorAll('input[type="number"]').forEach(campo => {
        if (campo.matches(seletoresInteiros)) return;
        campo.addEventListener('input', () => {
            let valor = campo.value.replace(/[^0-9.,]/g, '').replace(',', '.');
            const partes = valor.split('.');
            if (partes.length > 2) valor = partes.shift() + '.' + partes.join('');
            campo.value = valor;
        });
    });
});

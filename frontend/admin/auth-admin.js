/*
 * Proteção das telas administrativas.
 *
 * 1) Exige login com perfil "admin" (funcionário). Sem login, volta para a tela de login.
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

    function irParaLogin() {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('perfil');
        sessionStorage.removeItem('cliente');
        window.location.replace(urlLogin);
    }

    const token = sessionStorage.getItem('token');
    const perfil = sessionStorage.getItem('perfil');

    if (!token || perfil !== 'admin') {
        irParaLogin();
        return;
    }

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

        return resposta;
    };

    // Disponível para o botão "Sair" do menu.
    window.sairDoAdmin = irParaLogin;
})();

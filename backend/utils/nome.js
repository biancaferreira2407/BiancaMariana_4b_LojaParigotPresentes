// Regra única de nome de pessoa: só letras (com acentos) e espaços; cada palavra começa com letra maiúscula.
function formatarNome(valor) {
    return String(valor ?? '')
        .normalize('NFC')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase('pt-BR')
        .replace(/(^|\s)(\p{L})/gu, (trecho, inicio, letra) => inicio + letra.toLocaleUpperCase('pt-BR'));
}

function nomeValido(nome) {
    return /^\p{L}+(?: \p{L}+)*$/u.test(nome);
}

const MENSAGEM_NOME = 'O nome deve conter apenas letras.';

module.exports = { formatarNome, nomeValido, MENSAGEM_NOME };

// Regra única de telefone brasileiro (DDD + número) usada por cadastro, conta e CRUD de pessoa.
// Guarda sempre só os dígitos, sem o 55: 10 dígitos (fixo) ou 11 dígitos (celular, começa com 9).
function normalizarTelefone(valor) {
    let digitos = String(valor ?? '').replace(/\D/g, '');
    if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) digitos = digitos.slice(2);
    return digitos;
}

function telefoneValido(digitos) {
    if (!/^[1-9][1-9]\d{8,9}$/.test(digitos)) return false;      // DDD válido + 8 ou 9 dígitos
    return digitos.length === 10 ? /^\d{2}[2-5]/.test(digitos) : digitos[2] === '9'; // fixo 2-5 / celular 9
}

const MENSAGEM_TELEFONE = 'Informe um telefone válido com DDD, por exemplo (44) 99999-9999.';

module.exports = { normalizarTelefone, telefoneValido, MENSAGEM_TELEFONE };

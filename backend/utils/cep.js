// Restrição de CEP: só endereços de Campo Mourão - PR podem ser cadastrados.
const CIDADE_PERMITIDA = 'Campo Mourão';
const UF_PERMITIDA = 'PR';
const IBGE_PERMITIDO = '4104303';          // código IBGE de Campo Mourão
const CEP_INICIAL = 87300000;              // faixa de CEP de Campo Mourão (Correios)
const CEP_FINAL = 87319999;

const MENSAGEM_CEP_FORA = 'Só é possível cadastrar endereços de Campo Mourão - PR. Informe um CEP da cidade.';

function semAcento(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

// Confere os dados devolvidos pelo ViaCEP.
function dadosSaoDeCampoMourao(dados) {
    if (!dados || dados.erro) return false;
    if (dados.ibge) return String(dados.ibge) === IBGE_PERMITIDO;
    return semAcento(dados.localidade) === semAcento(CIDADE_PERMITIDA)
        && String(dados.uf || '').toUpperCase() === UF_PERMITIDA;
}

// Valida o CEP no servidor (não confia só no navegador).
// 1) fora da faixa de Campo Mourão -> recusa direto;
// 2) dentro da faixa -> confirma a cidade no ViaCEP; se o ViaCEP estiver fora do ar, vale a faixa.
async function validarCepCampoMourao(cepBruto) {
    const cep = String(cepBruto || '').replace(/\D/g, '');

    if (!/^\d{8}$/.test(cep)) {
        return { valido: false, mensagem: 'Informe um CEP válido com 8 números.' };
    }

    const numero = Number(cep);
    if (numero < CEP_INICIAL || numero > CEP_FINAL) {
        return { valido: false, mensagem: MENSAGEM_CEP_FORA };
    }

    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
            signal: AbortSignal.timeout(4000)
        });
        if (resposta.ok) {
            const dados = await resposta.json();
            if (dados.erro) {
                return { valido: false, mensagem: 'CEP não encontrado.' };
            }
            if (!dadosSaoDeCampoMourao(dados)) {
                return { valido: false, mensagem: MENSAGEM_CEP_FORA };
            }
        }
    } catch (erro) {
        console.warn('ViaCEP indisponível; usando apenas a faixa de CEP de Campo Mourão.', erro.message);
    }

    return { valido: true, cep };
}

module.exports = { validarCepCampoMourao, MENSAGEM_CEP_FORA, CIDADE_PERMITIDA, UF_PERMITIDA };

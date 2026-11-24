/*
 * PIX da Parigot Presentes (BR Code estático – padrão EMV® QRCPS do Banco Central).
 *
 * Gera o "PIX Copia e Cola" e o QR Code para a chave PIX da loja, com o valor
 * e o identificador do pedido. O mesmo texto vale para o QR Code e para o
 * copia-e-cola.
 *
 * ATENÇÃO: o PIX estático não avisa o site quando o pagamento é feito.
 * A loja precisa conferir o recebimento no extrato/app do banco.
 */
(function (raiz) {
    'use strict';

    // ===== DADOS DO RECEBEDOR (altere somente aqui) =====
    const CONFIG_PIX = {
        // Chave PIX do tipo telefone: formato internacional +55 + DDD + número.
        // Telefone informado: (44) 99711-5742
        chave: '+5544997115742',

        // Nome do recebedor: no máximo 25 caracteres, sem acento.
        // Nome completo: BIANCA MARIANA REIS FERREIRA (28 caracteres).
        // O app do banco do cliente mostra o nome completo cadastrado na chave.
        nomeRecebedor: 'BIANCA MARIANA R FERREIRA',

        // Cidade do recebedor: no máximo 15 caracteres, sem acento.
        cidade: 'GOIOERE'
    };

    // Monta um campo EMV: ID (2 dígitos) + tamanho (2 dígitos) + valor.
    function campo(id, valor) {
        const texto = String(valor);
        if (texto.length > 99) throw new Error(`Campo PIX ${id} excede 99 caracteres.`);
        return id + String(texto.length).padStart(2, '0') + texto;
    }

    // Remove acentos, deixa em maiúsculas e mantém só letras, números e espaço.
    function limparTexto(valor, tamanhoMaximo) {
        return String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9 ]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, tamanhoMaximo);
    }

    // Identificador da transação: somente letras e números, até 25 caracteres.
    function limparTxid(valor) {
        const txid = String(valor || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
        return txid || '***';
    }

    // CRC16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), exigido pelo BR Code.
    function crc16(texto) {
        let crc = 0xFFFF;
        for (let i = 0; i < texto.length; i++) {
            crc ^= texto.charCodeAt(i) << 8;
            for (let bit = 0; bit < 8; bit++) {
                crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
                crc &= 0xFFFF;
            }
        }
        return crc.toString(16).toUpperCase().padStart(4, '0');
    }

    /**
     * Gera o código "PIX Copia e Cola".
     * @param {{valor:number, txid?:string, config?:object}} opcoes
     *        valor em reais (ex.: 59.9). txid identifica o pedido.
     */
    function gerarPayloadPix({ valor, txid, config = CONFIG_PIX }) {
        const centavos = Math.round(Number(valor) * 100);
        if (!Number.isFinite(centavos) || centavos <= 0) {
            throw new Error('Informe um valor maior que zero para gerar o PIX.');
        }
        const valorTexto = (centavos / 100).toFixed(2);
        if (valorTexto.length > 13) throw new Error('Valor PIX acima do limite do BR Code.');

        const chave = String(config.chave || '').trim();
        if (!chave) throw new Error('Chave PIX da loja não configurada.');

        const nome = limparTexto(config.nomeRecebedor, 25);
        const cidade = limparTexto(config.cidade, 15);
        if (!nome || !cidade) throw new Error('Nome ou cidade do recebedor PIX inválidos.');

        const contaPix = campo('00', 'BR.GOV.BCB.PIX') + campo('01', chave);

        const semCrc =
            campo('00', '01') +                    // versão do payload
            campo('01', '11') +                    // QR estático (reutilizável)
            campo('26', contaPix) +                // conta/chave PIX
            campo('52', '0000') +                  // categoria do comerciante
            campo('53', '986') +                   // moeda: BRL
            campo('54', valorTexto) +              // valor
            campo('58', 'BR') +                    // país
            campo('59', nome) +                    // nome do recebedor
            campo('60', cidade) +                  // cidade do recebedor
            campo('62', campo('05', limparTxid(txid))) + // identificador (txid)
            '6304';                                // ID + tamanho do CRC

        return semCrc + crc16(semCrc);
    }

    // Carrega um script externo uma única vez.
    function carregarScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = () => reject(new Error('Falha ao carregar ' + url));
            document.head.appendChild(script);
        });
    }

    // Garante a biblioteca de QR Code (tenta uma segunda CDN se a primeira falhar).
    async function garantirBibliotecaQr() {
        if (typeof raiz.QRCode !== 'undefined') return true;
        const alternativas = [
            'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
            'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
        ];
        for (const url of alternativas) {
            try {
                await carregarScript(url);
                if (typeof raiz.QRCode !== 'undefined') return true;
            } catch (erro) { console.warn(erro.message); }
        }
        return false;
    }

    /**
     * Desenha o QR Code do payload dentro de um elemento.
     * Retorna true se desenhou; false se a biblioteca não pôde ser carregada
     * (nesse caso o copia-e-cola continua funcionando).
     */
    async function desenharQrCode(elemento, payload, tamanho = 220) {
        elemento.innerHTML = '';
        if (!(await garantirBibliotecaQr())) {
            elemento.textContent = 'Não foi possível carregar o QR Code. Use o código PIX Copia e Cola abaixo.';
            return false;
        }
        // Dica: o elemento deve ter fundo branco e margem interna ("zona silenciosa"),
        // como em .qrcode-pos-pedido, para o app do banco ler o QR Code com facilidade.
        new raiz.QRCode(elemento, {
            text: payload,
            width: tamanho,
            height: tamanho,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: raiz.QRCode.CorrectLevel.M
        });
        return true;
    }

    const api = { CONFIG_PIX, gerarPayloadPix, desenharQrCode, crc16 };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.PixParigot = api;
})(typeof window !== 'undefined' ? window : globalThis);


const express = require('express');
const router = express.Router();

const recuperacaoSenhaController = require('../controllers/recuperacaoSenhaController');

router.post('/solicitar', recuperacaoSenhaController.solicitarCodigo);

router.post('/verificar', recuperacaoSenhaController.verificarCodigo);

router.post('/redefinir', recuperacaoSenhaController.redefinirSenha);

module.exports = router;

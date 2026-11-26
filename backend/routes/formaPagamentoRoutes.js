const express = require('express');
const router = express.Router();
const formaPagamentoController = require('../controllers/formaPagamentoController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Todas as rotas de formas de pagamento são administrativas.
router.use(autenticar);

// Rotas do CRUD de Formas de Pagamento
// A lista também é usada na tela Novo pedido.
router.get('/listar', exigirModulo('formas_pagamento', 'pedidos'), formaPagamentoController.listarformaPagamento);

router.use(exigirModulo('formas_pagamento'));
router.get('/:id', formaPagamentoController.obterformaPagamento);
router.post('/', formaPagamentoController.criarformaPagamento);
router.put('/:id', formaPagamentoController.atualizarformaPagamento);
router.delete('/:id', formaPagamentoController.deletarformaPagamento);

module.exports = router;

const express = require('express');
const router = express.Router();
const formaPagamentoController = require('../controllers/formaPagamentoController');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Todas as rotas de formas de pagamento são administrativas.
router.use(autenticar, exigirAdmin);

// Rotas do CRUD de Formas de Pagamento
router.get('/listar', formaPagamentoController.listarformaPagamento);
router.get('/:id', formaPagamentoController.obterformaPagamento);
router.post('/', formaPagamentoController.criarformaPagamento);
router.put('/:id', formaPagamentoController.atualizarformaPagamento);
router.delete('/:id', formaPagamentoController.deletarformaPagamento);

module.exports = router;

const express = require('express');
const router = express.Router();
const controller = require('../controllers/devolucaoController');
const autenticarCliente = require('../middlewares/autenticarCliente');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Área do cliente
router.get('/minhas-devolucoes', autenticarCliente, controller.listarDevolucoesCliente);

// Área administrativa
router.get('/pedidos-disponiveis', autenticar, exigirModulo('devolucoes'), controller.listarPedidosDisponiveis);
router.get('/', autenticar, exigirModulo('devolucoes'), controller.listarDevolucoes);
router.get('/:id', autenticar, exigirModulo('devolucoes'), controller.obterDevolucao);
router.post('/', autenticar, exigirModulo('devolucoes'), controller.criarDevolucao);
router.put('/:id', autenticar, exigirModulo('devolucoes'), controller.atualizarDevolucao);
router.delete('/:id', autenticar, exigirModulo('devolucoes'), controller.excluirDevolucao);

module.exports = router;

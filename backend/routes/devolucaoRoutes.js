const express = require('express');
const router = express.Router();
const controller = require('../controllers/devolucaoController');
const autenticarCliente = require('../middlewares/autenticarCliente');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Área do cliente
router.get('/minhas-devolucoes', autenticarCliente, controller.listarDevolucoesCliente);

// Área administrativa
router.get('/pedidos-disponiveis', autenticar, exigirAdmin, controller.listarPedidosDisponiveis);
router.get('/', autenticar, exigirAdmin, controller.listarDevolucoes);
router.get('/:id', autenticar, exigirAdmin, controller.obterDevolucao);
router.post('/', autenticar, exigirAdmin, controller.criarDevolucao);
router.put('/:id', autenticar, exigirAdmin, controller.atualizarDevolucao);
router.delete('/:id', autenticar, exigirAdmin, controller.excluirDevolucao);

module.exports = router;

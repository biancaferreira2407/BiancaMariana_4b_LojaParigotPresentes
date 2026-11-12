const express = require('express');
const router = express.Router();
const controller = require('../controllers/devolucaoController');
const autenticarCliente = require('../middlewares/autenticarCliente');

router.get('/minhas-devolucoes', autenticarCliente, controller.listarDevolucoesCliente);

router.get('/pedidos-disponiveis', controller.listarPedidosDisponiveis);
router.get('/', controller.listarDevolucoes);
router.get('/:id', controller.obterDevolucao);
router.post('/', controller.criarDevolucao);
router.put('/:id', controller.atualizarDevolucao);
router.delete('/:id', controller.excluirDevolucao);

module.exports = router;
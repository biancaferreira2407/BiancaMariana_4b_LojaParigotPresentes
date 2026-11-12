const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const autenticarCliente = require('../middlewares/autenticarCliente');

// Rota específica primeiro
router.get('/meus-pedidos', autenticarCliente, pedidoController.listarPedidosCliente);

// Rotas gerais depois
router.get('/', pedidoController.listarPedidos);
router.get('/:id', pedidoController.obterPedido);
router.post('/', pedidoController.criarPedido);

module.exports = router;
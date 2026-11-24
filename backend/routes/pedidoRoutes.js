const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const autenticarCliente = require('../middlewares/autenticarCliente');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Área do cliente
router.get('/meus-pedidos', autenticarCliente, pedidoController.listarPedidosCliente);
router.get('/endereco-cliente', autenticarCliente, pedidoController.obterEnderecoCliente);
router.post('/validar-carrinho', pedidoController.validarCarrinho);
router.post('/validar-pagamento', autenticarCliente, pedidoController.validarPagamento);
router.post('/', autenticarCliente, pedidoController.criarPedido);

// Área administrativa
router.post('/admin', autenticar, exigirAdmin, pedidoController.criarPedidoAdmin);
router.get('/', autenticar, exigirAdmin, pedidoController.listarPedidos);
router.get('/:id', autenticar, exigirAdmin, pedidoController.obterPedido);

module.exports = router;

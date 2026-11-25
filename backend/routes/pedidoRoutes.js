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
router.post('/:id/avisar-pagamento', autenticarCliente, pedidoController.avisarPagamento);

// Área administrativa
router.post('/admin', autenticar, exigirAdmin, pedidoController.criarPedidoAdmin);
router.get('/', autenticar, exigirAdmin, pedidoController.listarPedidos);
router.get('/:id', autenticar, exigirAdmin, pedidoController.obterPedido);
router.patch('/:id/confirmar-pagamento', autenticar, exigirAdmin, pedidoController.confirmarPagamento);
router.patch('/:id/status', autenticar, exigirAdmin, pedidoController.atualizarStatusPedido);
router.patch('/:id/desfazer-confirmacao', autenticar, exigirAdmin, pedidoController.desfazerConfirmacaoPagamento);

module.exports = router;

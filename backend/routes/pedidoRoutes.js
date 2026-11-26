const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');
const autenticarCliente = require('../middlewares/autenticarCliente');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Área do cliente
router.get('/meus-pedidos', autenticarCliente, pedidoController.listarPedidosCliente);
router.get('/endereco-cliente', autenticarCliente, pedidoController.obterEnderecoCliente);
router.post('/validar-carrinho', pedidoController.validarCarrinho);
router.post('/validar-pagamento', autenticarCliente, pedidoController.validarPagamento);
router.post('/', autenticarCliente, pedidoController.criarPedido);
router.post('/:id/avisar-pagamento', autenticarCliente, pedidoController.avisarPagamento);

// Área administrativa
router.post('/admin', autenticar, exigirModulo('pedidos'), pedidoController.criarPedidoAdmin);
router.get('/', autenticar, exigirModulo('pedidos'), pedidoController.listarPedidos);
router.get('/:id', autenticar, exigirModulo('pedidos', 'devolucoes'), pedidoController.obterPedido);
router.patch('/:id/confirmar-pagamento', autenticar, exigirModulo('pedidos'), pedidoController.confirmarPagamento);
router.patch('/:id/status', autenticar, exigirModulo('pedidos'), pedidoController.atualizarStatusPedido);
router.patch('/:id/desfazer-confirmacao', autenticar, exigirModulo('pedidos'), pedidoController.desfazerConfirmacaoPagamento);

module.exports = router;

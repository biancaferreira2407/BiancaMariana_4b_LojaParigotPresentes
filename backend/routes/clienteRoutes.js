const express = require('express');
const router = express.Router();
const clienteController = require('./../controllers/clienteController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Todas as rotas de clientes são administrativas.
router.use(autenticar);

// CRUD de Clientes
// A lista de clientes também é usada na tela Novo pedido; a tela de Pessoas grava os dados de cliente.
router.get('/', exigirModulo('clientes', 'pessoas', 'pedidos'), clienteController.listarClientes);

router.use(exigirModulo('clientes', 'pessoas'));
router.post('/', clienteController.criarCliente);
router.get('/:id', clienteController.obterCliente);
router.put('/:id', clienteController.atualizarCliente);
router.delete('/:id', clienteController.deletarCliente);

module.exports = router;

const express = require('express');
const router = express.Router();
const clienteController = require('./../controllers/clienteController');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Todas as rotas de clientes são administrativas.
router.use(autenticar, exigirAdmin);

// CRUD de Clientes
router.get('/', clienteController.listarClientes);
router.post('/', clienteController.criarCliente);
router.get('/:id', clienteController.obterCliente);
router.put('/:id', clienteController.atualizarCliente);
router.delete('/:id', clienteController.deletarCliente);

module.exports = router;

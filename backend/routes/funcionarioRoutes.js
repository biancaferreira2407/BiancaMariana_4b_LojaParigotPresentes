const express = require('express');
const router = express.Router();
const funcionarioController = require('./../controllers/funcionarioController');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Todas as rotas de funcionários são administrativas.
router.use(autenticar, exigirAdmin);

// CRUD de Funcionarios
router.get('/', funcionarioController.listarFuncionarios);
router.post('/', funcionarioController.criarFuncionario);
router.get('/:id', funcionarioController.obterFuncionario);
router.put('/:id', funcionarioController.atualizarFuncionario);
router.delete('/:id', funcionarioController.deletarFuncionario);

module.exports = router;

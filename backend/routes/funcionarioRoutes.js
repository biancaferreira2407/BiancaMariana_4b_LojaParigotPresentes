const express = require('express');
const router = express.Router();
const funcionarioController = require('./../controllers/funcionarioController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Todas as rotas de funcionários são administrativas.
router.use(autenticar);

// CRUD de Funcionarios
// A lista de funcionários também é usada na tela Novo pedido; a tela de Pessoas grava os dados de funcionário.
router.get('/', exigirModulo('funcionarios', 'pessoas', 'pedidos'), funcionarioController.listarFuncionarios);

router.use(exigirModulo('funcionarios', 'pessoas'));
router.post('/', funcionarioController.criarFuncionario);
router.get('/:id', funcionarioController.obterFuncionario);
router.put('/:id', funcionarioController.atualizarFuncionario);
router.delete('/:id', funcionarioController.deletarFuncionario);

module.exports = router;

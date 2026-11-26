const express = require('express');
const router = express.Router();
const pessoaController = require('../controllers/pessoaController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Dados pessoais: somente administração.
router.use(autenticar, exigirModulo('pessoas'));

// CRUD de Pessoas
router.get('/', pessoaController.listarPessoas);
router.post('/', pessoaController.criarPessoa);
router.get('/:id', pessoaController.obterPessoa);
router.put('/:id', pessoaController.atualizarPessoa);
router.delete('/:id', pessoaController.deletarPessoa);

module.exports = router;

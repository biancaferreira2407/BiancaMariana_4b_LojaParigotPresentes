const express = require('express');
const router = express.Router();

const contaController = require('../controllers/contaController');
const { autenticar, exigirCliente } = require('../middlewares/authMiddleware');

// Todas as rotas de Minha Conta exigem uma sessão válida de cliente.
router.use(autenticar, exigirCliente);

router.get('/', contaController.obterMinhaConta);
router.put('/', contaController.atualizarMinhaConta);

module.exports = router;

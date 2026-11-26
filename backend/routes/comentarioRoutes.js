const express = require('express');
const router = express.Router();
const controller = require('../controllers/comentarioController');
const autenticarCliente = require('../middlewares/autenticarCliente');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');
router.get('/avaliacoes', controller.avaliacoesPublicas);
router.post('/', autenticarCliente, controller.criar);
router.get('/admin', autenticar, exigirModulo('pedidos'), controller.listarAdmin);
module.exports = router;

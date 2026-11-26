const express = require('express');
const router = express.Router();
const notificacaoController = require('../controllers/notificacaoController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Somente a administração acessa as notificações.
router.use(autenticar, exigirModulo('pedidos'));

router.get('/', notificacaoController.listar);
router.get('/nao-lidas', notificacaoController.contarNaoLidas);
router.patch('/lidas', notificacaoController.marcarTodasLidas);
router.patch('/:id/lida', notificacaoController.marcarLida);

module.exports = router;

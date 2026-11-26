const express = require('express');
const router = express.Router();
const controller = require('../controllers/relatorioController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');
router.get('/historico', autenticar, exigirModulo('pedidos'), controller.listarHistorico);
router.get('/ranking-produtos', autenticar, exigirModulo('pedidos'), controller.rankingProdutos);
module.exports = router;

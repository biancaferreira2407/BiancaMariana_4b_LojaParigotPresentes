const express = require('express');
const router = express.Router();
const unidadeMedidaController = require('../controllers/unidadeMedidaController');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Listagem pública: a vitrine mostra a unidade de medida dos produtos.
router.get('/listar', unidadeMedidaController.listarUnidadesMedida);

// Demais operações do CRUD: somente administração.
router.get('/:id', autenticar, exigirAdmin, unidadeMedidaController.obterUnidadeMedida);
router.post('/', autenticar, exigirAdmin, unidadeMedidaController.criarUnidadeMedida);
router.put('/:id', autenticar, exigirAdmin, unidadeMedidaController.atualizarUnidadeMedida);
router.delete('/:id', autenticar, exigirAdmin, unidadeMedidaController.deletarUnidadeMedida);

module.exports = router;

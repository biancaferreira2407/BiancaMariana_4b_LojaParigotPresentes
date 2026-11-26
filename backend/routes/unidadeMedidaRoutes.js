const express = require('express');
const router = express.Router();
const unidadeMedidaController = require('../controllers/unidadeMedidaController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Listagem pública: a vitrine mostra a unidade de medida dos produtos.
router.get('/listar', unidadeMedidaController.listarUnidadesMedida);

// Demais operações do CRUD: somente administração.
router.get('/:id', autenticar, exigirModulo('unidade_medida'), unidadeMedidaController.obterUnidadeMedida);
router.post('/', autenticar, exigirModulo('unidade_medida'), unidadeMedidaController.criarUnidadeMedida);
router.put('/:id', autenticar, exigirModulo('unidade_medida'), unidadeMedidaController.atualizarUnidadeMedida);
router.delete('/:id', autenticar, exigirModulo('unidade_medida'), unidadeMedidaController.deletarUnidadeMedida);

module.exports = router;

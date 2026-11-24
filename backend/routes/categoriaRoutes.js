const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Listagem pública: a vitrine da loja precisa das categorias.
router.get('/listar', categoriaController.listarCategorias);

// Demais operações do CRUD: somente administração.
router.get('/:id', autenticar, exigirAdmin, categoriaController.obterCategoria);
router.post('/', autenticar, exigirAdmin, categoriaController.criarCategoria);
router.put('/:id', autenticar, exigirAdmin, categoriaController.atualizarCategoria);
router.delete('/:id', autenticar, exigirAdmin, categoriaController.deletarCategoria);

module.exports = router;

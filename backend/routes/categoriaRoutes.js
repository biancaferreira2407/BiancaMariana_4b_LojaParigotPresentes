const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Listagem pública: a vitrine da loja precisa das categorias.
router.get('/listar', categoriaController.listarCategorias);

// Demais operações do CRUD: somente administração.
router.get('/:id', autenticar, exigirModulo('categorias'), categoriaController.obterCategoria);
router.post('/', autenticar, exigirModulo('categorias'), categoriaController.criarCategoria);
router.put('/:id', autenticar, exigirModulo('categorias'), categoriaController.atualizarCategoria);
router.delete('/:id', autenticar, exigirModulo('categorias'), categoriaController.deletarCategoria);

module.exports = router;

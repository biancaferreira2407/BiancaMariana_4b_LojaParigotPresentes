const express = require('express');
const router = express.Router();
const cargoController = require('../controllers/cargoController');
const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

// Todas as rotas de cargos são administrativas.
router.use(autenticar, exigirAdmin);

// Rotas do CRUD de Cargos
router.get('/listar', cargoController.listarCargos);
router.get('/modulos', cargoController.listarModulos);
router.get('/:id', cargoController.obterCargo);
router.post('/', cargoController.criarCargo);
router.put('/:id', cargoController.atualizarCargo);
router.delete('/:id', cargoController.deletarCargo);

module.exports = router;

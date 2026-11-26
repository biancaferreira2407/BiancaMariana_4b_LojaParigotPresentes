const express = require('express');
const router = express.Router();
const cargoController = require('../controllers/cargoController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Todas as rotas de cargos são administrativas.
router.use(autenticar);

// Rotas do CRUD de Cargos
// A lista de cargos também alimenta o seletor de cargo das telas de Pessoas/Funcionários.
router.get('/listar', exigirModulo('cargos', 'pessoas', 'funcionarios'), cargoController.listarCargos);

router.use(exigirModulo('cargos'));
router.get('/modulos', cargoController.listarModulos);
router.get('/:id', cargoController.obterCargo);
router.post('/', cargoController.criarCargo);
router.put('/:id', cargoController.atualizarCargo);
router.delete('/:id', cargoController.deletarCargo);

module.exports = router;

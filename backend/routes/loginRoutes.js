const express = require('express');
const router = express.Router();

const loginController = require('../controllers/loginController');

const { autenticar, exigirAdmin } = require('../middlewares/authMiddleware');

router.post('/', loginController.login);

// Módulos liberados para o cargo do funcionário logado (o menu usa para esconder o que ele não pode acessar).
router.get('/permissoes', autenticar, exigirAdmin, loginController.permissoes);

module.exports = router;
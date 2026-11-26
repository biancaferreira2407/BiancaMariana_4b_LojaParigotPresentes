const express = require('express');
const multer = require('multer');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const { autenticar, exigirModulo } = require('../middlewares/authMiddleware');

// Configura o Multer para armazenar em memória temporária para o Sharp processar.
// Limite de 5 MB e somente imagens.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(null, true);
        cb(new Error('Envie uma imagem JPEG, PNG, WEBP ou GIF.'));
    }
});

// Listagem pública: é a vitrine da loja.
router.get('/listar', produtoController.listarProdutos);

// Demais operações do CRUD: somente administração.
router.get('/:id', autenticar, exigirModulo('produtos'), produtoController.obterProduto);
router.post('/', autenticar, exigirModulo('produtos'), produtoController.criarProduto);
router.put('/:id', autenticar, exigirModulo('produtos'), produtoController.atualizarProduto);
router.delete('/:id', autenticar, exigirModulo('produtos'), produtoController.deletarProduto);

// Rota para upload da imagem
router.post('/upload/:id', autenticar, exigirModulo('produtos'), (req, res, next) => {
    upload.single('imagem')(req, res, erro => {
        if (erro) return res.status(400).json({ sucesso: false, mensagem: erro.message });
        next();
    });
}, produtoController.uploadImagem);

module.exports = router;

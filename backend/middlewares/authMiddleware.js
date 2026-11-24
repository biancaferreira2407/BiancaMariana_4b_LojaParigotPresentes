const jwt = require('jsonwebtoken');

// Valida o token criado pelo login e identifica o usuário autenticado.
exports.autenticar = (req, res, next) => {
    const cabecalho = req.headers.authorization;

    if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Faça login para continuar.'
        });
    }

    const token = cabecalho.split(' ')[1];

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (erro) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Sessão inválida ou expirada. Faça login novamente.'
        });
    }
};

// Permite acessar a área Minha Conta somente com perfil de cliente.
exports.exigirCliente = (req, res, next) => {
    if (!req.usuario || req.usuario.perfil !== 'cliente') {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Apenas clientes podem acessar esta área.'
        });
    }

    next();
};

// Permite acessar as rotas administrativas somente com perfil de funcionário (admin).
exports.exigirAdmin = (req, res, next) => {
    if (!req.usuario || req.usuario.perfil !== 'admin') {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Acesso restrito à administração da loja.'
        });
    }

    next();
};

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const cabecalho = req.headers.authorization;

    if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Faça o login primeiro.'
        });
    }

    const token = cabecalho.split(' ')[1];

    try {
        const dados = jwt.verify(token, process.env.JWT_SECRET);

        if (dados.perfil !== 'cliente') {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso permitido somente para clientes.'
            });
        }

        req.usuario = dados;
        next();

    } catch (erro) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Sessão inválida. Faça login novamente.'
        });
    }
};
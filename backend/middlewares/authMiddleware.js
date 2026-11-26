const jwt = require('jsonwebtoken');
const { query } = require('../database');

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

// Módulos (tabelas_card_menu.nome_tabela) que o CARGO do funcionário pode acessar.
// Consulta o banco a cada chamada: se o cargo mudar, o efeito é imediato (sem esperar o token expirar)
// e um funcionário removido perde o acesso na hora.
async function buscarPermissoes(cpf) {
    const resultado = await query(
        `SELECT t.nome_tabela
           FROM funcionario f
           JOIN cargo_has_tabela ct ON ct.id_cargo = f.cargo_id_cargo
           JOIN tabelas_card_menu t ON t.id_tabela = ct.id_tabela
          WHERE f.pessoa_cpf_pessoa = $1
          ORDER BY t.id_tabela`,
        [cpf]
    );
    return resultado.rows.map(linha => linha.nome_tabela);
}
exports.buscarPermissoes = buscarPermissoes;

// Libera a rota só para funcionário (admin) cujo cargo tenha pelo menos um dos módulos informados.
// Ex.: exigirModulo('pedidos') ou exigirModulo('pedidos', 'devolucoes') (qualquer um deles basta).
exports.exigirModulo = (...modulos) => async (req, res, next) => {
    if (!req.usuario || req.usuario.perfil !== 'admin') {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Acesso restrito à administração da loja.'
        });
    }

    try {
        const permissoes = await buscarPermissoes(req.usuario.cpf);
        req.permissoes = permissoes;

        if (modulos.some(modulo => permissoes.includes(modulo))) return next();

        return res.status(403).json({
            sucesso: false,
            moduloNegado: true,
            mensagem: 'Seu cargo não tem acesso a este módulo.'
        });
    } catch (erro) {
        console.error('Erro ao verificar permissões do cargo:', erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao verificar as permissões de acesso.'
        });
    }
};

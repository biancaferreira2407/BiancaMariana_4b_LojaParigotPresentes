const { query } = require('../database');

// Registra operações autenticadas que alteram dados, sem armazenar senhas,
// tokens ou o conteúdo completo das requisições.
module.exports = (req, res, next) => {
    const metodo = String(req.method || '').toUpperCase();
    const alteraDados = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo);

    if (alteraDados) {
        res.on('finish', async () => {
            if (!req.usuario?.cpf || res.statusCode >= 400) return;
            try {
                const rota = String(req.originalUrl || req.path || '').split('?')[0].slice(0, 250);
                const verbo = metodo === 'POST' ? 'Registrou' : metodo === 'DELETE' ? 'Excluiu' : 'Atualizou';
                const recurso = rota.split('/').filter(Boolean).slice(0, 2).join(' / ') || 'sistema';
                const descricao = `${verbo} uma informação em ${recurso} (${metodo} ${rota})`.slice(0, 500);
                await query(
                    `INSERT INTO public.historico_movimentacao (cpf_pessoa, descricao, metodo, rota)
                     VALUES ($1, $2, $3, $4)`,
                    [req.usuario.cpf, descricao, metodo, rota]
                );
            } catch (erro) {
                console.error('Não foi possível registrar a movimentação:', erro.message);
            }
        });
    }
    next();
};

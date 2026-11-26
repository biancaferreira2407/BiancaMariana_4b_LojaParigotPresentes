const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importa a função de consulta do banco
const { query } = require('./database');

// Importa as rotas
const produtoRoutes = require('./routes/produtoRoutes');
const unidadeMedidaRoutes = require('./routes/unidadeMedidaRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const cargoRoutes = require('./routes/cargoRoutes');
const formaPagamentoRoutes = require('./routes/formaPagamentoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const devolucaoRoutes = require('./routes/devolucaoRoutes');
const loginRoutes = require('./routes/loginRoutes');
const contaRoutes = require('./routes/contaRoutes');
const cadastroRoutes = require('./routes/cadastroRoutes');
const recuperacaoSenhaRoutes = require('./routes/recuperacaoSenhaRoutes');
const notificacaoRoutes = require('./routes/notificacaoRoutes');
const notificacaoController = require('./controllers/notificacaoController');
const registrarMovimentacao = require('./middlewares/registrarMovimentacao');
const relatorioRoutes = require('./routes/relatorioRoutes');
const comentarioRoutes = require('./routes/comentarioRoutes');


const app = express();

app.use(cors());
app.use(express.json());
app.use(registrarMovimentacao);

// Servir imagens estáticas
app.use('/imagens', express.static(path.join(__dirname, '../imagens')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Definir Rotas
app.use('/produto', produtoRoutes);
app.use('/unidade_medida', unidadeMedidaRoutes);
app.use('/categoria', categoriaRoutes);
app.use('/login', loginRoutes);
app.use('/conta', contaRoutes);
app.use('/cadastro', cadastroRoutes);
app.use('/esqueci-senha', recuperacaoSenhaRoutes);




//clienteRoutes tem que vir antes de pessoaRoutes
const clienteRoutes = require('./routes/clienteRoutes');
app.use('/cliente', clienteRoutes);

//funcionarioRoutes tem que vir antes de pessoaRoutes
const funcionarioRoutes = require('./routes/funcionarioRoutes');
app.use('/funcionario', funcionarioRoutes);

const pessoaRoutes = require('./routes/pessoaRoutes');
app.use('/pessoa', pessoaRoutes);


app.use('/cargo', cargoRoutes);

app.use('/forma_pagamento', formaPagamentoRoutes);

app.use('/pedido', pedidoRoutes);

app.use('/notificacao', notificacaoRoutes);
app.use('/relatorios', relatorioRoutes);
app.use('/comentario', comentarioRoutes);

app.use('/devolucao', devolucaoRoutes);

const PORT = process.env.PORT || 3001;

// Inicializa o servidor e testa o PostgreSQL
app.listen(PORT, async () => {
    console.log(`\n=================================`);
    console.log(`🚀 Servidor executando na porta ${PORT}`);
    
    try {
        await query('SELECT 1');
        console.log(`✅ Banco de Dados  ${process.env.DB_NAME} conectado com sucesso!`);
        try {
            await notificacaoController.garantirTabela();
            await query(`CREATE TABLE IF NOT EXISTS public.historico_movimentacao (id_historico BIGSERIAL PRIMARY KEY, cpf_pessoa VARCHAR(20), descricao VARCHAR(500) NOT NULL, metodo VARCHAR(10) NOT NULL, rota VARCHAR(250) NOT NULL, data_hora TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_historico_data_hora ON public.historico_movimentacao (data_hora DESC)`);
            await query(`CREATE TABLE IF NOT EXISTS public.comentarios (
                id_comentario BIGSERIAL PRIMARY KEY,
                cpf_comentador VARCHAR(20) NOT NULL REFERENCES public.pessoa(cpf_pessoa) ON DELETE CASCADE,
                id_produto INTEGER NOT NULL REFERENCES public.produto(id_produto) ON DELETE CASCADE,
                avaliacao SMALLINT NOT NULL CHECK (avaliacao BETWEEN 1 AND 5),
                texto_comentario TEXT NOT NULL CHECK (length(trim(texto_comentario)) BETWEEN 1 AND 1500),
                data_comentario TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_comentario_cliente_produto UNIQUE (cpf_comentador, id_produto)
            )`);
            await query(`CREATE INDEX IF NOT EXISTS idx_comentarios_produto ON public.comentarios (id_produto)`);
        } catch (erroTabela) {
            console.error(`⚠️  Não foi possível preparar as tabelas de histórico/comentários: ${erroTabela.message}`);
        }
    } catch (error) {
        console.error(`❌ FALHA NA CONEXÃO COM O BANCO DE DADOS:`);
        console.error(`   Motivo: ${error.message}`);
        console.error(`👉 Ajuste o arquivo .env com a senha correta do seu PostgreSQL.`);
    }
    console.log(`=================================\n`);
});

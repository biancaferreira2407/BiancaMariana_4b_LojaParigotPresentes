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


const app = express();

app.use(cors());
app.use(express.json());

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
        } catch (erroTabela) {
            console.error(`⚠️  Não foi possível preparar a tabela de notificações: ${erroTabela.message}`);
        }
    } catch (error) {
        console.error(`❌ FALHA NA CONEXÃO COM O BANCO DE DADOS:`);
        console.error(`   Motivo: ${error.message}`);
        console.error(`👉 Ajuste o arquivo .env com a senha correta do seu PostgreSQL.`);
    }
    console.log(`=================================\n`);
});

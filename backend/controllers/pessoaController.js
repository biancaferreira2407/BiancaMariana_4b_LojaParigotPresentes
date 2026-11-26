const { query } = require('../database');
const { normalizarTelefone, telefoneValido, MENSAGEM_TELEFONE } = require('../utils/telefone');
const { formatarNome, nomeValido, MENSAGEM_NOME } = require('../utils/nome');
const { validarCepCampoMourao } = require('../utils/cep');



exports.listarPessoas = async (req, res) => {
  try {
    const result = await query('SELECT cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa, (senha_pessoa IS NULL) AS senha_pendente FROM pessoa ORDER BY cpf_pessoa');
    res.json({ sucesso: true, pessoas: result.rows });
  } catch (error) {
    console.error('Erro ao listar pessoas:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.criarPessoa = async (req, res) => {
  try {
    const { cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa } = req.body;

    // A senha NÃO é definida pelo admin: a própria pessoa cria no primeiro login, confirmando o código enviado ao e-mail.
    const nomeFormatado = formatarNome(nome_pessoa);
    if (!nomeFormatado || !nomeValido(nomeFormatado)) return res.status(400).json({ sucesso: false, mensagem: MENSAGEM_NOME });
    if (!nome_pessoa || !endereco_pessoa || !telefone_pessoa || !email_pessoa) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nome, email, endereço, telefone e CEP são obrigatórios'
      });
    }

    const cpfLimpo = String(cpf_pessoa || '').replace(/\D/g, '');
    const cepLimpo = String(cep_pessoa || '').replace(/\D/g, '');
    const cepCheck = await validarCepCampoMourao(cepLimpo);
    if (!cepCheck.valido) return res.status(400).json({ sucesso: false, mensagem: cepCheck.mensagem });
    if (!/^\d{11}$/.test(cpfLimpo)) {
      return res.status(400).json({ sucesso: false, mensagem: 'O CPF deve conter exatamente 11 números.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_pessoa)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Formato de email inválido'
      });
    }

    const telefone = normalizarTelefone(telefone_pessoa);
    if (!telefoneValido(telefone)) {
      return res.status(400).json({ sucesso: false, mensagem: MENSAGEM_TELEFONE });
    }

    const emailEmUso = await query('SELECT 1 FROM pessoa WHERE LOWER(email_pessoa) = LOWER($1)', [email_pessoa]);
    if (emailEmUso.rows.length > 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado' });
    }

    const result = await query(
      'INSERT INTO pessoa (cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, senha_pessoa, email_pessoa) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7) RETURNING cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa',
      [cpfLimpo, nomeFormatado, data_nascimento_pessoa || null, cepLimpo, endereco_pessoa, telefone, email_pessoa]
    );

    res.status(201).json({ sucesso: true, pessoa: result.rows[0] });
  } catch (error) {
    console.error('Erro ao criar pessoa:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'CPF já está cadastrado'
      });
    }

    if (error.code === '23502') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Dados obrigatórios não fornecidos'
      });
    }

    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.obterPessoa = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();

    if (!id) {
      return res.status(400).json({ sucesso: false, mensagem: 'CPF inválido' });
    }

    const result = await query(
      'SELECT cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada' });
    }

    res.json({ sucesso: true, pessoa: result.rows[0] });
  } catch (error) {
    console.error('Erro ao obter pessoa:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.atualizarPessoa = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const { nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa } = req.body;

    if (cep_pessoa !== undefined && !/^\d{8}$/.test(String(cep_pessoa).replace(/\D/g, ''))) {
      return res.status(400).json({ sucesso: false, mensagem: 'O CEP deve conter exatamente 8 números.' });
    }

    let telefoneNovo;
    if (telefone_pessoa !== undefined) {
      telefoneNovo = normalizarTelefone(telefone_pessoa);
      if (!telefoneValido(telefoneNovo)) {
        return res.status(400).json({ sucesso: false, mensagem: MENSAGEM_TELEFONE });
      }
    }

    if (email_pessoa) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email_pessoa)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Formato de email inválido'
        });
      }
    }

    if (email_pessoa) {
      const emailEmUso = await query(
        'SELECT 1 FROM pessoa WHERE LOWER(email_pessoa) = LOWER($1) AND cpf_pessoa <> $2',
        [email_pessoa, id]
      );
      if (emailEmUso.rows.length > 0) {
        return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está cadastrado em outra pessoa' });
      }
    }

    const existingPersonResult = await query(
      'SELECT cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, senha_pessoa, email_pessoa FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada' });
    }

    const currentPerson = existingPersonResult.rows[0];

    // Só valida a cidade quando o CEP foi realmente alterado (cadastros antigos podem ser editados sem trocar o CEP).
    if (cep_pessoa !== undefined) {
      const cepNovo = String(cep_pessoa).replace(/\D/g, '');
      if (cepNovo !== String(currentPerson.cep_pessoa || '')) {
        const cepCheck = await validarCepCampoMourao(cepNovo);
        if (!cepCheck.valido) return res.status(400).json({ sucesso: false, mensagem: cepCheck.mensagem });
      }
    }
    const nomeAtualizado = nome_pessoa !== undefined ? formatarNome(nome_pessoa) : currentPerson.nome_pessoa;
    if (nome_pessoa !== undefined && !nomeValido(nomeAtualizado)) return res.status(400).json({ sucesso: false, mensagem: MENSAGEM_NOME });
    const updatedFields = {
      nome_pessoa: nomeAtualizado,
      data_nascimento_pessoa: data_nascimento_pessoa !== undefined ? (data_nascimento_pessoa || null) : currentPerson.data_nascimento_pessoa,
      cep_pessoa: cep_pessoa !== undefined ? String(cep_pessoa).replace(/\D/g, '') : currentPerson.cep_pessoa,
      endereco_pessoa: endereco_pessoa !== undefined ? endereco_pessoa : currentPerson.endereco_pessoa,
      telefone_pessoa: telefoneNovo !== undefined ? telefoneNovo : currentPerson.telefone_pessoa,
      senha_pessoa: currentPerson.senha_pessoa, // admin nunca altera senha
      email_pessoa: email_pessoa !== undefined ? email_pessoa : currentPerson.email_pessoa
    };

    const updateResult = await query(
      'UPDATE pessoa SET nome_pessoa = $1, data_nascimento_pessoa = $2, cep_pessoa = $3, endereco_pessoa = $4, telefone_pessoa = $5, senha_pessoa = $6, email_pessoa = $7 WHERE cpf_pessoa = $8 RETURNING cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa',
      [updatedFields.nome_pessoa, updatedFields.data_nascimento_pessoa, updatedFields.cep_pessoa, updatedFields.endereco_pessoa, updatedFields.telefone_pessoa, updatedFields.senha_pessoa, updatedFields.email_pessoa, id]
    );

    res.json({ sucesso: true, pessoa: updateResult.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar pessoa:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Não foi possível atualizar: já existe um registro com esses dados.'
      });
    }

    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.deletarPessoa = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();

    const existingPersonResult = await query(
      'SELECT cpf_pessoa FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada' });
    }

    await query(
      'DELETE FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    res.json({ sucesso: true, mensagem: 'Pessoa excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar pessoa:', error);

    if (error.code === '23503') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Não é possível deletar pessoa com dependências associadas'
      });
    }

    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.obterPessoaPorEmail = async (req, res) => {
  try {
    const { email_pessoa } = req.params;

    if (!email_pessoa) {
      return res.status(400).json({ sucesso: false, mensagem: 'Email é obrigatório' });
    }

    const result = await query(
      'SELECT cpf_pessoa, nome_pessoa, data_nascimento_pessoa, cep_pessoa, endereco_pessoa, telefone_pessoa, email_pessoa FROM pessoa WHERE email_pessoa = $1',
      [email_pessoa]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada' });
    }

    res.json({ sucesso: true, pessoa: result.rows[0] });
  } catch (error) {
    console.error('Erro ao obter pessoa por email:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.atualizarSenha = async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const { senha_atual, nova_senha } = req.body;

    if (!id) {
      return res.status(400).json({ sucesso: false, mensagem: 'CPF inválido' });
    }

    if (!senha_atual || !nova_senha) {
      return res.status(400).json({ sucesso: false, mensagem: 'Senha atual e nova senha são obrigatórias' });
    }

    const personResult = await query(
      'SELECT * FROM pessoa WHERE cpf_pessoa = $1',
      [id]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Pessoa não encontrada' });
    }

    const person = personResult.rows[0];

    if (person.senha_pessoa !== senha_atual) {
      return res.status(400).json({ sucesso: false, mensagem: 'Senha atual incorreta' });
    }

    const updateResult = await query(
      'UPDATE pessoa SET senha_pessoa = $1 WHERE cpf_pessoa = $2 RETURNING cpf_pessoa, nome_pessoa, endereco_pessoa, telefone_pessoa, data_nascimento_pessoa',
      [nova_senha, id]
    );

    res.json({ sucesso: true, pessoa: updateResult.rows[0] });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};
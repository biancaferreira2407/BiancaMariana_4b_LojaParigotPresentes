const { query, pool } = require('../database');



exports.listarCargos = async (req, res) => {
  try {
    const result = await query('SELECT * FROM cargo ORDER BY id_cargo');
  //  console.log('Resultado do SELECT:', result.rows);
    res.json({ sucesso: true, cargos: result.rows });
  } catch (error) {
    console.error('Erro ao listar cargos:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.criarCargo = async (req, res) => {
  try {
    const { id_cargo, nome_cargo } = req.body;
    const permissoes = Array.isArray(req.body.permissoes) ? req.body.permissoes : [];

    // Validação básica
    if (!nome_cargo) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'O nome do cargo é obrigatório'
      });
    }

    const client = await pool.connect();
    let cargoCriado;
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'INSERT INTO cargo (id_cargo, nome_cargo) VALUES ($1, $2) RETURNING *',
        [id_cargo, nome_cargo]
      );
      cargoCriado = result.rows[0];
      for (const idTabela of permissoes) {
        await client.query('INSERT INTO cargo_has_tabela (id_cargo, id_tabela) VALUES ($1, $2)', [id_cargo, idTabela]);
      }
      await client.query('COMMIT');
    } catch (erro) { await client.query('ROLLBACK'); throw erro; }
    finally { client.release(); }

    res.status(201).json({ sucesso: true, cargo: cargoCriado });
  } catch (error) {
    console.error('Erro ao criar cargo:', error);

    // Verifica se é erro de violação de constraint NOT NULL
    if (error.code === '23502') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Dados obrigatórios não fornecidos'
      });
    }

    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.obterCargo = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ sucesso: false, mensagem: 'ID deve ser um número válido' });
    }

    const result = await query(
      'SELECT * FROM cargo WHERE id_cargo = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cargo não encontrado' });
    }

    const permissoesResult = await query('SELECT id_tabela FROM cargo_has_tabela WHERE id_cargo = $1 ORDER BY id_tabela', [id]);
    res.json({ sucesso: true, cargo: { ...result.rows[0], permissoes: permissoesResult.rows.map(item => item.id_tabela) } });
  } catch (error) {
    console.error('Erro ao obter cargo:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.atualizarCargo = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nome_cargo } = req.body;

    // Verifica se o cargo existe
    const existingPersonResult = await query(
      'SELECT * FROM cargo WHERE id_cargo = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cargo não encontrado' });
    }

    // Constrói os campos para atualização
    const currentPerson = existingPersonResult.rows[0];
    const updatedFields = {
      nome_cargo: nome_cargo !== undefined ? nome_cargo : currentPerson.nome_cargo
    };

    // Atualiza o cargo
    const permissoes = Array.isArray(req.body.permissoes) ? req.body.permissoes : [];
    const client = await pool.connect();
    let cargoAtualizado;
    try {
      await client.query('BEGIN');
      const updateResult = await client.query(
        'UPDATE cargo SET nome_cargo = $1 WHERE id_cargo = $2 RETURNING *',
        [updatedFields.nome_cargo, id]
      );
      cargoAtualizado = updateResult.rows[0];
      await client.query('DELETE FROM cargo_has_tabela WHERE id_cargo = $1', [id]);
      for (const idTabela of permissoes) {
        await client.query('INSERT INTO cargo_has_tabela (id_cargo, id_tabela) VALUES ($1, $2)', [id, idTabela]);
      }
      await client.query('COMMIT');
    } catch (erro) { await client.query('ROLLBACK'); throw erro; }
    finally { client.release(); }

    res.json({ sucesso: true, cargo: cargoAtualizado });
  } catch (error) {
    console.error('Erro ao atualizar cargo:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

exports.deletarCargo = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Verifica se o cargo existe
    const existingPersonResult = await query(
      'SELECT * FROM cargo WHERE id_cargo = $1',
      [id]
    );

    if (existingPersonResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cargo não encontrado' });
    }

    // Deleta o cargo
    await query(
      'DELETE FROM cargo WHERE id_cargo = $1',
      [id]
    );

    res.json({ sucesso: true, mensagem: 'Cargo excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar cargo:', error);

    // Verifica se é erro de violação de foreign key (dependências)
    if (error.code === '23503') {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Não é possível deletar cargo com dependências associadas'
      });
    }

    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
};

// Lista os módulos disponíveis para configurar as permissões dos cargos.
exports.listarModulos = async (req, res) => {
  try {
    const result = await query('SELECT id_tabela, nome_tabela FROM tabelas_card_menu ORDER BY id_tabela');
    res.json({ sucesso: true, modulos: result.rows });
  } catch (error) {
    console.error('Erro ao listar módulos:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar módulos.' });
  }
};

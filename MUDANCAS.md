# Revisão do projeto Parigot Presentes — o que foi alterado

## PIX real (tela "Revisão do pedido")
- Novo arquivo `frontend/cliente/pix/pix.js`: gera o **PIX Copia e Cola** no padrão BR Code (EMV) do Banco Central, com CRC16, e desenha o **QR Code** (mesmo texto).
- Chave: `+5544997115742` (telefone). Favorecido no código: `BIANCA MARIANA R FERREIRA`
  (o campo aceita no máximo 25 caracteres; o app do banco mostra o nome completo cadastrado na chave). Cidade: `GOIOERE`.
- Valor = valor do PIX validado pelo servidor; identificador (txid) = `PEDIDO<número>`.
- Para trocar chave/nome/cidade: edite só `CONFIG_PIX` no início de `pix.js`.
- O PIX estático **não avisa o site** quando o pagamento é feito: a confirmação é manual (extrato do banco).
- Removido o código PIX antigo/morto de `formaPagamento.js/.html` e o texto "simulação" do PIX.

## Segurança
- As rotas administrativas (pessoas, funcionários, clientes, cargos, formas de pagamento, devoluções, pedidos, CRUD de produto/categoria/unidade) **não exigiam login**. Agora exigem token de funcionário (`exigirAdmin`). Continuam públicas: listar produtos/categorias/unidades (vitrine), cadastro, login, recuperação de senha.
- Telas admin: `frontend/admin/auth-admin.js` exige login admin e envia o token em todas as chamadas; botão **Sair** no menu.
- Upload de imagem: ID validado como inteiro (evitava caminho tipo `../../`), limite de 5 MB e só imagens.
- Login: e-mail sem diferenciar maiúsculas/minúsculas. E-mail duplicado agora é barrado (conta, admin) e o SQL ganhou índice único.

## Bugs corrigidos
- **Novo pedido (admin)** estava quebrado (enviava para a rota/formato do cliente). Criada `POST /pedido/admin`.
- Detalhes do pedido no admin mostravam "valor pago" R$ 0,00.
- **Devoluções**: excluir uma devolução "Defeito" descontava estoque indevidamente; editar o motivo não ajustava estoque. Motivo validado (Pessoal/Defeito).
- Revisão do pedido: com crédito **e** débito os formulários tinham `id` duplicado e o botão "Concluir pedido" nunca aparecia.
- Datas: `DATE` do banco volta como texto `AAAA-MM-DD` (evita aparecer um dia antes); "hoje" usa fuso local.
- Vitrine mostrava a silhueta após o admin enviar nova imagem (extensão fixa por produto).
- Carrinho/vitrine respeitam o estoque; produto sem estoque fica indisponível.
- Preferência "entrega" escolhida antes do login era salva no lugar errado e se perdia.
- Excluir produto/validações de produto, pessoa e cliente com mensagens corretas (409 se o produto já está em pedidos).
- Removida rota morta `/cliente/abrirCrudCliente`.

## Para rodar
1. `npm install` na pasta do projeto (o `node_modules` não foi incluído).
2. Banco já existente: rode `CREATE UNIQUE INDEX ux_pessoa_email ON pessoa (LOWER(email_pessoa));` (se houver e-mails repetidos, corrija antes). Banco novo: use `documentacao/DW_proj_4B.sql`.
3. `backend/.env` (modelo em `backend/.env.example`) e `node backend/server.js`.

## Ainda recomendado (não alterado)
- **Senhas estão em texto puro** no banco (`senha_pessoa VARCHAR(50)`). O ideal é guardar hash (bcrypt/scrypt), o que exige mudar a coluna e migrar as senhas.
- O `.env` veio dentro do ZIP com senha do banco e do Gmail: troque essas senhas e não envie o arquivo a terceiros.

## Acesso por cargo (funcionários)
- O funcionário só acessa os módulos marcados no **cargo** dele (tela Cargos -> `cargo_has_tabela`). Cargo sem módulos = menu vazio com aviso.
- Servidor: `exigirModulo(...)` (em `authMiddleware.js`) lê o cargo no banco **a cada chamada**; mudar o cargo/permissões vale na hora e funcionário excluído perde o acesso. Resposta 403 com `moduloNegado: true`.
- Módulo -> telas/API: `pedidos` (novo pedido, realizados, gerenciar, notificações), `devolucoes`, `cargos`, `pessoas`, `produtos`, `categorias`, `unidade_medida`, `formas_pagamento`; `clientes` e `funcionarios` controlam só a API (não há menu próprio).
- Dependências entre telas: Pessoas usa as APIs de cliente/funcionário/lista de cargos; Novo pedido lê as listas de clientes, funcionários e formas de pagamento; Devoluções lê o detalhe do pedido. Essas leituras ficam liberadas para o módulo que depende delas.
- Front: login guarda `permissoes`; `auth-admin.js` bloqueia a tela sem o módulo (volta ao menu); `menu.js` esconde os cards sem acesso e se atualiza via `GET /login/permissoes`.
- Banco: `documentacao/migracao_permissoes_cargo.sql` (bancos existentes) e permissões de Gerente/Diretor no `DW_proj_4B.sql`.

## Ajustes na loja (cliente)
- Busca de produtos ignora acentos e maiúsculas ("cafe" encontra "Café", "acucar" encontra "Açúcar").
- Produtos sem estoque aparecem bloqueados na vitrine (selo "Esgotado", sem abrir detalhes nem ir ao carrinho).
- O botão do carrinho mostra a quantidade de itens (soma das unidades) e acompanha mudanças feitas na tela do carrinho.
- Carrinho: o "Remover" de cada item virou um ícone de lixeira.
- Revisão do pedido: o botão bloqueado "Registrando pedido..." deixava de sumir porque o CSS anulava o atributo `hidden`; agora o botão é removido após registrar e `[hidden]` vale na página.
- Ícone da conta abre um menu com "Meu perfil" e "Sair da conta" (encerra a sessão; o carrinho continua salvo no navegador).

## Login e criar conta
- Senha com no mínimo **6** caracteres (antes 8), no cadastro e também na redefinição de senha ("Esqueci minha senha"), para as duas telas seguirem a mesma regra. Servidor: entre 6 e 50.
- Nome: só letras (com acentos) e espaços; a 1ª letra de cada palavra vira maiúscula enquanto digita ("joão da silva" -> "João Da Silva"). Regra única em `backend/utils/nome.js`, usada no cadastro e na tela Minha conta (o servidor também valida e formata).
- Ao criar a conta, o cliente vai direto para o login, que mostra "Conta criada com sucesso!" e já preenche o e-mail.

## Loja (cliente)
- Barra de navegação ganhou o botão "Produtos" (volta para a vitrine, sem filtros, de qualquer ponto, inclusive de Pedidos realizados/Devoluções).
- Categorias: "todas" em minúsculas e frase "Explore por categoria" removida.


## Revisão do ADMIN, cadastro por CEP e apresentação da loja
- Corrigido o caminho do botão **Voltar ao Menu** na tela de Cargos. Os 10 links administrativos de retorno foram verificados e todos apontam para `frontend/admin/menu/menu.html`.
- No ADMIN, os campos de nome aceitam letras (incluindo acentos) e espaços, e formatam a primeira letra de cada palavra em maiúscula. A API também valida e normaliza o nome.
- CPF, identificadores numéricos e quantidades recebem somente dígitos no navegador; campos monetários continuam aceitando casas decimais. O identificador da unidade de medida foi preservado como texto porque pode ser uma sigla (por exemplo, KG).
- No cadastro de pessoa do ADMIN e no cadastro de conta do cliente, o CEP é consultado automaticamente pelo ViaCEP. O usuário informa apenas o número da residência; rua, bairro, cidade e UF são preenchidos a partir do CEP e salvos em `endereco_pessoa`. O CEP de oito dígitos também é armazenado em `pessoa.cep_pessoa`.
- A tela de pessoas do ADMIN agora mostra também o CEP.
- Na vitrine, clicar na marca/nome Parigot Presentes abre uma apresentação da loja com o endereço: Rua Eucalipto, nº 64, Conjunto Parigot de Souza, Campo Mourão – PR.
- O endereço de entrega continua somente para leitura no fluxo de compra. Além disso, o backend ignora qualquer endereço enviado pelo navegador e recupera o endereço diretamente do cadastro associado ao cliente autenticado.

### Atualização necessária do banco existente
Execute uma vez `documentacao/migracao_cep_endereco.sql` no banco já utilizado. Em banco novo, a coluna `cep_pessoa` já está no `documentacao/DW_proj_4B.sql`. Cadastros antigos ficam com CEP nulo até que o CEP seja preenchido/atualizado; os novos cadastros passam a exigir CEP válido.

### Validações realizadas nesta revisão
- Todos os arquivos JavaScript passaram por `node --check`.
- Os links locais das páginas ADMIN foram verificados; nenhum destino de link ficou inexistente.
- Não foi possível testar visualmente cada tela em um navegador nem executar consultas no banco real deste ambiente. Após aplicar a migração, teste um cadastro novo tanto pelo ADMIN quanto pela tela Criar conta.

## Histórico, ranking de vendas e avaliações de produtos

- Novo módulo administrativo em `frontend/admin/relatorios/relatorios.html`, acessível pelo menu de ADMIN (permissão de pedidos).
- Histórico de movimentações: registra operações autenticadas de inclusão, alteração e exclusão após resposta bem-sucedida, mostrando data/hora, descrição da rota/ação, nome e CPF da pessoa. Não armazena senhas, tokens ou corpos das requisições.
- Ranking: soma unidades e valores de pedidos com pagamento confirmado, excluindo pedidos devolvidos.
- Comentários: clientes autenticados podem avaliar de 1 a 5 estrelas e escrever até 1.500 caracteres. Cada cliente mantém uma avaliação por produto; ao enviar outra, a avaliação anterior daquele produto é atualizada.
- Os textos e autores dos comentários são enviados somente à rota administrativa. A vitrine pública recebe apenas média e quantidade de avaliações por produto.
- Para banco existente, executar `documentacao/migracao_historico_comentarios.sql` uma vez. Para banco novo, as tabelas também estão no final de `documentacao/DW_proj_4B.sql`.
- O servidor cria a tabela de histórico automaticamente ao iniciar. A tabela `comentarios` precisa existir antes de carregar a vitrine; execute a migração no banco existente.

## Senha criada pela própria pessoa (primeiro acesso)
- Admin (tela Pessoa) não define mais senha: a pessoa é gravada com `senha_pessoa = NULL`. A listagem mostra "Pendente (1º acesso)" ou "Definida". O admin também não altera senhas na edição.
- Login: se o e-mail existe mas não tem senha, o servidor responde `primeiroAcesso: true` e o front leva para `esqueciSenha.html?primeiroAcesso=1&email=...`.
- Essa tela envia sozinha o código de 6 dígitos por e-mail (mesmo fluxo/tabela `recuperacao_senha` do "esqueci senha": validade de 10 min, 5 tentativas), a pessoa confirma o código e cria a senha. O e-mail do código tem texto próprio para primeiro acesso.
- Não precisa de migração: `senha_pessoa` já aceita NULL.

## CEP restrito a Campo Mourão - PR
- Novo `backend/utils/cep.js` (`validarCepCampoMourao`): recusa CEP fora da faixa 87300-000 a 87319-999 e confirma a cidade no ViaCEP (IBGE 4104303). Se o ViaCEP estiver fora do ar, vale só a faixa.
- Aplicado no cadastro do cliente (`cadastroController`) e no CRUD de Pessoa do admin (`pessoaController`). Na edição, só valida se o CEP foi alterado, para não travar cadastros antigos.
- Telas `cadastro.js` e `admin/pessoa/pessoa.js` avisam na hora ("Só atendemos Campo Mourão - PR") e não liberam o endereço.
- Para mudar a cidade, edite as constantes no topo de `utils/cep.js` e o código IBGE nas duas telas.

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


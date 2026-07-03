# Sistema de Locacao de Filmes

API REST desenvolvida para a disciplina de Desenvolvimento de Servicos e APIs.

**Aluna:** Manoela das Neves  
**Tema:** Sistema de locacao de filmes  
**Stack:** Node.js, TypeScript, Express, Prisma, MySQL, Zod, Nodemailer e Mailtrap

## Sobre o Projeto

Este projeto simula o backend de uma locadora de filmes. A API permite cadastrar clientes, filmes e locacoes, controlar estoque durante as locacoes, enviar historico por e-mail e registrar acoes importantes do sistema em uma tabela de logs.

Na etapa de seguranca, o sistema tambem passou a ter usuarios, login com token, recuperacao de senha por e-mail e controles adicionais exigidos na atividade.

## Principais Recursos

- CRUD de clientes.
- CRUD de filmes.
- Cadastro e listagem de locacoes.
- Controle de estoque ao criar e excluir locacoes.
- Envio de e-mail com historico de locacoes de um cliente.
- Cadastro e login de usuarios.
- Geracao e validacao de token para rotas protegidas.
- Recuperacao de senha por codigo enviado por e-mail.
- Registro de logs de login, tentativas invalidas e alteracoes sensiveis.
- Log de acao suspeita ao excluir locacao paga em dinheiro.

## Controles de Seguranca Implementados

Foram implementados 3 itens da lista de controles de seguranca proposta na atividade:

| 1 | Limite de tentativas invalidas de acesso | O usuario possui o campo `tentativasLoginInvalidas`. A cada login errado, o contador aumenta. Ao atingir 3 tentativas, o campo `bloqueado` passa para `true` e novos logins sao impedidos.

| 2 | Registro do ultimo login | O usuario possui o campo `ultimoLogin`. No login bem-sucedido, o sistema informa se e o primeiro acesso ou mostra a data/hora do ultimo acesso anterior. Depois atualiza o campo para o login atual.

| 3 | Alteracao simples de senha | A rota protegida `/usuarios/alterar-senha-simples` valida a senha atual, criptografa a nova senha e exige que a nova senha tenha pelo menos 2 caracteres diferentes da senha antiga. |

## Modelo de Dados

| Tabela    | Finalidade |
| ---       | ---        |
| `Cliente` | Armazena os clientes da locadora. |
| `Filme`   | Armazena os filmes e a quantidade disponivel em estoque. |
| `Locacao` | Registra as locacoes feitas pelos clientes. |
| `usuarios`| Armazena usuarios do sistema, senha criptografada e dados de seguranca. |
| `logs`    | Registra eventos importantes, como login, erro de login, alteracao de senha e acoes suspeitas. |

## Rotas da API

### Clientes

| Metodo |      Rotas      | Descricao |
| ---    | ---             | ---       |
| GET    | `/clientes`     | Lista todos os clientes. |
| GET    | `/clientes/:id` | Busca um cliente por ID. |
| POST   | `/clientes`     | Cadastra um cliente. |
| PUT    | `/clientes/:id` | Atualiza um cliente. |
| DELETE | `/clientes/:id` | Exclui um cliente. |

### Filmes

| Metodo | Rota                  | Descricao |
| ---    | ---                   | --- |
| GET    | `/filmes`             | Lista todos os filmes. |
| GET    | `/filmes/disponiveis` | Lista filmes com estoque disponivel. |
| GET    | `/filmes/:id`         | Busca um filme por ID. |
| POST   | `/filmes`             | Cadastra um filme. |
| PUT    | `/filmes/:id`         | Atualiza um filme. |
| DELETE | `/filmes/:id`         | Exclui um filme. |

### Locacoes

| Metodo | Rota            | Descricao |
| ---    | ---             | --- |
| GET    | `/locacoes`     | Lista todas as locacoes. |
| GET    | `/locacoes/:id` | Busca uma locacao por ID. |
| POST   | `/locacoes`     | Cria uma locacao e reduz o estoque do filme. |
| DELETE | `/locacoes/:id` | Exclui uma locacao, restaura o estoque e registra log se o pagamento foi em dinheiro. |

### E-mail

| Metodo | Rota                 | Descricao |
| ---    | ---                  | ---       |
| GET    | `/email/cliente/:id` | Envia por e-mail o historico de locacoes do cliente. |

### Usuarios e Seguranca

| Metodo | Rota                             | Descricao |
| ---    | ---                              | ---       |
| GET    | `/usuarios`                      | Lista usuarios cadastrados. |
| POST   | `/usuarios`                      | Cadastra um usuario. |
| POST   | `/usuarios/login`                | Realiza login, retorna token e controla tentativas invalidas. |
| POST   | `/usuarios/recuperar-senha`      | Gera codigo de recuperacao e envia por e-mail. |
| POST   | `/usuarios/alterar-senha`        | Altera senha usando o codigo de recuperacao. |
| POST   | `/usuarios/alterar-senha-simples`| Altera senha de usuario logado, validando senha atual. |

### Logs

| Metodo | Rota                          | Descricao |
| ---    | ---                           | ---       |
| GET    | `/logs`                       | Lista todos os logs. Requer token. |
| GET    | `/logs/pesquisar?usuarioId=1` | Lista logs de um usuario pelo query parameter. Requer token. |
| GET    | `/logs/usuario/:usuarioId`    | Lista logs de um usuario pelo path parameter. Requer token. |

## Variaveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com os dados do banco, Mailtrap e token:

~~~env
DATABASE_URL="mysql://usuario:senha@localhost:3306/locacao_filmes"
DATABASE_HOST="localhost"
DATABASE_PORT="3306"
DATABASE_USER="usuario"
DATABASE_PASSWORD="senha"
DATABASE_NAME="locacao_filmes"

MAILTRAP_EMAIL="seu_usuario_mailtrap"
MAILTRAP_SENHA="sua_senha_mailtrap"

TOKEN_SECRET="um-segredo-para-assinar-tokens"
~~~

## Como Rodar o Projeto

Instale as dependencias:

~~~bash
npm install
~~~

Execute as migrations do Prisma:

~~~bash
npx prisma migrate dev
~~~

Inicie o servidor:

~~~bash
npm run dev
~~~

A API ficara disponivel em:

~~~txt
http://localhost:3000
~~~

## Apresentacao

### 1. Criar usuario

`POST /usuarios`

{
  "nome": "Teste Seguranca",
  "email": "teste@email.com",
  "senha": "Senha@123"
}

### 2. Fazer login correto

`POST /usuarios/login`

{
  "email": "teste@email.com",
  "senha": "Senha@123"
}

Resultado esperado: retorna um `token` e uma mensagem de boas-vindas. No primeiro login, informa que este e o primeiro acesso.

### 3. Demonstrar ultimo login

Fazer login novamente com os mesmos dados.

Resultado esperado: a mensagem informa a data e hora do ultimo acesso anterior.

### 4. Demonstrar bloqueio por tentativas invalidas

Enviar login com senha errada 3 vezes:

~~~json
{
  "email": "teste@email.com",
  "senha": "senha-errada"
}
~~~

Resultado esperado: o sistema diminui as tentativas restantes e bloqueia o usuario na terceira tentativa.

### 5. Demonstrar alteracao simples de senha

Usar o token recebido no login no header:

~~~txt
Authorization: Bearer SEU_TOKEN
~~~

`POST /usuarios/alterar-senha-simples`

~~~json
{
  "senhaAtual": "Senha@123",
  "novaSenha": "Senha@456"
}
~~~

Resultado esperado: senha alterada com sucesso. Depois disso, o login deve ser feito com a nova senha.

### 6. Demonstrar logs

`GET /logs`

Usar token no header:

~~~txt
Authorization: Bearer SEU_TOKEN
~~~

Resultado esperado: lista de logs com login realizado, tentativas invalidas, alteracao de senha e outras acoes registradas.

## Observacoes Importantes

- Senhas sao armazenadas com hash, nao em texto puro.
- Tokens expiram em 2 horas.
- Rotas protegidas exigem header `Authorization: Bearer TOKEN`.
- O controle de bloqueio usa o campo `bloqueado`; para desbloquear um usuario, e necessario alterar esse campo no banco.
- A exclusao de locacao paga em dinheiro gera um log de acao suspeita.

## Estrutura Simplificada

~~~txt
src/
  middlewares/
    autenticacao.ts
  routes/
    clienteRoutes.ts
    emailRoutes.ts
    filmeRoutes.ts
    locacaoRoutes.ts
    logRoutes.ts
    usuarioRoutes.ts
  utils/
    codigoRecuperacao.ts
    email.ts
    log.ts
    senha.ts
    token.ts
  prismaClient.ts
  server.ts

prisma/
  migrations/
  schema.prisma
~~~

## Resumo Final

O sistema atende ao objetivo principal de uma API de locacao de filmes e adiciona recursos de seguranca importantes para controle de acesso, auditoria e protecao de usuarios.

Para a apresentacao, os pontos mais fortes sao:

- transacoes na criacao e exclusao de locacoes;
- envio de e-mails com Mailtrap;
- login com token;
- logs de auditoria;
- bloqueio por tentativas invalidas;
- exibicao de ultimo login;
- alteracao de senha com validacao da senha atual.

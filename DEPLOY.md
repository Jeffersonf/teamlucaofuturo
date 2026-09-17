# Deploy - Team Lucao Futevolei

## Objetivo

Rodar o sistema em um link acessivel pelo iPhone, com banco persistente e backup automatico.

## Requisitos

- Node 22+ com suporte a `node:sqlite`.
- Disco persistente para o arquivo `arena.db`.
- Variavel `ADMIN_PIN` diferente de `1209`.

## Variaveis

```bash
PORT=3020
ADMIN_PIN=troque-este-pin
DB_PATH=/data/arena.db
BACKUPS_DIR=/data/backups
AUTO_BACKUP_ON_START=true
AUTO_BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION=30
```

## Comando

```bash
npm install
npm start
```

## Deploy com Docker

```bash
docker build -t team-lucao-futevolei .
docker run -p 3020:3020 --env-file .env -v team-lucao-data:/data team-lucao-futevolei
```

## Deploy com Render Blueprint

O arquivo `render.yaml` ja define:

- Node 24.
- Disco persistente em `/data`.
- `DB_PATH=/data/arena.db`.
- `BACKUPS_DIR=/data/backups`.
- Backup automatico diario.

No painel do provedor, configure manualmente `ADMIN_PIN`.

## Deploy gratuito com Cloudflare Workers + D1

O deploy gratuito recomendado para uso online usa o Worker em `worker/index.js` e o banco D1. O Node/SQLite continua disponível para desenvolvimento local.

1. No Cloudflare, crie um banco D1 chamado `team-lucao-futevolei`.
2. Copie o `database_id` exibido pelo Cloudflare para `wrangler.toml`.
3. Aplique a primeira migração:

```bash
npx wrangler login
npx wrangler d1 migrations apply team-lucao-futevolei --remote
```

4. Cadastre o PIN sem colocá-lo no Git:

```bash
npx wrangler secret put ADMIN_PIN
```

Para o deploy automático pelo GitHub, crie um API Token no Cloudflare com permissão de editar Workers e D1. Salve o token em `CLOUDFLARE_API_TOKEN` e o ID da conta em `CLOUDFLARE_ACCOUNT_ID` nos secrets do repositório.

5. Gere os arquivos públicos e publique:

```bash
npm run build:cloudflare
npx wrangler deploy
```

Para publicar automaticamente a cada push na `main`, configure no GitHub os segredos `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. O workflow também aplica as migrações D1.

O Worker usa os mesmos caminhos `/aluno`, `/autorizar` e `/` e mantém os mesmos endpoints da interface. Para levar os dados atuais do SQLite, baixe o backup JSON pelo painel e envie-o ao endpoint `/api/import` com o PIN administrativo.

## Checklist antes de entregar para uso real

- Trocar `ADMIN_PIN`.
- Confirmar que `DB_PATH` esta em disco persistente.
- Confirmar que a pasta `backups/` tambem persiste no provedor.
- Criar um backup manual pela tela Dados.
- Testar acesso pelo iPhone.
- Salvar o link na tela inicial do iPhone.

## Links de uso rapido

- Aluno: `/aluno`
- Professor: `/autorizar`
- Painel completo: `/`

## Teste de aceite no iPhone

1. Abrir o link do servidor, nao o GitHub Pages.
2. Entrar com o PIN real.
3. Criar um aluno com agenda fixa.
4. Sincronizar proximas aulas pela ficha do aluno.
5. Abrir a aula do dia e marcar presenca.
6. Abrir a tela publica `Sou aluno`, buscar pelo WhatsApp e confirmar `Vou`.
7. Voltar ao painel e conferir a confirmacao na aula.
8. Criar backup manual e baixar o arquivo.

Se qualquer passo depender de dados compartilhados entre aparelhos, ele precisa passar pelo servidor Node.

## Observacoes

GitHub Pages continua servindo bem para demo, mas uso real precisa do servidor Node para persistir dados em SQLite e fazer backup automatico. Sem servidor, o modo local usa `localStorage` do navegador.

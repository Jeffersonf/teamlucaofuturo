# Fechamento e publicacao - Team Lucao

Use este checklist quando a rodada local estiver aprovada e for hora de publicar no GitHub Pages.

## Estado local esperado

- Live local: `http://127.0.0.1:4280/`
- PIN da demo: `1209`
- Versao atual dos assets: `20260624-clean1`
- Service worker atual: `team-lucao-v119`

## Antes de publicar

1. Rodar:

```bash
npm run check
```

2. Auditar os fluxos principais com servidor e banco temporario:

```bash
npm run flow:audit
```

3. Com o live server aberto, rodar:

```bash
npm run visual:check
```

4. Conferir no navegador:

- Tela publica de agendamento mobile.
- Aba publica `Sou aluno` para confirmar presenca futura.
- Login/PIN mobile pelo botao `Acesso professor`.
- Dashboard mobile.
- Aulas mobile.
- Cobrar mobile.
- Pedidos mobile.
- Dashboard desktop.
- Alunos desktop.
- Pedidos desktop.

5. Conferir manualmente no live server:

- Entrar com PIN `1234`.
- Enviar um pedido de aula pela primeira tela.
- Buscar aulas como aluno pelo WhatsApp e marcar `Vou` / `Nao vou`.
- Abrir `Pedidos` e aprovar/recusar um pedido.
- Abrir uma aula de hoje e marcar presenca.
- Conferir no modal de presenca: confirmar status dos alunos, copiar resumo e finalizar aula.
- Clicar no nome de um aluno e abrir a ficha.
- Abrir Cobrar e copiar uma cobranca.
- Abrir Espera e ver interessados com prioridade.
- Abrir Mais no mobile e conferir atalhos secundarios.

## Publicacao

### Demo estatica

1. Confirmar worktree limpo ou somente com mudancas intencionais.
2. Fazer push para `main`.
3. Aguardar o GitHub Pages atualizar.
4. Verificar se o HTML publicado contem a versao atual dos assets.
5. Abrir `https://jeffersonf.github.io/arena-futvolei/` no iPhone.

### Operacao real

1. Publicar o backend Node com `DB_PATH` e `BACKUPS_DIR` em disco persistente.
2. Configurar `ADMIN_PIN` fora do codigo.
3. Abrir o link do servidor no iPhone.
4. Confirmar que o topo mostra `Servidor Node + SQLite`.
5. Testar pedido publico, confirmacao do aluno, presenca e backup manual.
6. Seguir o roteiro completo de aceite em `OPERACAO_REAL.md`.

## Depois de publicar

- Fazer refresh forte se o service worker segurar versao antiga.
- Entrar com PIN `1234`.
- Verificar se o rodape mobile mostra `Inicio`, `Pedidos`, `Alunos`, `Aulas`, `Cobrar`, `Espera`, `Mais`.
- Confirmar que a tela publica de agendamento aparece antes do PIN.
- Confirmar que a aba `Sou aluno` abre no iPhone e nao estoura a largura.
- Confirmar que `Aulas`, `Cobrar` e ficha do aluno carregam com o design novo.

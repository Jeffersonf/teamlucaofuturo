# Operacao real - Team Lucao

Este guia e para quando a demo deixar de ser apenas visual e virar ferramenta do dia a dia da escola.

## Decisao rapida

Use GitHub Pages para demonstrar a interface.

Use o servidor Node para operacao real. Sem servidor, os dados ficam no navegador atual e nao sao confiaveis entre iPhone, notebook e outros aparelhos.

## Antes de colocar em uso

1. Definir um PIN de professor que nao seja `1209`.
2. Publicar o backend Node em um ambiente com disco persistente.
3. Configurar banco e backups fora da pasta temporaria do servidor.
4. Abrir o link final no iPhone do professor.
5. Confirmar que o topo mostra `Servidor Node + SQLite`.
6. Fazer backup manual antes de carregar dados reais.

## Variaveis recomendadas

```bash
ADMIN_PIN=troque-este-pin
DB_PATH=/caminho/persistente/arena.db
BACKUPS_DIR=/caminho/persistente/backups
AUTO_BACKUP_ON_START=true
AUTO_BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION=30
```

## Teste de aceite no iPhone

1. Abrir o link publico.
2. Pedir uma vaga como visitante.
3. Testar uma aula cheia e entrar na `lista de espera`.
4. Entrar como professor pelo botao `Acesso professor`.
5. No fluxo da aula, o aluno toca em `Vou` e o professor confirma a indicação em `Presenças`.
6. Abrir `Alunos` e confirmar que a lista esta legivel.
7. Editar um aluno e conferir `Agenda fixa` no topo do modal.
8. Abrir `Aulas`, entrar em `Presencas` e marcar alunos.
9. Adicionar uma pessoa fora da lista.
10. Abrir `Cobrar` e copiar uma cobranca.
11. Fazer backup manual pelo relatorio operacional.

## Rotina diaria sugerida

Antes das aulas:

- Abrir `Inicio`.
- Conferir a proxima aula e pendencias.
- Abrir `Aulas` e revisar previstos, confirmados e sem resposta.

Durante a aula:

- Abrir `Presencas`.
- Marcar presentes.
- Adicionar avulsos, reposicoes ou visitantes fora da lista.
- Finalizar a aula.

Depois da aula:

- Conferir `Cobrar`.
- Copiar cobrancas pendentes.
- Ver novos pedidos e lista de espera.
- Verificar esperas vinculadas as aulas lotadas e avisar a proxima pessoa quando liberar vaga.

## Backup

Faca backup manual antes de qualquer mudanca grande de dados.

No uso real, mantenha:

- backup automatico ao iniciar;
- backup automatico diario;
- retencao de pelo menos 30 backups;
- download manual do SQLite quando houver alteracao importante.

## Sinais de problema

Se aparecer `Local no navegador` ou `Modo demo/local`, o app nao esta usando servidor real.

Nesse caso:

- pedidos publicos ficam locais;
- confirmacoes de alunos nao ficam compartilhadas;
- presencas e pagamentos podem nao aparecer em outro aparelho;
- backup automatico de servidor nao funciona.

## Primeiro dia com dados reais

Comece pequeno:

1. Cadastrar planos reais.
2. Cadastrar 10 a 15 alunos principais.
3. Criar as aulas da semana.
4. Testar presenca em uma aula real.
5. Testar uma cobranca real pelo WhatsApp.
6. Fazer backup.

Depois de validado, carregar o restante dos alunos.

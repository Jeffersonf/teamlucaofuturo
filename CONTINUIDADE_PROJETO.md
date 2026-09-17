# Continuidade do Projeto - Team Lucao Futevolei

## Posicionamento

Para apresentar bem, a ideia e vender isso como um painel simples para tirar a escola do improviso: menos planilha solta, menos mensagem perdida, mais controle de aluno, aula e mensalidade.

## Como apresentar

Mostre em 5 minutos, direto no fluxo real dele:

1. Dashboard
   "Aqui ele abre o dia e ja ve aulas, alunos ativos e quem esta com mensalidade pendente."

2. Alunos
   "Cadastro completo do aluno: telefone, plano, nivel, status e observacoes."

3. Aulas
   "Ele cria a aula, coloca horario, turma, professor, capacidade e alunos."

4. Presenca
   "No dia da aula, marca quem veio. Isso ajuda a acompanhar frequencia e evolucao."

5. Mensalidades
   "Ele ve quem esta em dia e quem precisa cobrar."

6. Lista de espera
   "Quem chamou no WhatsApp mas ainda nao virou aluno entra aqui, para nao perder oportunidade."

7. Backup
   "Os dados podem ser salvos, evitando depender so de memoria, papel ou conversa."

8. Agendamento do aluno
   "A primeira tela pode ser usada pelo aluno para pedir uma vaga em uma aula. O professor ve esse pedido no painel e decide se aprova ou recusa."

## Como ajuda no dia a dia

Hoje ele provavelmente perde tempo com coisas pequenas: lembrar quem pagou, quem faltou, qual turma esta cheia, quem pediu aula experimental e quem esta interessado. O sistema centraliza isso.

Na pratica, ajuda em:

- Saber rapidamente quem esta devendo.
- Organizar horarios e turmas.
- Evitar esquecer interessados.
- Ter historico basico de alunos.
- Controlar presenca.
- Separar alunos ativos, experimentais e pausados.
- Fazer backup dos dados.
- Passar uma imagem mais profissional para a escola.
- Receber pedidos de aula sem precisar organizar tudo no WhatsApp na hora.
- Evitar passar da capacidade da turma sem perceber.

## O que ja tem

- Cadastro de alunos.
- Planos e mensalidades.
- Agenda de aulas.
- Presenca por aula.
- Lista de espera.
- Dashboard.
- Backup JSON.
- Backend Node com SQLite.
- Modo local no navegador se nao rodar servidor.
- Visual inicial com a marca Team Lucao Futevolei.
- Login de demo com primeira tela polida.
- Navegacao mobile no rodape com tela Mais.
- Dashboard com foco em proxima aula, cobranca e interessados.
- Cards de alunos, aulas, cobrancas e espera com estados visuais.
- Ficha do aluno com plano, pagamento, frequencia, proximas aulas e historico.
- Aula de hoje com horario destacado, ocupacao, presentes e avulsos.
- Modal de presenca com resumo visual da aula.
- QA visual local com screenshots mobile e desktop.
- Primeira tela publica de agendamento para o aluno.
- Pedidos de aula no painel administrativo.
- Aprovar/recusar pedido com limite de capacidade.
- Pedido aprovado entra na aula como aluno encontrado pelo telefone ou como solicitado fora da lista.

## O que precisa para apresentar

- Rodar `npm run check`.
- Rodar `npm run visual:check` com o live server aberto.
- Revisar a demo em `http://127.0.0.1:4280/`.
- Publicar no GitHub Pages quando a rodada final for aprovada.
- Trocar os dados ficticios por dados mais proximos da realidade dele, se ele mandar dados reais.
- Confirmar os planos reais: valores, aulas por semana, avulso, experimental.
- Confirmar os niveis/turmas: iniciante, intermediario, kids, feminino, avancado etc.
- Colocar o nome do professor ou professores reais.
- Testar em um notebook e em um celular.
- Preparar uma fala curta: "isso e a primeira versao, feita para validar o fluxo real da escola".

## O que ainda falta para virar produto de uso diario

- Login/senha.
- Melhor controle de pagamentos, com mes de referencia e historico.
- Relatorio de presenca por aluno mais profundo.
- Filtros avancados por turma, nivel, professor e horario.
- Edicao/delecao com mais protecoes e confirmacoes.
- Restauracao de backup com revisao antes de importar.
- Deploy online com backend para ele acessar do celular sem depender do seu PC.
- Seguranca e backup automatico.
- Area de aula experimental mais explicita.
- Login real com usuario/senha e permissoes.
- Notificacoes automaticas para novos pedidos de aula.

## Roadmap

### Fase 1: Apresentacao profissional

Objetivo: deixar bonito e convincente para mostrar.

Status: concluida localmente; falta publicar a rodada final no GitHub Pages.

- Personalizar logo, nome, cores e textos.
- Criar dados de exemplo realistas do Team Lucao.
- Revisar planos, niveis e tipos de turma.
- Melhorar tela mobile.
- Criar primeira tela de agendamento do aluno.
- Criar fila de pedidos para o professor.
- Preparar roteiro de demonstracao.
- Entrega: demo local funcionando em `http://127.0.0.1:4280/`.

### Fase 2: MVP usavel

Objetivo: ele conseguir usar por alguns dias e dizer o que funciona.

Status: base pronta para validacao com ele.

- Adicionar edicao/delecao completa.
- Melhorar historico de mensalidades.
- Criar filtros em alunos, aulas e pagamentos.
- Adicionar botao de WhatsApp em aluno e cobranca.
- Melhorar lista de espera com status: novo, contatado, convertido.
- Refinar pedidos de aula com filtros por status e aviso visual no dashboard.
- Entrega: versao para teste real com dados dele.

### Fase 3: Operacao real

Objetivo: virar ferramenta do dia a dia.

- Login com senha.
- Deploy online.
- Banco persistente em servidor.
- Backup automatico.
- Pagina responsiva boa no celular.
- Relatorios simples: faturamento, presenca, alunos ativos, inadimplencia.
- Entrega: sistema acessivel por link.

### Fase 4: Gestao inteligente

Objetivo: ajudar ele a crescer a escola.

- Relatorio de frequencia por aluno.
- Alertas de mensalidade vencida.
- Agenda semanal/mensal.
- Controle de capacidade por turma.
- Historico de evolucao/observacoes.
- Exportacao para Excel/PDF.
- Entrega: painel de gestao de verdade.

### Fase 5: Experiencia premium

Objetivo: diferenciar.

- Area do aluno.
- Confirmacao de presenca.
- Integracao com WhatsApp.
- Cobranca via Pix/checkout.
- Notificacoes automaticas.
- App/PWA instalavel no celular.
- Entrega: produto completo da escola.

## Pergunta-chave da apresentacao

"Isso encaixa no seu jeito de trabalhar ou voce organiza as aulas de outro jeito?"

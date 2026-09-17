# Apresentacao - Team Lucao Futevolei

## Ideia central

Um painel simples para tirar a escola do improviso: menos planilha solta, menos mensagem perdida, mais controle de alunos, aulas, presencas, mensalidades e interessados.

## Frase de venda

"Isso aqui nao tenta mudar seu jeito de trabalhar. Ele junta em uma tela o que hoje fica espalhado entre memoria, WhatsApp, papel e planilha."

## Demonstracao em 5 minutos

1. Entrar pelo iPhone ou notebook com o PIN `1209`.
2. Abrir o Dashboard e mostrar aulas de hoje, alunos ativos, pendencias e acoes rapidas.
3. Ir em Aulas, abrir Hoje, mostrar horarios, previstos, avulsos, presencas e botoes de Confirmar/Finalizar/Cancelar.
4. Clicar no nome de um aluno e mostrar o relatorio individual: plano, presencas, frequencia da semana, proximas aulas e pagamentos.
5. Ir em Mensalidades, filtrar o mes, copiar cobranca e mostrar quem esta pendente.
6. Ir em Espera, mostrar interessados, idade do contato, WhatsApp, Experimental e Virar aluno.
7. Fechar em Dados/Backup e Roadmap, explicando que a primeira meta e validar o fluxo real dele.

## Como ajuda no dia a dia

- Abre o dia sabendo quais aulas existem e quem deve ir.
- Marca presenca em poucos toques no celular.
- Registra aluno avulso que apareceu fora da lista.
- Evita esquecer interessado que chamou no WhatsApp.
- Mostra quem esta devendo no mes certo.
- Copia mensagem de cobranca sem reescrever tudo.
- Mostra o historico basico de cada aluno ao clicar no nome.
- Ajuda a controlar capacidade da turma.
- Passa imagem mais profissional para a escola.

## O que ja esta pronto

- Demo online no GitHub Pages.
- PIN simples para piloto.
- Mais de 60 itens ficticios entre alunos, aulas, pagamentos e interessados.
- Dashboard operacional com foco em proxima aula, cobrancas e interessados.
- Cadastro de alunos, planos e mensalidades.
- Relatorio individual do aluno com perfil, plano, pagamento, frequencia e historico.
- Agenda de aulas com visao de hoje, horario destacado e calendario previsto.
- Presenca por aula com resumo visual, todos presentes e avulsos.
- Tipo da aula: regular, experimental, reposicao, avulso ou evento.
- Filtros de aulas por data, tipo e status.
- Status rapido de aula: confirmar, finalizar, cancelar e reabrir.
- Copia rapida da lista da aula e do resumo de presenca.
- Pagamento marcado no mes filtrado da mensalidade.
- Lista de espera com funil: novo, contatado, experimental, convertido e perdido.
- Acoes rapidas por WhatsApp.
- Backup/importacao JSON.
- Exportacao CSV.
- PWA instalavel no celular.
- Backend Node com SQLite para uso real.
- Preparacao para deploy com Docker/Render.
- Polimento visual mobile/iPhone e desktop/PC.
- QA visual local com screenshots mobile e desktop.

## O que falta confirmar com ele

- Planos reais, valores e aulas por semana.
- Se existe avulso, reposicao e aula experimental paga ou gratuita.
- Niveis/turmas reais: iniciante, intermediario, kids, feminino, avancado, competitivo.
- Professores e locais de aula.
- Como ele cobra hoje: Pix, dinheiro, cartao, vencimento fixo ou por aluno.
- Se ele quer que aluno agende sozinho agora ou se primeiro sera controle interno.
- Quais dados ele realmente quer ver no relatorio do aluno.
- Se o uso sera so no iPhone dele ou tambem em computador/secretaria.

## Roadmap completo

### Versao 0.1 - Demo de apresentacao

Status: pronta.

- Marca Team Lucao.
- Navegacao principal.
- Dados ficticios realistas.
- Dashboard, alunos, aulas, mensalidades, espera e backup.
- GitHub Pages para abrir rapido.

### Versao 0.2 - Piloto rapido no iPhone

Status: quase pronta para apresentacao.

- Fluxo de aula de hoje com poucos toques.
- Relatorio individual ao clicar no aluno.
- Indicador de frequencia semanal por plano.
- Acoes de WhatsApp em aluno, aula e cobranca.
- Lista de espera com urgencia de resposta.
- Ajustes finos de tela pequena.
- Navegacao inferior com tela Mais.
- Cards compactos, estados visuais e resumo de presenca.

### Versao 0.3 - Operacao interna real

Objetivo: ele usar por uma semana com dados reais.

- Importar dados reais.
- Ajustar planos e turmas reais.
- Melhorar edicao/delecao de registros.
- Separar experimental, reposicao e avulso.
- Historico mensal de pagamentos mais forte.
- Backup manual e restauracao testada.
- Checklist semanal de rotina.

### Versao 0.4 - Online com servidor

Objetivo: deixar acessivel por link seguro.

- Deploy do backend Node/SQLite.
- Banco persistente.
- PIN forte via `ADMIN_PIN`.
- Backup automatico diario.
- Logs basicos.
- URL propria para ele acessar do iPhone.

### Versao 0.5 - Financeiro de verdade

Objetivo: parar de perder cobranca.

- Mensalidade por mes de referencia.
- Vencimento por aluno.
- Pagamentos parciais/descontos.
- Metodo de pagamento.
- Lista de inadimplentes.
- Mensagem de cobranca por WhatsApp.
- Exportacao mensal para planilha.

### Versao 0.6 - Agenda profissional

Objetivo: controlar capacidade e previsao.

- Agenda semanal e mensal.
- Aulas recorrentes mais completas.
- Reposicao vinculada ao aluno.
- Cancelamento por chuva/feriado.
- Capacidade por turma.
- Filtro por professor, nivel e horario.

### Versao 0.7 - Relatorios de gestao

Objetivo: saber se a escola esta crescendo.

- Faturamento previsto e recebido.
- Alunos ativos, pausados e experimentais.
- Conversao da lista de espera.
- Frequencia por aluno.
- Turmas mais cheias.
- Alertas de alunos sumidos.

### Versao 1.0 - Produto de uso diario

Objetivo: sistema estavel da escola.

- Login melhor.
- Backup automatico.
- Acesso mobile confiavel.
- Dados reais organizados.
- Relatorios essenciais.
- Manual simples de uso.
- Rotina semanal validada com o Lucao.

### Versao 1.5 - Experiencia premium

Objetivo: diferenciar a escola.

- Area do aluno.
- Confirmacao de presenca.
- Agendamento pelo aluno.
- Notificacoes.
- Pix/checkout.
- PWA instalavel com icone.
- Exportacao PDF.

## Pergunta final da reuniao

"Isso encaixa no seu jeito de trabalhar ou sua rotina de aulas e cobranca acontece de outro jeito?"

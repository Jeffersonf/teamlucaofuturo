# Team Lucao Futevolei

MVP leve para escola de futevolei, feito em HTML, CSS e JavaScript puro.

## O que ja faz

- Cadastro rapido de alunos
- Controle de planos e mensalidades
- Agenda de aulas
- Presenca por aula
- Relatorio individual ao clicar no nome do aluno
- Ficha do aluno com acao sugerida: cobrar, definir agenda ou acompanhar frequencia
- Aulas de hoje com previstos, avulsos e status rapido
- Indicador operacional por aula: pronta, lotada, sem resposta ou finalizar presenca
- Tipo de aula: regular, experimental, reposicao, avulso ou evento
- Filtros de aulas por data, tipo e status
- Copia rapida da lista da aula e do resumo de presenca
- Dashboard do dia com pendencias
- Central de acoes com historico de professor, aluno e sistema
- Central de acoes agrupada por dia e com ultimo movimento em destaque
- Origem da acao persistida no servidor para separar aluno, professor e sistema
- Atualizacao leve da central de acoes quando outra aba ou aluno registra novidade
- Sincronizacao entre abas no modo local/demo pelo mesmo navegador
- Filtros de alunos e aulas
- Acoes rapidas no dashboard
- Busca rapida por aluno/interessado
- Presenca em massa por aula
- Contato rapido por WhatsApp
- Historico recente de pagamentos
- Cobranças ordenadas por prioridade: atrasada, cobrar agora, programada e em dia
- Fechamento mensal copiavel com receita, presenca, aulas, avulsos, pedidos e espera
- Mensalidade marcada no mes filtrado
- Lista de espera com conversao para aluno
- Lista de espera sem remocao direta no painel, usando status para historico
- Lista de espera ordenada por prioridade: responder, marcar experimental e converter
- Backup JSON pelo painel operacional
- Login simples por PIN no servidor
- Acesso publico separado para confirmar aulas pelo WhatsApp
- Agendamento experimental publico com horario, nome e WhatsApp
- Horarios regulares da semana apresentados ao aluno sem misturar com experimental
- Area publica do aluno com resumo de confirmacoes futuras
- Fila de pedidos para professor aprovar ou recusar
- Limite de capacidade considerado antes de aceitar pedidos
- Aula lotada com entrada publica na lista de espera vinculada ao horario
- Bloqueio de entrada duplicada na espera por aula e WhatsApp
- Grade padrao: segunda a sexta as 18:30, 19:30 e 20:30; sabado as 09:00, 10:00, 14:00 e 15:00
- Criacao de aulas em lote com recorrencia por ate 12 semanas
- Cancelamento com motivo, reativacao e aviso para o grupo
- Modelos editaveis para confirmacao, lembrete, cancelamento, troca e agenda semanal no grupo
- PWA instalavel no celular
- Fluxo pensado para uso rapido no iPhone
- Layout otimizado para navegador mobile
- Visual claro mais neutro, com hierarquia inspirada no Finanza
- CSS visual consolidado para reduzir overrides acumulados
- Renderizacao local agrupada para reduzir travadas em celular
- Buscas e filtros com atualizacao agendada para digitar sem engasgar
- Navegacao mobile no rodape para ganhar espaco de tela
- Tela Mais no mobile para atalhos secundarios sem lotar o rodape
- Cards mobile mais compactos, com acoes em trilho horizontal
- Polimento visual global para desktop e iPhone
- Configuração administrativa temporária para temas completos, marca e textos
- Seis padrões visuais completos inspirados no Finanza Android Kotlin: Moderno, Clássico e Finanza Web em claro e escuro
- Dashboard com contexto visual de agenda, cobranca e conversao
- Estados visuais nos cards de alunos, aulas, cobrancas e espera
- Ficha do aluno redesenhada com perfil, plano, pagamento e frequencia
- Presenca com resumo visual da aula e destaque de presentes
- Modais, estados vazios e fluxos operacionais com acabamento visual
- Lembra a ultima aba aberta e melhora fechamento de busca/modal
- Faixa de foco no dashboard com proxima aula, cobrancas e interessado parado
- Backend Node/SQLite inspirado no FinClinica
- Fallback local com `localStorage` ao abrir o HTML direto

## Como abrir

Servidor completo:

```bash
npm install
npm start
```

PIN padrao do piloto:

```text
1209
```

Para trocar o PIN no servidor:

```bash
set ADMIN_PIN=2468
npm start
```

Depois acesse:

```text
http://localhost:3020
```

Tambem da para abrir `index.html` diretamente no navegador para usar em modo local.

## Laboratorio visual temporario

Depois de entrar como professor, abra `Config.` no menu desktop ou `Mais > Configuracao` no celular. A tela permite testar seis padroes completos inspirados no Finanza Android Kotlin: Moderno, Classico e Finanza Web, cada um em claro e escuro. Cada padrao altera tipografia, espacamento, bordas, sombras, navegacao e superficies; nao sao apenas cores. Tambem e possivel editar a identidade e revisar textos principais do painel. As alteracoes ficam no `localStorage` deste navegador; `Limpar testes` restaura o tema claro e os textos padrao. Essa secao foi isolada para ser removida quando a linguagem final for aprovada.

Live local usado durante o polimento visual:

```bash
npm run live
```

Depois acesse:

```text
http://127.0.0.1:4280/
```

QA visual local:

```bash
npm run visual:check
```

Auditoria local de acessibilidade:

```bash
npm run accessibility:audit
```

Auditoria local de carregamento, assets e overflow:

```bash
npm run performance:audit
```

Auditoria automatica dos fluxos principais com servidor e banco temporario:

```bash
npm run flow:audit
```

## Uso real online

Para rodar como sistema de uso diario, use o servidor Node com SQLite persistente. Configure pelo menos:

```bash
ADMIN_PIN=troque-este-pin
DB_PATH=/caminho/persistente/arena.db
BACKUPS_DIR=/caminho/persistente/backups
AUTO_BACKUP_ON_START=true
AUTO_BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION=30
```

Backups JSON ficam em `backups/`. O servidor cria um backup ao iniciar por padrao e, se `AUTO_BACKUP_INTERVAL_HOURS` for maior que zero, cria backups periodicos. A retencao padrao guarda os 30 backups mais recentes.

Endpoints uteis no servidor:

- `GET /health`: status publico.
- `/aluno`: pagina leve para o aluno indicar que vai.
- `/autorizar`: pagina leve para o professor autorizar indicacoes com PIN.
- `GET /api/bootstrap`: carga unica para acelerar o primeiro login do painel.
- `GET /api/public/classes`: aulas futuras disponiveis para pedido de vaga.
- `POST /api/public/bookings`: cria pedido publico de aula.
- `POST /api/public/waitlist`: entra na espera quando a aula esta lotada.
- `GET /api/public/student-waitlist`: consulta esperas ativas e posicao do aluno.
- `GET /api/public/student-classes`: aluno busca proximas aulas pelo WhatsApp.
- `POST /api/public/student-confirm`: aluno indica que vai à aula.
- `POST /api/classes/:id/student-confirmation`: professor confirma a indicacao do aluno.
- `GET /api/bookings`: lista pedidos para o professor.
- `POST /api/bookings/:id/respond`: aprova ou recusa um pedido.
- `GET /api/backups`: lista backups.
- `GET /api/backups/:filename`: baixa um backup especifico.
- `POST /api/backups/create`: cria backup manual.
- `GET /api/backup.json`: baixa snapshot JSON.
- `GET /api/db/download`: baixa o SQLite.

Todos os endpoints `/api/*`, exceto login e rotas `/api/public/*`, exigem header `X-Admin-Pin`.

## Apresentacao

O roteiro para apresentar a ideia, explicar o valor no dia a dia e mostrar o roadmap esta em `APRESENTACAO.md`.

O checklist pratico para ensaiar a demo esta em `CHECKLIST_DEMO.md`.

O checklist para fechar a rodada local e publicar no GitHub Pages esta em `FECHAMENTO_PUBLICACAO.md`.

O guia para colocar em operacao real com servidor, iPhone e backups esta em `OPERACAO_REAL.md`.

## GitHub Pages x uso real

GitHub Pages serve para demonstrar a interface e validar o fluxo visual. Para operacao diaria, use o backend Node:

- pedidos publicos de vaga compartilhados;
- confirmacao do aluno pelo link;
- confirmacao do professor separada da indicacao do aluno;
- presenca e mensalidade salvas entre dispositivos;
- backup automatico;
- acesso confiavel pelo iPhone do professor.

Sem backend online, o app mostra `Modo demo/local` e salva dados apenas no navegador atual.

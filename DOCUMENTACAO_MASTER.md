# 📘 DOCUMENTAÇÃO MASTER & MEMÓRIA TÉCNICA DO SISTEMA
## Plataforma de Gestão — Team Lucão Futevôlei

> **Objetivo deste documento:** Servir como fonte única da verdade e memória viva do projeto. Contém o histórico de pensamento, a arquitetura de software, decisões de engenharia, regras de negócio e o manual de todas as integrações (Pix e WhatsApp).

---

## 🧭 1. O Que Estávamos Pensando Quando Fizemos (Filosofia & Decisões)

Ao projetar esta plataforma, priorizamos a **realidade prática de uma arena esportiva de areia**:

1. **Anti-AI-Slop & Design Sóbrio (Dark Zinc & Sports Red)**:
   - Evitamos interfaces genéricas com excesso de sombras pesadas, bordas grossas ou gradientes exagerados.
   - Adotamos o padrão **Dark Zinc puro (`#09090b`)**, cards em **`#18181b`** com bordas ultrafinas de `1px solid rgba(255, 255, 255, 0.08)` e toques de **Vermelho Esportivo (`#dc2626`)**.
   - *Por quê?* Porque o professor ou aluno frequentemente usa o celular debaixo do sol forte na beira da quadra. O contraste precisa ser alto, sem distrações visuais e sem lentidão.

2. **Zero Bundlers (Por que NÃO usamos Webpack, Vite ou Babel?)**:
   - O projeto utiliza **JavaScript ES Modules nativo (`type="module"`)** em todos os arquivos.
   - *Por quê?* Porque ferramentas de build pesadas criam etapas frágeis de compilação que quebram com atualizações de dependências. Sem bundlers, o código que você escreve é exatamente o código que o navegador e o Cloudflare executam. O deploy leva menos de 2 segundos e a manutenção é perpétua.

3. **Autenticação com Fricção Zero**:
   - **Para o Aluno (`/aluno`)**: O aluno **não cria senha**. Ele digita apenas os dígitos do WhatsApp. Se o número estiver no banco de dados, o portal abre na hora.
   - **Para a Administração (`/`)**: Um **PIN unificado de 4 dígitos** (padrão `1209`). O professor não precisa preencher login e senha demorados. Digitou o PIN, a arena inteira está disponível para operar.

---

## 🛠️ 2. Stack de Tecnologias & Arquitetura

O sistema foi arquitetado em **camada dupla híbrida (Edge Serverless + Local Fallback)**:

```
                  ┌─────────────────────────────────────┐
                  │          DISPOSITIVO / APP          │
                  │   Safari (iOS) / Chrome (Android)   │
                  └──────────────────┬──────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼ (Produção na Nuvem)                   ▼ (Desenvolvimento Local)
       Cloudflare Pages + Workers D1           Node.js v22+ Express + SQLite
       • Zero servidor para manter             • Roda 100% offline no PC
       • Banco SQLite distribuído na borda     • node:sqlite nativo em memória
       • Deploy via Wrangler Pages             • Ideal para testes e simulações
```

- **Frontend**: HTML5 Semântico, CSS3 com variáveis nativas e JavaScript ES6+ modular em [`modules/`](file:///C:/Users/jeffe/Projetos/teamlucaofuturo/modules/).
- **PWA (Progressive Web App)**: Registrado via [`service-worker.js`](file:///C:/Users/jeffe/Projetos/teamlucaofuturo/service-worker.js) e [`manifest.webmanifest`](file:///C:/Users/jeffe/Projetos/teamlucaofuturo/manifest.webmanifest). Permite instalar como aplicativo nativo fullscreen sem passar pela loja da Apple/Google.
- **Nuvem em Produção**: **Cloudflare Pages** servindo os arquivos estáticos e **Cloudflare Workers** servindo a API com banco de dados **D1 (SQLite Serverless)**.
- **Ambiente Local**: **Node.js Express** em [`server/index.js`](file:///C:/Users/jeffe/Projetos/teamlucaofuturo/server/index.js) com banco SQLite nativo (`server/db.js`).

---

## 💳 3. Arquitetura Pix & Conciliação Automática

O sistema possui uma infraestrutura completa de recebimento e conciliação de pagamentos Pix.

### A. Endpoints do Sistema
- `GET /api/pix/config`: Retorna as credenciais ativas da arena (chave Pix, tipo de chave, titular e cidade).
- `POST /api/pix/config`: Permite à arena cadastrar ou alterar sua chave Pix oficial no painel.
- `POST /api/webhooks/pix`: Endpoint público preparado para receber chamadas de instituições bancárias e gateways.

### B. As 3 Camadas de Conciliação do Webhook
Quando o webhook recebe uma notificação de pagamento, ele processa a associação com o aluno nesta ordem:

1. **Camada 1: Por Identificador Único (`TxID`)**
   - O sistema gera códigos TxID no padrão: `TLF` + `{ID_DO_ALUNO}` + `{ANO_MES}` (ex: `TLF1202609` = Aluno 1, Setembro/2026).
   - O webhook aplica a regex `/^TLF(\d+?)(\d{6})$/i` e extrai o aluno e o mês com 100% de exatidão matemática.
2. **Camada 2: Por Telefone do Pagador (`pagador.telefone`)**
   - Se o aluno transferiu pela chave sem usar o Copia e Cola, o banco envia o telefone de quem pagou.
   - O webhook limpa a pontuação (`(15) 99999-0001` → `15999990001`) e localiza o aluno cadastrado com esse WhatsApp.
3. **Camada 3: Por Nome do Pagador (`pagador.nome`)**
   - Se não houver telefone, ele compara o nome do titular da conta bancária com os alunos da escola.
4. **Trava de Segurança (Pagador Desconhecido)**:
   - Se uma terceira pessoa (ex: parente com conta de outro sobrenome) transferiu sem o TxID, o webhook **não chuta**. Ele grava o log no sistema como `PENDENTE_CONCILIACAO` com o valor, avisando o Lucão para conferir manualmente.

### C. A Diferença Fundamental: Conta Pessoa Física vs Gateway PJ
> ⚠️ **Lembrete Crítico:**  
> - **Contas de Pessoa Física (Nubank PF, Itaú PF, Bradesco PF)**: Nenhum banco tradicional pessoa física possui API de webhook aberta na internet. O banco não avisa sites quando entra um Pix comum.
> - **Como usar em Conta PF**: O Lucão clica em **"Cobrar Pix"** no painel → O WhatsApp abre com a chave e o valor prontos → O aluno paga e manda o print → O Lucão dá a baixa com 1 toque no botão **"Pago"**.
> - **Como usar com Baixa 100% Automática**: A arena utiliza uma conta PJ em serviços com API Pix aberta (ex: **Asaas**, **EFI/Gerencianet**, **Cora**, **Mercado Pago** ou **Inter PJ**). Basta colar a URL `https://teamlucaofuturo.pages.dev/api/webhooks/pix` no painel do gateway. A partir desse momento, o aluno paga e o sistema dá baixa sozinho no mesmo segundo.

---

## 💬 4. Motor de Automação de WhatsApp (Os 3 Modos)

Desenvolvemos o sistema para suportar **3 estratégias de automação**, atendendo desde o custo zero até o modo 100% autônomo:

### ☀️ Modo 1: Automação Nativa pelo Celular (Atalhos iOS / MacroDroid Android) — *100% Gratuito*
Criamos um endpoint público no backend que entrega o texto diário já formatado com emojis e vagas:
- URL da Manhã: `https://teamlucaofuturo.pages.dev/api/public/group-summary?periodo=manha&format=text`
- URL da Tarde: `https://teamlucaofuturo.pages.dev/api/public/group-summary?periodo=tarde&format=text`

#### Como configurar no iPhone (App "Atalhos" nativo da Apple):
1. Abra o app **Atalhos** no iPhone e toque na aba **Automação** → **Criar Automação Pessoal**.
2. Escolha **Hora do Dia** (ex: `08:30 da manhã`, repetir diariamente).
3. Adicione a ação: **"Obter Conteúdo de URL"** com a URL da Manhã acima.
4. Adicione a ação: **"Enviar Mensagem via WhatsApp"** selecionando o grupo *"Alunos Team Lucão"* e marcando a mensagem como o resultado da etapa anterior.
5. Desmarque "Perguntar ao Executar".  
*Pronto! O próprio iPhone do Lucão buscará os dados ao vivo do sistema e postará no grupo todo dia no horário exato.*

---

### 📲 Modo 2: Disparo de 1 Toque no Painel da Arena (Ativo Hoje no Sistema)
- No cabeçalho da tela de Aulas e no Dashboard, existem os botões:
  - **`[☀️ Resumo Manhã]`**: Carrega as aulas do dia, vagas livres, confirmados e link da Área do Aluno.
  - **`[🌇 Chamada Noite]`**: Carrega o quadro da noite com chamada de última hora.
- Ao clicar, abre o modal onde o professor pode revisar o texto, clicar em **"Copiar Mensagem"** ou tocar em **"Abrir WhatsApp"**, que já abre o aplicativo com tudo preenchido pronto para enviar.

---

### 🤖 Modo 3: Robô Headless de Servidor (Baileys / Evolution API) — *Futuro / Próximo Nível*
- Se a arena quiser que as mensagens saiam da nuvem sem depender do celular do Lucão estar com bateria ou ligado:
- Conecta-se uma biblioteca open source como a **Evolution API** ou **Baileys** em um servidor Node.js.
- O Lucão lê o QR Code uma única vez para parear o número.
- O servidor roda um cron job programado que consulta o endpoint `/api/public/group-summary` e posta no ID do grupo do WhatsApp automaticamente.

---

### 📋 Templates Individuais de WhatsApp (1 para 1)
O arquivo [`modules/whatsapp.js`](file:///C:/Users/jeffe/Projetos/teamlucaofuturo/modules/whatsapp.js) contém os geradores de links para momentos individuais:
1. `sendClassConfirmation(student, classItem)`: Confirmação de vaga e lembrete com horário e local.
2. `sendPixPaymentRequest(student, pixData)`: Cobrança com chave Pix Copia e Cola formatada.
3. `sendExperimentalWelcome(guest)`: Boas-vindas para aluno novo, informando sobre roupa de areia e hidratação.
4. `sendClassCancellationNotice(classItem, reason)`: Comunicado de cancelamento (chuva) informando a devolução do crédito.
5. `sendPaymentReceipt(student, payment)`: Comprovante de baixa de mensalidade.

---

## 🏃 5. Regras de Negócio da Área do Aluno (`/aluno`)

O portal do aluno foi blindado contra erros comuns de operação:

1. **Cálculo Estrito de Cotas Semanais**:
   - Um aluno do plano *1x por semana* só pode ter **1 aula confirmada** entre segunda e domingo daquela semana.
   - O sistema bloqueia a segunda tentativa com a mensagem clara:  
     *"Limite do plano atingido: seu plano (1x semana) permite 1 aula por semana. Desmarque uma aula para escolher este horário."*
2. **Travamento de Fuso Horário (São Paulo)**:
   - Todas as datas operam sob o padrão `YYYY-MM-DD` com compensação de fuso horário de Brasília/SP (`America/Sao_Paulo`). Isso elimina o bug onde o dia anterior era selecionado por causa do horário UTC da nuvem.
3. **Bloqueio de Ações Retroativas**:
   - O aluno não pode desmarcar uma aula que já ocorreu no passado.
   - Aulas que estão acontecendo no horário atual recebem o badge pulsante `Aula em andamento`.
4. **Agendamento Experimental em 2 Colunas**:
   - **Coluna Esquerda**: Identificação, nome e WhatsApp do visitante.
   - **Coluna Direita**: Calendário interativo de datas disponíveis, seletores de horário e cartões com contador de vagas livres ao vivo.

---

## 📊 6. Sistema de Exportação (CSV / Excel)

Implementado no módulo [`modules/export.js`](file:///C:/Users/jeffe/Projetos/teamlucaofuturo/modules/export.js):
- **Compatibilidade Excel Brasil**: Todo arquivo exportado é prefixado com o BOM UTF-8 (`\uFEFF`) e delimitado com ponto-e-vírgula (`;`). Isso faz o Excel do Windows abrir as colunas separadas e acentos corretos sem necessidade de importar texto manualmente.
- **Relatórios Disponíveis**:
  - *Mensalidades do Mês*: Nome, WhatsApp, Plano, Valor, Vencimento, Status e Situação.
  - *Cadastro de Alunos*: Base cadastral completa com saldos de reposição.
  - *Histórico de Pagamentos*: Demonstrativo de todas as baixas registradas no sistema.

---

## 📁 7. Mapa de Arquivos do Projeto

```
teamlucaofuturo/
├── aluno.html                # Interface Web PWA da Área do Aluno
├── student-fast.js           # Lógica ultrarrápida do aluno (calendário, cotas, confirmações)
├── index.html                # Interface do Painel Administrativo de Gestão
├── app.js                    # Orquestrador central do Admin (rotas, estado, bridge)
├── styles.css                # Folha de estilo principal (Dark Zinc & Sports Red)
├── public.css                # Estilos específicos da Área do Aluno
├── manifest.webmanifest      # Manifesto PWA para instalação no celular
├── service-worker.js         # Service Worker para cache e modo PWA
│
├── modules/                  # Módulos de domínio ES6 desacoplados
│   ├── whatsapp.js           # Motor de automações e URLs do WhatsApp
│   ├── dashboard.js          # Barra de foco, KPIs operacionais e pendências
│   ├── classes.js            # Grade de horários, planner de hoje e presenças
│   ├── students.js           # Grid de alunos, cadastros e ficha individual
│   ├── payments.js           # Gestão de mensalidades, prioridade e baixas
│   ├── settings.js           # Preferências da arena e chave Pix oficial
│   ├── export.js             # Gerador de planilhas CSV/Excel formatadas
│   ├── pix.js                # Modal e cálculo de código Copia e Cola Pix
│   ├── rain.js               # Cancelamento em lote por chuva e crédito de reposição
│   ├── arenas.js             # Gestão de unidades da arena (multi-tenancy)
│   ├── api.js                # Cliente de comunicação com o backend
│   └── toast.js              # Notificações visuais elegantes na tela
│
├── server/                   # Backend Local em Node.js Express
│   ├── index.js              # Servidor API com SQLite local (node:sqlite)
│   ├── db.js                 # Estrutura e migrações do banco SQLite
│   └── pix.js                # Validações auxiliares de chaves Pix
│
├── worker/                   # Backend Nuvem Serverless Cloudflare
│   └── index.js              # Worker Edge API conectado ao Cloudflare D1
│
├── scripts/                  # Bateria de testes automatizados e deploy
│   ├── test-group-summary.js # Validação das mensagens diárias para grupos
│   ├── test-pix-webhook.js   # Testes do webhook Pix com conciliação
│   ├── test-admin-tabs.js    # Teste E2E Playwright de navegação mobile
│   ├── test-weekly-quota.js  # Validação de cotas semanais dos planos
│   ├── test-lifecycle.js     # Teste de ciclo de vida de presenças e baixas
│   ├── flow-audit.js         # Auditoria E2E completa de logs de ações
│   └── build-cloudflare.mjs  # Empacotador para deploy no Cloudflare Pages
│
├── APRESENTACAO_PROJETO.md   # Folder e pitch comercial da plataforma
└── DOCUMENTACAO_MASTER.md    # Este manual técnico e memória viva do sistema
```

---

## 🚀 8. Comandos Úteis do Desenvolvedor

```bash
# Iniciar o servidor local (porta 3000)
npm start

# Validar sintaxe JS em todos os 19 arquivos do projeto
npm run check

# Executar bateria de testes automatizados
node scripts/test-group-summary.js
node scripts/test-pix-webhook.js
node scripts/test-weekly-quota.js
node scripts/test-lifecycle.js
node scripts/test-admin-tabs.js

# Fazer o build e deploy para produção no Cloudflare Pages
npm run deploy:cloudflare
```

---
*Documentação registrada e atualizada em Setembro/2026. Versão 0.2.0.*

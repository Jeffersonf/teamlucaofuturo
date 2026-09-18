# 🏐 Team Lucão Futevôlei — Apresentação da Plataforma

> **A solução definitiva de gestão operacional, financeira e engajamento de alunos para o Centro de Treinamento e Arena Team Lucão.**

---

## 🎯 1. O Problema das Arenas Tradicionais

A maioria das arenas e escolas de futevôlei perde tempo e dinheiro todos os dias com:
- **Alunos que faltam sem avisar**, deixando vagas ociosas na quadra enquanto outros queriam treinar.
- **Cobranças manuais no WhatsApp**: horas gastas todo início de mês mandando mensagem por mensagem e cobrando quem esqueceu de pagar.
- **Controle em planilhas ou cadernos**: dados descentralizados, perda de histórico de presenças e dificuldade para calcular reposições.
- **Dias de chuva**: caos para avisar todo mundo e calcular crédito de reposição para cada aluno manualmente.
- **Aplicativos genéricos pesados**: sistemas de academia tradicionais que exigem senhas longas, download demorado na App Store e que os alunos acabam abandonando por preguiça.

---

## 🚀 2. A Solução Team Lucão: Simplicidade Extrema & Alta Performance

A plataforma **Team Lucão** foi desenhada sob medida para a dinâmica de uma arena de areia: rápida, visual, sem atrito e que roda direto no celular de qualquer aluno e professor sem precisar baixar nada pesado.

```
       ┌─────────────────────────────────────────────────────────────┐
       │                   ECOSSISTEMA TEAM LUCÃO                    │
       └──────────────────────────────┬──────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
   📱 ÁREA DO ALUNO (PWA)                          💻 PAINEL DE GESTÃO (ADMIN)
   • Acesso instantâneo por WhatsApp               • 1 PIN unificado: entra e opera
   • Confirmação e desmarcação em 1 toque          • Controle do dia: Aulas e Presenças
   • Calendário inteligente com vagas ao vivo      • Cobrança Pix com Copia e Cola
   • Agendamento de Experimental em 2 colunas      • Cancelamento de Chuva em 1 clique
   • Respeito automático ao limite do plano        • Exportação de relatórios em Excel
```

---

## 🌟 3. Principais Pilares do Sistema

### 📱 A. Área do Aluno (Foco no Engajamento Sem Atrito)
- **Zero Senhas Chave**: O aluno digita apenas o número do WhatsApp e já acessa seu painel personalizado.
- **Calendário Visual Dinâmico**: Mostra as turmas do dia e das próximas semanas com fuso horário de Brasília/SP 100% preciso.
- **Status em Tempo Real**:
  - Aulas futuras: Botão verde para confirmar ou vermelho para desmarcar.
  - Aulas que estão acontecendo agora: Badge pulsante `Aula em andamento`.
  - Aulas passadas: Bloqueio automático retroativo com indicação de presença realizada.
- **Validação de Cotas Semanais**: Se o aluno é do plano *1x por semana*, o sistema só deixa ele confirmar 1 aula por semana. Para confirmar outra, precisa desmarcar a anterior.
- **Agendamento de Aula Experimental Moderno**:
  - Coluna da esquerda: dados e WhatsApp do interessado.
  - Coluna da direita: calendário interativo com seletores de horário e cards de vagas restantes.

---

### 💻 B. Painel do Professor & Administrador (Visão de Comando)
- **Tema Premium Sports Red & Dark Zinc**: Visual moderno escuro (`#09090b`), sóbrio, legível sob a luz do sol na quadra.
- **Navegação Mobile Ergonômica (5 Abas)**:
  1. **Início**: Foco do dia, KPIs operacionais e alertas imediatos.
  2. **Aulas**: Grade completa, chamada rápida com botão "Todos Presentes".
  3. **Alunos**: Cadastros, planos, saldo de reposições e ficha individual.
  4. **Cobrar**: Quem já pagou no mês, quem está pendente e prioridade de cobrança.
  5. **Mais**: Pedidos pendentes, planos da escola, lista de espera e configurações.
- **Controle Meteorológico (Chuva) em 1 Toque**: Choveu? O professor aperta *Cancelar Aula por Chuva*: o sistema cancela a turma, devolve +1 crédito de reposição para todos os alunos e gera o aviso no WhatsApp.

---

### 💬 C. Motor de Automação do WhatsApp (3 Modos)
- **Rotina Diária nos Grupos**:
  - **Manhã (08:30)**: Posta resumo com todas as turmas do dia, vagas livres e link direto da Área do Aluno.
  - **Tarde (15:30)**: Chamada final para os treinos da noite com os nomes dos confirmados e últimas vagas.
- **Disparos Individuais com 1 Clique**:
  - Cobrança de mensalidade com chave Pix e valor pré-formatados.
  - Confirmação de vaga e lembrete.
  - Boas-vindas para aluno experimental com dicas de roupa e hidratação.
  - Recibo e comprovante de baixa automática.

---

### 💳 D. Pix Inteligente & Conciliação Automática
- **Webhook Ativo no Backend**: Pronto para receber notificações de bancos e contas PJ com API Pix (Asaas, EFI, Cora, Mercado Pago).
- **Conciliação em 3 Níveis**:
  1. Identificação pelo código `TxID` exclusivo do aluno.
  2. Identificação pelo número de telefone/WhatsApp do pagador.
  3. Identificação pelo nome do pagador.
- **Para Chaves Comuns (Pessoa Física)**: Geração de cobrança no WhatsApp com 1 toque e baixa com 1 clique no painel assim que o comprovante chega.

---

### 📊 E. Exportação para Excel e Contabilidade
- **Fechamento Mensal em CSV**: Exporta todos os alunos do mês com status de pagamento, plano e valores com separador `;` e codificação UTF-8 com BOM (abre formatado no Excel do Windows).
- **Base Completa de Alunos**: Planilha com contatos, saldos de reposição e dados cadastrais.
- **Histórico de Pagamentos**: Registro fiscal e contábil de todas as entradas da arena.

---

## 📈 4. Retorno sobre o Investimento (ROI) para a Arena

| Desafio Antigo | Com a Plataforma Team Lucão | Ganho Estimado |
| :--- | :--- | :--- |
| Alunos faltavam sem avisar | Desmarcação fácil pelo link libera vaga para outros | **+15% a 25% de ocupação das turmas** |
| Cobrança manual demorada | Cobrança pré-formatada via WhatsApp em 1 segundo | **Redução de inadimplência em mais de 60%** |
| Perda de interessados em experimental | Fluxo de agendamento em 2 colunas com WhatsApp direto | **Conversão de alunos novos quase dobra** |
| Dúvidas sobre reposições de chuva | Reposição creditada automaticamente no cadastro | **Zero atrito e discussão entre alunos e professores** |

---

## 🌐 5. Onde Acessar

- **Área do Aluno**: [https://teamlucaofuturo.pages.dev/aluno](https://teamlucaofuturo.pages.dev/aluno)
- **Painel Administrativo**: [https://teamlucaofuturo.pages.dev](https://teamlucaofuturo.pages.dev)
- **Instalação no Celular**: Abra no Safari (iPhone) ou Chrome (Android) e toque em **"Adicionar à Tela de Início"** para usar como App Nativo fullscreen.

// modules/whatsapp.js - Automação e geração de links de WhatsApp para alunos e turmas

/**
 * Limpa e formata o telefone para o padrão internacional do WhatsApp (ex: 5515999999999)
 */
export function formatPhoneForWhatsApp(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 8 || digits.length === 9) digits = `15${digits}`;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}

/**
 * Retorna a URL pronta do WhatsApp
 */
export function whatsappUrl(phone, message) {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedMsg = message ? `?text=${encodeURIComponent(message)}` : '';
  return cleanPhone ? `https://wa.me/${cleanPhone}${encodedMsg}` : `https://wa.me/${encodedMsg}`;
}

/**
 * Abre o WhatsApp diretamente com a mensagem pré-formatada
 */
export function openWhatsApp(phone, message) {
  window.open(whatsappUrl(phone, message), '_blank');
}

/**
 * 1. Mensagem de Confirmação de Presença / Vaga na Aula
 */
export function sendClassConfirmation(student, classItem) {
  const dateFormatted = classItem.data ? classItem.data.split('-').reverse().join('/') : 'hoje';
  const msg =
    `Olá, *${student.nome || 'Aluno'}*! ⚽\n\n` +
    `Sua presença está confirmada na aula de *${classItem.turma || 'Futevôlei'}*!\n` +
    `📅 *Data:* ${dateFormatted}\n` +
    `⏰ *Horário:* ${classItem.horario}\n` +
    `📍 *Local:* Team Lucão Arena\n\n` +
    `Chegue com 10 minutinhos de antecedência para o aquecimento. Nos vemos na quadra! 👊`;
  openWhatsApp(student.telefone, msg);
}

/**
 * 2. Mensagem de Cobrança de Mensalidade com Chave Pix
 */
export function sendPixPaymentRequest(student, pixData) {
  const valFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pixData.valor || student.mensalidade || 220);
  const msg =
    `Olá, *${student.nome || 'Aluno'}*! 🏐\n\n` +
    `Segue o código Pix para o pagamento da sua mensalidade (*${pixData.referencia || 'Plano'}*):\n` +
    `💰 *Valor:* ${valFormatted}\n\n` +
    `🔑 *Código Pix Copia e Cola:*\n` +
    `${pixData.pix_code}\n\n` +
    `📱 *Como pagar:* Basta copiar o código acima, abrir o aplicativo do seu banco e escolher a opção *Pix Copia e Cola*.\n\n` +
    `A confirmação e baixa são automáticas no sistema! Obrigado por treinar com a gente! 👊`;
  openWhatsApp(student.telefone, msg);
}

/**
 * 3. Boas-vindas e Confirmação de Aula Experimental
 */
export function sendExperimentalWelcome(guest) {
  const dateFormatted = guest.data ? guest.data.split('-').reverse().join('/') : 'em breve';
  const msg =
    `Olá, *${guest.nome || 'Visitante'}*! 🏐\n\n` +
    `Que alegria receber seu pedido para aula experimental no *Team Lucão Futevôlei*!\n\n` +
    `📅 *Data solicitada:* ${dateFormatted}\n` +
    `⏰ *Horário:* ${guest.horario || 'A combinar'}\n` +
    `📍 *Local:* Arena Team Lucão\n\n` +
    `Nossos treinos são dinâmicos e acolhedores, ideais para todos os níveis.\n` +
    `Traga roupas leves e garrafinha de água. Estamos prontos para te receber na areia! 🏖️⚽\n\n` +
    `Qualquer dúvida, pode nos chamar por aqui.`;
  openWhatsApp(guest.telefone, msg);
}

/**
 * 4. Aviso de Cancelamento de Aula (Chuva / Manutenção)
 */
export function sendClassCancellationNotice(classItem, reason = 'Chuva') {
  const dateFormatted = classItem.data ? classItem.data.split('-').reverse().join('/') : 'hoje';
  const msg =
    `⚠️ *Aviso Importante - Team Lucão*\n\n` +
    `Pessoal, informamos que a aula de *${classItem.turma || 'Futevôlei'}* de hoje (*${dateFormatted} às ${classItem.horario}*) foi *cancelada* devido a: *${reason}*.\n\n` +
    `✅ Todos os alunos que estavam na lista receberam automaticamente *+1 crédito de reposição* no sistema para agendar em outra data!\n\n` +
    `Agradecemos a compreensão de todos. Bom descanso e até o próximo treino! 🌧️👊`;
  return msg;
}

/**
 * 5. Recibo / Comprovante de Pagamento Recebido
 */
export function sendPaymentReceipt(student, payment) {
  const dateFormatted = payment.pago_em ? payment.pago_em.split('-').reverse().join('/') : 'hoje';
  const valFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.valor || 0);
  const msg =
    `✅ *Comprovante de Pagamento - Team Lucão*\n\n` +
    `Olá, *${student.nome || 'Aluno'}*!\n` +
    `Confirmamos o recebimento da sua mensalidade:\n\n` +
    `📅 *Data de Baixa:* ${dateFormatted}\n` +
    `💰 *Valor:* ${valFormatted}\n` +
    `📋 *Referência:* ${payment.referencia || 'Mensalidade'}\n` +
    `🔒 *Forma:* ${payment.forma_pagamento || 'Pix'}\n\n` +
    `Sua matrícula está 100% em dia. Bons treinos! 🏐👊`;
  openWhatsApp(student.telefone, msg);
}

/**
 * 6. Abre o WhatsApp com texto pronto para compartilhar no Grupo de Alunos
 */
export function openGroupWhatsApp(message) {
  const encodedMsg = message ? `?text=${encodeURIComponent(message)}` : '';
  window.open(`https://wa.me/${encodedMsg}`, '_blank');
}


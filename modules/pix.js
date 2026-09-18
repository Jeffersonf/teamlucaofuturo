// modules/pix.js - Gestão e Cobrança com Pix Dinâmico e QR Code

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatField(id, value) {
  const str = String(value);
  const len = String(str.length).padStart(2, '0');
  return `${id}${len}${str}`;
}

function generateLocalPix(key, name, amount, txid) {
  const merchantAccount = formatField('00', 'br.gov.bcb.pix') + formatField('01', key || 'lucao@futevolei.com.br');
  let payload =
    formatField('00', '01') +
    formatField('26', merchantAccount) +
    formatField('52', '0000') +
    formatField('53', '986') +
    (Number(amount) > 0 ? formatField('54', Number(amount).toFixed(2)) : '') +
    formatField('58', 'BR') +
    formatField('59', (name || 'TEAM LUCAO').slice(0, 25).toUpperCase()) +
    formatField('60', 'SOROCABA') +
    formatField('62', formatField('05', (txid || 'MENSALIDADE').slice(0, 25))) +
    '6304';
  return payload + crc16(payload);
}

export async function openPixModal({ studentId, studentName, studentPhone, amount, reference, getAdminPin, showToast, refreshCallback }) {
  const pin = typeof getAdminPin === 'function' ? getAdminPin() : getAdminPin;

  try {
    let data = null;
    try {
      const res = await fetch('/api/pix/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin || ''
        },
        body: JSON.stringify({
          aluno_id: studentId,
          valor: amount,
          referencia: reference
        })
      });
      if (res.ok) data = await res.json();
    } catch {}

    // Fallback para GitHub Pages / Modo Demo
    if (!data || !data.ok) {
      const localCode = generateLocalPix('lucao@futevolei.com.br', 'TEAM LUCAO ARENA', amount, `TLF${studentId || '1'}`);
      data = {
        ok: true,
        aluno_nome: studentName || 'Aluno',
        referencia: reference || '2026-09',
        valor: amount || 220,
        pix_code: localCode
      };
    }

    const modal = document.getElementById('pixModal');
    if (!modal) return;

    // Atualizar dados na tela
    document.getElementById('pixStudentInfo').textContent = `${data.aluno_nome} • Ref: ${data.referencia}`;
    document.getElementById('pixValueDisplay').textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valor);
    const copyInput = document.getElementById('pixCopyInput');
    copyInput.value = data.pix_code;

    // Botão de cópia
    const btnCopy = document.getElementById('btnCopyPix');
    btnCopy.onclick = async () => {
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(data.pix_code);
          copied = true;
        } catch (e) {}
      }
      if (!copied) {
        try {
          const tArea = document.createElement('textarea');
          tArea.value = data.pix_code;
          tArea.setAttribute('readonly', '');
          tArea.style.position = 'fixed';
          tArea.style.top = '-9999px';
          tArea.style.left = '-9999px';
          document.body.appendChild(tArea);
          tArea.focus();
          tArea.select();
          tArea.setSelectionRange(0, 99999);
          copied = document.execCommand('copy');
          document.body.removeChild(tArea);
        } catch (e) {}
      }
      if (copied && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
      btnCopy.textContent = copied ? 'Copiado!' : 'Erro ao copiar';
      setTimeout(() => { btnCopy.textContent = 'Copiar'; }, 2500);
      if (typeof showToast === 'function') showToast(copied ? 'Código Pix copiado!' : 'Selecione e copie manualmente.');
    };

    // Botão de simular baixa automática
    const btnSimulate = document.getElementById('btnSimulatePixWebhook');
    btnSimulate.onclick = async () => {
      btnSimulate.disabled = true;
      btnSimulate.textContent = 'Processando confirmação...';
      try {
        let simData = null;
        try {
          const simRes = await fetch('/api/pix/simulate-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-pin': pin || ''
            },
            body: JSON.stringify({
              aluno_id: studentId,
              referencia: reference,
              valor: amount
            })
          });
          if (simRes.ok) simData = await simRes.json();
        } catch {}

        // Fallback para GitHub Pages / Modo Demo
        if (!simData || !simData.ok) {
          const app = window.__tlf_app;
          if (app && app.state) {
            const student = (app.state.students || []).find(s => s.id === studentId);
            const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
            if (student) {
              student.pago_ate = today;
              app.state.payments = app.state.payments || [];
              app.state.payments.unshift({
                id: 'pix-' + Date.now(),
                aluno_id: student.id,
                aluno_nome: student.nome,
                referencia: reference,
                valor: amount,
                pago_em: today,
                status: 'PAGO',
                forma_pagamento: 'Pix Automático'
              });
              app.saveAndRender();
              simData = { ok: true, mensagem: `Pagamento Pix de ${student.nome} confirmado com sucesso!` };
            }
          }
        }

        if (simData && simData.ok) {
          if (typeof showToast === 'function') showToast(simData.mensagem);
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
          if (typeof refreshCallback === 'function') refreshCallback();
        }
      } catch (err) {
        alert("Erro na simulação: " + err.message);
      } finally {
        btnSimulate.disabled = false;
        btnSimulate.textContent = 'Simular Confirmação Bancária (Baixa Automática)';
      }
    };

    // Botão de enviar via WhatsApp
    const btnWhatsapp = document.getElementById('btnSharePixWhatsapp');
    btnWhatsapp.onclick = () => {
      const cleanPhone = String(studentPhone || '').replace(/\D/g, '');
      const msg = encodeURIComponent(
        `Olá, ${data.aluno_nome}! ⚽\n\n` +
        `Segue o código Pix para pagamento da mensalidade (${data.referencia}) no valor de R$ ${Number(data.valor).toFixed(2)}:\n\n` +
        `${data.pix_code}\n\n` +
        `Basta copiar o código acima e colar no seu app de banco. A confirmação é automática! 👊`
      );
      const url = cleanPhone.length >= 10 ? `https://wa.me/55${cleanPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
      window.open(url, '_blank');
    };

    // Abrir o modal
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  } catch (err) {
    alert("Erro ao gerar Pix: " + err.message);
  }
}

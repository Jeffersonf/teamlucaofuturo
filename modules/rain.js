// modules/rain.js - Gestão de Cancelamento por Chuva e Créditos de Reposição
export async function cancelClassDueToRain(classId, getAdminPin, showToast, refreshCallback) {
  if (!classId) return;

  const confirmed = confirm(
    "🌧️ Cancelar aula devido à chuva?\n\n" +
    "Isso irá:\n" +
    "1. Mudar o status da aula para 'Cancelada (Chuva)'\n" +
    "2. Conceder automaticamente +1 crédito de reposição para todos os alunos previstos\n" +
    "3. Gerar o comunicado pronto para o WhatsApp da turma"
  );

  if (!confirmed) return;

  const pin = typeof getAdminPin === 'function' ? getAdminPin() : getAdminPin;

  try {
    let data = null;
    try {
      const res = await fetch(`/api/classes/${classId}/cancel-rain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin || ''
        }
      });
      if (res.ok) data = await res.json();
    } catch {}

    // Fallback para GitHub Pages / Modo Demo
    if (!data || !data.ok) {
      const app = window.__tlf_app;
      if (app && app.state) {
        const classItem = (app.state.classes || []).find(c => String(c.id) === String(classId));
        if (classItem) {
          classItem.status = 'Cancelada (Chuva)';
          const studentIds = classItem.aluno_ids || [];
          (app.state.students || []).forEach(s => {
            if (studentIds.includes(s.id)) {
              s.saldo_reposicoes = (s.saldo_reposicoes || 0) + 1;
            }
          });
          app.saveAndRender();
          data = {
            ok: true,
            mensagem: `Aula cancelada por chuva. ${studentIds.length} crédito(s) de reposição concedido(s).`,
            whatsapp_msg: `🌧️ *Aviso de Chuva - Team Lucão*\n\nGalera, devido às condições climáticas/chuva, a aula de *${classItem.turma || 'Futevôlei'}* de hoje (*${classItem.horario}*) foi *cancelada por chuva*.\n\n✅ Todos os ${studentIds.length} alunos previstos ganharam *+1 crédito de reposição* automático no sistema para agendar em outra data!\n\nQualquer dúvida, estamos à disposição! ⚽👊`
          };
        }
      }
    }

    if (!data || !data.ok) throw new Error('Falha ao cancelar aula');

    if (typeof showToast === 'function') {
      showToast(data.mensagem || 'Aula cancelada por chuva com sucesso!');
    }

    if (data.whatsapp_msg) {
      const copyWhatsapp = confirm(
        `${data.mensagem}\n\n` +
        `Deseja copiar o comunicado de chuva para o grupo do WhatsApp agora?`
      );
      if (copyWhatsapp) {
        navigator.clipboard.writeText(data.whatsapp_msg);
        alert("✅ Comunicado copiado para a área de transferência! Cole no grupo da turma no WhatsApp.");
      }
    }

    if (typeof refreshCallback === 'function') {
      refreshCallback();
    }
  } catch (err) {
    alert("Erro ao cancelar aula: " + err.message);
  }
}

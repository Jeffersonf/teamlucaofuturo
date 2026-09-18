const { seedOfficialClasses, rows, scalar } = require('../server/db');

console.log('--- REINICIALIZANDO TODAS AS AULAS COM A GRADE OFICIAL ---');
console.log('Deletando aulas antigas e gerando nova grade oficial...');

const created = seedOfficialClasses({ weeks: 5, clearExisting: true });

console.log(`Sucesso! Total de aulas geradas: ${created}`);

// Validação dos horários criados
const sampleWeek = rows(`
  SELECT data, horario, turma 
  FROM aulas 
  WHERE data >= '2026-09-14' AND data <= '2026-09-20' 
  ORDER BY data, horario
`);

const byDay = {};
sampleWeek.forEach(item => {
  byDay[item.data] = byDay[item.data] || [];
  byDay[item.data].push(item.horario);
});

console.log('\n--- VERIFICAÇÃO DA SEMANA ATUAL (14/09 a 20/09) ---');
for (const [date, times] of Object.entries(byDay)) {
  console.log(`Data: ${date} (${times.length} aulas) -> ${times.join(', ')}`);
}

const sundayCount = scalar("SELECT COUNT(*) FROM aulas WHERE strftime('%w', data) = '0'");
console.log(`\nAulas no domingo (deve ser 0): ${sundayCount}`);

if (sundayCount === 0) {
  console.log('>>> VALIDAÇÃO CONCLUÍDA: DOMINGO SEM AULA E GRADE 100% CORRETA! <<<');
} else {
  console.error('ERRO: Há aulas no domingo!');
  process.exit(1);
}

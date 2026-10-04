// Script de Teste Automatizado para as Métricas de Ciência de Dados (Admin + Cliente)
// Roda 100% em memória: nenhum dado real é lido nem gravado.
import { storage } from './src/services/storage.js';
import { toLocalDateKey } from './src/utils/helpers.js';

console.log('====================================================');
console.log('TESTE AUTOMATIZADO: CIÊNCIA DE DADOS (ADMIN + CLIENTE)');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

function seed(plaques) {
  storage.plaques = plaques;
  storage.plaquesMap = new Map(plaques.map(p => [p.id, p]));
  storage.invalidateCache();
}

function mk(id, extra = {}) {
  return {
    id,
    name: 'Empresa ' + id,
    status: 'active',
    target_url: 'https://search.google.com/local/writereview?placeid=' + id,
    pin: '1234',
    client_name: '',
    client_phone: '',
    client_code: '',
    created_at: ago(30),
    activated_at: ago(20),
    scans_count: 0,
    last_scan_at: null,
    batch_name: 'Lote Teste',
    ...extra
  };
}

// ---------------------------------------------------------------
// Cenário: clientes com perfis bem diferentes
// ---------------------------------------------------------------
seed([
  // Campeão ativo: 60 leituras, última há 1 dia
  mk('T-001', { client_name: 'Ana Campeã', client_phone: '(11) 98765-4321', client_code: '12345678911', scans_count: 60, last_scan_at: ago(1) }),
  // Ex-campeão dormente: 200 leituras, mas parado há 30 dias (deve ser Em Risco, nunca Campeão)
  mk('T-002', { client_name: 'Bruno Dormente', client_phone: '(11) 91111-2222', client_code: '22221111911', scans_count: 200, last_scan_at: ago(30) }),
  // Ativa nunca lida
  mk('T-003', { client_name: 'Carla Nova', client_phone: '(11) 93333-4444', client_code: '44443333911', scans_count: 0, last_scan_at: null }),
  // DDD 55 (RS): número de 11 dígitos começando com 55 NÃO tem DDI
  mk('T-004', { client_name: 'Diego Gaúcho', client_phone: '(55) 99999-1234', client_code: '43219999955', scans_count: 5, last_scan_at: ago(2) }),
  // Dois clientes com o MESMO nome e telefones diferentes (não podem se misturar)
  mk('T-005', { client_name: 'Maria Silva', client_phone: '(11) 95555-0001', client_code: '10005555911', scans_count: 3, last_scan_at: ago(0) }),
  mk('T-006', { client_name: 'Maria Silva', client_phone: '(21) 96666-0002', client_code: '20006666912', scans_count: 8, last_scan_at: ago(20) }),
  // Placas sem cliente nem telefone, com leitura recente:
  // não podem "emprestar" última leitura para ninguém
  mk('T-007', { status: 'virgin', activated_at: null }),
  mk('T-008', { scans_count: 9, last_scan_at: ago(0) })
]);

console.log('\n--- 1. Radar de Retenção (getDashboardMetrics) ---');
const m = storage.getDashboardMetrics(14);
const radar = m.clientHealthMatrix;
const everyone = [...radar.power, ...radar.accelerating, ...radar.stable, ...radar.atRisk];
const find = (name, phone) => everyone.find(c => c.name === name && (!phone || c.phone === phone));

assert(typeof m.networkEstimatedReviews === 'number', 'networkEstimatedReviews é um número');
assert(typeof m.paretoShare === 'string', 'paretoShare é uma string formatada');
assert(Array.isArray(radar.power) && Array.isArray(radar.accelerating) && Array.isArray(radar.stable) && Array.isArray(radar.atRisk), 'As 4 categorias são arrays');
assert(find('Ana Campeã')?.category === 'power', 'Muitas leituras E recente = Campeão');
assert(find('Bruno Dormente')?.category === 'atRisk', '200 leituras mas parado há 30 dias = Em Risco (não Campeão)');
assert(find('Bruno Dormente')?.daysSinceScan === 30, 'Bruno: 30 dias sem leitura');
assert(find('Carla Nova')?.category === 'atRisk' && find('Carla Nova')?.daysSinceScan === null, 'Placa ativa nunca lida = Em Risco, sem data de leitura');
assert(find('Diego Gaúcho')?.category === 'accelerating', 'Leitura há 2 dias = Acelerando');

const maria1 = find('Maria Silva', '(11) 95555-0001');
const maria2 = find('Maria Silva', '(21) 96666-0002');
assert(maria1 && maria2, 'Duas clientes com o mesmo nome continuam separadas');
assert(maria1 && maria1.daysSinceScan === 0, 'Maria SP: última leitura é a dela (hoje), sem herdar da homônima');
assert(maria2 && maria2.daysSinceScan === 20, 'Maria RJ: última leitura é a dela (20 dias), sem herdar da homônima');

const avulsa = find('Cliente Não Identificado');
assert(avulsa && avulsa.activeCount === 1 && avulsa.totalScans === 9, 'Placa avulsa fica num grupo próprio, sem misturar com clientes reais');

console.log('\n--- 2. Links de WhatsApp ---');
const waAna = find('Ana Campeã')?.whatsappUrl || '';
assert(waAna.startsWith('https://wa.me/5511987654321?text='), 'Número de SP recebe DDI 55 (5511987654321)');
const waDiego = find('Diego Gaúcho')?.whatsappUrl || '';
assert(waDiego.startsWith('https://wa.me/5555999991234?text='), 'DDD 55 (RS) recebe o DDI na frente (5555999991234)');
const msgBruno = decodeURIComponent((find('Bruno Dormente')?.whatsappUrl || '').split('text=')[1] || '');
assert(msgBruno.includes('30 dias'), 'Mensagem do cliente dormente cita os dias reais sem leitura');
assert(!/crescendo/i.test(decodeURIComponent(waDiego.split('text=')[1] || '')), 'Mensagem não afirma um "crescimento" que não foi medido');
assert(find('Cliente Não Identificado')?.whatsappUrl === null, 'Sem telefone não gera link de WhatsApp');

console.log('\n--- 3. Pareto e Lotes ---');
// 7 grupos de clientes -> top 20% = ceil(1.4) = 2 (Bruno 200 + Ana 60) sobre o total de leituras dos clientes
const totalClientScans = 60 + 200 + 0 + 5 + 3 + 8 + 9;
assert(m.paretoShare === (((200 + 60) / totalClientScans) * 100).toFixed(1), 'Pareto = top 20% por LEITURAS (não por nº de placas)');
m.batchDistribution.forEach(b => {
  assert(typeof b.burnRateDaysRemaining === 'number', `Lote "${b.name}" tem burnRateDaysRemaining numérico`);
  assert(typeof b.isStockLow === 'boolean', `Lote "${b.name}" tem isStockLow booleano`);
});

console.log('\n--- 4. Analytics do Cliente (getClientAnalytics) ---');
assert(storage.getClientAnalytics('CODIGO_INEXISTENTE_9999') === null, 'Retorna null para cliente inexistente');

const ana = storage.getClientAnalytics('12345678911');
assert(ana && ana.totalScans === 60, 'Total de scans correto (60)');
assert(ana.estimatedReviews === undefined, 'Portal do cliente não expõe estimativa de reviews (não é medida)');
assert(ana.scanHistory.available === false, 'Sem histórico carregado, scanHistory.available = false');
assert(ana.milestone.target === 100 && ana.milestone.remaining === 40, 'Meta de 60 scans é 100 (faltam 40)');
assert(ana.milestone.percent >= 0 && ana.milestone.percent <= 100, 'Progresso entre 0% e 100%');
assert(ana.plaqueHealth[0].status === 'optimal', 'Placa lida ontem = "optimal"');
assert(ana.dayparts === undefined && ana.techSplit === undefined && ana.weeklyGrowthRate === undefined,
  'Não expõe dados inventados (horário, NFC/QR, crescimento semanal)');
// 60 leituras em 20 dias = 3/dia -> 40 restantes = ~14 dias
assert(ana.milestone.estimatedDays === Math.ceil(40 / (60 / 20)), 'Previsão usa o ritmo real desde a ativação (3 leituras/dia)');
assert(ana.plaqueRanking.length === 1 && ana.plaqueRanking[0].percentOfTotal === 100, 'Ranking por plaquinha usa leituras reais');

const bruno = storage.getClientAnalytics('22221111911');
assert(bruno.plaqueHealth[0].status === 'dormant', '200 leituras mas parada há 30 dias = "dormant" (não "optimal")');
assert(bruno.insights.some(i => i.title === 'Plaquinhas Paradas'), 'Insight avisa sobre plaquinha parada');

const carla = storage.getClientAnalytics('44443333911');
assert(carla.plaqueHealth[0].status === 'attention', 'Ativa sem leituras = "attention"');
assert(carla.milestone.estimatedDays === null, 'Sem leituras não existe previsão de meta');
assert(carla.insights.length > 0, 'Cliente sem leituras recebe orientação inicial');

console.log('\n--- 5. Histórico real de leituras (scan_events) ---');
const brt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const dayAgo = (n) => new Date(Date.now() - n * DAY);

// Admin: 3 leituras hoje (2 às 12h, 1 às 20h), 5 ontem, 4 há 3 dias. Histórico começou há 4 dias.
const todayKey = toLocalDateKey(new Date());
storage.adminScanStats = {
  since: dayAgo(4).toISOString(),
  fetchedAt: Date.now(),
  rows: [
    { d: toLocalDateKey(dayAgo(3)), h: 10, n: 4 },
    { d: toLocalDateKey(dayAgo(1)), h: 15, n: 5 },
    { d: todayKey, h: 12, n: 2 },
    { d: todayKey, h: 20, n: 1 }
  ]
};
const mEv = storage.getDashboardMetrics(14);
assert(mEv.scanSource === 'events', 'Dashboard usa o histórico real quando ele existe');
assert(mEv.todayScans === 3, 'Hoje = 3 leituras reais (e não o total acumulado das placas)');
assert(mEv.yesterdayScans === 5, 'Ontem = 5 leituras reais');
const tl = mEv.timeline;
assert(tl.find(t => t.date === todayKey).scans === 3, 'Gráfico diário: hoje = 3');
assert(tl.find(t => t.date === toLocalDateKey(dayAgo(3))).scans === 4, 'Gráfico diário: 4 leituras há 3 dias');
assert(tl.find(t => t.date === toLocalDateKey(dayAgo(9))).noHistory === true, 'Dia anterior ao início do histórico é marcado "sem histórico" (não vira "0 leituras")');
assert(tl.find(t => t.date === toLocalDateKey(dayAgo(2))).noHistory === false, 'Dia com histórico não é marcado como sem histórico');
assert(mEv.yesterdayNoHistory === false, 'Ontem já tem histórico');
const mToday = storage.getDashboardMetrics(1);
assert(mToday.timeline[4].scans === 2 && mToday.timeline[6].scans === 1, 'Modo "Hoje": 2 leituras na faixa 12h–15h e 1 na faixa 18h–21h');

// Falha na busca (SQL não rodado / sem sessão): volta ao comportamento antigo sem quebrar
storage.adminScanStats = { since: null, rows: null, fetchedAt: Date.now(), failed: true };
assert(storage.getDashboardMetrics(14).scanSource === 'estimate', 'Se o histórico falhar, o dashboard cai para a estimativa antiga');
storage.adminScanStats = null;

// Cliente: últimos 7 dias = 14 leituras; 7 dias anteriores = 7 leituras -> +100%
seed([mk('E-001', { client_name: 'Eva Eventos', client_phone: '(11) 97777-0000', client_code: '00007777911', scans_count: 21, last_scan_at: ago(0), activated_at: ago(25) })]);
storage.clientScanStats = {
  '00007777911': {
    since: dayAgo(20).toISOString(),
    fetchedAt: Date.now(),
    rows: [
      { d: brt(dayAgo(0)), h: 12, n: 8 },
      { d: brt(dayAgo(3)), h: 19, n: 6 },
      { d: brt(dayAgo(8)), h: 12, n: 7 }
    ]
  }
};
const eva = storage.getClientAnalytics('00007777911');
assert(eva.scanHistory.available === true, 'Cliente com histórico: available = true');
assert(eva.scanHistory.last7 === 14, 'Leituras dos últimos 7 dias = 14');
assert(eva.scanHistory.growthPercent === 100, 'Crescimento real vs. semana anterior = +100%');
assert(eva.scanHistory.dayparts && eva.scanHistory.dayparts.length === 4, 'Faixas de horário reais calculadas (21 leituras >= mínimo)');
const peak = eva.scanHistory.dayparts.find(d => d.isPeak);
assert(peak && peak.id === 'lunch' && peak.percent === 71, 'Horário de maior movimento = almoço (15 de 21 leituras = 71%)');
assert(eva.scanHistory.dayparts.find(d => d.id === 'evening').count === 6, 'Noite = 6 leituras (19h)');
assert(eva.insights.some(i => i.title === 'Horário de Maior Movimento'), 'Insight de horário só aparece com dado real');

// Poucos dados: sem faixas (não inventa "horário de pico" com 4 leituras)
storage.clientScanStats = { '00007777911': { since: dayAgo(2).toISOString(), fetchedAt: Date.now(), rows: [{ d: brt(dayAgo(0)), h: 9, n: 4 }] } };
const evaPoucos = storage.getClientAnalytics('00007777911');
assert(evaPoucos.scanHistory.available === true && evaPoucos.scanHistory.dayparts === null, 'Com menos de 10 leituras, não mostra faixas de horário');
assert(evaPoucos.scanHistory.growthPercent === null, 'Com menos de 14 dias de histórico, não mostra crescimento');

// Falha de busca do cliente: portal segue funcionando, só sem a parte de histórico
storage.clientScanStats = { '00007777911': { since: null, rows: null, fetchedAt: Date.now(), failed: true } };
assert(storage.getClientAnalytics('00007777911').scanHistory.available === false, 'Falha na busca do histórico não quebra o portal');
storage.clientScanStats = {};

console.log('\n--- 6. Cliente só com placa virgem ---');
seed([mk('V-001', { status: 'virgin', activated_at: null, client_name: 'Vera Virgem', client_phone: '(11) 90000-0000', client_code: '00000000911' })]);
const vera = storage.getClientAnalytics('00000000911');
assert(vera && vera.plaqueHealth[0].status === 'virgin', 'Placa virgem classificada como "virgin"');
assert(vera && vera.milestone.estimatedDays === null, 'Placa virgem não tem previsão');

// Limpa o estado em memória
seed([]);

console.log('\n====================================================');
console.log(`RESULTADO FINAL: ${passedTests} de ${totalTests} testes passaram!`);
if (passedTests === totalTests) {
  console.log('✓ TODOS OS TESTES PASSARAM COM SUCESSO!');
} else {
  console.error(`✗ ${totalTests - passedTests} testes falharam.`);
  process.exit(1);
}
console.log('====================================================');

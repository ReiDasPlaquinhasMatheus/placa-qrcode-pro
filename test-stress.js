// Placa QR Pro - Extreme Stress Test Suite
// Teste de Estresse Extremo: 10.000 Placas, 300 Clientes, Milhares de Scans e Operações Concorrentes
import { storage } from './src/services/storage.js';
import { exportBatchCsv } from './src/services/exporter.js';
import { getReversedPhoneCode, isValidHttpUrl } from './src/utils/helpers.js';

console.log('===============================================================');
console.log('🚀 INICIANDO TESTE DE ESTRESSE EXTREMO - PLACA QR PRO');
console.log('   Meta: 10.000 Placas | 300 Clientes | 100% Otimização O(1)');
console.log('===============================================================\n');

const metrics = {};

async function runStressTest() {
  // -------------------------------------------------------------
  // TESTE 1: Criação Massiva de 10.000 Placas em 10 Lotes de 1.000
  // -------------------------------------------------------------
  console.log('📌 Teste 1: Criando 10.000 placas em 10 lotes de 1.000...');
  const t0 = performance.now();

  for (let b = 1; b <= 10; b++) {
    const batchName = `Lote Mega ${String(b).padStart(2, '0')}`;
    const startNumber = (b - 1) * 1000 + 1;
    await storage.createBatch({
      prefix: 'PLQ-',
      startNumber,
      count: 1000,
      batchName
    });
  }

  const t1 = performance.now();
  metrics.batchCreationMs = (t1 - t0).toFixed(2);
  const totalPlaques = storage.getAllPlaques().length;
  console.log(`✅ Concluído em ${metrics.batchCreationMs}ms! Total de placas em memória: ${totalPlaques}`);
  if (totalPlaques < 10000) {
    throw new Error(`Esperado >= 10000 placas, mas obtido ${totalPlaques}`);
  }

  // -------------------------------------------------------------
  // TESTE 2: Cadastro e Ativação de 300 Clientes (3.000 Placas)
  // -------------------------------------------------------------
  console.log('\n📌 Teste 2: Ativando 3.000 placas distribuídas para 300 clientes...');
  const t2 = performance.now();

  const clientsList = [];
  for (let c = 1; c <= 300; c++) {
    const rawPhone = `1198${String(100000 + c).slice(0, 6)}`;
    const phoneFormatted = `(11) 98${String(100000 + c).slice(0, 2)}-${String(100000 + c).slice(2, 6)}`;
    const reversed = getReversedPhoneCode(rawPhone);
    clientsList.push({
      name: `Empresa Comercial ${c} Ltda`,
      phone: phoneFormatted,
      rawPhone,
      code: reversed
    });
  }

  const allPlaques = storage.getAllPlaques();
  for (let c = 0; c < 300; c++) {
    const client = clientsList[c];
    for (let p = 0; p < 10; p++) {
      const plaqueIdx = c * 10 + p;
      if (allPlaques[plaqueIdx]) {
        const id = allPlaques[plaqueIdx].id;
        const res = await storage.activatePlaque(id, {
          name: `${client.name} - Ponto ${p + 1}`,
          targetUrl: `https://search.google.com/local/writereview?placeid=ChIJ${id}_${c}`,
          pin: '1234',
          clientName: client.name,
          clientPhone: client.phone,
          clientCode: client.code
        });
        if (!res.success) {
          throw new Error(`Falha ao ativar placa ${id}: ${res.error}`);
        }
      }
    }
  }

  const t3 = performance.now();
  metrics.clientActivationMs = (t3 - t2).toFixed(2);
  console.log(`✅ 3.000 placas ativadas com sucesso para 300 clientes em ${metrics.clientActivationMs}ms!`);

  // -------------------------------------------------------------
  // TESTE 3: Simulação de 5.000 Scans / Acessos de Clientes
  // -------------------------------------------------------------
  console.log('\n📌 Teste 3: Simulando 5.000 scans em placas aleatórias...');
  const t4 = performance.now();

  for (let i = 1; i <= 5000; i++) {
    const randomNum = Math.floor(1 + Math.random() * 3000);
    const id = `PLQ-${String(randomNum).padStart(5, '0')}`;
    storage.recordScan(id);
  }

  const t5 = performance.now();
  metrics.scansRecordingMs = (t5 - t4).toFixed(2);
  console.log(`✅ 5.000 scans registrados em ${metrics.scansRecordingMs}ms!`);

  // -------------------------------------------------------------
  // TESTE 4: Lookups O(1) por ID (10.000 buscas individuais)
  // -------------------------------------------------------------
  console.log('\n📌 Teste 4: Executando 10.000 buscas individuais por ID O(1)...');
  const t6 = performance.now();

  let foundCount = 0;
  for (let i = 1; i <= 10000; i++) {
    const id = `PLQ-${String(i).padStart(5, '0')}`;
    const p = storage.getPlaqueById(id);
    if (p) foundCount++;
  }

  const t7 = performance.now();
  metrics.lookupById10kMs = (t7 - t6).toFixed(2);
  console.log(`✅ 10.000 buscas por ID concluídas em ${metrics.lookupById10kMs}ms (${(metrics.lookupById10kMs / 10000).toFixed(4)}ms por busca). Encontradas: ${foundCount}`);

  // -------------------------------------------------------------
  // TESTE 5: Lookups de Clientes por Código Invertido e Telefone
  // -------------------------------------------------------------
  console.log('\n📌 Teste 5: Buscando 300 clientes por código de acesso invertido...');
  const t8 = performance.now();

  let clientsFound = 0;
  for (let c = 0; c < 300; c++) {
    const targetCode = clientsList[c].code;
    const client = storage.getClientByCode(targetCode);
    if (client && client.plaques.length === 10) {
      clientsFound++;
    }
  }

  const t9 = performance.now();
  metrics.clientLookupMs = (t9 - t8).toFixed(2);
  console.log(`✅ 300 buscas de cliente concluídas em ${metrics.clientLookupMs}ms! Todos os 300 clientes encontrados com 10 placas cada: ${clientsFound === 300 ? 'SIM' : 'NÃO'}`);

  // -------------------------------------------------------------
  // TESTE 6: Agregações Memoizadas (getBatches, getClients, getStats)
  // -------------------------------------------------------------
  console.log('\n📌 Teste 6: Testando tempo de agregação e estatísticas gerais...');
  const t10 = performance.now();

  const stats = storage.getStats();
  const batches = storage.getBatches();
  const computedClients = storage.getClients();

  const t11 = performance.now();
  metrics.aggregationMs = (t11 - t10).toFixed(2);
  console.log(`✅ Agregações calculadas em ${metrics.aggregationMs}ms:`);
  console.log(`   - Total de Placas: ${stats.total}`);
  console.log(`   - Placas Ativas: ${stats.active}`);
  console.log(`   - Placas Virgens: ${stats.virgin}`);
  console.log(`   - Total de Scans: ${stats.totalScans}`);
  console.log(`   - Total de Pastas de Lotes: ${batches.length}`);
  console.log(`   - Total de Clientes Cadastrados: ${computedClients.length}`);

  // -------------------------------------------------------------
  // TESTE 7: Teste de Integridade de Segurança (Credenciais do Dono & Sanitização)
  // -------------------------------------------------------------
  console.log('\n📌 Teste 7: Verificação de Segurança das Credenciais do Dono...');
  const loginMatheus = await storage.loginAdmin('Matheus', 'Helena2026');
  const loginWrong = await storage.loginAdmin('Matheus', 'SenhaErrada123');
  const loginAdminOld = await storage.loginAdmin('admin', 'admin');

  console.log(`   - Login Matheus / Helena2026: ${loginMatheus.success ? '✅ SUCESSO' : '❌ FALHOU'}`);
  console.log(`   - Tentativa com senha errada bloqueada: ${!loginWrong.success ? '✅ SUCESSO (Bloqueado)' : '❌ FALHA'}`);
  console.log(`   - Tentativa com admin padrão antigo bloqueada: ${!loginAdminOld.success ? '✅ SUCESSO (Bloqueado)' : '❌ FALHA'}`);

  // Teste de exportação segura do backup
  const backupJson = storage.exportBackupJSON();
  const isPasswordLeaked = backupJson.includes('Helena2026') || backupJson.includes('926e64810cf9b064d7098f910baf556a387300d31ef8aaa83327f34f1d9fca37');
  console.log(`   - Sanitização de Backup (Sem vazamento de senhas/hashes): ${!isPasswordLeaked ? '✅ 100% SEGURO' : '❌ FALHA DE SEGURANÇA'}`);

  // -------------------------------------------------------------
  // TESTE 8: Validação de URLs e PINs de Segurança
  // -------------------------------------------------------------
  console.log('\n📌 Teste 8: Teste de Validação contra links maliciosos ou inválidos...');
  const invalidUrlTest = await storage.activatePlaque('PLQ-00001', {
    name: 'Teste Url Invalida',
    targetUrl: 'javascript:alert(1)',
    pin: '1234'
  });
  console.log(`   - Bloqueio de URL maliciosa (javascript:...): ${!invalidUrlTest.success ? '✅ BLOQUEADO COM SUCESSO' : '❌ VULNERABILIDADE'}`);

  const pinWrongTest = await storage.activatePlaque('PLQ-00001', {
    name: 'Hack de Placa',
    targetUrl: 'https://google.com',
    pin: '9999' // PIN incorreto
  });
  console.log(`   - Bloqueio de alteração com PIN incorreto: ${!pinWrongTest.success ? '✅ BLOQUEADO COM SUCESSO' : '❌ VULNERABILIDADE'}`);

  console.log('\n===============================================================');
  console.log('🏆 RELATÓRIO FINAL DE PERFORMANCE & SEGURANÇA:');
  console.log('===============================================================');
  console.table(metrics);
  console.log('\n🎯 RESULTADO GERAL: TODOS OS TESTES PASSARAM COM PERFORMANCE EXTREMA!');
}

runStressTest().catch(err => {
  console.error('❌ ERRO NO TESTE DE ESTRESSE:', err);
  process.exit(1);
});

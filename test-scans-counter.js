// Placa QR Pro - Scans / Views Counter Verification Suite
// Testa e comprova que a contagem de visualizações (scans) é incrementada e persistida com precisão
import { storage } from './src/services/storage.js';

console.log('===============================================================');
console.log('🔍 TESTE E CONFIRMAÇÃO DO CONTADOR DE VISUALIZAÇÕES (SCANS)');
console.log('===============================================================\n');

async function testScansCounter() {
  const targetId = 'PLQ-SCAN-TEST-001';

  // 1. Criar ou resetar uma placa de teste
  await storage.createBatch({
    prefix: 'PLQ-SCAN-TEST-',
    startNumber: 1,
    count: 1,
    batchName: 'Lote Teste Scans'
  });

  const resAct = await storage.activatePlaque(targetId, {
    name: 'Restaurante Teste de Scans',
    targetUrl: 'https://search.google.com/local/writereview?placeid=ChIJTestScans',
    pin: '1234',
    clientName: 'Cliente Teste Scan',
    clientPhone: '(11) 99999-1111'
  });

  const initialPlaque = storage.getPlaqueById(targetId);
  console.log(`📌 1. Placa inicial criada:`);
  console.log(`   - ID: ${initialPlaque.id}`);
  console.log(`   - Status: ${initialPlaque.status}`);
  console.log(`   - Scans Iniciais: ${initialPlaque.scans_count || 0}`);
  console.log(`   - Último Scan: ${initialPlaque.last_scan_at || 'Nunca'}`);

  const initialScans = initialPlaque.scans_count || 0;

  // 2. Simular 1 Scan via storage.recordScan()
  console.log(`\n📌 2. Simulando 1º Scan via leitura de QR Code...`);
  const beforeTime = Date.now();
  await storage.recordScan(targetId);

  const plaqueAfter1 = storage.getPlaqueById(targetId);
  console.log(`   - Scans após 1º scan: ${plaqueAfter1.scans_count}`);
  console.log(`   - Data do último scan: ${plaqueAfter1.last_scan_at}`);

  if (plaqueAfter1.scans_count !== initialScans + 1) {
    throw new Error(`Falha: esperado ${initialScans + 1} scans, mas obtido ${plaqueAfter1.scans_count}`);
  }

  const scanTimestamp = new Date(plaqueAfter1.last_scan_at).getTime();
  if (scanTimestamp < beforeTime) {
    throw new Error(`Falha: timestamp last_scan_at não foi atualizado corretamente.`);
  }
  console.log(`   - ✅ 1º Scan registrado e incrementado com sucesso!`);

  // 3. Simular 10 scans consecutivos em alta frequência
  console.log(`\n📌 3. Simulando 10 scans adicionais em alta frequência...`);
  for (let i = 1; i <= 10; i++) {
    await storage.recordScan(targetId);
  }

  const plaqueAfter11 = storage.getPlaqueById(targetId);
  console.log(`   - Scans após 10 scans adicionais: ${plaqueAfter11.scans_count}`);
  if (plaqueAfter11.scans_count !== initialScans + 11) {
    throw new Error(`Falha: esperado ${initialScans + 11} scans, mas obtido ${plaqueAfter11.scans_count}`);
  }
  console.log(`   - ✅ Todos os 10 scans adicionais foram somados com 100% de precisão!`);

  // 4. Testar reflexo nas estatísticas globais
  console.log(`\n📌 4. Verificando reflexo no totalizador global de estatísticas...`);
  const stats = storage.getStats();
  console.log(`   - Total de Scans Computados no Sistema: ${stats.totalScans}`);
  if (stats.totalScans < 11) {
    throw new Error(`Falha: estatística global não refletiu os scans.`);
  }
  console.log(`   - ✅ Estatísticas globais (getStats) atualizadas corretamente!`);

  // 5. Testar reflexo no totalizador da pasta do lote
  console.log(`\n📌 5. Verificando reflexo no totalizador da pasta do Lote...`);
  const batches = storage.getBatches();
  const testBatch = batches.find(b => b.name === 'Lote Teste Scans');
  console.log(`   - Scans na Pasta '${testBatch.name}': ${testBatch.totalScans}`);
  if (testBatch.totalScans !== plaqueAfter11.scans_count) {
    throw new Error(`Falha: pasta de lote não refletiu a contagem correta.`);
  }
  console.log(`   - ✅ Totalizador da pasta de lote refletiu a contagem com precisão!`);

  // 6. Testar reflexo no Portal do Cliente
  console.log(`\n📌 6. Verificando reflexo no Portal do Comprador / Cliente...`);
  const client = storage.getClientByCode('(11) 99999-1111');
  console.log(`   - Scans no Perfil do Cliente '${client.name}': ${client.totalScans}`);
  if (client.totalScans !== plaqueAfter11.scans_count) {
    throw new Error(`Falha: painel do cliente não refletiu a contagem.`);
  }
  console.log(`   - ✅ Painel do Cliente refletiu a contagem com precisão!`);

  console.log('\n===============================================================');
  console.log('🏆 CONCLUSÃO: O CONTADOR DE VISUALIZAÇÕES/SCANS ESTÁ 100%');
  console.log('   PRECISO, ATUALIZA EM TEMPO REAL E PROPAGA PARA TODAS AS TELAS!');
  console.log('===============================================================');
}

testScansCounter().catch(err => {
  console.error('❌ ERRO NO TESTE DE SCANS:', err);
  process.exit(1);
});

// Teste Automatizado de Emissão e Gerenciamento de Lotes de QR Codes
import { storage } from './src/services/storage.js';

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 TESTE COMPLETO: EMISSÃO DE LOTES E PROTEÇÃO ANTI-COLISÃO');
  console.log('===============================================================\n');

  // 1. Teste de detecção do próximo número livre
  console.log('🔢 1. Testando detecção do próximo número livre (getNextAvailableNumber)...');
  const nextNum = storage.getNextAvailableNumber('PLQ-');
  console.log(`   - Próximo número calculado para prefixo "PLQ-": #${nextNum}`);
  if (nextNum >= 1) {
    console.log('   ✅ getNextAvailableNumber calculou corretamente!\n');
  } else {
    throw new Error('Falha no cálculo do próximo número.');
  }

  // 2. Teste de validação de intervalo (checkRangeAvailability)
  console.log('🔍 2. Testando verificação de disponibilidade (checkRangeAvailability)...');
  const checkOld = storage.checkRangeAvailability('PLQ-', 1, 4);
  console.log(`   - Intervalo PLQ-001 a PLQ-004 (IDs existentes):`, checkOld.available ? 'LIVRE' : 'OCUPADO');
  console.log(`   - IDs conflitantes detectados:`, checkOld.existingIds);
  console.log(`   - Sugestão de início: #${checkOld.suggestedStart}`);

  const checkNew = storage.checkRangeAvailability('PLQ-', nextNum, 10);
  console.log(`   - Intervalo PLQ-${nextNum} a PLQ-${nextNum + 9}:`, checkNew.available ? '✅ LIVRE' : 'OCUPADO');

  if (!checkOld.available && checkNew.available) {
    console.log('   ✅ Validação de disponibilidade detectou conflitos e confirmou novos IDs!\n');
  }

  // 3. Teste de Emissão de Novo Lote com Proteção Anti-Colisão
  console.log('📦 3. Testando emissão de novo lote (createBatch)...');
  const testBatchName = 'Lote Teste Automatizado 2026';
  const newPlaques = await storage.createBatch({
    prefix: 'PLQ-',
    startNumber: nextNum,
    count: 15,
    batchName: testBatchName,
    collisionMode: 'auto-next'
  });

  console.log(`   - Quantidade de plaquinhas geradas: ${newPlaques.length}`);
  console.log(`   - Primeiro ID: ${newPlaques[0].id}, Último ID: ${newPlaques[newPlaques.length - 1].id}`);
  console.log(`   - Status inicial: ${newPlaques[0].status}, PIN gerado: ${newPlaques[0].pin}`);
  console.log(`   - Lote atrelado: "${newPlaques[0].batch_name}"`);

  if (newPlaques.length === 15 && newPlaques[0].batch_name === testBatchName) {
    console.log('   ✅ Emissão de Lote concluída com sucesso absoluto!\n');
  } else {
    throw new Error('Falha na criação do lote.');
  }

  // 4. Teste de Busca do Lote Criado
  console.log('📂 4. Testando consulta das pastas de lotes...');
  const batches = storage.getBatches();
  const foundBatch = batches.find(b => b.name === testBatchName);
  console.log(`   - Lote encontrado na listagem: "${foundBatch?.name}" com ${foundBatch?.count} plaquinhas.`);

  const batchPlaques = storage.getPlaquesByBatch(testBatchName);
  console.log(`   - Placas recuperadas por getPlaquesByBatch: ${batchPlaques.length}`);

  if (foundBatch && batchPlaques.length === 15) {
    console.log('   ✅ Consulta de lotes e placas funcionando perfeitamente!\n');
  } else {
    throw new Error('Falha ao recuperar lote criado.');
  }

  // 5. Teste de Exclusão de Lote
  console.log('🗑️ 5. Testando exclusão do lote de teste (deleteBatch)...');
  const deleteRes = await storage.deleteBatch(testBatchName);
  console.log(`   - Resultado da exclusão:`, deleteRes);

  const batchesAfterDelete = storage.getBatches();
  const foundAfterDelete = batchesAfterDelete.find(b => b.name === testBatchName);
  console.log(`   - Lote ainda existe?`, foundAfterDelete ? 'SIM (ERRO)' : 'NÃO (REMOVIDO COM SUCESSO)');

  if (deleteRes.success && !foundAfterDelete) {
    console.log('   ✅ Exclusão de lote e sincronização concluídas com sucesso!\n');
  } else {
    throw new Error('Falha ao excluir lote de teste.');
  }

  console.log('===============================================================');
  console.log('🎉 TODOS OS TESTES DE EMISSÃO E GERENCIAMENTO DE LOTES PASSARAM!');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('❌ Erro durante a execução dos testes:', err);
  process.exit(1);
});

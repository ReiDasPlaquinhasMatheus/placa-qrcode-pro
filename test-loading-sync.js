// Testes do cache local / sincronização: garantem que a tela nunca fique presa a
// dados parciais ou antigos. Roda 100% em memória (nenhuma chamada de rede).
import { storage } from './src/services/storage.js';

let passed = 0;
let total = 0;
function assert(condition, message) {
  total++;
  if (condition) { passed++; console.log(`  ✓ [PASS] ${message}`); }
  else console.error(`  ✗ [FAIL] ${message}`);
}

const mk = (id, extra = {}) => ({
  id, name: 'Empresa ' + id, status: 'active', target_url: 'https://example.com/' + id, pin: '1234',
  client_name: 'Cliente X', client_phone: '(11) 90000-0000', client_code: '00000000911',
  created_at: new Date().toISOString(), activated_at: new Date().toISOString(),
  scans_count: 0, last_scan_at: null, batch_name: 'Lote 01', ...extra
});
function seed(list) {
  storage.plaques = list;
  storage.plaquesMap = new Map(list.map(p => [p.id.toUpperCase(), p]));
  storage.invalidateCache();
}

console.log('\n--- 1. Cliente com cache antigo recebe a lista COMPLETA da nuvem ---');
// Cache antigo: 3 placas do cliente + 1 que não é mais dele; nuvem: 10 placas (3 antigas + 7 novas)
seed([
  mk('P-01', { pin: '9999' }), mk('P-02'), mk('P-03'),
  mk('P-REMOVIDA'),                                   // já foi resetada/apagada na nuvem
  mk('OUTRO-1', { client_code: '99999999911', client_name: 'Outro Cliente', client_phone: '(99) 99999-9999' })
]);
const cloudRows = Array.from({ length: 10 }, (_, i) => {
  const id = 'P-' + String(i + 1).padStart(2, '0');
  const r = mk(id, { scans_count: i });
  delete r.pin; // a nuvem não devolve o PIN ao cliente
  return r;
});
const staleClient = storage.getClientByCode('00000000911');
assert(staleClient.count === 4, 'antes: cache mostra 4 placas do cliente (lista antiga)');
storage.replaceClientPlaques(cloudRows, staleClient);
const fresh = storage.getClientByCode('00000000911');
assert(fresh.count === 10, 'depois: cliente passa a ver as 10 placas reais');
assert(!storage.getPlaqueById('P-REMOVIDA'), 'placa que não é mais do cliente some do cache dele');
assert(storage.getPlaqueById('OUTRO-1') && storage.getPlaqueById('OUTRO-1').client_name === 'Outro Cliente', 'placas de OUTROS clientes não são tocadas');
assert(storage.getPlaqueById('P-01').pin === '9999', 'campos que a nuvem não devolve (pin) são preservados no cache do admin');
assert(storage.getPlaqueById('P-05').scans_count === 4, 'campos devolvidos pela nuvem (scans_count) são atualizados');
assert(storage.plaques.length === 11, 'total do cache = 10 do cliente + 1 de outro cliente');

console.log('\n--- 2. Assinatura de dados (decide se precisa redesenhar a tela) ---');
const sigA = storage.getDataSignature();
seed(storage.plaques.slice().reverse());
assert(storage.getDataSignature() === sigA, 'mesma informação em outra ordem = mesma assinatura (não redesenha à toa)');
storage.getPlaqueById('P-02').name = 'Nome novo';
assert(storage.getDataSignature() !== sigA, 'mudou um nome = assinatura diferente (redesenha)');
storage.getPlaqueById('P-02').name = 'Empresa P-02';
storage.getPlaqueById('P-02').scans_count = 50;
assert(storage.getDataSignature() !== sigA, 'mudou a contagem de leituras = assinatura diferente');
storage.getPlaqueById('P-02').scans_count = 1;
assert(storage.getDataSignature() === sigA, 'voltou ao original = assinatura igual');
seed(storage.plaques.slice(1));
assert(storage.getDataSignature() !== sigA, 'uma placa a menos = assinatura diferente');

console.log('\n--- 3. Rótulo de sincronização ---');
storage.syncState = 'syncing';
assert(storage.getSyncLabel() === 'Atualizando…', 'durante a sincronização mostra "Atualizando…"');
storage.syncState = 'idle';
storage.lastSyncAt = new Date(2026, 9, 4, 14, 32).getTime();
assert(/14:32/.test(storage.getSyncLabel()) && storage.getSyncLabel().startsWith('Atualizado'), 'depois mostra "Atualizado às 14:32"');
storage.syncState = 'offline';
assert(storage.getSyncLabel().startsWith('Sem conexão') && /14:32/.test(storage.getSyncLabel()), 'sem rede avisa e mostra a hora dos dados');

console.log('\n--- 4. whenLocalReady respeita o limite de tempo ---');
storage._localReady = new Promise(() => {}); // cache que nunca responde
const t0 = Date.now();
await storage.whenLocalReady(150);
const waited = Date.now() - t0;
assert(waited >= 140 && waited < 1000, `não trava a abertura do painel (esperou ${waited}ms)`);
storage._localReady = Promise.resolve();

console.log('\n--- 5. Placa repetida na lista paginada da nuvem ---');
// Reproduz o defeito medido: 2752 linhas recebidas, só 2638 placas distintas
const pagedWithDuplicates = [mk('D-1'), mk('D-2'), mk('D-3'), mk('D-2'), mk('D-3'), mk('D-3')];
storage.setPlaquesInternal(pagedWithDuplicates);
assert(storage.plaques.length === 3, 'seis linhas com três placas distintas viram 3 placas (sem contagem inflada)');
assert(storage.duplicatesDropped === 3, 'o app sabe quantas linhas repetidas descartou');
assert(storage.getStats().total === 3, 'o total de placas do painel não conta repetidas');
assert(storage.plaques.length === storage.plaquesMap.size, 'lista e índice têm o mesmo tamanho (cache confiável)');

seed([]);
console.log('\n====================================================');
console.log(`RESULTADO FINAL: ${passed} de ${total} testes passaram!`);
if (passed !== total) process.exit(1);
console.log('✓ TODOS OS TESTES PASSARAM COM SUCESSO!');

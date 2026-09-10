// Teste Automatizado de Segurança: Acesso do Cliente, Isolamento de Dados e Validação Anti-Fraude
import { storage } from './src/services/storage.js';
import { getReversedPhoneCode, isValidHttpUrl, sanitizeUrl, escapeHtml } from './src/utils/helpers.js';

async function runSecurityAudit() {
  console.log('===============================================================');
  console.log('🛡️ INICIANDO AUDITORIA RIGOROSA DE SEGURANÇA: ACESSO DO CLIENTE');
  console.log('===============================================================');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASSOU] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FALHOU] ${message}`);
      throw new Error(`Falha no teste de segurança: ${message}`);
    }
  }

  // Configura fixtures de teste isoladas
  storage.setPlaquesInternal([
    {
      id: 'PLQ-001',
      name: 'Pizzaria Bella Napoli',
      status: 'active',
      target_url: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
      pin: '1234',
      client_name: 'Roberto Pizza',
      client_phone: '(11) 98765-4321',
      client_code: '12345678911',
      created_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
      scans_count: 142,
      last_scan_at: new Date().toISOString(),
      batch_name: 'Lote 01'
    },
    {
      id: 'PLQ-002',
      name: 'Barbearia Vintage Club',
      status: 'active',
      target_url: 'https://search.google.com/local/writereview?placeid=ChIJQ1t_tDeuEmsRUsoyG83frY5',
      pin: '5678',
      client_name: 'Carlos Barba',
      client_phone: '(21) 99888-7766',
      client_code: '66778889912',
      created_at: new Date().toISOString(),
      activated_at: new Date().toISOString(),
      scans_count: 89,
      last_scan_at: new Date().toISOString(),
      batch_name: 'Lote 01'
    }
  ]);

  // 1. Teste de Autenticação Sem Senha por Telefone e Código Invertido
  console.log('\n🔐 1. Testando Lógica de Código de Login Sem Senha...');
  const phoneA = '(11) 98765-4321';
  const expectedCodeA = '12345678911';
  assert(getReversedPhoneCode(phoneA) === expectedCodeA, `Código invertido de ${phoneA} deve ser exatamente ${expectedCodeA}`);

  const phoneB = '(21) 99888-7766';
  const expectedCodeB = '66778889912';
  assert(getReversedPhoneCode(phoneB) === expectedCodeB, `Código invertido de ${phoneB} deve ser exatamente ${expectedCodeB}`);

  // 2. Teste de Isolamento de Dados entre Compradores
  console.log('\n🔒 2. Testando Isolamento Estrito de Dados entre Clientes...');
  const clientA = storage.getClientByCode(expectedCodeA);
  assert(clientA !== null, 'Cliente A deve ser encontrado por seu código invertido');
  assert(clientA.plaques.every(p => p.id === 'PLQ-001'), 'Cliente A deve enxergar APENAS sua plaquinha (PLQ-001)');

  const clientB = storage.getClientByCode(expectedCodeB);
  assert(clientB !== null, 'Cliente B deve ser encontrado por seu código invertido');
  assert(clientB.plaques.every(p => p.id === 'PLQ-002'), 'Cliente B deve enxergar APENAS sua plaquinha (PLQ-002)');

  // Tentativa de busca com código inválido/inexistente
  const fakeClient = storage.getClientByCode('00000000000');
  assert(fakeClient === null, 'Código de cliente inexistente deve retornar null (acesso negado)');

  // 3. Teste de Proteção contra Sequestro de Placa Ativa (PIN de Segurança)
  console.log('\n🛡️ 3. Testando Proteção de PIN contra Alteração não Autorizada...');
  // Tentar alterar PLQ-001 sem informar PIN
  const hackAttempt1 = await storage.activatePlaque('PLQ-001', {
    name: 'Tentativa Hacker',
    targetUrl: 'https://google.com',
    pin: ''
  });
  assert(hackAttempt1.success === false, 'Alteração de placa ativa sem PIN deve ser BLOQUEADA');

  // Tentar alterar PLQ-001 com PIN errado
  const hackAttempt2 = await storage.activatePlaque('PLQ-001', {
    name: 'Tentativa Hacker',
    targetUrl: 'https://google.com',
    pin: '9999'
  });
  assert(hackAttempt2.success === false, 'Alteração de placa ativa com PIN incorreto deve ser BLOQUEADA');

  // Alterar com o PIN correto
  const validUpdate = await storage.activatePlaque('PLQ-001', {
    name: 'Pizzaria Bella Napoli Premium',
    targetUrl: 'https://g.page/r/bellanapoli/review',
    pin: '1234',
    clientPhone: phoneA
  });
  assert(validUpdate.success === true, 'Alteração de placa ativa com PIN correto deve ser AUTORIZADA');

  // 4. Teste de Bloqueio de URLs Maliciosas (Protocolos Proibidos)
  console.log('\n🚫 4. Testando Bloqueio de URLs Maliciosas e Protocolos Perigosos...');
  const maliciousUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://attacker.com'
  ];

  for (const badUrl of maliciousUrls) {
    const isSafe = isValidHttpUrl(badUrl);
    assert(isSafe === false, `URL maliciosa [${badUrl}] deve ser rejeitada como inválida`);
  }

  // 5. Teste de Sanitização Anti-XSS
  console.log('\n🧼 5. Testando Sanitização HTML contra XSS Injection...');
  const dangerousName = '<script>alert("XSS")</script> Pizzaria & "Lanchonete"';
  const escaped = escapeHtml(dangerousName);
  assert(!escaped.includes('<script>'), 'Tags de script devem ser neutralizadas por escapeHtml');
  assert(escaped.includes('&lt;script&gt;'), 'Caracteres menores que e maiores que devem ser codificados');
  assert(escaped.includes('&quot;'), 'Aspas duplas devem ser codificadas para não quebrar atributos');

  // 6. Teste de Separação de Privilégios (Admin vs Cliente)
  console.log('\n👑 6. Testando Separação de Privilégios Dono/Admin vs Cliente...');
  storage.logoutAdmin();
  assert(storage.isAdminAuthenticated() === false, 'Após logout, estado de admin deve ser false');

  // Tentativa de login admin com credenciais incorretas
  const badLogin = await storage.loginAdmin('Matheus', 'senhaErrada123');
  assert(badLogin.success === false, 'Login de Dono com senha incorreta deve ser BLOQUEADO');

  // Login admin correto
  const goodLogin = await storage.loginAdmin('Matheus', 'Helena2026');
  assert(goodLogin.success === true, 'Login de Dono com credenciais corretas deve ser AUTORIZADO');

  // 7. Teste de Proteção de Backup JSON (Sem vazamento de senhas)
  console.log('\n📦 7. Testando Sanitização de Backup JSON...');
  const backup = storage.exportBackupJSON();
  const parsedBackup = JSON.parse(backup);
  assert(!parsedBackup.settings.adminPassword, 'Backup JSON NUNCA deve conter senhas em texto puro');
  assert(!parsedBackup.settings.adminPasswordHash, 'Backup JSON NUNCA deve expor hashes de senhas');

  console.log('\n===============================================================');
  console.log(`🎉 AUDITORIA CONCLUÍDA COM 100% DE SUCESSO! (${passed}/${total} testes aprovados)`);
  console.log('===============================================================');
}

runSecurityAudit().catch(err => {
  console.error(err);
  process.exit(1);
});

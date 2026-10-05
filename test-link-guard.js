// Testes das conferências feitas ao ativar uma placa: link que não é do Google e
// link repetido de outra empresa do mesmo cliente. Roda em memória (RPC simulada).
import { storage } from './src/services/storage.js';
import { describeLinkProblem, normalizeLinkForCompare } from './src/utils/helpers.js';

let passed = 0;
let total = 0;
function assert(condition, message) {
  total++;
  if (condition) { passed++; console.log(`  ✓ [PASS] ${message}`); }
  else console.error(`  ✗ [FAIL] ${message}`);
}

console.log('\n--- 1. O link parece de avaliação/página do Google? ---');
const okLinks = [
  'https://search.google.com/local/writereview?placeid=ChIJl0OWmpFCzpQRFXabc',
  'https://g.page/r/CaKTU3aYor97EBE/review',
  'https://maps.app.goo.gl/KRD4nXyP29om1Z8Z8?g_st=ac',
  'https://www.google.com/maps/place/Ka+Pratas',
  'g.page/r/CaKTU3aYor97EBE/review'
];
okLinks.forEach(u => assert(describeLinkProblem(u) === null, `aceita sem aviso: ${u.slice(0, 55)}`));

const badLinks = [
  ['https://www.instagram.com/gstoreplussize?stkn=abc', /rede social/],
  ['https://share.google/QGJsBzpepqY5D1mVc', /BUSCA/],
  ['https://wa.me/5511999999999', /WhatsApp/],
  ['https://jrpetiscos-connect.lovable.app/', /não parece/],
  ['https://www.globo.com/', /não parece/]
];
badLinks.forEach(([u, re]) => {
  const msg = describeLinkProblem(u);
  assert(msg && re.test(msg), `avisa sobre: ${u.slice(0, 50)}`);
});

console.log('\n--- 2. Comparação de links ---');
assert(
  normalizeLinkForCompare('https://maps.app.goo.gl/KRD4nXyP29om1Z8Z8?g_st=ac') === normalizeLinkForCompare('https://maps.app.goo.gl/KRD4nXyP29om1Z8Z8/'),
  'ignora parâmetro de rastreio (g_st) e barra final'
);
assert(
  normalizeLinkForCompare('https://search.google.com/local/writereview?placeid=ChIJAAA') !== normalizeLinkForCompare('https://search.google.com/local/writereview?placeid=ChIJBBB'),
  'placeids diferentes continuam diferentes'
);

console.log('\n--- 3. Mesmo link usado por outra empresa do mesmo cliente ---');
const KA_URL = 'https://maps.app.goo.gl/KRD4nXyP29om1Z8Z8?g_st=ac';
let rpcCalls = [];
storage.callRpc = async (fn, params) => {
  rpcCalls.push({ fn, params });
  if (fn !== 'public_get_client_plaques') throw new Error('RPC não simulada: ' + fn);
  if (globalThis.__rpcMode === 'fail') throw new Error('Failed to fetch');
  if (globalThis.__rpcMode === 'password') throw new Error('PASSWORD_REQUIRED');
  return [
    { id: 'PLQ-888', name: 'Óptica da Jô', status: 'active', target_url: KA_URL },
    { id: 'PLQ-759', name: 'Ka Pratas', status: 'active', target_url: KA_URL },
    { id: 'PLQ-900', name: 'Outra Loja', status: 'active', target_url: 'https://g.page/r/outra/review' },
    { id: 'PLQ-901', name: 'Antiga', status: 'virgin', target_url: '' }
  ];
};

globalThis.__rpcMode = 'ok';
const found = await storage.findOtherCompanyWithSameLink({
  clientPhone: '(11) 95169-7191', targetUrl: KA_URL, excludeId: 'PLQ-759', companyName: 'Ka Pratas'
});
assert(found && found.id === 'PLQ-888' && found.name === 'Óptica da Jô', 'Ka Pratas com o link da Óptica da Jô: encontra a outra empresa');
assert(rpcCalls[0].params.p_query === '19179615911', 'consulta usa o código do próprio cliente (telefone invertido)');

const sameCompany = await storage.findOtherCompanyWithSameLink({
  clientPhone: '(11) 95169-7191', targetUrl: KA_URL, excludeId: 'PLQ-999', companyName: 'ÓPTICA DA JÔ'
});
assert(sameCompany === null || sameCompany.name !== 'Óptica da Jô', 'segunda placa da MESMA empresa com o mesmo link não gera aviso');

const noClash = await storage.findOtherCompanyWithSameLink({
  clientPhone: '(11) 95169-7191', targetUrl: 'https://g.page/r/novo-link/review', excludeId: 'PLQ-759', companyName: 'Ka Pratas'
});
assert(noClash === null, 'link diferente de todas as outras empresas: sem aviso');

const noSelf = await storage.findOtherCompanyWithSameLink({
  clientPhone: '(11) 95169-7191', targetUrl: KA_URL, excludeId: 'PLQ-888', companyName: 'Óptica da Jô'
});
assert(!noSelf || noSelf.id !== 'PLQ-888', 'a própria placa que está sendo editada nunca conta como conflito');

globalThis.__rpcMode = 'fail';
assert(await storage.findOtherCompanyWithSameLink({ clientPhone: '(11) 95169-7191', targetUrl: KA_URL, excludeId: 'X', companyName: 'Y' }) === null, 'sem rede: não bloqueia a ativação (sem aviso)');
globalThis.__rpcMode = 'password';
assert(await storage.findOtherCompanyWithSameLink({ clientPhone: '(11) 95169-7191', targetUrl: KA_URL, excludeId: 'X', companyName: 'Y' }) === null, 'conta com senha: não bloqueia a ativação (sem aviso)');
assert(await storage.findOtherCompanyWithSameLink({ clientPhone: '', targetUrl: KA_URL, excludeId: 'X', companyName: 'Y' }) === null, 'sem telefone: sem aviso');

console.log('\n--- 4. Link já usado por OUTRO cliente (caso Ka Pratas x Gipsy) ---');
const calls = [];
storage._linkCheckUnavailable = false;
storage.callRpc = async (fn, params) => {
  calls.push({ fn, params });
  if (globalThis.__linkMode === 'fail') throw new Error('Failed to fetch');
  if (globalThis.__linkMode === 'missing') throw new Error('Could not find the function public.public_link_in_use_by_other_client(p_client_code, p_exclude_id, p_url) in the schema cache');
  return globalThis.__linkMode === 'inuse';
};
const GIPSY = 'https://search.google.com/local/writereview?placeid=ChIJkXiyyFddzpQRCt_ty3-LUbU';

globalThis.__linkMode = 'inuse';
assert(await storage.isLinkUsedByOtherClient({ targetUrl: GIPSY, excludeId: 'PLQ-759', clientPhone: '(11) 95169-7191' }) === true, 'banco diz que outro cliente usa o link: avisa');
assert(calls[0].fn === 'public_link_in_use_by_other_client' && calls[0].params.p_exclude_id === 'PLQ-759' && calls[0].params.p_client_code === '19179615911',
  'envia link, placa atual e o código do próprio cliente (para não acusar o próprio cliente)');
globalThis.__linkMode = 'free';
assert(await storage.isLinkUsedByOtherClient({ targetUrl: GIPSY, excludeId: 'PLQ-759', clientPhone: '(11) 95169-7191' }) === false, 'banco diz que ninguém mais usa: não avisa');
globalThis.__linkMode = 'fail';
assert(await storage.isLinkUsedByOtherClient({ targetUrl: GIPSY, excludeId: 'PLQ-759', clientPhone: '(11) 95169-7191' }) === false, 'sem rede: não bloqueia a ativação');
globalThis.__linkMode = 'missing';
assert(await storage.isLinkUsedByOtherClient({ targetUrl: GIPSY, excludeId: 'PLQ-759', clientPhone: '(11) 95169-7191' }) === false, 'função ainda não criada no banco: não bloqueia a ativação');
const before = calls.length;
globalThis.__linkMode = 'inuse';
await storage.isLinkUsedByOtherClient({ targetUrl: GIPSY, excludeId: 'PLQ-759', clientPhone: '(11) 95169-7191' });
assert(calls.length === before, 'depois de descobrir que a função não existe, para de perguntar (não fica repetindo erro 404)');
storage._linkCheckUnavailable = false;
assert(await storage.isLinkUsedByOtherClient({ targetUrl: '', excludeId: 'X', clientPhone: '' }) === false, 'link vazio: sem consulta');

console.log('\n====================================================');
console.log(`RESULTADO FINAL: ${passed} de ${total} testes passaram!`);
if (passed !== total) process.exit(1);
console.log('✓ TODOS OS TESTES PASSARAM COM SUCESSO!');

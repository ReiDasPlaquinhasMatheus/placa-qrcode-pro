// Placa QR Pro - Data Storage & Persistence Service
// Sincronização em Tempo Real (Supabase Cloud + Local API + IndexedDB + LocalStorage Fallback)
// Arquitetura Ultra Otimizada para 10.000+ Placas e 300+ Usuários Simultâneos com Lookups O(1)
import { getReversedPhoneCode, isValidHttpUrl, sanitizeUrl, sha256Hex, toLocalDateKey } from '../utils/helpers.js';
import { idb } from './db.js';

// ---- Histórico de leituras (tabela scan_events) --------------------------
const BRASILIA_TZ = 'America/Sao_Paulo';
const DAY_MS_CONST = 24 * 60 * 60 * 1000;
const MIN_EVENTS_FOR_DAYPARTS = 10;

// Dia (YYYY-MM-DD) no fuso de Brasília — o mesmo usado pelo banco para agrupar
function brasiliaDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BRASILIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

// Resume as linhas {d, h, n} devolvidas pelas RPCs de estatística
function summarizeScanEvents(stats, now = new Date()) {
  if (!stats || !Array.isArray(stats.rows)) return null;

  const dayKey = (offsetDays) => brasiliaDateKey(new Date(now.getTime() - offsetDays * DAY_MS_CONST));
  const last7 = new Set([0, 1, 2, 3, 4, 5, 6].map(dayKey));
  const prev7 = new Set([7, 8, 9, 10, 11, 12, 13].map(dayKey));

  let total = 0;
  let last7Count = 0;
  let prev7Count = 0;
  const byHour = new Array(24).fill(0);

  for (const r of stats.rows) {
    const n = Number(r.n) || 0;
    const h = Number(r.h);
    total += n;
    if (h >= 0 && h < 24) byHour[h] += n;
    if (last7.has(r.d)) last7Count += n;
    else if (prev7.has(r.d)) prev7Count += n;
  }

  const sinceKey = stats.since ? brasiliaDateKey(new Date(stats.since)) : null;
  const daysTracked = sinceKey
    ? Math.round((Date.parse(brasiliaDateKey(now)) - Date.parse(sinceKey)) / DAY_MS_CONST) + 1
    : 0;

  return { total, last7: last7Count, prev7: prev7Count, byHour, sinceKey, daysTracked };
}

// "2026-10-04" -> "04/10"
function formatDayKeyShort(key) {
  if (!key) return '';
  const parts = String(key).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : key;
}

const isMissingRpcError = (err) => /could not find the function|erro 404/i.test(String((err && err.message) || ''));

const STORAGE_KEY = 'placa_qrcode_pro_data_v6';
const SETTINGS_KEY = 'placa_qrcode_pro_settings_v6';
// Guarda quantas placas existiam na última gravação do cache local; permite saber
// se o cache está COMPLETO ou é só o subconjunto reduzido do localStorage.
const CACHE_META_KEY = 'placa_qrcode_pro_cache_meta_v1';

// Credenciais padrão do Dono. Após o primeiro login, troque em Configurações > Credenciais.
const DEFAULT_ADMIN_USER = 'Matheus';
const DEFAULT_ADMIN_HASH = '48992b376198f6a96c4856c6479377108d0919dcd93c89af68bd961081068ce8';

const DEFAULT_SEED_PLAQUES = [];

class StorageService {
  constructor() {
    this.settings = this.loadSettings();
    this.plaques = [];
    this.plaquesMap = new Map(); // Índice O(1) por ID
    
    // Memoização de agregações
    this._isDirty = true;
    this._cachedBatches = null;
    this._cachedClients = null;
    this._cachedStats = null;
    this._saveDebounceTimer = null;

    // Estado de sincronização / confiabilidade do cache local
    this.syncState = 'idle';          // 'idle' | 'syncing' | 'offline'
    this.lastSyncAt = null;
    this._cloudSyncedAt = null;
    this.localCacheTrusted = false;   // true = o cache local tem TODAS as placas da última sincronização
    this._localReady = Promise.resolve();

    // Inicialização de dados
    this.initInitialData();
  }

  // Inicialização síncrona com fallback e posterior hidratação IndexedDB / Cloud
  initInitialData() {
    const local = this.loadLocalPlaques();
    this.setPlaquesInternal(local);
    // O localStorage só guarda tudo quando cabe (<= 2500 placas); acima disso
    // guarda um subconjunto, e mostrar esse subconjunto dava números errados.
    const meta = this.readCacheMeta();
    this.localCacheTrusted = local.length > 0 && Boolean(meta) && meta.total === local.length;
    this.hydrateFromIndexedDBAndCloud();
  }

  readCacheMeta() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(CACHE_META_KEY);
        return raw ? JSON.parse(raw) : null;
      }
    } catch (e) {}
    return null;
  }

  // Resolve quando o cache local (IndexedDB, que guarda TODAS as placas) terminou
  // de carregar, ou após o limite de tempo.
  whenLocalReady(timeoutMs = 2000) {
    return Promise.race([
      this._localReady,
      new Promise(resolve => setTimeout(resolve, timeoutMs))
    ]);
  }

  // Assinatura barata do conteúdo (independente da ordem) para saber se a
  // sincronização trouxe algo diferente do que já está na tela.
  getDataSignature() {
    let sum = 0;
    for (let i = 0; i < this.plaques.length; i++) {
      const p = this.plaques[i];
      const str = `${p.id}|${p.status}|${p.name}|${p.target_url}|${p.client_code}|${p.client_name}|${p.client_phone}|${p.scans_count}|${p.last_scan_at}|${p.pin}|${p.batch_name}`;
      let h = 5381;
      for (let j = 0; j < str.length; j++) h = ((h * 33) ^ str.charCodeAt(j)) >>> 0;
      sum = (sum + h) >>> 0;
    }
    return `${this.plaques.length}:${sum}`;
  }

  // Texto curto para a barra lateral: deixa claro quando os dados são frescos
  getSyncLabel() {
    if (this.syncState === 'syncing') return 'Atualizando…';
    const t = this.lastSyncAt || (this.readCacheMeta() || {}).savedAt;
    const hhmm = t ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    if (this.syncState === 'offline') return hhmm ? `Sem conexão · dados de ${hhmm}` : 'Sem conexão';
    return hhmm ? `Atualizado às ${hhmm}` : '';
  }

  setPlaquesInternal(plaquesArray) {
    const incoming = Array.isArray(plaquesArray) ? plaquesArray : [];
    // Uma placa por ID. Listas paginadas com ordenação instável podem trazer a
    // mesma placa em duas páginas; sem isso as contagens (placas, clientes,
    // leituras) saíam infladas, e o cache local nunca batia com o total salvo.
    const seen = new Set();
    this.plaques = [];
    this.plaquesMap.clear();
    for (let i = 0; i < incoming.length; i++) {
      const p = incoming[i];
      if (!p || !p.id) continue;
      const key = p.id.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      this.plaques.push(p);
      this.plaquesMap.set(key, p);
    }
    this.duplicatesDropped = incoming.length - this.plaques.length;
    this.invalidateCache();
  }

  invalidateCache() {
    this._isDirty = true;
    this._cachedBatches = null;
    this._cachedClients = null;
    this._cachedStats = null;
  }

  async hydrateFromIndexedDBAndCloud() {
    this._localReady = (async () => {
      try {
        // 1. IndexedDB guarda TODAS as placas da última sincronização
        const idbData = await idb.getAllPlaques();
        // Não sobrescreve dados que a nuvem já entregou enquanto isto carregava
        if (Array.isArray(idbData) && idbData.length > 0 && !this._cloudSyncedAt) {
          const meta = this.readCacheMeta();
          this.setPlaquesInternal(idbData);
          this.localCacheTrusted = !meta || meta.total === idbData.length;
        }
      } catch (e) {
        console.warn('Falha na hidratação IndexedDB:', e);
      }
    })();
    await this._localReady;

    // 2. Sincroniza com Supabase Cloud e API Local em segundo plano
    this.initCloudAndServerSync();
  }

  loadLocalPlaques() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('Falha ao ler localStorage:', e);
    }
    return [];
  }

  loadSettings() {
    const defaultSettings = {
      baseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://suaplaca.com',
      defaultPrefix: 'PLQ-',
      adminUsername: DEFAULT_ADMIN_USER,
      adminPasswordHash: DEFAULT_ADMIN_HASH,
      supabaseUrl: import.meta.env?.VITE_SUPABASE_URL || 'https://zhxtmrhrbtqbsjcbvaim.supabase.co',
      supabaseKey: import.meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qzS4vaixU3R0ILND8ejg0g_O-1_Rx2V'
    };
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem('placa_qrcode_pro_settings_v5');
        if (stored) {
          const parsed = JSON.parse(stored);
          const combined = { ...defaultSettings, ...parsed };
          
          if (combined.adminUsername === 'admin' || !combined.adminUsername) {
            combined.adminUsername = DEFAULT_ADMIN_USER;
          }
          if (combined.adminPasswordHash === '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918' || !combined.adminPasswordHash) {
            combined.adminPasswordHash = DEFAULT_ADMIN_HASH;
          }
          delete combined.adminPassword;
          return combined;
        }
      }
    } catch (e) {}
    return defaultSettings;
  }

  getAdminUsername() {
    return this.settings.adminUsername || DEFAULT_ADMIN_USER;
  }

  getAdminPasswordHash() {
    return this.settings.adminPasswordHash || DEFAULT_ADMIN_HASH;
  }

  async setAdminCredentials(newUsername, newPassword) {
    if (!newUsername || newUsername.trim().length < 2) {
      throw new Error('O nome de usuário deve ter pelo menos 2 caracteres.');
    }
    const updates = {
      adminUsername: newUsername.trim()
    };
    let newHash = null;
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 3) {
        throw new Error('A senha deve ter pelo menos 3 caracteres.');
      }
      newHash = await sha256Hex(newPassword.trim());
      updates.adminPasswordHash = newHash;
      delete updates.adminPassword;
    }
    this.saveSettings(updates);

    // Mantém a credencial espelhada no banco (admin_credentials) em
    // sincronia — sem isso, o login local continuaria funcionando mas
    // as escritas administrativas via RPC parariam (sessão nunca mais
    // seria emitida, pois admin_login compara com o hash antigo).
    const sessionToken = this.getAdminSessionToken();
    if (!sessionToken) {
      throw new Error('Credencial trocada aqui, mas sem sessão de administrador válida para confirmar no servidor — faça login de novo e troque outra vez, ou as próximas escritas administrativas vão falhar.');
    }
    try {
      await this.callRpc('admin_change_credentials', {
        p_token: sessionToken,
        p_new_username: newUsername.trim(),
        p_new_password_hash: newHash
      });
    } catch (e) {
      throw new Error('Credencial trocada aqui, mas NÃO foi confirmada no servidor: ' + e.message + ' Faça login de novo e troque outra vez.');
    }
    return true;
  }

  isAdminAuthenticated() {
    try {
      if (typeof window !== 'undefined') {
        const isSessionAuth = sessionStorage.getItem('placa_admin_auth_session');
        if (isSessionAuth) return true;

        const isLocalAuth = localStorage.getItem('placa_admin_auth_token');
        if (isLocalAuth) {
          try {
            const authData = JSON.parse(isLocalAuth);
            if (authData && authData.expiresAt && Date.now() < authData.expiresAt) {
              return true;
            } else {
              localStorage.removeItem('placa_admin_auth_token');
            }
          } catch (_) {
            if (isLocalAuth === 'true') return true;
          }
        }
      }
    } catch (e) {}
    return false;
  }

  async loginAdmin(username, password, rememberMe = true) {
    const currentUsername = this.getAdminUsername();
    const currentHash = this.getAdminPasswordHash();

    const inputHash = await sha256Hex(password);
    const isUserValid = String(username).trim().toLowerCase() === String(currentUsername).trim().toLowerCase();
    const isPassValid = inputHash === currentHash;

    if (isUserValid && isPassValid) {
      try {
        if (typeof window !== 'undefined') {
          const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);

          if (rememberMe) {
            const expiresAt = Date.now() + (1000 * 60 * 60 * 24 * 7); // 7 dias
            localStorage.setItem('placa_admin_auth_token', JSON.stringify({ token, expiresAt }));
          } else {
            sessionStorage.setItem('placa_admin_auth_session', token);
          }
        }
      } catch (e) {}

      // Obtém uma sessão validada no banco (admin_login) para autorizar
      // as escritas administrativas via RPC. Se estiver offline, o login
      // local ainda funciona, mas escritas na nuvem ficarão bloqueadas
      // até a próxima tentativa de sincronização com conexão disponível.
      try {
        const sessionToken = await this.callRpc('admin_login', {
          p_username: username,
          p_password_hash: inputHash
        });
        if (sessionToken) {
          this.setAdminSessionToken(sessionToken, rememberMe);
        }
      } catch (e) {
        console.warn('Aviso: não foi possível obter sessão de administrador no Supabase (offline?):', e);
      }

      return { success: true };
    }
    return { success: false, error: 'Usuário ou senha de Administrador incorretos.' };
  }

  logoutAdmin() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('placa_admin_auth_token');
        sessionStorage.removeItem('placa_admin_auth_session');
      }
    } catch (e) {}
    this.clearAdminSessionToken();
  }

  // Sessão de administrador validada no banco (RPC admin_login), usada
  // para autorizar escritas administrativas via Supabase RPC
  getAdminSessionToken() {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('placa_admin_session_token_v1') || sessionStorage.getItem('placa_admin_session_token_v1') || null;
      }
    } catch (e) {}
    return null;
  }

  setAdminSessionToken(token, persistent) {
    try {
      if (typeof window === 'undefined' || !token) return;
      if (persistent) {
        localStorage.setItem('placa_admin_session_token_v1', token);
      } else {
        sessionStorage.setItem('placa_admin_session_token_v1', token);
      }
    } catch (e) {}
  }

  clearAdminSessionToken() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('placa_admin_session_token_v1');
        sessionStorage.removeItem('placa_admin_session_token_v1');
      }
    } catch (e) {}
  }

  // Senha opcional do Portal do Cliente — sessão salva como
  // {code, token}, um slot só (um navegador = um negócio, na prática)
  getClientSessionInfo() {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('placa_client_session_v1');
        return raw ? JSON.parse(raw) : null;
      }
    } catch (e) {}
    return null;
  }

  setClientSessionInfo(code, token) {
    try {
      if (typeof window !== 'undefined' && code && token) {
        localStorage.setItem('placa_client_session_v1', JSON.stringify({ code, token }));
      }
    } catch (e) {}
  }

  clearClientSessionInfo() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('placa_client_session_v1');
      }
    } catch (e) {}
  }

  // Aceita telefone OU código invertido. Retorna o client_code CANÔNICO
  // se essa conta já tem senha configurada (usar esse valor, não o que
  // foi digitado, nas chamadas de client_login/client_set_password) ou
  // null (não encontrado, ou encontrado mas sem senha — acesso normal).
  async checkClientHasPassword(query) {
    try {
      const result = await this.callRpc('client_has_password', { p_query: query }, 5000);
      return result || null;
    } catch (e) {
      // Falha de rede não deve travar o acesso normal por telefone
      return null;
    }
  }

  // Busca as placas do cliente usando a sessão de senha já validada
  async fetchClientBySession(clientCode) {
    const session = this.getClientSessionInfo();
    if (!session || session.code !== clientCode || !session.token) return false;

    try {
      const rows = await this.callRpc('public_get_client_plaques_by_session', { p_token: session.token }, 5000);
      if (Array.isArray(rows) && rows.length > 0) {
        this.replaceClientPlaques(rows, this.getClientByCode(clientCode));
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Troca TODAS as placas locais de um cliente pelas que vieram da nuvem. Antes
  // só se somava/substituía as que chegavam, então uma placa nova do cliente
  // nunca aparecia e uma placa removida nunca sumia do cache dele. Campos que a
  // nuvem não devolve ao cliente (ex.: pin, no cache do admin) são preservados.
  replaceClientPlaques(rows, staleClient = null) {
    const staleIds = new Set();
    if (staleClient) (staleClient.plaques || []).forEach(p => staleIds.add(String(p.id).toUpperCase()));
    const oldById = new Map();
    rows.forEach(r => {
      const id = String(r.id).toUpperCase();
      staleIds.add(id);
      const old = this.plaquesMap.get(id);
      if (old) oldById.set(id, old);
    });

    this.plaques = this.plaques.filter(p => !staleIds.has(String(p.id).toUpperCase()));
    const merged = rows.map(r => {
      const old = oldById.get(String(r.id).toUpperCase());
      return old ? { ...old, ...r } : r;
    });
    this.plaques.unshift(...merged);

    this.plaquesMap.clear();
    for (const p of this.plaques) {
      if (p && p.id) this.plaquesMap.set(p.id.toUpperCase(), p);
    }
    this.invalidateCache();
    this.saveToDisk(this.plaques);
  }

  // Atualiza as placas de um cliente SEM senha direto da nuvem (telefone/código).
  // Devolve 'ok' | 'empty' | 'password_required' | 'error'. Em 'error' (sem rede)
  // o que já estava em cache continua valendo.
  async refreshClientFromCloud(query) {
    if (!query || !this.settings.supabaseUrl || !this.settings.supabaseKey) return 'error';
    const stale = this.getClientByCode(query);
    try {
      const rows = await this.callRpc('public_get_client_plaques', { p_query: String(query).trim() }, 5000);
      if (!Array.isArray(rows)) return 'error';
      if (rows.length === 0) return 'empty';
      this.replaceClientPlaques(rows, stale);
      return 'ok';
    } catch (e) {
      if (/PASSWORD_REQUIRED/.test(String((e && e.message) || ''))) return 'password_required';
      return 'error';
    }
  }

  async clientLogin(clientCode, password) {
    if (!password) return { success: false, error: 'Digite sua senha.' };
    const hash = await sha256Hex(password);
    let token;
    try {
      token = await this.callRpc('client_login', { p_client_code: clientCode, p_password_hash: hash }, 6000);
    } catch (e) {
      return { success: false, error: 'Não foi possível entrar agora. Verifique sua conexão e tente novamente.' };
    }
    if (!token) {
      return { success: false, error: 'Senha incorreta.' };
    }
    this.setClientSessionInfo(clientCode, token);
    const ok = await this.fetchClientBySession(clientCode);
    if (!ok) {
      return { success: false, error: 'Não foi possível carregar seus dados agora. Tente novamente.' };
    }
    return { success: true };
  }

  // Configura (ou troca — "esqueci minha senha" usa a mesma chamada) a
  // senha do cliente. O telefone é a prova de posse, validada no banco.
  async clientSetPassword(clientCode, phoneAttempt, newPassword) {
    if (!phoneAttempt || !phoneAttempt.trim()) {
      return { success: false, error: 'Informe seu telefone de contato.' };
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'A senha deve ter pelo menos 4 caracteres.' };
    }
    const hash = await sha256Hex(newPassword.trim());
    let token;
    try {
      token = await this.callRpc('client_set_password', {
        p_client_code: clientCode,
        p_phone_attempt: phoneAttempt.trim(),
        p_new_password_hash: hash
      }, 6000);
    } catch (err) {
      const msg = String(err && err.message || '');
      if (msg === 'PHONE_MISMATCH') {
        return { success: false, error: 'Esse telefone não confere com o cadastrado nesta conta.' };
      }
      return { success: false, error: 'Não foi possível configurar a senha agora. Verifique sua conexão e tente novamente.' };
    }
    if (!token) {
      return { success: false, error: 'Não foi possível confirmar. Tente novamente.' };
    }
    this.setClientSessionInfo(clientCode, token);
    return { success: true };
  }

  // Além de limpar a sessão, remove do cache local as placas desse
  // cliente — sem isso, "Sair" seria só cosmético para uma conta
  // protegida por senha: os dados continuariam visíveis no cache até
  // alguém apagar o navegador, mesmo depois de "sair".
  clientLogout(clientCode) {
    this.clearClientSessionInfo();
    if (this.clientScanStats) this.clientScanStats = {};
    if (clientCode) {
      const before = this.plaques.length;
      this.plaques = this.plaques.filter(p => (p.client_code || '') !== clientCode);
      if (this.plaques.length !== before) {
        this.plaquesMap.clear();
        for (const p of this.plaques) {
          if (p && p.id) this.plaquesMap.set(p.id.toUpperCase(), p);
        }
        this.invalidateCache();
        this.saveToDisk(this.plaques);
      }
    }
  }

  // "Esqueci meu PIN" — só funciona com sessão de senha válida (prova
  // quem é a pessoa sem precisar do PIN antigo). Reseta o PIN de UMA
  // placa específica, sempre confirmando no banco que ela pertence a
  // esse client_code.
  async clientResetPin(plaqueId, newPin) {
    const session = this.getClientSessionInfo();
    if (!session || !session.token) {
      return { success: false, error: 'Você precisa estar logado com sua senha para resetar o PIN. Configure uma senha primeiro.' };
    }
    if (!newPin || String(newPin).trim().length < 3) {
      return { success: false, error: 'O PIN deve ter pelo menos 3 caracteres.' };
    }
    try {
      await this.callRpc('client_reset_pin', {
        p_id: plaqueId,
        p_session_token: session.token,
        p_new_pin: String(newPin).trim()
      }, 6000);
    } catch (err) {
      const msg = String(err && err.message || '');
      if (msg === 'INVALID_SESSION') {
        return { success: false, error: 'Sua sessão expirou. Saia e entre novamente com sua senha.' };
      }
      if (msg === 'NOT_OWNER') {
        return { success: false, error: 'Essa plaquinha não pertence à sua conta.' };
      }
      if (msg === 'PLAQUE_NOT_FOUND') {
        return { success: false, error: 'Plaquinha não encontrada.' };
      }
      return { success: false, error: 'Não foi possível trocar o PIN agora. Verifique sua conexão e tente novamente.' };
    }

    const plaque = this.getPlaqueById(plaqueId);
    if (plaque) {
      plaque.pin = String(newPin).trim();
      this.saveToDisk(this.plaques);
    }
    return { success: true };
  }

  // Chamada genérica de função (RPC) do Supabase. Toda leitura/escrita
  // hoje passa por funções SECURITY DEFINER no banco em vez de acesso
  // direto à tabela `plaques` com a anon key.
  async callRpc(fnName, params = {}, timeoutMs = 6000) {
    if (!this.settings.supabaseUrl || !this.settings.supabaseKey) {
      throw new Error('Supabase não configurado.');
    }
    const res = await this.fetchWithTimeout(`${this.settings.supabaseUrl}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'apikey': this.settings.supabaseKey,
        'Authorization': `Bearer ${this.settings.supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    }, timeoutMs);

    if (!res.ok) {
      let message = `Erro ${res.status} ao chamar ${fnName}.`;
      try {
        const errBody = await res.json();
        if (errBody && errBody.message) message = errBody.message;
      } catch (e) {}
      throw new Error(message);
    }
    return res.json();
  }

  // Sincroniza uma lista de placas com o Supabase via RPC administrativa
  // (exige sessão de admin válida — substitui o antigo POST direto na tabela)
  async syncPlaquesAsAdmin(plaquesArray) {
    if (!Array.isArray(plaquesArray) || plaquesArray.length === 0) return;
    const token = this.getAdminSessionToken();
    if (!token) {
      throw new Error('Sessão de administrador ausente ou expirada. Faça login novamente para sincronizar com a nuvem.');
    }
    const CHUNK_SIZE = 250;
    for (let i = 0; i < plaquesArray.length; i += CHUNK_SIZE) {
      const chunk = plaquesArray.slice(i, i + CHUNK_SIZE);
      await this.callRpc('admin_upsert_plaques', { p_token: token, p_rows: chunk }, 8000);
    }
  }

  async fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async initServerSync() {
    return this.initCloudAndServerSync();
  }

  async initCloudAndServerSync() {
    if (this._syncPromise) {
      return this._syncPromise;
    }

    this.syncState = 'syncing';
    this._syncPromise = (async () => {
      // 1. Só baixa a tabela inteira (com dados de clientes) se houver uma
      //    sessão de administrador válida — visitantes públicos (scan,
      //    ativação, portal do cliente) usam funções RPC específicas e
      //    nunca precisam do dump completo da tabela.
      const adminToken = this.getAdminSessionToken();
      if (adminToken && this.settings.supabaseUrl && this.settings.supabaseKey) {
        try {
          const allCloudData = [];
          let offset = 0;
          const pageSize = 1000;
          let hasMore = true;

          while (hasMore) {
            const batch = await this.callRpc('admin_list_plaques', {
              p_token: adminToken,
              p_limit: pageSize,
              p_offset: offset
            }, 8000);

            if (!Array.isArray(batch) || batch.length === 0) {
              hasMore = false;
              break;
            }

            allCloudData.push(...batch);

            if (batch.length < pageSize) {
              hasMore = false;
            } else {
              offset += pageSize;
            }
          }

          if (allCloudData.length > 0) {
            this.setPlaquesInternal(allCloudData);
            this.saveToDisk(this.plaques);
            this.localCacheTrusted = true;
            this._cloudSyncedAt = Date.now();
            this.lastSyncAt = this._cloudSyncedAt;
            this.syncState = 'idle';

            // Sincroniza com a API local em segundo plano
            fetch('/api/plaques/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(allCloudData)
            }).catch(() => {});

            return allCloudData;
          }
        } catch (err) {
          console.warn('Modo offline / fallback:', err);
        }
      }

      // 2. Se falhar ou estiver offline, tenta API local
      try {
        const res = await this.fetchWithTimeout('/api/plaques', {}, 2000);
        if (res.ok) {
          const serverData = await res.json();
          if (Array.isArray(serverData) && serverData.length > 0) {
            this.setPlaquesInternal(serverData);
            this.saveToDisk(this.plaques);
            return serverData;
          }
        }
      } catch (e) {}

      return this.plaques;
    })().finally(() => {
      // Não chegou dado novo da nuvem (sem sessão de admin, sem rede ou erro)
      if (this.syncState === 'syncing') {
        this.syncState = this.getAdminSessionToken() ? 'offline' : 'idle';
      }
      this._syncPromise = null;
    });

    return this._syncPromise;
  }

  // Persistência com IndexedDB e Fallback seguro para LocalStorage
  saveToDisk(plaques) {
    const targetPlaques = plaques || this.plaques;
    
    // 1. Persistência Assíncrona no IndexedDB (Suporta 100.000+ registros)
    idb.saveAllPlaques(targetPlaques).catch(() => {});
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CACHE_META_KEY, JSON.stringify({ total: targetPlaques.length, savedAt: Date.now() }));
      }
    } catch (e) {}

    // 2. Fallback no LocalStorage com proteção contra QuotaExceededError
    try {
      if (typeof localStorage !== 'undefined') {
        if (targetPlaques.length <= 2500) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(targetPlaques));
        } else {
          // Se for muito grande (>2500 placas), salva um subset recente para não estourar o localStorage
          const safeSubset = targetPlaques.slice(0, 1000);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSubset));
        }
      }
    } catch (e) {
      console.warn('Aviso: Quota do localStorage atingida. Dados salvos com sucesso no IndexedDB.', e.message);
    }
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      }
      idb.setKV('settings', this.settings).catch(() => {});
    } catch (e) {}
  }

  getAllPlaques() {
    return this.plaques;
  }

  // Memoizado com O(N) single pass
  getBatches() {
    if (!this._isDirty && this._cachedBatches) {
      return this._cachedBatches;
    }

    const batchMap = new Map();
    const len = this.plaques.length;

    for (let i = 0; i < len; i++) {
      const p = this.plaques[i];
      const name = (p.batch_name && p.batch_name.trim()) ? p.batch_name.trim() : 'Lote Geral';
      
      let b = batchMap.get(name);
      if (!b) {
        b = {
          name: name,
          count: 0,
          active: 0,
          virgin: 0,
          totalScans: 0,
          firstId: p.id,
          lastId: p.id,
          created_at: p.created_at,
          plaques: []
        };
        batchMap.set(name, b);
      }

      b.count++;
      if (p.status === 'active') b.active++;
      else if (p.status === 'virgin') b.virgin++;
      b.totalScans += (p.scans_count || 0);
      b.lastId = p.id;
      b.plaques.push(p);
    }

    this._cachedBatches = Array.from(batchMap.values());
    return this._cachedBatches;
  }

  getPlaquesByBatch(batchName) {
    if (!batchName || batchName === 'all') return this.getAllPlaques();
    const cleanName = batchName.trim().toLowerCase();
    const result = [];
    const len = this.plaques.length;
    for (let i = 0; i < len; i++) {
      const p = this.plaques[i];
      const pBatch = (p.batch_name && p.batch_name.trim()) ? p.batch_name.trim().toLowerCase() : 'lote geral';
      if (pBatch === cleanName) {
        result.push(p);
      }
    }
    return result;
  }

  // Memoizado com O(N) single pass
  getClients() {
    if (!this._isDirty && this._cachedClients) {
      return this._cachedClients;
    }

    const clientMap = new Map();
    const len = this.plaques.length;

    for (let i = 0; i < len; i++) {
      const p = this.plaques[i];
      const phone = (p.client_phone && p.client_phone.trim()) ? p.client_phone.trim() : '';
      const code = (p.client_code && p.client_code.trim()) 
        ? p.client_code.trim() 
        : (phone ? getReversedPhoneCode(phone) : null);

      if (!code && !p.client_name && !phone) continue;

      const key = code || phone || p.client_name;
      let c = clientMap.get(key);
      if (!c) {
        c = {
          client_code: code || getReversedPhoneCode(phone) || 'SEM-CODIGO',
          name: p.client_name || p.name || 'Cliente Sem Nome',
          phone: phone,
          count: 0,
          active: 0,
          virgin: 0,
          totalScans: 0,
          plaques: []
        };
        clientMap.set(key, c);
      }

      c.count++;
      if (p.status === 'active') c.active++;
      else if (p.status === 'virgin') c.virgin++;
      c.totalScans += (p.scans_count || 0);
      c.plaques.push(p);
    }

    this._cachedClients = Array.from(clientMap.values());
    return this._cachedClients;
  }

  getClientByCode(codeOrPhone) {
    if (!codeOrPhone) return null;
    const clean = String(codeOrPhone).trim();
    const cleanDigits = clean.replace(/\D/g, '');
    const reversed = cleanDigits ? cleanDigits.split('').reverse().join('') : '';

    const clients = this.getClients();
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      const cDigits = c.phone ? c.phone.replace(/\D/g, '') : '';
      const cCode = c.client_code ? String(c.client_code).trim() : '';
      if (
        cCode === clean ||
        cCode === cleanDigits ||
        cCode === reversed ||
        cDigits === clean ||
        cDigits === cleanDigits ||
        cDigits === reversed
      ) {
        return c;
      }
    }
    return null;
  }

  getPlaquesByClient(codeOrPhone) {
    const client = this.getClientByCode(codeOrPhone);
    if (!client) return [];
    return client.plaques;
  }

  // Lookup O(1) instantâneo via Map
  getPlaqueById(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toUpperCase();
    return this.plaquesMap.get(cleanId) || null;
  }

  // Calcula o próximo número sequencial verdadeiramente disponível para um prefixo
  getNextAvailableNumber(prefix = 'PLQ-') {
    const cleanPrefix = String(prefix || 'PLQ-').toUpperCase().trim();
    let maxNumber = 0;

    for (let i = 0; i < this.plaques.length; i++) {
      const pId = (this.plaques[i]?.id || '').toUpperCase();
      if (pId.startsWith(cleanPrefix)) {
        const numPart = pId.substring(cleanPrefix.length).replace(/\D/g, '');
        if (numPart) {
          const val = parseInt(numPart, 10);
          if (!isNaN(val) && val > maxNumber) {
            maxNumber = val;
          }
        }
      }
    }

    return maxNumber + 1;
  }

  // Validação prévia de disponibilidade de intervalo de IDs
  checkRangeAvailability(prefix = 'PLQ-', startNumber = 1, count = 10) {
    const cleanPrefix = String(prefix || 'PLQ-').toUpperCase().trim();
    const currentNum = parseInt(startNumber, 10) || 1;
    const totalCount = Math.max(1, parseInt(count, 10) || 1);
    const endNum = currentNum + totalCount - 1;
    const padLength = Math.max(3, String(endNum).length);

    const existingIds = [];
    const firstId = `${cleanPrefix}${String(currentNum).padStart(padLength, '0')}`;
    const lastId = `${cleanPrefix}${String(endNum).padStart(padLength, '0')}`;

    for (let i = 0; i < totalCount; i++) {
      const num = currentNum + i;
      const formattedNum = String(num).padStart(padLength, '0');
      const plaqueId = `${cleanPrefix}${formattedNum}`;

      // Verifica no formato atual e também em variações de padding comuns (3 e 4 dígitos)
      if (
        this.plaquesMap.has(plaqueId) ||
        this.plaquesMap.has(`${cleanPrefix}${String(num).padStart(3, '0')}`) ||
        this.plaquesMap.has(`${cleanPrefix}${String(num).padStart(4, '0')}`)
      ) {
        existingIds.push(plaqueId);
      }
    }

    return {
      available: existingIds.length === 0,
      existingIds,
      firstId,
      lastId,
      totalRequested: totalCount,
      availableCount: totalCount - existingIds.length,
      suggestedStart: this.getNextAvailableNumber(cleanPrefix)
    };
  }

  // Criação em Massa Ultra Otimizada com Proteção Anti-Colisão
  async createBatch({ prefix = 'PLQ-', startNumber, count = 10, batchName = 'Lote 01', collisionMode = 'auto-next' }) {
    const cleanPrefix = String(prefix || 'PLQ-').toUpperCase().trim();
    const cleanBatchName = String(batchName || 'Lote').trim();
    let currentNum = parseInt(startNumber, 10);

    if (isNaN(currentNum) || currentNum < 1) {
      currentNum = this.getNextAvailableNumber(cleanPrefix);
    }

    const totalCount = Math.max(1, parseInt(count, 10) || 10);

    // Verificação de colisão
    const availability = this.checkRangeAvailability(cleanPrefix, currentNum, totalCount);

    if (!availability.available) {
      if (collisionMode === 'error') {
        const conflictSample = availability.existingIds.slice(0, 4).join(', ');
        const extra = availability.existingIds.length > 4 ? ` e mais ${availability.existingIds.length - 4}` : '';
        throw new Error(`Conflito de códigos: [${conflictSample}${extra}] já existem no sistema. Utilize o próximo número livre sugerido: #${availability.suggestedStart}.`);
      } else if (collisionMode === 'auto-next') {
        // Ajusta automaticamente para o próximo número livre
        currentNum = availability.suggestedStart;
      }
    }

    const newPlaques = [];
    const endNum = currentNum + totalCount - 1;
    const padLength = Math.max(3, String(endNum).length);
    const nowIso = new Date().toISOString();

    for (let i = 0; i < totalCount; i++) {
      const num = currentNum + i;
      const formattedNum = String(num).padStart(padLength, '0');
      const plaqueId = `${cleanPrefix}${formattedNum}`;

      // Garante que não duplica se já existir
      if (!this.plaquesMap.has(plaqueId)) {
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        const plaque = {
          id: plaqueId,
          name: '',
          status: 'virgin',
          target_url: '',
          pin: pin,
          client_name: '',
          client_phone: '',
          client_code: '',
          created_at: nowIso,
          activated_at: null,
          scans_count: 0,
          last_scan_at: null,
          batch_name: cleanBatchName
        };
        newPlaques.push(plaque);
        this.plaquesMap.set(plaqueId, plaque);
      }
    }

    if (newPlaques.length === 0) {
      const nextFree = this.getNextAvailableNumber(cleanPrefix);
      throw new Error(`Nenhum código novo foi gerado pois os IDs solicitados já existem. Utilize o próximo número disponível: #${nextFree}.`);
    }

    // Prepend dos novos itens
    this.plaques = [...newPlaques, ...this.plaques];
    this.invalidateCache();

    // Persistência assíncrona local (IndexedDB + LocalStorage)
    this.saveToDisk(this.plaques);

    // Sincroniza com a nuvem via RPC administrativa. Precisa esperar e
    // propagar falha: se isso não chegar no banco, as placas físicas
    // impressas a partir do ZIP baixado a seguir simplesmente não
    // existiriam de verdade — o cliente escanearia e cairia em "não
    // encontrado" para sempre.
    try {
      await this.syncPlaquesAsAdmin(newPlaques);
    } catch (err) {
      // Desfaz a inserção local, já que o lote não existe de verdade na nuvem
      const newIds = new Set(newPlaques.map(p => p.id.toUpperCase()));
      this.plaques = this.plaques.filter(p => !newIds.has(p.id.toUpperCase()));
      newIds.forEach(id => this.plaquesMap.delete(id));
      this.invalidateCache();
      this.saveToDisk(this.plaques);
      throw new Error('Não foi possível salvar o novo lote no servidor: ' + err.message + ' Nada foi criado — tente novamente.');
    }

    try {
      fetch('/api/plaques/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlaques)
      }).catch(() => {});
    } catch (e) {}

    return newPlaques;
  }

  // Exclusão completa de lote (Sincronizado com IndexedDB, LocalStorage, Supabase Cloud e Servidor)
  // Apaga PRIMEIRO no Supabase e só remove localmente se der certo — na
  // ordem antiga, a exclusão local acontecia sempre, e a exclusão no
  // banco era fire-and-forget (só console.warn se falhasse). Isso podia
  // mostrar um lote como "excluído" no painel enquanto continuava
  // 100% ativo no banco de verdade.
  async deleteBatch(batchName) {
    if (!batchName) return { success: false, error: 'Nome do lote inválido.' };
    const cleanName = String(batchName).trim().toLowerCase();

    const matching = this.plaques.filter(p => (p.batch_name || 'Lote Geral').trim().toLowerCase() === cleanName);
    if (matching.length === 0) {
      return { success: false, error: 'Nenhuma plaquinha encontrada neste lote.' };
    }

    const token = this.getAdminSessionToken();
    if (!token) {
      return { success: false, error: 'Sessão de administrador ausente ou expirada. Faça login novamente e tente de novo.' };
    }
    try {
      await this.callRpc('admin_delete_by_batch', { p_token: token, p_batch_name: batchName.trim() }, 8000);
    } catch (e) {
      return { success: false, error: 'Não foi possível excluir no servidor: ' + e.message };
    }

    const matchingIds = new Set(matching.map(p => p.id.toUpperCase()));
    this.plaques = this.plaques.filter(p => !matchingIds.has(p.id.toUpperCase()));
    matchingIds.forEach(id => this.plaquesMap.delete(id));
    this.invalidateCache();
    this.saveToDisk(this.plaques);

    try {
      fetch(`/api/batches/${encodeURIComponent(batchName.trim())}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    return { success: true, count: matching.length };
  }

  // Exclusão de uma única placa (mesma ordem: banco primeiro, local depois)
  async deletePlaque(plaqueId) {
    if (!plaqueId) return { success: false, error: 'ID da placa inválido.' };
    const cleanId = String(plaqueId).trim().toUpperCase();

    if (!this.plaquesMap.has(cleanId)) {
      return { success: false, error: 'Plaquinha não encontrada.' };
    }

    const token = this.getAdminSessionToken();
    if (!token) {
      return { success: false, error: 'Sessão de administrador ausente ou expirada. Faça login novamente e tente de novo.' };
    }
    try {
      await this.callRpc('admin_delete_by_id', { p_token: token, p_id: cleanId }, 4000);
    } catch (e) {
      return { success: false, error: 'Não foi possível excluir no servidor: ' + e.message };
    }

    this.plaquesMap.delete(cleanId);
    this.plaques = this.plaques.filter(p => (p.id || '').toUpperCase() !== cleanId);
    this.invalidateCache();
    this.saveToDisk(this.plaques);

    try {
      fetch(`/api/plaques/${encodeURIComponent(cleanId)}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    return { success: true };
  }

  // Busca direta de plaquinha no Supabase Cloud via RPC pública (não expõe o PIN)
  async fetchPlaqueFromCloud(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toUpperCase();
    const local = this.getPlaqueById(cleanId);
    if (local) return local;

    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      try {
        const rows = await this.callRpc('public_get_plaque', { p_id: cleanId }, 3500);
        const cloudPlaque = Array.isArray(rows) ? rows[0] : rows;
        if (cloudPlaque && cloudPlaque.id) {
          const upperId = cloudPlaque.id.toUpperCase();
          this.plaquesMap.set(upperId, cloudPlaque);
          this.plaques = this.plaques.filter(p => p.id.toUpperCase() !== upperId);
          this.plaques.unshift(cloudPlaque);
          this.invalidateCache();
          this.saveToDisk(this.plaques);
          return cloudPlaque;
        }
      } catch (e) {}
    }
    return null;
  }

  // Busca o estado ATUAL da placa direto do servidor, ignorando o cache
  // local (diferente de fetchPlaqueFromCloud, que usa o cache se já
  // tiver algo salvo). Usado só na decisão de redirecionamento: sem
  // isso, um navegador que já tinha a placa em cache (ex: o admin, que
  // sincroniza o catálogo inteiro ao logar) continuava redirecionando
  // pro link antigo mesmo depois da placa ser editada/resetada em outro
  // lugar, porque nunca voltava a checar o servidor.
  async fetchFreshPlaqueForRedirect(id) {
    if (!id || !this.settings.supabaseUrl || !this.settings.supabaseKey) return null;
    try {
      const rows = await this.callRpc('public_get_plaque', { p_id: id }, 4000);
      const fresh = Array.isArray(rows) ? rows[0] : rows;
      return fresh && fresh.id ? fresh : null;
    } catch (e) {
      return null;
    }
  }

  // Busca direta de cliente no Supabase Cloud via RPC pública
  async fetchClientFromCloud(codeOrPhone) {
    if (!codeOrPhone) return null;
    const local = this.getClientByCode(codeOrPhone);
    if (local) return local;

    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      try {
        const rows = await this.callRpc('public_get_client_plaques', { p_query: String(codeOrPhone).trim() }, 3500);
        if (Array.isArray(rows) && rows.length > 0) {
          rows.forEach(p => {
            const upperId = p.id.toUpperCase();
            this.plaquesMap.set(upperId, p);
            // Substitui qualquer entrada local desatualizada (não só
            // adiciona se ausente) — sem isso, um cache local obsoleto
            // (ex: placa ainda "virgem" antes de ativar) nunca era
            // atualizado com o estado real vindo da nuvem.
            this.plaques = this.plaques.filter(item => item.id.toUpperCase() !== upperId);
            this.plaques.unshift(p);
          });
          this.invalidateCache();
          this.saveToDisk(this.plaques);
          return this.getClientByCode(codeOrPhone);
        }
      } catch (e) {}
    }
    return null;
  }

  // Ativação/edição pública de placa. O PIN agora é validado DENTRO do
  // banco (função public_activate_plaque), não mais só no navegador —
  // chamar a API do Supabase direto com a anon key não basta mais para
  // sequestrar uma placa já ativa.
  async activatePlaque(id, { name, targetUrl, pin, clientName, clientPhone, clientCode }) {
    let plaque = this.getPlaqueById(id);
    if (!plaque) {
      plaque = await this.fetchPlaqueFromCloud(id);
    }
    if (!plaque) return { success: false, error: 'Código de plaquinha não encontrado.' };

    const cleanUrl = sanitizeUrl(targetUrl);
    if (!isValidHttpUrl(cleanUrl)) {
      return { success: false, error: 'Link de avaliação inválido. Insira um link válido (ex: https://g.page/r/... ou link da sua empresa).' };
    }

    const calculatedCode = clientCode || (clientPhone ? getReversedPhoneCode(clientPhone) : (plaque.client_code || ''));

    let serverResult;
    try {
      const rows = await this.callRpc('public_activate_plaque', {
        p_id: id,
        p_pin_attempt: pin || null,
        p_name: name || null,
        p_target_url: cleanUrl,
        p_client_name: clientName || null,
        p_client_phone: clientPhone || null,
        p_client_code: calculatedCode || null,
        p_new_pin: pin || null
      }, 6000);
      serverResult = Array.isArray(rows) ? rows[0] : rows;
    } catch (err) {
      const msg = String(err && err.message || '');
      if (msg === 'INVALID_PIN') {
        return { success: false, error: 'PIN de segurança obrigatório ou incorreto para alterar esta plaquinha.' };
      }
      if (msg === 'PLAQUE_NOT_FOUND') {
        return { success: false, error: 'Código de plaquinha não encontrado.' };
      }
      if (msg === 'INVALID_URL') {
        return { success: false, error: 'Link de avaliação inválido. Insira um link válido.' };
      }
      return { success: false, error: 'Não foi possível ativar agora. Verifique sua conexão e tente novamente.' };
    }

    if (!serverResult) {
      return { success: false, error: 'Não foi possível confirmar a ativação. Tente novamente.' };
    }

    Object.assign(plaque, serverResult);
    if (pin) plaque.pin = String(pin).trim();

    this.invalidateCache();
    idb.putPlaque(plaque).catch(() => {});
    this.saveToDisk(this.plaques);

    return { success: true, plaque };
  }

  // Edição feita de dentro do painel administrativo (sem PIN — protegida
  // pela sessão de admin validada no banco via admin_upsert_plaques)
  async updatePlaque(id, updates) {
    let plaque = this.getPlaqueById(id);
    if (!plaque) {
      plaque = await this.fetchPlaqueFromCloud(id);
    }
    if (!plaque) return null;

    if (updates.target_url) {
      updates.target_url = sanitizeUrl(updates.target_url);
      if (!isValidHttpUrl(updates.target_url)) {
        throw new Error('Link de destino inválido. Use um link válido.');
      }
    }

    Object.assign(plaque, updates);
    this.invalidateCache();

    idb.putPlaque(plaque).catch(() => {});
    this.saveToDisk(this.plaques);

    // IMPORTANTE: precisa esperar e propagar falha daqui. Antes essa
    // chamada era fire-and-forget (só console.warn) — a tela mostrava
    // a alteração como salva mesmo quando a sessão de admin estava
    // ausente/expirada e a escrita real no Supabase nunca acontecia.
    // Resultado real: um "reset" parecia funcionar no painel, mas o
    // cliente continuava sendo redirecionado pro link antigo, porque
    // o banco nunca foi atualizado de verdade.
    try {
      await this.syncPlaquesAsAdmin([plaque]);
    } catch (err) {
      throw new Error('Alterado aqui, mas NÃO foi salvo no servidor: ' + err.message + ' Tente novamente.');
    }

    return plaque;
  }

  // Sem pinAttempt: reset feito pelo admin (exige sessão de admin, via
  // updatePlaque/syncPlaquesAsAdmin). Com pinAttempt: o próprio cliente
  // apagando a placa dele pelo Portal — validado no banco via RPC
  // pública, sem exigir sessão de administrador.
  async resetPlaque(id, pinAttempt = null) {
    if (pinAttempt) {
      let rows;
      try {
        rows = await this.callRpc('public_reset_plaque', { p_id: id, p_pin_attempt: pinAttempt });
      } catch (err) {
        const msg = String(err && err.message || '');
        if (msg === 'INVALID_PIN') {
          throw new Error('PIN de segurança incorreto.');
        }
        if (msg === 'PLAQUE_NOT_FOUND') {
          throw new Error('Plaquinha não encontrada.');
        }
        throw new Error('Não foi possível apagar agora. Verifique sua conexão e tente novamente.');
      }

      const result = Array.isArray(rows) ? rows[0] : rows;
      if (!result) {
        throw new Error('Não foi possível confirmar a exclusão. Tente novamente.');
      }

      const plaque = this.getPlaqueById(id);
      const resetFields = {
        name: '',
        status: 'virgin',
        target_url: '',
        client_name: '',
        client_phone: '',
        client_code: '',
        activated_at: null,
        pin: '1234'
      };
      if (plaque) {
        Object.assign(plaque, resetFields);
        this.invalidateCache();
        idb.putPlaque(plaque).catch(() => {});
        this.saveToDisk(this.plaques);
      }
      return plaque;
    }

    return this.updatePlaque(id, {
      name: '',
      status: 'virgin',
      target_url: '',
      client_name: '',
      client_phone: '',
      client_code: '',
      activated_at: null,
      pin: '1234'
    });
  }

  async recordScan(id) {
    const plaque = this.getPlaqueById(id);
    if (plaque) {
      plaque.scans_count = (plaque.scans_count || 0) + 1;
      plaque.last_scan_at = new Date().toISOString();
      this.invalidateCache();

      idb.putPlaque(plaque).catch(() => {});
      
      // Debounce saveToDisk ao receber múltiplos scans
      if (!this._saveDebounceTimer) {
        this._saveDebounceTimer = setTimeout(() => {
          this.saveToDisk(this.plaques);
          this._saveDebounceTimer = null;
        }, 500);
      }

      this.callRpc('public_record_scan', { p_id: id }).catch(() => {});

      try {
        fetch('/api/plaques', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plaque)
        }).catch(() => {});
      } catch (e) {}
    }
  }

  // Estatísticas agregadas instantâneas em O(N) com memoização
  getStats() {
    if (!this._isDirty && this._cachedStats) {
      return this._cachedStats;
    }

    let active = 0;
    let virgin = 0;
    let totalScans = 0;
    const total = this.plaques.length;

    for (let i = 0; i < total; i++) {
      const p = this.plaques[i];
      if (p.status === 'active') active++;
      else if (p.status === 'virgin') virgin++;
      totalScans += (p.scans_count || 0);
    }

    this._cachedStats = { total, active, virgin, totalScans };
    return this._cachedStats;
  }

  // Histórico real de leituras (admin). Devolve true quando buscou dados novos
  // na nuvem (a tela então se redesenha); false se usou cache ou não há como.
  // Se o SQL do histórico ainda não foi rodado no Supabase, desliga a busca
  // nesta sessão e o painel continua com o comportamento antigo.
  async fetchAdminScanStats() {
    if (this._scanStatsUnavailable) return false;
    const token = this.getAdminSessionToken();
    if (!token) return false;
    const cached = this.adminScanStats;
    if (cached && Date.now() - cached.fetchedAt < 60000) return false;
    if (this._adminScanStatsPromise) return this._adminScanStatsPromise;

    this._adminScanStatsPromise = (async () => {
      try {
        const data = await this.callRpc('admin_scan_stats', { p_token: token, p_days: 45 }, 8000);
        this.adminScanStats = {
          since: (data && data.since) || null,
          rows: Array.isArray(data && data.rows) ? data.rows : [],
          fetchedAt: Date.now()
        };
        return true;
      } catch (err) {
        if (isMissingRpcError(err)) this._scanStatsUnavailable = true;
        // Falha registrada no cache: não martela o servidor a cada redesenho
        this.adminScanStats = { since: null, rows: null, fetchedAt: Date.now(), failed: true };
        return false;
      } finally {
        this._adminScanStatsPromise = null;
      }
    })();
    return this._adminScanStatsPromise;
  }

  // Histórico real de leituras de UM cliente (portal). Usa a sessão de senha
  // quando ela é DESSE cliente; senão consulta por telefone/código (contas
  // sem senha). Conta com senha e sem sessão: simplesmente não mostra.
  async fetchClientScanStats(clientCode) {
    if (this._scanStatsUnavailable || !clientCode) return false;
    this.clientScanStats = this.clientScanStats || {};
    this._clientScanStatsInFlight = this._clientScanStatsInFlight || {};

    const cached = this.clientScanStats[clientCode];
    if (cached && Date.now() - cached.fetchedAt < 60000) return false;
    if (this._clientScanStatsInFlight[clientCode]) return this._clientScanStatsInFlight[clientCode];

    this._clientScanStatsInFlight[clientCode] = (async () => {
      try {
        const session = this.getClientSessionInfo();
        let data = null;

        if (session && session.token && String(session.code) === String(clientCode)) {
          try {
            data = await this.callRpc('public_get_client_scan_stats_by_session', { p_token: session.token, p_days: 45 }, 8000);
          } catch (err) {
            if (isMissingRpcError(err)) throw err;
          }
        }
        if (!data) {
          data = await this.callRpc('public_get_client_scan_stats', { p_query: clientCode, p_days: 45 }, 8000);
        }

        this.clientScanStats[clientCode] = {
          since: (data && data.since) || null,
          rows: Array.isArray(data && data.rows) ? data.rows : [],
          fetchedAt: Date.now()
        };
        return true;
      } catch (err) {
        if (isMissingRpcError(err)) this._scanStatsUnavailable = true;
        // Ex.: conta com senha e sem sessão (PASSWORD_REQUIRED). Cacheia a falha.
        this.clientScanStats[clientCode] = { since: null, rows: null, fetchedAt: Date.now(), failed: true };
        return false;
      } finally {
        delete this._clientScanStatsInFlight[clientCode];
      }
    })();
    return this._clientScanStatsInFlight[clientCode];
  }

  // Métricas analíticas completas para o Dashboard do Dono
  getDashboardMetrics(daysCount = 14) {
    const isTodayMode = parseInt(daysCount, 10) === 1;
    const days = isTodayMode ? 1 : Math.max(3, Math.min(60, parseInt(daysCount, 10) || 14));
    const now = new Date();
    const todayStr = toLocalDateKey(now);
    
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = toLocalDateKey(yesterdayDate);

    const timelineMap = new Map();
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    if (isTodayMode) {
      // 8 faixas de horário para o dia de Hoje
      const slots = [
        { start: 0, end: 3, label: '00h às 03h (Madrugada)', shortLabel: '00h-03h' },
        { start: 3, end: 6, label: '03h às 06h (Madrugada)', shortLabel: '03h-06h' },
        { start: 6, end: 9, label: '06h às 09h (Manhã)', shortLabel: '06h-09h' },
        { start: 9, end: 12, label: '09h às 12h (Manhã)', shortLabel: '09h-12h' },
        { start: 12, end: 15, label: '12h às 15h (Tarde)', shortLabel: '12h-15h' },
        { start: 15, end: 18, label: '15h às 18h (Tarde)', shortLabel: '15h-18h' },
        { start: 18, end: 21, label: '18h às 21h (Noite)', shortLabel: '18h-21h' },
        { start: 21, end: 24, label: '21h às 24h (Noite)', shortLabel: '21h-24h' }
      ];
      slots.forEach((s, idx) => {
        timelineMap.set(String(idx), {
          slotIndex: idx,
          date: todayStr,
          label: s.label,
          shortLabel: s.shortLabel,
          dayName: 'Hoje',
          scans: 0,
          activations: 0,
          isToday: true
        });
      });
    } else {
      // Inicializa os N dias em ordem cronológica
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const isoDate = toLocalDateKey(d);
        const parts = isoDate.split('-');
        const formattedDayMonth = `${parts[2]}/${parts[1]}`;
        const dayName = dayNames[d.getDay()];
        
        let label = formattedDayMonth;
        if (isoDate === todayStr) label = `${formattedDayMonth} (Hoje)`;
        else if (isoDate === yesterdayStr) label = `${formattedDayMonth} (Ontem)`;

        timelineMap.set(isoDate, {
          date: isoDate,
          label,
          shortLabel: formattedDayMonth,
          dayName,
          scans: 0,
          activations: 0,
          isToday: isoDate === todayStr
        });
      }
    }

    let totalActive = 0;
    let totalVirgin = 0;
    let totalScans = 0;
    let todayScans = 0;
    let yesterdayScans = 0;
    let todayActivations = 0;
    let yesterdayActivations = 0;

    const clientsMap = new Map();
    const activePlaquesList = [];

    const total = this.plaques.length;
    for (let i = 0; i < total; i++) {
      const p = this.plaques[i];
      const scans = p.scans_count || 0;
      totalScans += scans;

      if (p.status === 'active') {
        totalActive++;
        activePlaquesList.push(p);

        let wasActivatedToday = false;
        if (p.activated_at) {
          const actDate = toLocalDateKey(p.activated_at);
          if (actDate === todayStr) {
            todayActivations++;
            wasActivatedToday = true;
            if (isTodayMode) {
              const hour = new Date(p.activated_at).getHours();
              const slotIdx = String(Math.min(7, Math.floor(hour / 3)));
              const slot = timelineMap.get(slotIdx);
              if (slot) slot.activations++;
            }
          }
          if (actDate === yesterdayStr) yesterdayActivations++;
          if (!isTodayMode && timelineMap.has(actDate)) {
            timelineMap.get(actDate).activations++;
          }
        }

        // Agrupamento para ranking de quem mais está ativando
        const clientName = (p.client_name && p.client_name.trim()) || 'Cliente Não Identificado';
        const clientPhone = (p.client_phone && p.client_phone.trim()) || '';
        const clientCode = (p.client_code && p.client_code.trim()) || (clientPhone ? getReversedPhoneCode(clientPhone) : '');
        const clientKey = clientCode || clientPhone || clientName;

        let clientStat = clientsMap.get(clientKey);
        if (!clientStat) {
          clientStat = {
            key: clientKey,
            name: clientName,
            phone: clientPhone,
            code: clientCode,
            activeCount: 0,
            todayActiveCount: 0,
            todayScans: 0,
            totalScans: 0,
            latestScanMs: 0,
            latestScanAt: null,
            latestActivation: p.activated_at || p.created_at || ''
          };
          clientsMap.set(clientKey, clientStat);
        }

        clientStat.activeCount++;
        if (wasActivatedToday) clientStat.todayActiveCount++;
        clientStat.totalScans += scans;
        if (p.last_scan_at) {
          const scanMs = Date.parse(p.last_scan_at);
          if (!Number.isNaN(scanMs) && scanMs > clientStat.latestScanMs) {
            clientStat.latestScanMs = scanMs;
            clientStat.latestScanAt = p.last_scan_at;
          }
        }
        if (p.activated_at && (!clientStat.latestActivation || p.activated_at > clientStat.latestActivation)) {
          clientStat.latestActivation = p.activated_at;
        }
      } else {
        totalVirgin++;
      }

      if (p.last_scan_at) {
        const scanDate = toLocalDateKey(p.last_scan_at);
        if (scanDate === todayStr) {
          todayScans += scans || 1;
          if (isTodayMode) {
            const hour = new Date(p.last_scan_at).getHours();
            const slotIdx = String(Math.min(7, Math.floor(hour / 3)));
            const slot = timelineMap.get(slotIdx);
            if (slot) slot.scans += scans || 1;
          }
        }
        if (scanDate === yesterdayStr) yesterdayScans += scans || 1;
        if (!isTodayMode && timelineMap.has(scanDate)) {
          timelineMap.get(scanDate).scans += scans || 1;
        }
      }
    }

    // Histórico real (scan_events): substitui a aproximação por "última leitura"
    // (que jogava o total acumulado da placa inteiro no dia da última leitura).
    const eventStats = this.adminScanStats;
    let scanSource = 'estimate';
    let scanHistorySince = null;
    let yesterdayNoHistory = false;
    if (eventStats && Array.isArray(eventStats.rows)) {
      scanSource = 'events';
      scanHistorySince = eventStats.since || null;
      const sinceKey = scanHistorySince ? toLocalDateKey(scanHistorySince) : null;

      timelineMap.forEach(slot => { slot.scans = 0; });
      todayScans = 0;
      yesterdayScans = 0;

      for (const r of eventStats.rows) {
        const n = Number(r.n) || 0;
        if (r.d === todayStr) {
          todayScans += n;
          if (isTodayMode) {
            const slot = timelineMap.get(String(Math.min(7, Math.floor(Number(r.h) / 3))));
            if (slot) slot.scans += n;
          }
        }
        if (r.d === yesterdayStr) yesterdayScans += n;
        if (!isTodayMode && timelineMap.has(r.d)) timelineMap.get(r.d).scans += n;
      }

      // Dias anteriores ao início do histórico: sem dado (não é "zero leituras")
      if (!isTodayMode) {
        timelineMap.forEach(slot => { slot.noHistory = !sinceKey || slot.date < sinceKey; });
      }
      yesterdayNoHistory = !sinceKey || yesterdayStr < sinceKey;
    }

    // Ranking ordenado de clientes
    const topClients = Array.from(clientsMap.values())
      .sort((a, b) => {
        if (isTodayMode) {
          if (b.todayActiveCount !== a.todayActiveCount) return b.todayActiveCount - a.todayActiveCount;
        }
        return b.activeCount - a.activeCount || b.totalScans - a.totalScans;
      })
      .map((c, index) => ({
        rank: index + 1,
        ...c,
        percentOfTotalActive: totalActive > 0 ? ((c.activeCount / totalActive) * 100).toFixed(1) : '0.0'
      }));

    // CIÊNCIA DE DADOS ADMIN: Radar de Saúde da Carteira & Detector de Churn
    const nowTimestamp = now.getTime();
    const clientHealthMatrix = {
      power: [],       // Campeões / Power Users
      accelerating: [],// Acelerando / Recentes
      stable: [],      // Estáveis / Regulares
      atRisk: []       // Em Risco / Dormentes (7+ dias sem leitura)
    };

    // Telefone no formato do wa.me: DDI 55 só é prefixado quando o número
    // ainda não o tem (12+ dígitos). Número com 10/11 dígitos que começa
    // com "55" é DDD 55 (RS), não DDI.
    const toWhatsAppNumber = (rawPhone) => {
      const digits = String(rawPhone || '').replace(/\D/g, '');
      if (digits.length < 10) return '';
      return digits.length >= 12 && digits.startsWith('55') ? digits : `55${digits}`;
    };
    const firstName = (fullName) => String(fullName || '').trim().split(/\s+/)[0] || 'cliente';

    topClients.forEach(c => {
      // Última leitura já agregada no loop principal (O(N)), por cliente
      const daysSinceScan = c.latestScanMs > 0
        ? Math.max(0, Math.floor((nowTimestamp - c.latestScanMs) / (1000 * 60 * 60 * 24)))
        : null;

      // Dormência vem primeiro: um cliente com muitas leituras históricas
      // mas parado há semanas precisa aparecer em "Em Risco", não em "Campeão".
      let category;
      let waMessage;
      const nome = firstName(c.name);
      if (daysSinceScan === null) {
        category = 'atRisk';
        waMessage = `Olá ${nome}! Aqui é do Rei do NFC. Sua plaquinha ainda não registrou nenhuma leitura. Posso te ajudar a testar e a escolher o melhor lugar para ela no balcão?`;
      } else if (daysSinceScan > 7) {
        category = 'atRisk';
        waMessage = `Olá ${nome}! Aqui é do Rei do NFC. Vi que sua plaquinha está sem leituras há ${daysSinceScan} dias. Está tudo certo por aí? Posso te ajudar a conferir o link ou o posicionamento dela.`;
      } else if (c.totalScans >= 40) {
        category = 'power';
        waMessage = `Olá ${nome}! Aqui é do Rei do NFC. Sua empresa já passou de ${c.totalScans} leituras! Se quiser, posso te passar condições para colocar plaquinhas em outras mesas ou filiais.`;
      } else if (daysSinceScan <= 3) {
        category = 'accelerating';
        waMessage = `Olá ${nome}, tudo bem? Aqui é do Rei do NFC. Sua plaquinha teve leituras nos últimos dias. Se precisar ajustar o link de destino, é só chamar!`;
      } else {
        category = 'stable';
        waMessage = `Olá ${nome}! Aqui é do Rei do NFC, passando para saber se está tudo certo com a sua plaquinha.`;
      }

      const waNumber = toWhatsAppNumber(c.phone);
      clientHealthMatrix[category].push({
        ...c,
        category,
        daysSinceScan,
        latestScanStr: c.latestScanAt,
        whatsappUrl: waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}` : null
      });
    });

    // CIÊNCIA DE DADOS ADMIN: Curva de Pareto (80/20)
    let paretoShare = '0.0';
    const clientsScansTotal = topClients.reduce((sum, c) => sum + (c.totalScans || 0), 0);
    if (topClients.length > 0 && clientsScansTotal > 0) {
      const byScans = topClients.slice().sort((a, b) => (b.totalScans || 0) - (a.totalScans || 0));
      const top20Count = Math.max(1, Math.ceil(byScans.length * 0.2));
      const top20Scans = byScans.slice(0, top20Count).reduce((sum, c) => sum + (c.totalScans || 0), 0);
      paretoShare = ((top20Scans / clientsScansTotal) * 100).toFixed(1);
    }

    // CIÊNCIA DE DADOS ADMIN: Liquidez de Lotes & Burn Rate
    const batches = this.getBatches();
    const dailyActivationsRate = Math.max(0.2, (todayActivations + yesterdayActivations) / 2 || 0.5);
    const batchDistribution = batches.map(b => {
      const daysOfInventory = b.virgin > 0 ? Math.round(b.virgin / dailyActivationsRate) : 0;
      return {
        name: b.name,
        total: b.count,
        active: b.active,
        virgin: b.virgin,
        totalScans: b.totalScans,
        percentActive: b.count > 0 ? ((b.active / b.count) * 100).toFixed(1) : '0.0',
        burnRateDaysRemaining: daysOfInventory,
        isStockLow: b.virgin <= 5 && b.count > 0
      };
    });

    // Estimativa de Reviews no Google de Toda a Rede
    const networkEstimatedReviews = Math.round(totalScans * 0.22);

    // Últimas ativações ordenadas decrescente
    const recentActivations = activePlaquesList
      .filter(p => p.activated_at)
      .sort((a, b) => new Date(b.activated_at) - new Date(a.activated_at))
      .slice(0, 8);

    const timeline = Array.from(timelineMap.values());
    const activationRate = total > 0 ? ((totalActive / total) * 100).toFixed(1) : '0.0';

    return {
      periodDays: days,
      timeline,
      todayScans,
      yesterdayScans,
      todayActivations,
      yesterdayActivations,
      totalScans,
      totalActive,
      totalVirgin,
      totalPlaques: total,
      activationRate,
      topClients,
      uniqueActiveClients: clientsMap.size,
      batchDistribution,
      recentActivations,
      clientHealthMatrix,
      paretoShare,
      networkEstimatedReviews,
      scanSource,
      scanHistorySince,
      yesterdayNoHistory
    };
  }

  // Estatísticas do portal do cliente. Usa só dados que realmente existem:
  // scans_count, last_scan_at, activated_at e, quando o histórico (scan_events)
  // já estiver ativo, leituras por dia/hora. Não há dado por canal (NFC/QR) nem
  // taxa real de avaliações no Google, então nada aqui finge medir isso.
  getClientAnalytics(codeOrPhone) {
    const client = this.getClientByCode(codeOrPhone);
    if (!client) return null;

    const DAY_MS = 1000 * 60 * 60 * 24;
    const nowMs = Date.now();
    const plaques = client.plaques || [];
    const activePlaques = plaques.filter(p => p.status === 'active');
    const virginPlaques = plaques.filter(p => p.status === 'virgin');
    const totalScans = plaques.reduce((acc, p) => acc + (p.scans_count || 0), 0);

    const daysSince = (iso) => {
      const ms = iso ? Date.parse(iso) : NaN;
      return Number.isNaN(ms) ? null : Math.max(0, Math.floor((nowMs - ms) / DAY_MS));
    };

    // Saúde de cada placa: a recência da última leitura manda, não o total
    // histórico (uma placa com 100 leituras parada há 2 meses não é "ótima").
    const plaqueHealth = plaques.map(p => {
      const scans = p.scans_count || 0;
      let status = 'virgin';
      let score = 0;
      let badgeClass = 'badge-virgin';
      let statusLabel = 'Virgem';
      let recommendation = 'Vincule seu link do Google para começar a receber leituras';

      if (p.status === 'active') {
        const days = daysSince(p.last_scan_at);
        if (scans === 0) {
          status = 'attention';
          score = 20;
          statusLabel = '○ Aguardando 1ª Leitura';
          recommendation = 'Faça um teste você mesmo aproximando o celular.';
        } else if (days !== null && days <= 2) {
          status = 'optimal';
          score = 95;
          badgeClass = 'badge-active';
          statusLabel = '● Alta Atividade';
          recommendation = 'Excelente ponto físico. Mantenha a plaquinha limpa e visível.';
        } else if (days !== null && days <= 7) {
          status = 'steady';
          score = 75;
          badgeClass = 'badge-active';
          statusLabel = '● Fluxo Regular';
          recommendation = 'Apresente a placa aos clientes no momento do pagamento.';
        } else {
          status = 'dormant';
          score = 35;
          statusLabel = '○ Sem Leituras (+7d)';
          recommendation = 'Aproxime a plaquinha do caixa ou coloque sobre a mesa mais movimentada.';
        }
      }

      return {
        id: p.id,
        name: p.name || 'Plaquinha ' + p.id,
        status,
        score,
        badgeClass,
        statusLabel,
        recommendation,
        scans,
        lastScanAt: p.last_scan_at,
        targetUrl: p.target_url
      };
    });

    // Ranking real de leituras por plaquinha (só as que já foram lidas)
    const maxPlaqueScans = Math.max(1, ...plaqueHealth.map(ph => ph.scans));
    const plaqueRanking = plaqueHealth
      .filter(ph => ph.scans > 0)
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 5)
      .map(ph => ({
        ...ph,
        percentOfTotal: totalScans > 0 ? Math.round((ph.scans / totalScans) * 100) : 0,
        barPercent: Math.round((ph.scans / maxPlaqueScans) * 100)
      }));

    // Próximo marco de leituras + previsão pelo ritmo médio desde a ativação
    let targetGoal = 25;
    if (totalScans >= 25 && totalScans < 50) targetGoal = 50;
    else if (totalScans >= 50 && totalScans < 100) targetGoal = 100;
    else if (totalScans >= 100 && totalScans < 250) targetGoal = 250;
    else if (totalScans >= 250 && totalScans < 500) targetGoal = 500;
    else if (totalScans >= 500) targetGoal = Math.ceil((totalScans + 100) / 100) * 100;

    const scansRemaining = Math.max(0, targetGoal - totalScans);
    const progressPercent = Math.min(100, Math.round((totalScans / targetGoal) * 100));

    const activationTimes = activePlaques
      .map(p => (p.activated_at ? Date.parse(p.activated_at) : NaN))
      .filter(ms => !Number.isNaN(ms));
    const daysActive = activationTimes.length > 0
      ? Math.max(1, Math.ceil((nowMs - Math.min(...activationTimes)) / DAY_MS))
      : null;
    const dailyVelocity = daysActive && totalScans > 0 ? totalScans / daysActive : 0;
    let daysToGoal = dailyVelocity > 0 ? Math.ceil(scansRemaining / dailyVelocity) : null;
    if (daysToGoal !== null && daysToGoal > 365) daysToGoal = null;

    // Histórico real de leituras (scan_events), quando disponível
    const events = summarizeScanEvents(this.clientScanStats && this.clientScanStats[client.client_code]);
    let scanHistory = { available: false };
    if (events) {
      let growthPercent = null;
      if (events.daysTracked >= 14 && events.prev7 > 0) {
        growthPercent = Math.round(((events.last7 - events.prev7) / events.prev7) * 100);
      }

      let dayparts = null;
      if (events.total >= MIN_EVENTS_FOR_DAYPARTS) {
        const sum = (from, to) => events.byHour.slice(from, to).reduce((a, b) => a + b, 0);
        const bands = [
          { id: 'morning', label: 'Manhã', range: '06h–11h', count: sum(6, 11) },
          { id: 'lunch', label: 'Almoço', range: '11h–15h', count: sum(11, 15) },
          { id: 'afternoon', label: 'Tarde', range: '15h–18h', count: sum(15, 18) },
          { id: 'evening', label: 'Noite / Madrugada', range: '18h–06h', count: sum(18, 24) + sum(0, 6) }
        ];
        const peakCount = Math.max(...bands.map(b => b.count));
        dayparts = bands.map(b => ({
          ...b,
          percent: Math.round((b.count / events.total) * 100),
          isPeak: peakCount > 0 && b.count === peakCount
        }));
      }

      scanHistory = {
        available: true,
        since: events.sinceKey,
        sinceLabel: formatDayKeyShort(events.sinceKey),
        daysTracked: events.daysTracked,
        total: events.total,
        last7: events.last7,
        growthPercent,
        dayparts,
        minForDayparts: MIN_EVENTS_FOR_DAYPARTS
      };
    }

    // Insights em linguagem natural — só fatos que os dados sustentam
    const insights = [];
    if (totalScans > 0) {
      const scanAges = plaques.map(p => daysSince(p.last_scan_at)).filter(d => d !== null);
      if (scanAges.length > 0) {
        const newestScanDays = Math.min(...scanAges);
        insights.push({
          icon: 'clock',
          title: 'Última Leitura',
          desc: newestScanDays === 0
            ? 'Suas plaquinhas foram lidas hoje.'
            : `A última leitura foi há ${newestScanDays} dia${newestScanDays === 1 ? '' : 's'}.`
        });
      }

      const topPlaque = plaqueRanking[0];
      if (topPlaque && activePlaques.length > 1) {
        insights.push({
          icon: 'award',
          title: 'Ponto Físico Líder',
          desc: `A plaquinha "${topPlaque.name}" concentra ${topPlaque.percentOfTotal}% das suas leituras.`
        });
      }

      const dormantCount = plaqueHealth.filter(ph => ph.status === 'dormant').length;
      if (dormantCount > 0) {
        insights.push({
          icon: 'info',
          title: 'Plaquinhas Paradas',
          desc: `${dormantCount} plaquinha${dormantCount === 1 ? ' está' : 's estão'} sem leituras há mais de 7 dias. Vale reposicionar mais perto do caixa.`
        });
      }

      const peakBand = scanHistory.dayparts && scanHistory.dayparts.find(b => b.isPeak);
      if (peakBand) {
        insights.push({
          icon: 'clock',
          title: 'Horário de Maior Movimento',
          desc: `${peakBand.label} (${peakBand.range}) concentra ${peakBand.percent}% das leituras registradas desde ${scanHistory.sinceLabel}.`
        });
      }

      if (daysToGoal !== null) {
        insights.push({
          icon: 'trendingUp',
          title: 'Previsão do Próximo Marco',
          desc: `No ritmo médio desde a ativação (${dailyVelocity.toFixed(1)} leituras/dia), você deve chegar a ${targetGoal} leituras em cerca de ${daysToGoal} dia${daysToGoal === 1 ? '' : 's'}.`
        });
      }
    } else {
      insights.push({
        icon: 'info',
        title: 'Como Iniciar a Captação',
        desc: 'Posicione sua plaquinha próxima ao caixa e instrua seus atendentes a pedir 5 estrelas no momento de pagar a conta.'
      });
    }

    return {
      client,
      totalPlaques: plaques.length,
      activeCount: activePlaques.length,
      virginCount: virginPlaques.length,
      totalScans,
      scanHistory,
      plaqueHealth,
      plaqueRanking,
      milestone: {
        current: totalScans,
        target: targetGoal,
        remaining: scansRemaining,
        percent: progressPercent,
        estimatedDays: daysToGoal
      },
      insights
    };
  }

  exportBackupJSON() {
    // Sanitização de segurança: remove credenciais do Dono do backup
    const safeSettings = {
      baseUrl: this.settings.baseUrl,
      defaultPrefix: this.settings.defaultPrefix,
      adminUsername: this.settings.adminUsername || DEFAULT_ADMIN_USER
    };
    return JSON.stringify({
      version: '5.0',
      exportedAt: new Date().toISOString(),
      count: this.plaques.length,
      plaques: this.plaques,
      settings: safeSettings
    }, null, 2);
  }

  async importBackupJSON(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      return { success: false, error: 'Arquivo JSON corrompido ou inválido.' };
    }
    if (!data || !Array.isArray(data.plaques)) {
      return { success: false, error: 'Formato de backup incompatível.' };
    }

    this.setPlaquesInternal(data.plaques);
    this.saveToDisk(this.plaques);
    try {
      await this.syncPlaquesAsAdmin(this.plaques);
    } catch (err) {
      return { success: false, error: 'Restaurado localmente, mas NÃO foi salvo no servidor: ' + err.message + ' Tente novamente.' };
    }
    return { success: true, count: this.plaques.length };
  }

  // Limpeza total e reinício do zero absoluto (Memória, IndexedDB, LocalStorage, Supabase Cloud e Mock Server)
  async resetDatabaseToZero() {
    // 1. Zera no Supabase Cloud PRIMEIRO — é a operação mais destrutiva
    // do sistema, então só limpamos o que o admin vê localmente depois
    // de confirmar que o banco de verdade foi zerado. Na ordem antiga
    // (local primeiro, nuvem por último e tolerante a falha), um erro
    // aqui deixava o painel "vazio" enquanto o banco real continuava
    // com tudo.
    const resetToken = this.getAdminSessionToken();
    if (!resetToken) {
      return { success: false, error: 'Sessão de administrador ausente ou expirada. Faça login novamente e tente de novo.' };
    }
    try {
      await this.callRpc('admin_reset_all', { p_token: resetToken }, 15000);
    } catch (e) {
      return { success: false, error: 'Não foi possível zerar no servidor: ' + e.message };
    }

    // 2. Limpa memória
    this.plaques = [];
    this.plaquesMap.clear();
    this.invalidateCache();

    // 3. Limpa IndexedDB
    try {
      await idb.clearAllPlaques();
    } catch (e) {}

    // Limpa bancos legados do IndexedDB se existirem
    try {
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('PlacaQRProDB');
      }
    } catch (e) {}

    // 4. Limpa todas as versões de LocalStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('placa_qrcode_pro_data_v6');
        localStorage.removeItem('placa_qrcode_pro_data_v5');
        localStorage.removeItem('placa_qrcode_pro_data_v4');
        localStorage.removeItem('placa_qrcode_pro_data_v3');
        localStorage.removeItem('placa_qrcode_pro_data_v2');
        localStorage.removeItem('placa_qrcode_pro_data');
        localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      }
    } catch (e) {}

    // 5. Limpa no mock server local se estiver rodando
    try {
      await this.fetchWithTimeout('/api/plaques/reset', { method: 'POST' }, 2000);
    } catch (e) {}

    return { success: true };
  }
}

export const storage = new StorageService();

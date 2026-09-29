// Placa QR Pro - Data Storage & Persistence Service
// Sincronização em Tempo Real (Supabase Cloud + Local API + IndexedDB + LocalStorage Fallback)
// Arquitetura Ultra Otimizada para 10.000+ Placas e 300+ Usuários Simultâneos com Lookups O(1)
import { getReversedPhoneCode, isValidHttpUrl, sanitizeUrl, sha256Hex } from '../utils/helpers.js';
import { idb } from './db.js';

const STORAGE_KEY = 'placa_qrcode_pro_data_v6';
const SETTINGS_KEY = 'placa_qrcode_pro_settings_v6';

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

    // Inicialização de dados
    this.initInitialData();
  }

  // Inicialização síncrona com fallback e posterior hidratação IndexedDB / Cloud
  initInitialData() {
    const local = this.loadLocalPlaques();
    this.setPlaquesInternal(local);
    this.hydrateFromIndexedDBAndCloud();
  }

  setPlaquesInternal(plaquesArray) {
    this.plaques = Array.isArray(plaquesArray) ? plaquesArray : [];
    this.plaquesMap.clear();
    for (let i = 0; i < this.plaques.length; i++) {
      const p = this.plaques[i];
      if (p && p.id) {
        this.plaquesMap.set(p.id.toUpperCase(), p);
      }
    }
    this.invalidateCache();
  }

  invalidateCache() {
    this._isDirty = true;
    this._cachedBatches = null;
    this._cachedClients = null;
    this._cachedStats = null;
  }

  async hydrateFromIndexedDBAndCloud() {
    try {
      // 1. Tenta carregar do IndexedDB
      const idbData = await idb.getAllPlaques();
      if (Array.isArray(idbData) && idbData.length > 0) {
        this.setPlaquesInternal(idbData);
      }
    } catch (e) {
      console.warn('Falha na hidratação IndexedDB:', e);
    }

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
    if (sessionToken) {
      try {
        await this.callRpc('admin_change_credentials', {
          p_token: sessionToken,
          p_new_username: newUsername.trim(),
          p_new_password_hash: newHash
        });
      } catch (e) {
        console.warn('Aviso: credencial local trocada, mas falha ao sincronizar com o Supabase:', e);
      }
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
      this._syncPromise = null;
    });

    return this._syncPromise;
  }

  // Persistência com IndexedDB e Fallback seguro para LocalStorage
  saveToDisk(plaques) {
    const targetPlaques = plaques || this.plaques;
    
    // 1. Persistência Assíncrona no IndexedDB (Suporta 100.000+ registros)
    idb.saveAllPlaques(targetPlaques).catch(() => {});

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

    // Sincroniza com a nuvem via RPC administrativa
    this.syncPlaquesAsAdmin(newPlaques).catch((err) => {
      console.warn('Aviso: falha ao sincronizar novo lote com o Supabase:', err);
    });

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
  async deleteBatch(batchName) {
    if (!batchName) return { success: false, error: 'Nome do lote inválido.' };
    const cleanName = String(batchName).trim().toLowerCase();

    const initialCount = this.plaques.length;
    const remainingPlaques = [];
    const deletedIds = [];

    for (let i = 0; i < initialCount; i++) {
      const p = this.plaques[i];
      const pBatch = (p.batch_name || 'Lote Geral').trim().toLowerCase();
      if (pBatch === cleanName) {
        deletedIds.push(p.id);
        this.plaquesMap.delete(p.id.toUpperCase());
      } else {
        remainingPlaques.push(p);
      }
    }

    const deletedCount = deletedIds.length;
    if (deletedCount === 0) {
      return { success: false, error: 'Nenhuma plaquinha encontrada neste lote.' };
    }

    this.plaques = remainingPlaques;
    this.invalidateCache();
    this.saveToDisk(this.plaques);

    // Sincroniza exclusão no Supabase Cloud (via RPC administrativa)
    const deleteBatchToken = this.getAdminSessionToken();
    if (deleteBatchToken) {
      try {
        await this.callRpc('admin_delete_by_batch', { p_token: deleteBatchToken, p_batch_name: batchName.trim() }, 5000);
      } catch (e) {
        console.warn('Aviso: Falha ao deletar lote no Supabase Cloud:', e);
      }
    }

    // Sincroniza com servidor local
    try {
      fetch(`/api/batches/${encodeURIComponent(batchName.trim())}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    return { success: true, count: deletedCount };
  }

  // Exclusão de uma única placa
  async deletePlaque(plaqueId) {
    if (!plaqueId) return { success: false, error: 'ID da placa inválido.' };
    const cleanId = String(plaqueId).trim().toUpperCase();

    if (!this.plaquesMap.has(cleanId)) {
      return { success: false, error: 'Plaquinha não encontrada.' };
    }

    this.plaquesMap.delete(cleanId);
    this.plaques = this.plaques.filter(p => (p.id || '').toUpperCase() !== cleanId);
    this.invalidateCache();
    this.saveToDisk(this.plaques);

    // Sincroniza com Supabase Cloud (via RPC administrativa)
    const deletePlaqueToken = this.getAdminSessionToken();
    if (deletePlaqueToken) {
      try {
        await this.callRpc('admin_delete_by_id', { p_token: deletePlaqueToken, p_id: cleanId }, 4000);
      } catch (e) {}
    }

    // Sincroniza com servidor local
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
          this.plaquesMap.set(cloudPlaque.id.toUpperCase(), cloudPlaque);
          if (!this.plaques.some(p => p.id.toUpperCase() === cloudPlaque.id.toUpperCase())) {
            this.plaques.unshift(cloudPlaque);
          }
          this.invalidateCache();
          this.saveToDisk(this.plaques);
          return cloudPlaque;
        }
      } catch (e) {}
    }
    return null;
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
            this.plaquesMap.set(p.id.toUpperCase(), p);
            if (!this.plaques.some(item => item.id.toUpperCase() === p.id.toUpperCase())) {
              this.plaques.unshift(p);
            }
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

    this.syncPlaquesAsAdmin([plaque]).catch((err) => {
      console.warn('Aviso: falha ao sincronizar edição com o Supabase:', err);
    });

    return plaque;
  }

  async resetPlaque(id) {
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

  // Métricas analíticas completas para o Dashboard do Dono
  getDashboardMetrics(daysCount = 14) {
    const isTodayMode = parseInt(daysCount, 10) === 1;
    const days = isTodayMode ? 1 : Math.max(3, Math.min(60, parseInt(daysCount, 10) || 14));
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

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
        const isoDate = d.toISOString().split('T')[0];
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
          const actDate = p.activated_at.split('T')[0];
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
            latestActivation: p.activated_at || p.created_at || ''
          };
          clientsMap.set(clientKey, clientStat);
        }

        clientStat.activeCount++;
        if (wasActivatedToday) clientStat.todayActiveCount++;
        clientStat.totalScans += scans;
        if (p.activated_at && (!clientStat.latestActivation || p.activated_at > clientStat.latestActivation)) {
          clientStat.latestActivation = p.activated_at;
        }
      } else {
        totalVirgin++;
      }

      if (p.last_scan_at) {
        const scanDate = p.last_scan_at.split('T')[0];
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

    // Ranking ordenado de clientes (se for modo hoje, prioriza quem teve atividade hoje)
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

    // Distribuição por Lotes
    const batches = this.getBatches();
    const batchDistribution = batches.map(b => ({
      name: b.name,
      total: b.count,
      active: b.active,
      virgin: b.virgin,
      totalScans: b.totalScans,
      percentActive: b.count > 0 ? ((b.active / b.count) * 100).toFixed(1) : '0.0'
    }));

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
      recentActivations
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
    try {
      const data = JSON.parse(jsonString);
      if (data && Array.isArray(data.plaques)) {
        this.setPlaquesInternal(data.plaques);
        this.saveToDisk(this.plaques);
        this.syncPlaquesAsAdmin(this.plaques).catch((err) => {
          console.warn('Aviso: falha ao sincronizar backup restaurado com o Supabase:', err);
        });
        return { success: true, count: this.plaques.length };
      }
    } catch (e) {
      return { success: false, error: 'Arquivo JSON corrompido ou inválido.' };
    }
    return { success: false, error: 'Formato de backup incompatível.' };
  }

  // Limpeza total e reinício do zero absoluto (Memória, IndexedDB, LocalStorage, Supabase Cloud e Mock Server)
  async resetDatabaseToZero() {
    // 1. Limpa memória
    this.plaques = [];
    this.plaquesMap.clear();
    this.invalidateCache();

    // 2. Limpa IndexedDB
    try {
      await idb.clearAllPlaques();
    } catch (e) {}

    // Limpa bancos legados do IndexedDB se existirem
    try {
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('PlacaQRProDB');
      }
    } catch (e) {}

    // 3. Limpa todas as versões de LocalStorage
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

    // 4. Limpa no Supabase Cloud (via RPC administrativa)
    const resetToken = this.getAdminSessionToken();
    if (resetToken) {
      try {
        await this.callRpc('admin_reset_all', { p_token: resetToken }, 8000);
      } catch (e) {
        console.warn('Aviso: Falha ao zerar no Supabase Cloud:', e);
      }
    }

    // 5. Limpa no mock server local se estiver rodando
    try {
      await this.fetchWithTimeout('/api/plaques/reset', { method: 'POST' }, 2000);
    } catch (e) {}

    return { success: true };
  }
}

export const storage = new StorageService();

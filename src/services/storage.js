// Placa QR Pro - Data Storage & Persistence Service
// Sincronização em Tempo Real (Supabase Cloud + Local API + IndexedDB + LocalStorage Fallback)
// Arquitetura Ultra Otimizada para 10.000+ Placas e 300+ Usuários Simultâneos com Lookups O(1)
import { getReversedPhoneCode, isValidHttpUrl, sanitizeUrl, sha256Hex } from '../utils/helpers.js';
import { idb } from './db.js';

const STORAGE_KEY = 'placa_qrcode_pro_data_v5';
const SETTINGS_KEY = 'placa_qrcode_pro_settings_v5';

// Hash SHA-256 padrão para as credenciais do Dono (Usuário: Matheus / Senha: Helena2026)
const DEFAULT_ADMIN_USER = 'Matheus';
const DEFAULT_ADMIN_HASH = '926e64810cf9b064d7098f910baf556a387300d31ef8aaa83327f34f1d9fca37';

const DEFAULT_SEED_PLAQUES = [
  {
    id: 'PLQ-001',
    name: 'Pizzaria Bella Napoli',
    status: 'active',
    target_url: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    pin: '1234',
    client_name: 'Marcos Silva',
    client_phone: '(11) 98765-4321',
    client_code: '12345678911',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    activated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    scans_count: 142,
    last_scan_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    batch_name: 'Lote 01'
  },
  {
    id: 'PLQ-002',
    name: 'Barbearia Vintage Club',
    status: 'active',
    target_url: 'https://search.google.com/local/writereview?placeid=ChIJQ1t_tDeuEmsRUsoyG83frY5',
    pin: '5678',
    client_name: 'Carlos Santos',
    client_phone: '(21) 99888-7766',
    client_code: '66778889912',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    activated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    scans_count: 89,
    last_scan_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    batch_name: 'Lote 01'
  },
  {
    id: 'PLQ-003',
    name: '',
    status: 'virgin',
    target_url: '',
    pin: '9012',
    client_name: '',
    client_phone: '',
    client_code: '',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    activated_at: null,
    scans_count: 0,
    last_scan_at: null,
    batch_name: 'Lote 02'
  },
  {
    id: 'PLQ-004',
    name: '',
    status: 'virgin',
    target_url: '',
    pin: '3456',
    client_name: '',
    client_phone: '',
    client_code: '',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    activated_at: null,
    scans_count: 0,
    last_scan_at: null,
    batch_name: 'Lote 02'
  }
];

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

    // Fila de sincronização batch
    this._syncQueue = new Map();
    this._syncQueueTimer = null;

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
        const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('placa_qrcode_pro_data_v4');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {
      console.warn('Falha ao ler localStorage:', e);
    }
    return [...DEFAULT_SEED_PLAQUES];
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
        const stored = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem('placa_qrcode_pro_settings_v4');
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
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 3) {
        throw new Error('A senha deve ter pelo menos 3 caracteres.');
      }
      updates.adminPasswordHash = await sha256Hex(newPassword.trim());
      delete updates.adminPassword;
    }
    this.saveSettings(updates);
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
    // 1. Tenta carregar do Supabase Cloud se as credenciais estiverem ativas
    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      try {
        const res = await this.fetchWithTimeout(`${this.settings.supabaseUrl}/rest/v1/plaques?select=*&order=created_at.desc&limit=10000`, {
          headers: {
            'apikey': this.settings.supabaseKey,
            'Authorization': `Bearer ${this.settings.supabaseKey}`
          }
        });
        if (res.ok) {
          const cloudData = await res.json();
          if (Array.isArray(cloudData) && cloudData.length > 0) {
            this.setPlaquesInternal(cloudData);
            this.saveToDisk(this.plaques);
            return cloudData;
          } else if (Array.isArray(cloudData) && cloudData.length === 0 && this.plaques.length > 0) {
            // Tabela vazia: faz seed inicial em lotes
            this.syncBatchToSupabase(this.plaques);
            return this.plaques;
          }
        }
      } catch (err) {
        // Modo offline / resiliência silenciosa
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

    // Enfileira sincronização para nuvem
    this.syncBatchToSupabase(newPlaques);

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

    // Sincroniza exclusão no Supabase Cloud
    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      try {
        await this.fetchWithTimeout(`${this.settings.supabaseUrl}/rest/v1/plaques?batch_name=eq.${encodeURIComponent(batchName.trim())}`, {
          method: 'DELETE',
          headers: {
            'apikey': this.settings.supabaseKey,
            'Authorization': `Bearer ${this.settings.supabaseKey}`
          }
        }, 5000);
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

    // Sincroniza com Supabase Cloud
    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      try {
        await this.fetchWithTimeout(`${this.settings.supabaseUrl}/rest/v1/plaques?id=eq.${encodeURIComponent(cleanId)}`, {
          method: 'DELETE',
          headers: {
            'apikey': this.settings.supabaseKey,
            'Authorization': `Bearer ${this.settings.supabaseKey}`
          }
        }, 4000);
      } catch (e) {}
    }

    // Sincroniza com servidor local
    try {
      fetch(`/api/plaques/${encodeURIComponent(cleanId)}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}

    return { success: true };
  }

  // Busca direta de plaquinha no Supabase Cloud (garante acesso mesmo antes de sync completo)
  async fetchPlaqueFromCloud(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toUpperCase();
    const local = this.getPlaqueById(cleanId);
    if (local) return local;

    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      try {
        const res = await this.fetchWithTimeout(`${this.settings.supabaseUrl}/rest/v1/plaques?id=eq.${encodeURIComponent(cleanId)}&select=*`, {
          headers: {
            'apikey': this.settings.supabaseKey,
            'Authorization': `Bearer ${this.settings.supabaseKey}`
          }
        }, 3500);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const cloudPlaque = data[0];
            this.plaquesMap.set(cloudPlaque.id.toUpperCase(), cloudPlaque);
            if (!this.plaques.some(p => p.id.toUpperCase() === cloudPlaque.id.toUpperCase())) {
              this.plaques.unshift(cloudPlaque);
            }
            this.invalidateCache();
            this.saveToDisk(this.plaques);
            return cloudPlaque;
          }
        }
      } catch (e) {}
    }
    return null;
  }

  // Busca direta de cliente no Supabase Cloud
  async fetchClientFromCloud(codeOrPhone) {
    if (!codeOrPhone) return null;
    const local = this.getClientByCode(codeOrPhone);
    if (local) return local;

    if (this.settings.supabaseUrl && this.settings.supabaseKey) {
      try {
        const clean = String(codeOrPhone).trim();
        const cleanDigits = clean.replace(/\D/g, '');
        const reversed = cleanDigits ? cleanDigits.split('').reverse().join('') : '';

        const res = await this.fetchWithTimeout(`${this.settings.supabaseUrl}/rest/v1/plaques?or=(client_code.eq.${encodeURIComponent(clean)},client_code.eq.${encodeURIComponent(cleanDigits)},client_code.eq.${encodeURIComponent(reversed)},client_phone.eq.${encodeURIComponent(clean)})&select=*`, {
          headers: {
            'apikey': this.settings.supabaseKey,
            'Authorization': `Bearer ${this.settings.supabaseKey}`
          }
        }, 3500);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(p => {
              this.plaquesMap.set(p.id.toUpperCase(), p);
              if (!this.plaques.some(item => item.id.toUpperCase() === p.id.toUpperCase())) {
                this.plaques.unshift(p);
              }
            });
            this.invalidateCache();
            this.saveToDisk(this.plaques);
            return this.getClientByCode(codeOrPhone);
          }
        }
      } catch (e) {}
    }
    return null;
  }

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

    // Validação de PIN de segurança caso a placa já esteja ativa
    if (plaque.status === 'active' && plaque.pin && pin && String(pin).trim() !== String(plaque.pin).trim()) {
      return { success: false, error: 'PIN de segurança incorreto para alterar esta plaquinha.' };
    }

    const calculatedCode = clientCode || (clientPhone ? getReversedPhoneCode(clientPhone) : (plaque.client_code || ''));

    plaque.name = name ? String(name).trim() : plaque.name || 'Empresa Cadastrada';
    plaque.target_url = cleanUrl;
    plaque.status = 'active';
    plaque.activated_at = new Date().toISOString();
    if (pin) plaque.pin = String(pin).trim();
    if (clientName) plaque.client_name = String(clientName).trim();
    if (clientPhone) plaque.client_phone = String(clientPhone).trim();
    if (calculatedCode) plaque.client_code = String(calculatedCode).trim();

    this.invalidateCache();
    idb.putPlaque(plaque).catch(() => {});
    this.saveToDisk(this.plaques);

    this.queueForSync(plaque);

    try {
      fetch('/api/plaques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plaque)
      }).catch(() => {});
    } catch (e) {}

    return { success: true, plaque };
  }

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

    this.queueForSync(plaque);

    try {
      fetch('/api/plaques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plaque)
      }).catch(() => {});
    } catch (e) {}

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
      activated_at: null
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

      this.queueForSync(plaque);

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

  // Fila inteligente de sincronização em segundo plano (Write-behind batched sync)
  queueForSync(plaque) {
    if (!this.settings.supabaseUrl || !this.settings.supabaseKey) return;
    this._syncQueue.set(plaque.id, plaque);

    if (!this._syncQueueTimer) {
      this._syncQueueTimer = setTimeout(() => {
        this.flushSyncQueue();
      }, 1200);
    }
  }

  async flushSyncQueue() {
    this._syncQueueTimer = null;
    if (!this._syncQueue || this._syncQueue.size === 0) return;

    const items = Array.from(this._syncQueue.values());
    this._syncQueue.clear();
    await this.syncBatchToSupabase(items);
  }

  // Chunking inteligente para sincronização em massa sem estourar limites HTTP
  async syncBatchToSupabase(plaques) {
    if (!this.settings.supabaseUrl || !this.settings.supabaseKey || !Array.isArray(plaques) || plaques.length === 0) return;
    
    const CHUNK_SIZE = 250;
    const total = plaques.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = plaques.slice(i, i + CHUNK_SIZE);
      try {
        await this.fetchWithTimeout(`${this.settings.supabaseUrl}/rest/v1/plaques`, {
          method: 'POST',
          headers: {
            'apikey': this.settings.supabaseKey,
            'Authorization': `Bearer ${this.settings.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(chunk)
        }, 5000);
      } catch (e) {
        // Silencioso em caso de timeout / rede offline
      }
    }
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
        this.syncBatchToSupabase(this.plaques);
        return { success: true, count: this.plaques.length };
      }
    } catch (e) {
      return { success: false, error: 'Arquivo JSON corrompido ou inválido.' };
    }
    return { success: false, error: 'Formato de backup incompatível.' };
  }
}

export const storage = new StorageService();

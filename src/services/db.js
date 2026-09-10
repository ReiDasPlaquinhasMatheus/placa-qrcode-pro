// Placa QR Pro - High Performance Native IndexedDB Engine
// Suporta armazenamento local persistente de centenas de milhares de registros sem limites de quota

const DB_NAME = 'PlacaQRProDB_v2';
const DB_VERSION = 1;
const STORE_PLAQUES = 'plaques';
const STORE_KV = 'keyval';

class IndexedDBStorage {
  constructor() {
    this.dbPromise = null;
    this.isAvailable = typeof indexedDB !== 'undefined';
  }

  async getDB() {
    if (!this.isAvailable) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Object Store para Placas com índices rápidos
          if (!db.objectStoreNames.contains(STORE_PLAQUES)) {
            const plaqueStore = db.createObjectStore(STORE_PLAQUES, { keyPath: 'id' });
            plaqueStore.createIndex('batch_name', 'batch_name', { unique: false });
            plaqueStore.createIndex('status', 'status', { unique: false });
            plaqueStore.createIndex('client_code', 'client_code', { unique: false });
          }

          // Key-Value Store para configurações e metadata
          if (!db.objectStoreNames.contains(STORE_KV)) {
            db.createObjectStore(STORE_KV);
          }
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = (event) => {
          console.warn('Erro ao abrir IndexedDB:', event.target.error);
          resolve(null); // Fallback para localStorage
        };
      } catch (err) {
        console.warn('IndexedDB não suportado neste ambiente:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  // Obter todas as placas do IndexedDB
  async getAllPlaques() {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PLAQUES, 'readonly');
        const store = tx.objectStore(STORE_PLAQUES);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  // Salvar lote completo de placas em uma única transação de alta performance
  async saveAllPlaques(plaques) {
    const db = await this.getDB();
    if (!db || !Array.isArray(plaques)) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PLAQUES, 'readwrite');
        const store = tx.objectStore(STORE_PLAQUES);

        store.clear(); // Limpa store anterior

        for (let i = 0; i < plaques.length; i++) {
          store.put(plaques[i]);
        }

        tx.oncomplete = () => resolve(true);
        tx.onerror = (e) => {
          console.warn('Erro ao persistir lote no IndexedDB:', e.target.error);
          resolve(false);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Limpar todas as placas do IndexedDB
  async clearAllPlaques() {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PLAQUES, 'readwrite');
        const store = tx.objectStore(STORE_PLAQUES);
        const req = store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Atualizar ou inserir uma única placa (Upsert O(1))
  async putPlaque(plaque) {
    const db = await this.getDB();
    if (!db || !plaque || !plaque.id) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PLAQUES, 'readwrite');
        const store = tx.objectStore(STORE_PLAQUES);
        store.put(plaque);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Key-Value genérico para configurações
  async setKV(key, value) {
    const db = await this.getDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_KV, 'readwrite');
        const store = tx.objectStore(STORE_KV);
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async getKV(key) {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_KV, 'readonly');
        const store = tx.objectStore(STORE_KV);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
}

export const idb = new IndexedDBStorage();

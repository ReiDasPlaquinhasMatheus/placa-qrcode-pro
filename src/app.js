import './index.css';
import { storage } from './services/storage.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderBatchFoldersView } from './components/BatchFoldersView.js';
import { renderClientsView } from './components/ClientsView.js';
import { renderClientPortalView } from './components/ClientPortalView.js';
import { renderAdminLoginView } from './components/AdminLoginView.js';
import { renderPlaqueTable } from './components/PlaqueTable.js';
import { renderBatchGenerator } from './components/BatchGenerator.js';
import { renderActivationView } from './components/ActivationView.js';
import { renderGoogleReviewHelper } from './components/GoogleReviewHelper.js';
import { renderSettingsView } from './components/SettingsView.js';
import { renderEditModal, renderQRModal, renderDeployGuideModal } from './components/Modals.js';
import { exportBatchZip, exportBatchCsv, downloadSvg, downloadPng } from './services/exporter.js';
import { generateCleanQRCodePng, generateCleanQRCodeSvg } from './services/qrGenerator.js';
import { copyToClipboard, buildGoogleReviewUrl, getReversedPhoneCode, formatPhone, isValidHttpUrl } from './utils/helpers.js';
import { getIcon } from './utils/icons.js';

// Estado global da aplicação com suporte a paginação e filtros
const state = {
  currentRoute: 'lotes',
  currentBatch: null,
  activePlaqueId: null,

  // Filtros e paginação da Tabela de Placas
  plaqueFilter: 'all',
  plaqueSearch: '',
  plaqueBatchFilter: 'all',
  plaqueClientFilter: 'all',
  plaqueSortBy: 'created_at',
  plaqueSortOrder: 'desc',
  plaquePage: 1,
  plaquePerPage: 25,

  // Filtros e paginação de Clientes
  clientSearch: '',
  clientSortBy: 'count',
  clientSortOrder: 'desc',
  clientPage: 1,
  clientPerPage: 25,

  // Filtros de Pastas de Lotes
  batchSearch: '',
  batchSortBy: 'recent',

  // Filtros e paginação do Portal do Cliente
  portalSearch: '',
  portalFilter: 'all',
  portalPage: 1,
  portalPerPage: 25
};

// Router baseado em Hash
function getRoute() {
  const hash = window.location.hash || '#/';
  
  if (hash.startsWith('#/activate/')) {
    const id = hash.replace('#/activate/', '').split('?')[0];
    return { name: 'activate', params: { id } };
  }
  
  if (hash.startsWith('#/r/')) {
    const id = hash.replace('#/r/', '').split('?')[0];
    return { name: 'redirect', params: { id } };
  }

  if (hash.startsWith('#/cliente/')) {
    const code = decodeURIComponent(hash.replace('#/cliente/', '').split('?')[0]);
    return { name: 'cliente', params: { code } };
  }

  if (hash === '#/cliente' || hash === '#/meu-painel') {
    return { name: 'cliente', params: { code: null } };
  }

  if (hash === '#/admin-login' || hash === '#/login') {
    return { name: 'admin-login' };
  }

  if (hash === '#/clientes') return { name: 'clientes' };

  if (hash.startsWith('#/lote/')) {
    const batchName = decodeURIComponent(hash.replace('#/lote/', '').split('?')[0]);
    return { name: 'batch', params: { batchName } };
  }

  if (hash === '#/todas-placas') return { name: 'todas-placas' };
  if (hash === '#/gerador') return { name: 'gerador' };
  if (hash === '#/ajuda-google') return { name: 'ajuda-google' };
  if (hash === '#/config') return { name: 'config' };

  return { name: 'lotes' };
}

// Renderizador Principal
async function renderApp() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  try {
    const route = getRoute();
    state.currentRoute = route.name;
    state.currentBatch = route.params?.batchName || null;

    // 1. Redirecionamento SPA (Se aberto via link curto /r/:id)
    if (route.name === 'redirect') {
      const plaque = storage.getPlaqueById(route.params.id);
      if (plaque && plaque.status === 'active' && plaque.target_url && isValidHttpUrl(plaque.target_url)) {
        storage.recordScan(plaque.id);
        appEl.innerHTML = `
          <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #FFFFFF; font-family: sans-serif;">
            <div style="text-align: center; padding: 2rem;">
              <p style="font-size: 0.875rem; color: #64748B;">Redirecionando para as avaliações...</p>
              <p style="font-weight: 700; font-size: 1.125rem; color: #0F172A; margin-top: 0.5rem;">${plaque.name || plaque.id}</p>
            </div>
          </div>
        `;
        setTimeout(() => {
          window.location.href = plaque.target_url;
        }, 200);
        return;
      } else {
        window.location.hash = `#/activate/${route.params.id}`;
        return;
      }
    }

    // 2. Tela Pública de Ativação (SEM SIDEBAR DE ADMIN)
    if (route.name === 'activate') {
      appEl.innerHTML = `
        <main style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #F8FAFC; padding: 1.5rem 1rem;">
          ${renderActivationView(route.params.id)}
        </main>
        <div id="modal-container"></div>
      `;
      setupEventListeners();
      return;
    }

    // 3. Portal do Comprador / Cliente (SEM SIDEBAR DE ADMIN)
    if (route.name === 'cliente') {
      appEl.innerHTML = `
        ${renderClientPortalView({
          clientCode: route.params?.code,
          searchQuery: state.portalSearch,
          statusFilter: state.portalFilter,
          currentPage: state.portalPage,
          perPage: state.portalPerPage
        })}
        <div id="modal-container"></div>
      `;
      setupEventListeners();
      return;
    }

    // 4. Tela de Login do Administrador / Dono
    if (route.name === 'admin-login') {
      if (storage.isAdminAuthenticated()) {
        window.location.hash = '#/lotes';
        return;
      }
      appEl.innerHTML = `
        ${renderAdminLoginView()}
        <div id="modal-container"></div>
      `;
      setupEventListeners();
      return;
    }

    // 5. Verificação de Autenticação do Administrador para rotas de Gestão
    if (!storage.isAdminAuthenticated()) {
      appEl.innerHTML = `
        ${renderAdminLoginView()}
        <div id="modal-container"></div>
      `;
      setupEventListeners();
      return;
    }

    // 6. Painel Administrativo com Sidebar Lateral (Apenas para Administrador autenticado)
    let mainContentHtml = '';
    if (route.name === 'gerador') {
      mainContentHtml = renderBatchGenerator();
    } else if (route.name === 'clientes') {
      mainContentHtml = renderClientsView({
        searchQuery: state.clientSearch,
        sortBy: state.clientSortBy,
        sortOrder: state.clientSortOrder,
        currentPage: state.clientPage,
        perPage: state.clientPerPage
      });
    } else if (route.name === 'ajuda-google') {
      mainContentHtml = renderGoogleReviewHelper();
    } else if (route.name === 'config') {
      mainContentHtml = renderSettingsView();
    } else if (route.name === 'batch') {
      mainContentHtml = renderPlaqueTable({
        currentFilter: state.plaqueFilter,
        searchQuery: state.plaqueSearch,
        batchName: route.params.batchName,
        clientFilter: state.plaqueClientFilter,
        sortBy: state.plaqueSortBy,
        sortOrder: state.plaqueSortOrder,
        currentPage: state.plaquePage,
        perPage: state.plaquePerPage
      });
    } else if (route.name === 'todas-placas') {
      mainContentHtml = renderPlaqueTable({
        currentFilter: state.plaqueFilter,
        searchQuery: state.plaqueSearch,
        batchName: state.plaqueBatchFilter,
        clientFilter: state.plaqueClientFilter,
        sortBy: state.plaqueSortBy,
        sortOrder: state.plaqueSortOrder,
        currentPage: state.plaquePage,
        perPage: state.plaquePerPage
      });
    } else {
      mainContentHtml = renderBatchFoldersView({
        searchQuery: state.batchSearch,
        sortBy: state.batchSortBy
      });
    }

    appEl.innerHTML = `
      <div class="app-layout">
        ${renderSidebar(route.name)}
        <div class="main-wrapper">
          <main style="flex: 1;">${mainContentHtml}</main>
          <footer style="border-top: 1px solid #E2E8F0; padding: 1.25rem 0; background: #FFFFFF;" class="no-print">
            <div class="container" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted); flex-wrap: wrap; gap: 8px;">
              <div>Placas QR Pro • Sistema de Redirecionamento Dinâmico</div>
              <div style="display: flex; gap: 12px;">
                <button id="btn-footer-deploy-guide" class="btn-ghost" style="padding: 2px 4px; cursor: pointer; border: none; font-size: 0.75rem;">Guia Netlify</button>
              </div>
            </div>
          </footer>
        </div>
      </div>
      <div id="modal-container"></div>
    `;

    setupEventListeners();
  } catch (err) {
    console.error('Erro na renderização da aplicação:', err);
    appEl.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #F8FAFC; padding: 1.5rem;">
        <div class="card p-6" style="max-width: 460px; text-align: center;">
          <h2 style="font-size: 1.25rem; font-weight: 700; color: #DC2626; margin-bottom: 8px;">Recuperação do Sistema</h2>
          <p class="text-sm text-muted mb-4">Ocorreu uma pequena instabilidade ao carregar a tela. Clique no botão abaixo para restaurar a visão padrão.</p>
          <button onclick="window.location.hash='#/lotes'; window.location.reload();" class="btn btn-primary btn-sm">
            Recarregar Painel
          </button>
        </div>
      </div>
    `;
  }
}

// Configuração de Eventos
function setupEventListeners() {
  const modalContainer = document.getElementById('modal-container');

  // Controle do Menu Lateral no Mobile
  const btnToggleMobile = document.getElementById('btn-toggle-mobile-sidebar');
  const sidebarEl = document.getElementById('app-sidebar');
  const backdropEl = document.getElementById('mobile-sidebar-backdrop');
  const btnCloseMobile = document.getElementById('btn-close-mobile-sidebar');

  if (btnToggleMobile && sidebarEl) {
    btnToggleMobile.addEventListener('click', () => {
      sidebarEl.classList.toggle('open');
      if (backdropEl) backdropEl.classList.toggle('open');
    });
  }

  if (backdropEl && sidebarEl) {
    backdropEl.addEventListener('click', () => {
      sidebarEl.classList.remove('open');
      backdropEl.classList.remove('open');
    });
  }

  if (btnCloseMobile && sidebarEl) {
    btnCloseMobile.addEventListener('click', () => {
      sidebarEl.classList.remove('open');
      if (backdropEl) backdropEl.classList.remove('open');
    });
  }

  // ==========================================
  // FILTROS & PAGINAÇÃO DA TABELA DE PLACAS
  // ==========================================
  document.querySelectorAll('.btn-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.plaqueFilter = e.currentTarget.dataset.filter;
      state.plaquePage = 1;
      renderApp();
    });
  });

  const selectBatchFilter = document.getElementById('select-filter-batch');
  if (selectBatchFilter) {
    selectBatchFilter.addEventListener('change', (e) => {
      state.plaqueBatchFilter = e.target.value;
      state.plaquePage = 1;
      renderApp();
    });
  }

  const selectClientFilter = document.getElementById('select-filter-client');
  if (selectClientFilter) {
    selectClientFilter.addEventListener('change', (e) => {
      state.plaqueClientFilter = e.target.value;
      state.plaquePage = 1;
      renderApp();
    });
  }

  const selectSortBy = document.getElementById('select-sort-by');
  if (selectSortBy) {
    selectSortBy.addEventListener('change', (e) => {
      const parts = e.target.value.split(':');
      state.plaqueSortBy = parts[0] || 'created_at';
      state.plaqueSortOrder = parts[1] || 'desc';
      state.plaquePage = 1;
      renderApp();
    });
  }

  const searchInput = document.getElementById('input-search-plaques');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      state.plaqueSearch = e.target.value;
      state.plaquePage = 1;
      debounceTimer = setTimeout(() => {
        renderApp();
        const inputAfter = document.getElementById('input-search-plaques');
        if (inputAfter) {
          inputAfter.focus();
          inputAfter.setSelectionRange(inputAfter.value.length, inputAfter.value.length);
        }
      }, 250);
    });
  }

  const btnClearSearchInput = document.getElementById('btn-clear-search-input');
  if (btnClearSearchInput) {
    btnClearSearchInput.addEventListener('click', () => {
      state.plaqueSearch = '';
      state.plaquePage = 1;
      renderApp();
    });
  }

  const btnClearPlaqueFilters = document.getElementById('btn-clear-plaque-filters');
  const btnResetFiltersInline = document.getElementById('btn-reset-filters-inline');
  const handleResetPlaqueFilters = () => {
    state.plaqueFilter = 'all';
    state.plaqueSearch = '';
    state.plaqueBatchFilter = 'all';
    state.plaqueClientFilter = 'all';
    state.plaqueSortBy = 'created_at';
    state.plaqueSortOrder = 'desc';
    state.plaquePage = 1;
    renderApp();
  };
  if (btnClearPlaqueFilters) btnClearPlaqueFilters.addEventListener('click', handleResetPlaqueFilters);
  if (btnResetFiltersInline) btnResetFiltersInline.addEventListener('click', handleResetPlaqueFilters);

  // ==========================================
  // FILTROS & PAGINAÇÃO DE CLIENTES
  // ==========================================
  const selectSortClients = document.getElementById('select-sort-clients');
  if (selectSortClients) {
    selectSortClients.addEventListener('change', (e) => {
      const parts = e.target.value.split(':');
      state.clientSortBy = parts[0] || 'count';
      state.clientSortOrder = parts[1] || 'desc';
      state.clientPage = 1;
      renderApp();
    });
  }

  const inputSearchClients = document.getElementById('input-search-clients');
  if (inputSearchClients) {
    let debounceTimer;
    inputSearchClients.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      state.clientSearch = e.target.value;
      state.clientPage = 1;
      debounceTimer = setTimeout(() => {
        renderApp();
        const inputAfter = document.getElementById('input-search-clients');
        if (inputAfter) {
          inputAfter.focus();
          inputAfter.setSelectionRange(inputAfter.value.length, inputAfter.value.length);
        }
      }, 250);
    });
  }

  const btnClearClientFilters = document.getElementById('btn-clear-client-filters');
  const btnClearClientSearch = document.getElementById('btn-clear-client-search');
  const btnResetClientSearchInline = document.getElementById('btn-reset-client-search-inline');
  const handleResetClientFilters = () => {
    state.clientSearch = '';
    state.clientSortBy = 'count';
    state.clientSortOrder = 'desc';
    state.clientPage = 1;
    renderApp();
  };
  if (btnClearClientFilters) btnClearClientFilters.addEventListener('click', handleResetClientFilters);
  if (btnClearClientSearch) btnClearClientSearch.addEventListener('click', handleResetClientFilters);
  if (btnResetClientSearchInline) btnResetClientSearchInline.addEventListener('click', handleResetClientFilters);

  // ==========================================
  // FILTROS & BUSCA DE PASTAS DE LOTES
  // ==========================================
  const selectSortBatches = document.getElementById('select-sort-batches');
  if (selectSortBatches) {
    selectSortBatches.addEventListener('change', (e) => {
      state.batchSortBy = e.target.value;
      renderApp();
    });
  }

  const inputSearchBatches = document.getElementById('input-search-batches');
  if (inputSearchBatches) {
    let debounceTimer;
    inputSearchBatches.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      state.batchSearch = e.target.value;
      debounceTimer = setTimeout(() => {
        renderApp();
        const inputAfter = document.getElementById('input-search-batches');
        if (inputAfter) {
          inputAfter.focus();
          inputAfter.setSelectionRange(inputAfter.value.length, inputAfter.value.length);
        }
      }, 250);
    });
  }

  const btnClearBatchFilters = document.getElementById('btn-clear-batch-filters');
  const btnClearBatchSearch = document.getElementById('btn-clear-batch-search');
  const btnResetBatchSearchInline = document.getElementById('btn-reset-batch-search-inline');
  const handleResetBatchFilters = () => {
    state.batchSearch = '';
    state.batchSortBy = 'recent';
    renderApp();
  };
  if (btnClearBatchFilters) btnClearBatchFilters.addEventListener('click', handleResetBatchFilters);
  if (btnClearBatchSearch) btnClearBatchSearch.addEventListener('click', handleResetBatchFilters);
  if (btnResetBatchSearchInline) btnResetBatchSearchInline.addEventListener('click', handleResetBatchFilters);

  // ==========================================
  // FILTROS & BUSCA DO PORTAL DO CLIENTE
  // ==========================================
  document.querySelectorAll('.btn-client-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.portalFilter = e.currentTarget.dataset.filter;
      state.portalPage = 1;
      renderApp();
    });
  });

  const inputSearchClientPlaques = document.getElementById('input-search-client-plaques');
  if (inputSearchClientPlaques) {
    let debounceTimer;
    inputSearchClientPlaques.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      state.portalSearch = e.target.value;
      state.portalPage = 1;
      debounceTimer = setTimeout(() => {
        renderApp();
        const inputAfter = document.getElementById('input-search-client-plaques');
        if (inputAfter) {
          inputAfter.focus();
          inputAfter.setSelectionRange(inputAfter.value.length, inputAfter.value.length);
        }
      }, 250);
    });
  }

  const btnClearClientPortalSearch = document.getElementById('btn-clear-client-portal-search');
  if (btnClearClientPortalSearch) {
    btnClearClientPortalSearch.addEventListener('click', () => {
      state.portalSearch = '';
      state.portalPage = 1;
      renderApp();
    });
  }

  // ==========================================
  // EVENTOS GENÉRICOS DE PAGINAÇÃO
  // ==========================================
  document.querySelectorAll('.btn-pagination-page, .btn-pagination-nav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = parseInt(e.currentTarget.dataset.page, 10);
      if (isNaN(page) || page < 1) return;
      const bar = e.currentTarget.closest('.pagination-bar');
      const prefix = bar?.dataset.prefix || 'plaque';

      if (prefix === 'plaque') {
        state.plaquePage = page;
      } else if (prefix === 'client') {
        state.clientPage = page;
      } else if (prefix === 'client-portal') {
        state.portalPage = page;
      }
      renderApp();
    });
  });

  document.querySelectorAll('.pagination-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10) || 25;
      const bar = e.target.closest('.pagination-bar');
      const prefix = bar?.dataset.prefix || 'plaque';

      if (prefix === 'plaque') {
        state.plaquePerPage = val;
        state.plaquePage = 1;
      } else if (prefix === 'client') {
        state.clientPerPage = val;
        state.clientPage = 1;
      } else if (prefix === 'client-portal') {
        state.portalPerPage = val;
        state.portalPage = 1;
      }
      renderApp();
    });
  });

  // ==========================================
  // ABERTURA DE MODAIS
  // ==========================================
  document.querySelectorAll('.btn-view-qr').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      state.activePlaqueId = id;
      modalContainer.innerHTML = await renderQRModal(id);
      setupModalListeners();
    });
  });

  document.querySelectorAll('.btn-edit-plaque').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      state.activePlaqueId = id;
      modalContainer.innerHTML = renderEditModal(id);
      setupModalListeners();
    });
  });

  const btnFooterDeploy = document.getElementById('btn-footer-deploy-guide');
  if (btnFooterDeploy) {
    btnFooterDeploy.addEventListener('click', () => {
      modalContainer.innerHTML = renderDeployGuideModal();
      setupModalListeners();
    });
  }

  // Exportar Tabela Completa em CSV Instantâneo
  const btnExportCsv = document.getElementById('btn-export-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const plaques = state.currentBatch ? storage.getPlaquesByBatch(state.currentBatch) : storage.getAllPlaques();
      exportBatchCsv(plaques, state.currentBatch ? `lote-${state.currentBatch}.csv` : 'todas-placas.csv');
    });
  }

  // Baixar Todos em ZIP
  const btnExportAll = document.getElementById('btn-export-all-zip');
  if (btnExportAll) {
    btnExportAll.addEventListener('click', async () => {
      const plaques = storage.getAllPlaques();
      btnExportAll.textContent = 'Gerando ZIP...';
      btnExportAll.disabled = true;
      try {
        await exportBatchZip(plaques, 'Lote-Geral-QRCodes');
      } catch (err) {
        alert('Erro ao gerar pacote ZIP: ' + err.message);
      } finally {
        btnExportAll.textContent = 'Baixar Todos em ZIP';
        btnExportAll.disabled = false;
      }
    });
  }

  // Baixar Lote Específico em ZIP
  document.querySelectorAll('.btn-download-batch-zip').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const batchName = e.currentTarget.dataset.batch;
      const plaques = storage.getPlaquesByBatch(batchName);
      const originalText = btn.textContent;
      btn.textContent = 'Gerando ZIP...';
      btn.disabled = true;
      try {
        const cleanName = (batchName || 'Lote').replace(/[^a-zA-Z0-9_-]/g, '_');
        await exportBatchZip(plaques, `Lote-${cleanName}`);
      } catch (err) {
        alert('Erro ao gerar pacote ZIP: ' + err.message);
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  });

  // Copiar link do portal do cliente
  document.querySelectorAll('.btn-copy-client-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.currentTarget.dataset.url;
      copyToClipboard(url);
      btn.textContent = 'Link Copiado!';
      setTimeout(() => { btn.textContent = 'Copiar Link'; }, 1800);
    });
  });

  // Login do Cliente (por telefone ou código invertido)
  const formClientLogin = document.getElementById('form-client-login');
  if (formClientLogin) {
    formClientLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('client-login-input').value.trim();
      if (!input) return;

      const client = storage.getClientByCode(input);
      if (client) {
        window.location.hash = `#/cliente/${encodeURIComponent(client.client_code)}`;
      } else {
        alert('Nenhum comprador encontrado com este telefone ou código invertido. Verifique o número digitado.');
      }
    });
  }

  // Preview dinâmico de código invertido na digitação do telefone na ativação
  const actPhoneInput = document.getElementById('act-client-phone');
  if (actPhoneInput) {
    actPhoneInput.addEventListener('input', (e) => {
      const val = e.target.value;
      const codePreviewBox = document.getElementById('box-code-preview');
      const reversed = getReversedPhoneCode(val);
      if (codePreviewBox) {
        if (reversed) {
          codePreviewBox.innerHTML = `${getIcon('key', 'text-blue', 13)} <span>Seu código de login será: <strong class="font-mono text-blue">${reversed}</strong></span>`;
        } else {
          codePreviewBox.innerHTML = `${getIcon('info', 'text-muted', 13)} <span>Seu código de login para ver todas as suas placas será o seu número invertido.</span>`;
        }
      }
    });
  }

  // Formulário de Criação de Lotes
  const formBatch = document.getElementById('form-batch-create');
  if (formBatch) {
    const prefixInput = document.getElementById('batch-prefix');
    const startInput = document.getElementById('batch-start');
    const countInput = document.getElementById('batch-count');
    const previewRange = document.getElementById('preview-range');

    const updateRangePreview = () => {
      const prefix = prefixInput.value || 'PLQ-';
      const start = parseInt(startInput.value, 10) || 1;
      const count = parseInt(countInput.value, 10) || 10;
      const end = start + count - 1;
      const padLen = Math.max(3, String(end).length);
      previewRange.textContent = `${prefix}${String(start).padStart(padLen, '0')} até ${prefix}${String(end).padStart(padLen, '0')} (${count} códigos)`;
    };

    prefixInput.addEventListener('input', updateRangePreview);
    startInput.addEventListener('input', updateRangePreview);
    countInput.addEventListener('input', updateRangePreview);

    document.querySelectorAll('.btn-count-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.btn-count-preset').forEach(b => {
          b.className = 'btn btn-secondary btn-sm btn-count-preset';
        });
        e.currentTarget.className = 'btn btn-primary btn-sm btn-count-preset';
        countInput.value = e.currentTarget.dataset.count;
        updateRangePreview();
      });
    });

    formBatch.addEventListener('submit', async (e) => {
      e.preventDefault();
      const batchName = document.getElementById('batch-name').value;
      const prefix = prefixInput.value.trim() || 'PLQ-';
      const startNumber = parseInt(startInput.value, 10) || 1;
      const count = parseInt(countInput.value, 10) || 10;

      const submitBtn = document.getElementById('btn-submit-batch');
      submitBtn.textContent = 'Gerando códigos e pacote ZIP...';
      submitBtn.disabled = true;

      try {
        const newPlaques = await storage.createBatch({
          prefix,
          startNumber,
          count,
          batchName
        });

        await exportBatchZip(newPlaques, batchName.replace(/\s+/g, '-'));
        window.location.hash = `#/lote/${encodeURIComponent(batchName)}`;
      } catch (err) {
        alert('Erro ao criar lote: ' + err.message);
        submitBtn.textContent = 'Gerar Lote e Baixar ZIP';
        submitBtn.disabled = false;
      }
    });
  }

  // Formulário de Ativação do Cliente
  const formActivate = document.getElementById('form-activate-plaque');
  if (formActivate) {
    formActivate.addEventListener('submit', async (e) => {
      e.preventDefault();
      const plaqueId = e.currentTarget.dataset.id;
      const clientName = document.getElementById('act-client-name')?.value || '';
      const clientPhone = document.getElementById('act-client-phone')?.value || '';
      const companyName = document.getElementById('act-company-name')?.value || '';
      const googleUrlInput = document.getElementById('act-google-url')?.value || '';
      const pin = document.getElementById('act-pin')?.value || '1234';

      const targetUrl = buildGoogleReviewUrl(googleUrlInput);
      if (!isValidHttpUrl(targetUrl)) {
        alert('Por favor, insira um link válido do Google.');
        return;
      }

      const submitBtn = document.getElementById('btn-submit-activate');
      submitBtn.textContent = 'Salvando e ativando...';
      submitBtn.disabled = true;

      const clientCode = getReversedPhoneCode(clientPhone);

      const result = await storage.activatePlaque(plaqueId, {
        name: companyName,
        targetUrl,
        pin,
        clientName,
        clientPhone,
        clientCode
      });

      if (result.success) {
        const container = document.getElementById('activation-card-container');
        if (container) {
          container.innerHTML = `
            <div style="text-align: center; padding: 2rem 1rem;">
              <div style="width: 56px; height: 56px; background: #ECFDF5; border: 1px solid #A7F3D0; color: #16A34A; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
                ${getIcon('check', '', 28)}
              </div>
              <h2 style="font-size: 1.25rem; font-weight: 700; color: #0F172A; margin-bottom: 0.5rem;">Plaquinha Ativada com Sucesso!</h2>
              <p class="text-sm text-muted mb-4">Esta plaquinha foi vinculada à sua empresa e adicionada à sua conta.</p>

              <div class="card p-4 text-left mb-4" style="background: #F8FAFC;">
                <div class="text-xs text-muted mb-1">Empresa cadastrada:</div>
                <div class="font-bold text-sm mb-2">${result.plaque.name}</div>
                <div class="text-xs text-muted mb-1">Responsável:</div>
                <div class="text-sm font-medium mb-2">${result.plaque.client_name || clientName} (${formatPhone(result.plaque.client_phone)})</div>
                <div class="text-xs text-muted mb-1">Seu Código de Login Sem Senha:</div>
                <div class="font-mono font-bold text-blue text-sm" style="display: flex; align-items: center; gap: 4px;">
                  ${getIcon('key', '', 14)}
                  <span>${clientCode || result.plaque.client_code}</span>
                </div>
              </div>

              <div style="display: flex; gap: 8px; justify-content: center; flex-direction: column;">
                <a href="#/cliente/${clientCode}" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
                  <span>Acessar Meu Painel de Plaquinhas</span>
                  ${getIcon('arrowRight', '', 14)}
                </a>
                <a href="${result.plaque.target_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                  Testar Link no Google
                </a>
              </div>
            </div>
          `;
        }
      } else {
        alert('Erro na ativação: ' + result.error);
        submitBtn.textContent = 'Ativar e Vincular Plaquinha';
        submitBtn.disabled = false;
      }
    });
  }

  // Gerador Auxiliar do Google
  const btnGenGUrl = document.getElementById('btn-generate-google-url');
  if (btnGenGUrl) {
    btnGenGUrl.addEventListener('click', () => {
      const input = document.getElementById('input-google-place-id').value;
      const resultBox = document.getElementById('google-url-result');
      const output = document.getElementById('output-google-url');
      if (input.trim()) {
        const url = buildGoogleReviewUrl(input);
        output.value = url;
        resultBox.classList.remove('hidden');
      }
    });
  }

  // Configurações
  const formDomain = document.getElementById('form-settings-domain');
  if (formDomain) {
    formDomain.addEventListener('submit', (e) => {
      e.preventDefault();
      const baseUrl = document.getElementById('cfg-base-url').value.trim();
      if (!isValidHttpUrl(baseUrl)) {
        alert('URL inválida. Use um link completo com https://');
        return;
      }
      storage.saveSettings({ baseUrl });
      alert('Domínio de produção salvo com sucesso!');
    });
  }

  const formDb = document.getElementById('form-settings-db');
  if (formDb) {
    formDb.addEventListener('submit', async (e) => {
      e.preventDefault();
      const supabaseUrl = document.getElementById('cfg-supabase-url').value.trim();
      const supabaseKey = document.getElementById('cfg-supabase-key').value.trim();
      storage.saveSettings({ supabaseUrl, supabaseKey });
      alert('Credenciais salvas! Sincronizando com a nuvem...');
      await storage.initCloudAndServerSync();
      renderApp();
    });

    const btnShowSql = document.getElementById('btn-show-sql-schema');
    if (btnShowSql) {
      btnShowSql.addEventListener('click', () => {
        const container = document.getElementById('sql-schema-container');
        if (container) container.classList.toggle('hidden');
      });
    }

    const btnCopySql = document.getElementById('btn-copy-sql');
    if (btnCopySql) {
      btnCopySql.addEventListener('click', () => {
        const sqlText = document.querySelector('#sql-schema-container pre')?.textContent || '';
        copyToClipboard(sqlText);
        btnCopySql.textContent = 'Copiado!';
        setTimeout(() => { btnCopySql.textContent = 'Copiar SQL'; }, 1800);
      });
    }

    const btnBackupJson = document.getElementById('btn-download-json-backup');
    if (btnBackupJson) {
      btnBackupJson.addEventListener('click', () => {
        const json = storage.exportBackupJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-placas-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }

    const fileRestore = document.getElementById('file-restore-json');
    if (fileRestore) {
      fileRestore.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const res = await storage.importBackupJSON(event.target.result);
            if (res.success) {
              alert(`Backup restaurado com sucesso! ${res.count} placas importadas.`);
              renderApp();
            } else {
              alert('Erro: ' + res.error);
            }
          };
          reader.readAsText(file);
        }
      });
    }
  }

  // 1. Login do Administrador / Dono
  const formAdminLogin = document.getElementById('form-admin-login');
  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userInput = document.getElementById('admin-login-username');
      const passInput = document.getElementById('admin-login-password');
      const rememberMe = document.getElementById('admin-remember-me')?.checked ?? true;
      const errDiv = document.getElementById('admin-login-error');
      const submitBtn = document.getElementById('btn-submit-admin-login');
      if (!userInput || !passInput) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificando...';
      }

      const res = await storage.loginAdmin(userInput.value, passInput.value, rememberMe);
      if (res.success) {
        if (errDiv) errDiv.classList.add('hidden');
        if (window.location.hash === '#/admin-login' || window.location.hash === '#/login') {
          window.location.hash = '#/lotes';
        } else {
          renderApp();
        }
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Entrar no Painel</span> ${getIcon('arrowRight', '', 16)}`;
        }
        if (errDiv) {
          errDiv.textContent = res.error || 'Usuário ou senha incorretos.';
          errDiv.classList.remove('hidden');
        } else {
          alert(res.error || 'Usuário ou senha incorretos.');
        }
      }
    });
  }

  // 2. Logout do Administrador
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      if (confirm('Deseja realmente sair do painel administrativo?')) {
        storage.logoutAdmin();
        renderApp();
      }
    });
  }

  // 3. Alteração de Credenciais de Administrador (Usuário & Senha)
  const formSettingsPass = document.getElementById('form-settings-password');
  if (formSettingsPass) {
    formSettingsPass.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newUsername = document.getElementById('cfg-admin-user')?.value || 'admin';
      const newPass = document.getElementById('cfg-new-pass')?.value || '';
      const confirmPass = document.getElementById('cfg-confirm-pass')?.value || '';

      if (newPass && newPass !== confirmPass) {
        alert('As senhas digitadas não conferem. Verifique e tente novamente.');
        return;
      }
      try {
        await storage.setAdminCredentials(newUsername, newPass);
        alert('Credenciais do Dono/Administrador atualizadas com sucesso e criptografadas (SHA-256)!');
        if (document.getElementById('cfg-new-pass')) document.getElementById('cfg-new-pass').value = '';
        if (document.getElementById('cfg-confirm-pass')) document.getElementById('cfg-confirm-pass').value = '';
      } catch (err) {
        alert('Erro ao alterar credenciais: ' + err.message);
      }
    });
  }
}

// Configuração dos Eventos dos Modais
function setupModalListeners() {
  const modalContainer = document.getElementById('modal-container');

  const closeModal = () => {
    modalContainer.innerHTML = '';
  };

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // Fechar ao clicar no fundo escuro do modal
  const modalOverlay = document.querySelector('.modal-overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  const formEdit = document.getElementById('form-edit-modal-save');
  if (formEdit) {
    formEdit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const plaqueId = e.currentTarget.dataset.id;
      const name = document.getElementById('edit-name').value;
      const target_url = document.getElementById('edit-target-url').value;
      const client_name = document.getElementById('edit-client-name')?.value || '';
      const client_phone = document.getElementById('edit-client-phone')?.value || '';
      const client_code = client_phone ? getReversedPhoneCode(client_phone) : '';
      const pin = document.getElementById('edit-pin').value;
      const status = document.getElementById('edit-status').value;

      try {
        await storage.updatePlaque(plaqueId, { 
          name, 
          target_url, 
          client_name, 
          client_phone, 
          client_code, 
          pin, 
          status 
        });
        closeModal();
        renderApp();
      } catch (err) {
        alert('Erro ao salvar: ' + err.message);
      }
    });
  }

  const btnDownloadSvg = document.getElementById('btn-download-svg-single');
  if (btnDownloadSvg) {
    btnDownloadSvg.addEventListener('click', async () => {
      const plaque = storage.getPlaqueById(state.activePlaqueId);
      if (plaque) {
        const svgString = await generateCleanQRCodeSvg(plaque.id, true);
        downloadSvg(svgString, `qrcode-${plaque.id}-quadrado.svg`);
      }
    });
  }

  const btnDownloadPng = document.getElementById('btn-download-png-single');
  if (btnDownloadPng) {
    btnDownloadPng.addEventListener('click', async () => {
      const plaque = storage.getPlaqueById(state.activePlaqueId);
      if (plaque) {
        const pngUrl = await generateCleanQRCodePng(plaque.id, 1000, true);
        if (pngUrl) {
          downloadPng(pngUrl, `qrcode-${plaque.id}-1000x1000px.png`);
        }
      }
    });
  }

  document.querySelectorAll('.btn-copy-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const url = e.currentTarget.dataset.url;
      copyToClipboard(url);
      btn.textContent = 'Copiado!';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 1800);
    });
  });
}

// Fechar modal com a tecla ESC
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer && modalContainer.innerHTML) {
      modalContainer.innerHTML = '';
    }
  }
});

// Inicialização da Aplicação e reset de páginas na navegação
window.addEventListener('hashchange', () => {
  state.plaquePage = 1;
  state.clientPage = 1;
  state.portalPage = 1;
  renderApp();
});

// Inicialização Imediata e Resiliente (Resolve tela branca em refresh)
function startApp() {
  // 1. Renderiza imediatamente com dados em cache local (sem esperar rede)
  renderApp();

  // 2. Sincroniza em segundo plano com o Supabase/API Local e re-renderiza se houver novidades
  storage.initServerSync().then(() => {
    renderApp();
  }).catch(() => {});
}

// Inicia imediatamente se o DOM já estiver pronto (ou escuta DOMContentLoaded se ainda estiver carregando)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

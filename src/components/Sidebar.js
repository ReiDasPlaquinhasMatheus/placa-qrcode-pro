import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';
import { getEnvLabel } from '../utils/helpers.js';

export function renderSidebar(activeRoute = 'lotes') {
  const stats = storage.getStats();
  const batches = storage.getBatches();
  const clients = storage.getClients();
  const hasCloudDb = Boolean(storage.settings?.supabaseUrl && storage.settings?.supabaseKey);

  return `
    <!-- Mobile Header -->
    <div class="mobile-header">
      <a href="#/lotes" style="font-weight: 700; font-size: 0.9375rem; color: #FFFFFF; display: flex; align-items: center; gap: 8px; text-decoration: none;">
        <img src="/logo.png" alt="Rei do NFC" style="height: 28px; width: 28px; object-fit: contain;" />
        <span style="letter-spacing: -0.01em;">REI DO NFC</span>
        <span class="sidebar-brand-badge">${getEnvLabel()}</span>
      </a>
      <button id="btn-toggle-mobile-sidebar" class="btn btn-ghost btn-sm" style="color: #FFFFFF; padding: 4px 6px;">
        ${getIcon('menu', '', 18)}
      </button>
    </div>

    <!-- Mobile Backdrop Overlay -->
    <div class="mobile-backdrop" id="mobile-sidebar-backdrop"></div>

    <!-- Sidebar Principal Linear Workstation -->
    <aside class="sidebar" id="app-sidebar">
      
      <!-- Topo / Marca -->
      <div class="sidebar-header">
        <a href="#/lotes" class="sidebar-brand" style="text-decoration: none;">
          <img src="/logo.png" alt="Rei do NFC" style="width: 32px; height: 32px; object-fit: contain; flex-shrink: 0;" />
          <div style="overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="line-height: 1.15; font-weight: 700; font-size: 0.9375rem; color: #FFFFFF; letter-spacing: -0.01em;">REI DO NFC</span>
              <span class="sidebar-brand-badge">${getEnvLabel()}</span>
            </div>
            <div style="font-size: 0.625rem; color: #94A3B8; font-weight: 500; font-family: var(--font-mono); letter-spacing: 0.02em; margin-top: 2px;">Hardware & QR OS</div>
          </div>
        </a>
        <button id="btn-close-mobile-sidebar" class="btn btn-ghost btn-sm" style="color: #94A3B8; display: none;" title="Fechar Menu">
          ${getIcon('close', '', 16)}
        </button>
      </div>

      <!-- Navegação Principal -->
      <nav class="sidebar-nav">
        
        <div class="nav-section-title">Visão Geral</div>

        <a href="#/dashboard" class="nav-item ${activeRoute === 'dashboard' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('barchart', '', 16)}</span>
          <span>Métricas & Tráfego</span>
        </a>

        <div class="nav-section-title" style="margin-top: 0.5rem;">Gerenciamento</div>

        <a href="#/lotes" class="nav-item ${activeRoute === 'lotes' || activeRoute === 'batch' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('folder', '', 16)}</span>
          <span>Pastas de Lotes</span>
          <span class="nav-badge">${batches.length}</span>
        </a>

        <a href="#/clientes" class="nav-item ${activeRoute === 'clientes' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('users', '', 16)}</span>
          <span>Usuários & Clientes</span>
          <span class="nav-badge">${clients.length}</span>
        </a>

        <a href="#/todas-placas" class="nav-item ${activeRoute === 'todas-placas' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('grid', '', 16)}</span>
          <span>Inventário de Placas</span>
          <span class="nav-badge">${stats.total}</span>
        </a>

        <div class="nav-section-title" style="margin-top: 0.5rem;">Fábrica & Operação</div>

        <a href="#/gerador" class="nav-item ${activeRoute === 'gerador' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('plus', '', 16)}</span>
          <span>Emitir Novo Lote</span>
        </a>

        <a href="#/ajuda-google" class="nav-item ${activeRoute === 'ajuda-google' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('star', '', 16)}</span>
          <span>Link Google Avaliações</span>
        </a>

        <div class="nav-section-title" style="margin-top: 0.5rem;">Acesso Externo & Ajustes</div>

        <a href="#/cliente" target="_blank" class="nav-item">
          <span class="nav-item-icon">${getIcon('user', '', 16)}</span>
          <span>Portal do Comprador</span>
          <span style="margin-left: auto; color: #64748B;">${getIcon('externalLink', '', 12)}</span>
        </a>

        <a href="#/config" class="nav-item ${activeRoute === 'config' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('settings', '', 16)}</span>
          <span>Configurações & Banco</span>
        </a>

      </nav>

      <!-- Rodapé da Sidebar -->
      <div class="sidebar-footer">
        <div class="status-indicator">
          <span class="status-dot" style="background-color: ${hasCloudDb ? '#059669' : '#D97706'};"></span>
          <span>${hasCloudDb ? 'Supabase Nuvem' : 'Local'}</span>
        </div>
        <div id="sync-status-text" style="font-size: 0.625rem; color: #64748B; font-family: var(--font-mono); margin: -2px 0 2px 14px;">${storage.getSyncLabel()}</div>
        <div style="display: flex; justify-content: space-between; font-size: 0.6875rem; color: #64748B; font-family: var(--font-mono);">
          <span>Leituras:</span>
          <span style="color: #F3F4F6; font-weight: 600;">${stats.totalScans.toLocaleString('pt-BR')}</span>
        </div>
        <button id="btn-admin-logout" class="btn btn-ghost btn-sm" style="color: #94A3B8; justify-content: flex-start; padding: 5px 8px; font-size: 0.6875rem; margin-top: 2px; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-xs); gap: 6px;">
          ${getIcon('logOut', '', 14)}
          <span>Encerrar Sessão</span>
        </button>
      </div>

    </aside>
  `;
}

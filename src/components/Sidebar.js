import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';

export function renderSidebar(activeRoute = 'lotes') {
  const stats = storage.getStats();
  const batches = storage.getBatches();
  const clients = storage.getClients();
  const hasCloudDb = Boolean(storage.settings?.supabaseUrl && storage.settings?.supabaseKey);

  return `
    <!-- Mobile Header -->
    <div class="mobile-header">
      <a href="#/lotes" style="font-weight: 800; font-size: 1.05rem; color: #FFFFFF; display: flex; align-items: center; gap: 10px; text-decoration: none;">
        <img src="/logo.png" alt="Rei do NFC" style="height: 34px; width: 34px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(37,99,235,0.5));" />
        <span style="letter-spacing: -0.01em;">REI DO NFC</span>
      </a>
      <button id="btn-toggle-mobile-sidebar" class="btn btn-ghost btn-sm" style="color: #FFFFFF; padding: 4px 8px;">
        ${getIcon('menu', '', 20)}
      </button>
    </div>

    <!-- Mobile Backdrop Overlay -->
    <div class="mobile-backdrop" id="mobile-sidebar-backdrop"></div>

    <!-- Sidebar Principal -->
    <aside class="sidebar" id="app-sidebar">
      
      <!-- Topo / Marca -->
      <div class="sidebar-header" style="padding: 1.25rem 1.15rem 1rem;">
        <a href="#/lotes" class="sidebar-brand" style="display: flex; align-items: center; gap: 12px; text-decoration: none;">
          <img src="/logo.png" alt="Rei do NFC" style="width: 44px; height: 44px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 4px 12px rgba(37,99,235,0.45));" />
          <div style="overflow: hidden;">
            <div style="line-height: 1.15; font-weight: 800; font-size: 1rem; color: #FFFFFF; letter-spacing: -0.01em;">REI DO NFC</div>
            <div style="font-size: 0.6875rem; color: #60A5FA; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px;">Placas QR Pro</div>
          </div>
        </a>
        <button id="btn-close-mobile-sidebar" class="btn btn-ghost btn-sm" style="color: #94A3B8; display: none;" title="Fechar Menu">
          ${getIcon('close', '', 18)}
        </button>
      </div>

      <!-- Navegação Principal -->
      <nav class="sidebar-nav">
        
        <div class="nav-section-title">Visão Geral</div>

        <a href="#/dashboard" class="nav-item ${activeRoute === 'dashboard' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('barchart', '', 18)}</span>
          <span>Dashboard & Métricas</span>
          <span class="nav-badge" style="background: rgba(37,99,235,0.25); color: #60A5FA;">Ao Vivo</span>
        </a>

        <div class="nav-section-title" style="margin-top: 0.75rem;">Gerenciamento</div>

        <a href="#/lotes" class="nav-item ${activeRoute === 'lotes' || activeRoute === 'batch' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('folder', '', 18)}</span>
          <span>Pastas de Lotes</span>
          <span class="nav-badge">${batches.length}</span>
        </a>

        <a href="#/clientes" class="nav-item ${activeRoute === 'clientes' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('users', '', 18)}</span>
          <span>Usuários & Clientes</span>
          <span class="nav-badge">${clients.length}</span>
        </a>

        <a href="#/todas-placas" class="nav-item ${activeRoute === 'todas-placas' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('grid', '', 18)}</span>
          <span>Todas as Placas</span>
          <span class="nav-badge">${stats.total}</span>
        </a>

        <div class="nav-section-title" style="margin-top: 0.75rem;">Operação & Emissão</div>

        <a href="#/gerador" class="nav-item ${activeRoute === 'gerador' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('plus', '', 18)}</span>
          <span>Emitir Novo Lote</span>
        </a>

        <a href="#/ajuda-google" class="nav-item ${activeRoute === 'ajuda-google' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('star', '', 18)}</span>
          <span>Link Google Avaliação</span>
        </a>

        <div class="nav-section-title" style="margin-top: 0.75rem;">Acesso & Sistema</div>

        <a href="#/cliente" target="_blank" class="nav-item">
          <span class="nav-item-icon">${getIcon('user', '', 18)}</span>
          <span>Área do Comprador</span>
          <span style="margin-left: auto; color: #94A3B8;">${getIcon('externalLink', '', 14)}</span>
        </a>

        <a href="#/config" class="nav-item ${activeRoute === 'config' ? 'active' : ''}">
          <span class="nav-item-icon">${getIcon('settings', '', 18)}</span>
          <span>Configurações & Backup</span>
        </a>

      </nav>

      <!-- Rodapé da Sidebar -->
      <div class="sidebar-footer">
        <div class="status-indicator">
          <span class="status-dot" style="background-color: ${hasCloudDb ? '#16A34A' : '#EAB308'};"></span>
          <span>${hasCloudDb ? 'Supabase Nuvem Ativo' : 'Armazenamento Local'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #64748B;">
          <span>Total de Scans:</span>
          <span style="color: #F8FAFC; font-weight: 700;">${stats.totalScans}</span>
        </div>
        <button id="btn-admin-logout" class="btn btn-ghost btn-sm" style="color: #94A3B8; justify-content: flex-start; padding: 6px 8px; font-size: 0.75rem; margin-top: 4px; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; gap: 8px;">
          ${getIcon('logOut', '', 16)}
          <span>Sair do Painel</span>
        </button>
      </div>

    </aside>
  `;
}

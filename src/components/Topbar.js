import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/helpers.js';

// Barra superior do painel (desktop). A busca leva para o Inventário de Placas
// já filtrado (por ID, empresa, cliente, telefone ou link).
export function renderTopbar() {
  const username = storage.getAdminUsername() || 'Admin';
  const initial = escapeHtml(username.trim().charAt(0).toUpperCase() || 'A');
  const syncLabel = storage.getSyncLabel() || 'Dados carregados';

  return `
    <header class="topbar no-print">
      <div class="topbar-left">
        <span class="topbar-sync" title="Estado da sincronização com a nuvem">
          <span class="dot"></span>
          <span id="topbar-sync-text">${escapeHtml(syncLabel)}</span>
        </span>
      </div>

      <div class="topbar-right">
        <form id="form-topbar-search" class="topbar-search" role="search">
          <span class="icon-wrap">${getIcon('search', '', 16)}</span>
          <input type="search" id="topbar-search-input" placeholder="Buscar placa, empresa ou cliente..." autocomplete="off" aria-label="Buscar placa, empresa ou cliente" />
        </form>

        <div class="topbar-user">
          <div class="topbar-avatar" aria-hidden="true">${initial}</div>
          <div>
            <div class="topbar-user-name">${escapeHtml(username)}</div>
            <div class="topbar-user-role">Administrador</div>
          </div>
        </div>
      </div>
    </header>
  `;
}

import { storage } from '../services/storage.js';
import { formatPhone, formatRelativeTime, escapeHtml } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';
import { renderPagination } from './Pagination.js';

export function renderClientPortalView({
  clientCode = null,
  searchQuery = '',
  statusFilter = 'all',
  currentPage = 1,
  perPage = 25
} = {}) {
  const client = clientCode ? storage.getClientByCode(clientCode) : null;

  // 1. Tela de Login Sem Senha (apenas número invertido ou telefone)
  if (!client) {
    return `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #F8FAFC; padding: 1.5rem 1rem;">
        <div class="card p-6" style="max-width: 440px; width: 100%; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.06);">
          
          <div class="text-center mb-6">
            <div style="width: 52px; height: 52px; background: #EEF2FF; border: 1px solid #E0E7FF; color: #4F46E5; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
              ${getIcon('user', '', 26)}
            </div>
            <h1 style="font-size: 1.375rem; font-weight: 700; color: #0F172A;">Área do Cliente</h1>
            <p class="text-xs text-muted mt-1">Gerencie suas plaquinhas QR Code e acompanhe suas avaliações do Google.</p>
          </div>

          <form id="form-client-login">
            <div class="form-group mb-4">
              <label class="form-label" for="client-login-input">Telefone de Contato ou Código de Acesso</label>
              <input 
                type="text" 
                id="client-login-input" 
                class="form-input font-mono" 
                placeholder="Ex: (11) 98765-4321 ou código invertido" 
                required 
                autofocus 
              />
              <span class="text-xs text-muted" style="font-size: 0.725rem; margin-top: 6px; display: flex; align-items: center; gap: 4px;">
                ${getIcon('info', '', 13)}
                <span>Dica: Seu código de login é o seu número de telefone com os dígitos invertidos.</span>
              </span>
            </div>

            <button type="submit" class="btn btn-primary w-full" style="padding: 0.625rem; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <span>Acessar Minhas Plaquinhas</span>
              ${getIcon('arrowRight', '', 16)}
            </button>
          </form>

        </div>
      </div>
    `;
  }

  // 2. Painel Privado do Cliente Logado
  const allPlaques = client.plaques || [];
  const activeCount = allPlaques.filter(p => p.status === 'active').length;
  const virginCount = allPlaques.filter(p => p.status === 'virgin').length;
  const totalScans = allPlaques.reduce((sum, p) => sum + (p.scans_count || 0), 0);

  // Filtragem
  let filtered = allPlaques;
  if (statusFilter === 'active') {
    filtered = filtered.filter(p => p.status === 'active');
  } else if (statusFilter === 'virgin') {
    filtered = filtered.filter(p => p.status === 'virgin');
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.id.toLowerCase().includes(q) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.target_url && p.target_url.toLowerCase().includes(q))
    );
  }

  // Paginação
  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / perPage) || 1;
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedPlaques = filtered.slice((validPage - 1) * perPage, validPage * perPage);

  return `
    <div style="background: #F8FAFC; min-height: 100vh;">
      
      <!-- Topo do Portal do Cliente -->
      <header style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0; padding: 1rem 0;">
        <div class="container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <span class="text-xs text-muted">Portal do Cliente</span>
            <div style="font-size: 1.25rem; font-weight: 700; color: #0F172A; display: flex; align-items: center; gap: 8px;">
              <span>Olá, ${escapeHtml(client.name)}!</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-mono" style="gap: 4px;">
              ${getIcon('key', '', 13)} Código: <strong>${escapeHtml(client.client_code)}</strong>
            </div>
            <a href="#/cliente" class="btn btn-ghost btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
              ${getIcon('logOut', '', 14)}
              <span>Sair</span>
            </a>
          </div>
        </div>
      </header>

      <!-- Conteúdo Principal -->
      <div class="container py-8">
        
        <!-- Cards de Resumo do Cliente -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="card p-4">
            <div class="text-xs text-muted font-medium">Minhas Plaquinhas</div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px;">${allPlaques.length}</div>
          </div>

          <div class="card p-4">
            <div class="text-xs text-muted font-medium">Plaquinhas Ativas</div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--green);">${activeCount}</div>
          </div>

          <div class="card p-4">
            <div class="text-xs text-muted font-medium">Avaliações / Leituras Google</div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--blue);">${totalScans}</div>
          </div>
        </div>

        <!-- Barra de Filtros e Busca do Cliente -->
        <div class="filter-bar">
          
          <div class="filter-group">
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-client-filter ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}" data-filter="all">
                Todas (${allPlaques.length})
              </button>
              <button class="btn btn-sm btn-client-filter ${statusFilter === 'active' ? 'btn-primary' : 'btn-ghost'}" data-filter="active">
                Ativas (${activeCount})
              </button>
              <button class="btn btn-sm btn-client-filter ${statusFilter === 'virgin' ? 'btn-primary' : 'btn-ghost'}" data-filter="virgin">
                Virgens (${virginCount})
              </button>
            </div>
          </div>

          <div style="width: 260px; max-width: 100%; position: relative;">
            <input 
              type="text" 
              id="input-search-client-plaques" 
              placeholder="Buscar plaquinha..." 
              value="${escapeHtml(searchQuery)}"
              class="form-input" 
              style="padding: 6px 30px 6px 30px; font-size: 0.8125rem;"
            />
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
              ${getIcon('search', '', 14)}
            </span>
            ${searchQuery ? `
              <button id="btn-clear-client-portal-search" class="btn-ghost" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; padding: 2px; color: var(--text-muted); cursor: pointer;" title="Limpar busca">
                ${getIcon('close', '', 12)}
              </button>
            ` : ''}
          </div>

        </div>

        <div class="table-container" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 140px;">Código QR</th>
                <th style="width: 100px;">Status</th>
                <th>Empresa / Link de Avaliação do Google</th>
                <th style="width: 100px;">Leituras</th>
                <th style="width: 140px;">Última Leitura</th>
                <th style="width: 140px; text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${paginatedPlaques.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    Nenhuma plaquinha encontrada para os filtros selecionados.
                  </td>
                </tr>
              ` : paginatedPlaques.map(plaque => {
                const isVirgin = plaque.status === 'virgin';

                return `
                  <tr style="height: 50px; white-space: nowrap; vertical-align: middle;">
                    <!-- Código -->
                    <td class="font-mono font-bold" style="white-space: nowrap;">
                      <span class="text-blue btn-view-qr" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" data-id="${escapeHtml(plaque.id)}">
                        ${getIcon('qrcode', '', 15)}
                        <span>${escapeHtml(plaque.id)}</span>
                      </span>
                    </td>

                    <!-- Status -->
                    <td style="white-space: nowrap;">
                      ${isVirgin 
                        ? `<span class="badge badge-virgin">Virgem</span>`
                        : `<span class="badge badge-active">Ativo</span>`
                      }
                    </td>

                    <!-- Link e Empresa (1 linha só) -->
                    <td style="white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis;">
                      ${isVirgin ? `
                        <span class="text-muted text-xs">Plaquinha pronta para vincular</span>
                        <a href="#/activate/${escapeHtml(plaque.id)}" class="text-xs text-blue ml-2 font-medium" style="display: inline-flex; align-items: center; gap: 3px;">
                          <span>Vincular Agora</span>
                          ${getIcon('arrowright', '', 12)}
                        </a>
                      ` : `
                        <span class="font-bold text-sm text-main" title="${escapeHtml(plaque.name || '')}">${escapeHtml(plaque.name || 'Sua Empresa')}</span>
                        ${plaque.target_url ? `
                          <a href="${escapeHtml(plaque.target_url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue ml-2" style="display: inline-flex; vertical-align: middle;" title="${escapeHtml(plaque.target_url)}">
                            ${getIcon('externallink', '', 12)}
                          </a>
                        ` : ''}
                      `}
                    </td>

                    <!-- Scans -->
                    <td class="font-mono font-bold" style="white-space: nowrap; color: ${(plaque.scans_count || 0) > 0 ? 'var(--color-blue)' : 'inherit'};">
                      ${plaque.scans_count || 0}
                    </td>

                    <!-- Último Scan -->
                    <td class="text-xs text-muted" style="white-space: nowrap;">${formatRelativeTime(plaque.last_scan_at)}</td>

                    <!-- Ações do Cliente -->
                    <td style="text-align: right; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-secondary btn-sm btn-view-qr" data-id="${escapeHtml(plaque.id)}" title="Visualizar QR Code">
                          ${getIcon('qrcode', '', 14)} QR
                        </button>
                        <button class="btn btn-primary btn-sm btn-edit-plaque" data-id="${escapeHtml(plaque.id)}" title="Alterar Link de Destino">
                          ${getIcon('edit', '', 14)} Alterar
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Barra de Paginação -->
        ${renderPagination({
          totalItems: totalFiltered,
          currentPage: validPage,
          perPage,
          entityName: 'plaquinhas',
          idPrefix: 'client-portal'
        })}

      </div>

    </div>
  `;
}


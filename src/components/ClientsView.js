import { storage } from '../services/storage.js';
import { formatPhone, getWhatsAppUrl, escapeHtml } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';
import { renderPagination } from './Pagination.js';

export function renderClientsView({
  searchQuery = '',
  sortBy = 'count',
  sortOrder = 'desc',
  currentPage = 1,
  perPage = 25
} = {}) {
  const allClients = storage.getClients();
  const totalClients = allClients.length;
  const totalPlaquesWithClient = allClients.reduce((sum, c) => sum + c.count, 0);
  const totalScans = allClients.reduce((sum, c) => sum + c.totalScans, 0);

  // 1. Filtragem por Busca
  let filtered = allClients;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.client_code && c.client_code.includes(q)) ||
      c.plaques.some(p => p.id.toLowerCase().includes(q) || (p.name && p.name.toLowerCase().includes(q)))
    );
  }

  // 2. Ordenação
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'totalScans') {
      comparison = b.totalScans - a.totalScans;
    } else if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
      return sortOrder === 'desc' ? -comparison : comparison;
    } else {
      // 'count' padrão (quantidade de placas)
      comparison = b.count - a.count;
    }
    return sortOrder === 'asc' ? -comparison : comparison;
  });

  // 3. Paginação
  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / perPage) || 1;
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedClients = filtered.slice((validPage - 1) * perPage, validPage * perPage);

  const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'count';

  return `
    <div class="container py-8">
      
      <!-- Cabeçalho -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
            ${getIcon('users', '', 24)}
            <span>Usuários e Clientes</span>
          </h1>
          <p class="text-sm text-muted mt-1">Gerencie os compradores das suas plaquinhas. O código de acesso deles é o próprio número de telefone invertido.</p>
        </div>

        <div style="display: flex; gap: 8px;">
          <a href="#/cliente" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            ${getIcon('externalLink', '', 14)}
            <span>Abrir Portal do Cliente</span>
          </a>
          <a href="#/gerador" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            ${getIcon('plus', '', 14)}
            <span>Emitir Mais Códigos</span>
          </a>
        </div>
      </div>

      <!-- Resumo de Clientes -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Total de Clientes / Compradores</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px;">${totalClients}</div>
        </div>

        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Plaquinhas Vinculadas</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--blue);">${totalPlaquesWithClient}</div>
        </div>

        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Scans Gerados por Clientes</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--green);">${totalScans}</div>
        </div>
      </div>

      <!-- Barra de Filtros e Busca de Clientes -->
      <div class="filter-bar">
        
        <div class="filter-group">
          <!-- Seletor de Ordenação de Clientes -->
          <label for="select-sort-clients" class="text-xs text-muted font-medium">Ordenar por:</label>
          <select id="select-sort-clients" class="filter-select">
            <option value="count:desc" ${sortBy === 'count' && sortOrder === 'desc' ? 'selected' : ''}>Mais Placas</option>
            <option value="totalScans:desc" ${sortBy === 'totalScans' && sortOrder === 'desc' ? 'selected' : ''}>Mais Scans / Leituras</option>
            <option value="name:asc" ${sortBy === 'name' && sortOrder === 'asc' ? 'selected' : ''}>Nome do Cliente (A–Z)</option>
          </select>

          ${hasActiveFilters ? `
            <button id="btn-clear-client-filters" class="btn btn-ghost btn-sm text-xs" style="color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;" title="Limpar busca e ordenação">
              ${getIcon('xCircle', '', 13)}
              <span>Limpar Filtros</span>
            </button>
          ` : ''}
        </div>

        <div style="width: 260px; max-width: 100%; position: relative;">
          <input 
            type="text" 
            id="input-search-clients" 
            placeholder="Buscar nome, telefone, login..." 
            value="${escapeHtml(searchQuery)}"
            class="form-input" 
            style="padding: 6px 30px 6px 30px; font-size: 0.8125rem;"
          />
          <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
            ${getIcon('search', '', 14)}
          </span>
          ${searchQuery ? `
            <button id="btn-clear-client-search" class="btn-ghost" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; padding: 2px; color: var(--text-muted); cursor: pointer;" title="Limpar busca">
              ${getIcon('close', '', 12)}
            </button>
          ` : ''}
        </div>

      </div>

      <!-- Tabela de Clientes -->
      <div class="table-container" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
        <table class="table">
          <thead>
            <tr>
              <th>Cliente / Responsável</th>
              <th>Telefone (WhatsApp)</th>
              <th>Código de Acesso (Login)</th>
              <th style="width: 130px;">Placas Atreladas</th>
              <th style="width: 100px;">Total Scans</th>
              <th style="width: 170px; text-align: right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedClients.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                  ${hasActiveFilters 
                    ? `Nenhum cliente encontrado para a busca informada. <button id="btn-reset-client-search-inline" class="text-blue underline font-medium" style="background:none; border:none; cursor:pointer; font-size:inherit;">Limpar busca</button>` 
                    : `Nenhum cliente cadastrado ainda. Os clientes aparecem aqui automaticamente assim que ativam suas plaquinhas com telefone.`
                  }
                </td>
              </tr>
            ` : paginatedClients.map(client => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const waLink = getWhatsAppUrl(client.phone, `Olá ${client.name}, aqui está o link de acesso para gerenciar suas plaquinhas QR Code: ${origin}/#/cliente/${client.client_code}`);
              const clientPortalLink = `${origin}/#/cliente/${client.client_code}`;

              return `
                <tr>
                  <!-- Nome -->
                  <td>
                    <div class="font-bold text-sm text-main">${escapeHtml(client.name)}</div>
                    <div class="text-xs text-muted font-mono mt-0.5">${escapeHtml(client.plaques.map(p => p.id).slice(0, 3).join(', '))}${client.plaques.length > 3 ? ` (+${client.plaques.length - 3})` : ''}</div>
                  </td>

                  <!-- Telefone / WhatsApp -->
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="font-mono text-xs">${escapeHtml(formatPhone(client.phone)) || 'Sem telefone'}</span>
                      ${client.phone ? `
                        <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="padding: 2px 6px; color: #16A34A; display: inline-flex; align-items: center; gap: 4px;" title="Conversar no WhatsApp">
                          ${getIcon('whatsapp', '', 14)}
                          <span>WhatsApp</span>
                        </a>
                      ` : ''}
                    </div>
                  </td>

                  <!-- Código de Login (Invertido) -->
                  <td>
                    <div style="display: inline-flex; align-items: center; gap: 4px;">
                      <span class="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800" style="display: inline-flex; align-items: center; gap: 4px;">
                        ${getIcon('key', '', 12)}
                        <span>${escapeHtml(client.client_code)}</span>
                      </span>
                    </div>
                  </td>

                  <!-- Placas -->
                  <td>
                    <span class="font-bold text-sm">${client.count} placas</span>
                    <span class="text-xs text-muted block">(${client.active} ativas)</span>
                  </td>

                  <!-- Scans -->
                  <td class="font-mono font-bold text-sm">${client.totalScans}</td>

                  <!-- Ações -->
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 4px;">
                      <button class="btn btn-secondary btn-sm btn-copy-client-link" data-url="${escapeHtml(clientPortalLink)}" title="Copiar link de login do cliente" style="display: inline-flex; align-items: center; gap: 4px;">
                        ${getIcon('copy', '', 13)}
                        <span>Copiar Link</span>
                      </button>
                      <a href="#/cliente/${encodeURIComponent(client.client_code)}" class="btn btn-primary btn-sm" title="Acessar painel deste cliente" style="display: inline-flex; align-items: center; gap: 4px;">
                        <span>Abrir</span>
                        ${getIcon('arrowRight', '', 13)}
                      </a>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Barra de Paginação de Clientes -->
      ${renderPagination({
        totalItems: totalFiltered,
        currentPage: validPage,
        perPage,
        entityName: 'clientes',
        idPrefix: 'client'
      })}

    </div>
  `;
}


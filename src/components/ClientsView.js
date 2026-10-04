import { storage } from '../services/storage.js';
import { formatPhone, getWhatsAppUrl, escapeHtml, normalizeForSearch } from '../utils/helpers.js';
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
    const q = normalizeForSearch(searchQuery);
    filtered = filtered.filter(c =>
      normalizeForSearch(c.name).includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.client_code && c.client_code.includes(q)) ||
      c.plaques.some(p => p.id.toLowerCase().includes(q) || (p.name && normalizeForSearch(p.name).includes(q)))
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
    <div class="container py-6">
      
      <!-- Cabeçalho Workstation -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center;">
              ${getIcon('users', '', 14)}
            </div>
            <div>
              <h1 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
                Usuários & Clientes
              </h1>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 1px 0 0 0;">
                Diretório de compradores de placas com links diretos para portal individual
              </p>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 6px;">
          <a href="#/cliente" target="_blank" class="btn btn-secondary btn-sm" style="gap: 4px;">
            ${getIcon('externalLink', '', 12)}
            <span>Portal do Comprador</span>
          </a>
          <a href="#/gerador" class="btn btn-primary btn-sm" style="gap: 4px;">
            ${getIcon('plus', '', 12)}
            <span>Emitir Lote</span>
          </a>
        </div>
      </div>

      <!-- Resumo de Clientes em KPIs Compactos -->
      <div class="resp-grid-3" style="gap: 0.5rem; margin-bottom: 0.75rem;">
        <div class="card" style="padding: 0.55rem 0.75rem;">
          <span style="font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Clientes Cadastrados</span>
          <div class="num-tabular" style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-top: 1px;">${totalClients}</div>
        </div>

        <div class="card" style="padding: 0.55rem 0.75rem;">
          <span style="font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Placas Vinculadas</span>
          <div class="num-tabular" style="font-size: 1.25rem; font-weight: 700; color: #059669; margin-top: 1px;">${totalPlaquesWithClient}</div>
        </div>

        <div class="card" style="padding: 0.55rem 0.75rem;">
          <span style="font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Scans em Clientes</span>
          <div class="num-tabular" style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); margin-top: 1px;">${totalScans.toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <!-- Barra de Filtros e Busca de Clientes -->
      <div class="filter-bar">
        
        <div class="filter-group">
          <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">Ordenar:</span>
          <select id="select-sort-clients" class="filter-select">
            <option value="count:desc" ${sortBy === 'count' && sortOrder === 'desc' ? 'selected' : ''}>Mais Placas</option>
            <option value="totalScans:desc" ${sortBy === 'totalScans' && sortOrder === 'desc' ? 'selected' : ''}>Mais Scans</option>
            <option value="name:asc" ${sortBy === 'name' && sortOrder === 'asc' ? 'selected' : ''}>Nome (A–Z)</option>
          </select>

          ${hasActiveFilters ? `
            <button id="btn-clear-client-filters" class="btn btn-ghost btn-xs" style="gap: 3px;" title="Limpar">
              ${getIcon('xCircle', '', 11)}
              <span>Limpar</span>
            </button>
          ` : ''}
        </div>

        <div style="width: 240px; max-width: 100%; position: relative;">
          <input 
            type="text" 
            id="input-search-clients" 
            placeholder="Buscar nome, telefone, login..." 
            value="${escapeHtml(searchQuery)}"
            class="form-input" 
            style="padding: 4px 26px 4px 28px; font-size: 0.75rem; height: 30px;"
          />
          <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
            ${getIcon('search', '', 13)}
          </span>
          ${searchQuery ? `
            <button id="btn-clear-client-search" class="btn-ghost" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); border: none; padding: 2px; color: var(--text-muted); cursor: pointer;" title="Limpar">
              ${getIcon('close', '', 11)}
            </button>
          ` : ''}
        </div>

      </div>

      <!-- Tabela Workstation de Clientes -->
      <div class="card" style="overflow: hidden;">
        <div style="overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; min-width: 800px;">
            <thead>
              <tr>
                <th>CLIENTE / RESPONSÁVEL</th>
                <th>WHATSAPP / TELEFONE</th>
                <th>CÓDIGO DE ACESSO</th>
                <th style="width: 110px; text-align: center;">PLACAS</th>
                <th style="width: 90px; text-align: center;">SCANS</th>
                <th style="width: 130px; text-align: right;">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              ${paginatedClients.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted); font-size: 0.75rem;">
                    ${hasActiveFilters 
                      ? `Nenhum cliente localizado para o termo pesquisado.` 
                      : `Nenhum cliente cadastrado ainda.`
                    }
                  </td>
                </tr>
              ` : paginatedClients.map(client => {
                // Link enviado ao cliente usa o domínio de produção configurado, nunca
                // um localhost/IP de teste (se o admin estiver testando localmente).
                const origin = (storage.settings?.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
                const waLink = getWhatsAppUrl(client.phone, `Olá ${client.name}, segue seu link para gerenciar suas plaquinhas QR Code: ${origin}/#/cliente/${client.client_code}`);
                const clientPortalLink = `${origin}/#/cliente/${client.client_code}`;

                return `
                  <tr>
                    <!-- Nome -->
                    <td>
                      <div style="font-weight: 600; color: var(--text-main); font-size: 0.8125rem;">${escapeHtml(client.name)}</div>
                      <div style="font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 1px;">
                        ${escapeHtml(client.plaques.map(p => p.id).slice(0, 3).join(', '))}${client.plaques.length > 3 ? ` (+${client.plaques.length - 3})` : ''}
                      </div>
                    </td>

                    <!-- Telefone / WhatsApp -->
                    <td>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="num-tabular" style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">
                          ${escapeHtml(formatPhone(client.phone)) || '—'}
                        </span>
                        ${client.phone ? `
                          <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-xs" style="color: #059669; padding: 2px 5px;" title="Conversar no WhatsApp">
                            ${getIcon('whatsapp', '', 12)}
                          </a>
                        ` : ''}
                      </div>
                    </td>

                    <!-- Código de Login (Invertido) -->
                    <td>
                      <span class="num-tabular" style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-main); background: var(--bg-subtle); border: 1px solid var(--border-color); padding: 1px 5px; border-radius: var(--radius-xs);">
                        ${escapeHtml(client.client_code)}
                      </span>
                    </td>

                    <!-- Placas -->
                    <td style="text-align: center;">
                      <span class="badge badge-virgin num-tabular" style="font-weight: 600;">
                        ${client.count} un
                      </span>
                      <span class="num-tabular" style="font-size: 0.65rem; color: #059669; display: block; margin-top: 1px;">${client.active} ativas</span>
                    </td>

                    <!-- Scans -->
                    <td style="text-align: center; font-size: 0.8125rem; font-weight: 600;" class="num-tabular font-mono">
                      ${client.totalScans}
                    </td>

                    <!-- Ações -->
                    <td style="text-align: right; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-secondary btn-xs btn-copy-client-link" data-url="${escapeHtml(clientPortalLink)}" title="Copiar link do portal">
                          ${getIcon('copy', '', 11)}
                          <span>Link</span>
                        </button>
                        <a href="#/cliente/${encodeURIComponent(client.client_code)}" class="btn btn-primary btn-xs" title="Acessar painel deste cliente">
                          <span>Abrir</span>
                          ${getIcon('arrowRight', '', 11)}
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

    </div>
  `;
}

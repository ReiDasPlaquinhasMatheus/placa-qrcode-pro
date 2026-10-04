import { storage } from '../services/storage.js';
import { formatRelativeTime, escapeHtml, normalizeForSearch, toLocalDateKey } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';
import { renderPagination } from './Pagination.js';

export function renderPlaqueTable({
  currentFilter = 'all',
  searchQuery = '',
  batchName = null,
  clientFilter = 'all',
  sortBy = 'created_at',
  sortOrder = 'desc',
  currentPage = 1,
  perPage = 25
} = {}) {
  const isSpecificBatch = Boolean(batchName && batchName !== 'all');
  const basePlaques = isSpecificBatch ? storage.getPlaquesByBatch(batchName) : storage.getAllPlaques();
  const allBatches = storage.getBatches();

  const total = basePlaques.length;
  let active = 0;
  let virgin = 0;
  let totalScans = 0;
  const todayStr = toLocalDateKey(new Date());
  let todayCount = 0;
  const filtered = [];

  const q = searchQuery ? normalizeForSearch(searchQuery) : '';
  const filterByLote = (!isSpecificBatch && batchName && batchName !== 'all') ? batchName : null;

  // Filtragem e Métricas
  for (let i = 0; i < total; i++) {
    const p = basePlaques[i];
    const isToday = Boolean(p.activated_at && toLocalDateKey(p.activated_at) === todayStr);
    if (isToday) todayCount++;

    if (p.status === 'active') active++;
    else if (p.status === 'virgin') virgin++;
    totalScans += (p.scans_count || 0);

    // 1. Filtro por Status
    if (currentFilter === 'active' && p.status !== 'active') continue;
    if (currentFilter === 'virgin' && p.status !== 'virgin') continue;
    if (currentFilter === 'today' && !isToday) continue;

    // 2. Filtro por Lote
    // Mesma regra do getBatches(): placa sem lote pertence a "Lote Geral"
    if (filterByLote) {
      const pBatch = (p.batch_name && p.batch_name.trim()) ? p.batch_name.trim() : 'Lote Geral';
      if (pBatch !== filterByLote) continue;
    }

    // 3. Filtro por Vínculo de Cliente
    if (clientFilter === 'with_client' && !p.client_name && !p.client_phone && !p.client_code) continue;
    if (clientFilter === 'without_client' && (p.client_name || p.client_phone || p.client_code)) continue;

    // 4. Busca em Tempo Real
    if (q) {
      const match = (p.id && p.id.toLowerCase().includes(q)) ||
        (p.name && normalizeForSearch(p.name).includes(q)) ||
        (p.client_name && normalizeForSearch(p.client_name).includes(q)) ||
        (p.client_phone && p.client_phone.toLowerCase().includes(q)) ||
        (p.client_code && p.client_code.toLowerCase().includes(q)) ||
        (p.target_url && p.target_url.toLowerCase().includes(q)) ||
        (p.batch_name && normalizeForSearch(p.batch_name).includes(q));
      if (!match) continue;
    }

    filtered.push(p);
  }

  // Ordenação
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'scans_count') {
      comparison = (b.scans_count || 0) - (a.scans_count || 0);
      return sortOrder === 'asc' ? -comparison : comparison;
    } else if (sortBy === 'last_scan_at') {
      const timeA = a.last_scan_at ? new Date(a.last_scan_at).getTime() : 0;
      const timeB = b.last_scan_at ? new Date(b.last_scan_at).getTime() : 0;
      comparison = timeB - timeA;
      return sortOrder === 'asc' ? -comparison : comparison;
    } else if (sortBy === 'name') {
      comparison = (a.name || '').localeCompare(b.name || '');
      return sortOrder === 'desc' ? -comparison : comparison;
    } else if (sortBy === 'id') {
      comparison = a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'desc' ? -comparison : comparison;
    } else {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      comparison = timeB - timeA;
      return sortOrder === 'asc' ? -comparison : comparison;
    }
  });

  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / perPage) || 1;
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedPlaques = filtered.slice((validPage - 1) * perPage, validPage * perPage);

  const hasActiveFilters = currentFilter !== 'all' || 
    searchQuery.trim() !== '' || 
    clientFilter !== 'all' || 
    (!isSpecificBatch && batchName && batchName !== 'all') ||
    sortBy !== 'created_at';

  return `
    <div class="container py-6">
      
      <!-- Topo Workstation -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          ${isSpecificBatch ? `
            <a href="#/lotes" class="btn btn-ghost btn-xs mb-1" style="gap: 4px; padding: 2px 4px; color: var(--text-muted);">
              ${getIcon('arrowleft', '', 11)}
              <span>Voltar para Pastas</span>
            </a>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
                ${escapeHtml(batchName)}
              </h1>
              <span class="badge badge-virgin num-tabular">${total} placas</span>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center;">
                ${getIcon('grid', '', 14)}
              </div>
              <div>
                <h1 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
                  Inventário de Placas
                </h1>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin: 1px 0 0 0;">
                  Catálogo geral com estado de ativação, PIN e telemetria de scans
                </p>
              </div>
            </div>
          `}
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="gap: 4px;">
            ${getIcon('filetext', '', 13)}
            <span>Exportar CSV</span>
          </button>
          ${isSpecificBatch ? `
            <button class="btn btn-secondary btn-sm btn-download-batch-zip" data-batch="${escapeHtml(batchName)}" style="gap: 4px;">
              ${getIcon('download', '', 13)}
              <span>Baixar ZIP</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-delete-batch-action" data-batch="${escapeHtml(batchName)}" style="gap: 4px; color: #DC2626;" title="Excluir este lote">
              ${getIcon('trash', '', 13)}
              <span>Excluir</span>
            </button>
            <a href="#/gerador" class="btn btn-primary btn-sm" style="gap: 4px;">
              ${getIcon('plus', '', 13)}
              <span>Emitir Mais</span>
            </a>
          ` : `
            <button id="btn-export-all-zip" class="btn btn-secondary btn-sm" style="gap: 4px;">
              ${getIcon('download', '', 13)}
              <span>Baixar Todos ZIP</span>
            </button>
            <a href="#/gerador" class="btn btn-primary btn-sm" style="gap: 4px;">
              ${getIcon('plus', '', 13)}
              <span>Emitir Lote</span>
            </a>
          `}
        </div>
      </div>

      <!-- Barra de KPIs Compacta -->
      <div class="resp-grid-4" style="gap: 0.5rem; margin-bottom: 0.75rem;">
        <div class="card" style="padding: 0.55rem 0.75rem;">
          <span style="font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Total</span>
          <div class="num-tabular" style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-top: 1px;">${total}</div>
        </div>
        <div class="card" style="padding: 0.55rem 0.75rem;">
          <span style="font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Ativas</span>
          <div class="num-tabular" style="font-size: 1.15rem; font-weight: 700; color: #059669; margin-top: 1px;">${active}</div>
        </div>
        <div class="card" style="padding: 0.55rem 0.75rem;">
          <span style="font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Virgens</span>
          <div class="num-tabular" style="font-size: 1.15rem; font-weight: 700; color: var(--text-muted); margin-top: 1px;">${virgin}</div>
        </div>
        <div class="card" style="padding: 0.55rem 0.75rem;">
          <span style="font-size: 0.625rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Scans</span>
          <div class="num-tabular" style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-top: 1px;">${totalScans.toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <!-- Barra de Filtros e Busca Rápida -->
      <div class="card" style="padding: 0.65rem 0.85rem; margin-bottom: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
        
        <!-- Linha 1: Abas de Status & Campo de Busca -->
        <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; flex-wrap: wrap;">
          <div class="filter-tabs">
            <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">
              Todas (${total})
            </button>
            <button class="filter-btn ${currentFilter === 'today' ? 'active' : ''}" data-filter="today">
              Hoje (${todayCount})
            </button>
            <button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active">
              Ativas (${active})
            </button>
            <button class="filter-btn ${currentFilter === 'virgin' ? 'active' : ''}" data-filter="virgin">
              Virgens (${virgin})
            </button>
          </div>

          <div style="flex: 1; max-width: 320px; min-width: 200px; position: relative;">
            <input 
              type="text" 
              id="table-search" 
              class="form-input" 
              placeholder="Filtrar por ID, empresa, cliente, link..." 
              value="${escapeHtml(searchQuery)}"
              style="padding: 4px 26px 4px 28px; font-size: 0.75rem; height: 30px;"
            />
            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
              ${getIcon('search', '', 13)}
            </span>
            ${searchQuery ? `
              <button id="btn-clear-search" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;">
                ${getIcon('close', '', 11)}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Linha 2: Filtros Avançados (Lote, Cliente, Ordenação, Itens por Página) -->
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
          
          ${!isSpecificBatch ? `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 0.7rem; color: var(--text-muted);">Lote:</span>
              <select id="filter-batch" class="filter-select">
                <option value="all" ${(!batchName || batchName === 'all') ? 'selected' : ''}>Todos os Lotes</option>
                ${allBatches.map(b => `
                  <option value="${escapeHtml(b.name)}" ${batchName === b.name ? 'selected' : ''}>
                    ${escapeHtml(b.name)} (${b.count})
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 0.7rem; color: var(--text-muted);">Cliente:</span>
            <select id="filter-client" class="filter-select">
              <option value="all" ${clientFilter === 'all' ? 'selected' : ''}>Todos</option>
              <option value="with_client" ${clientFilter === 'with_client' ? 'selected' : ''}>Com Vínculo</option>
              <option value="without_client" ${clientFilter === 'without_client' ? 'selected' : ''}>Sem Vínculo (Avulsas)</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 0.7rem; color: var(--text-muted);">Ordenar:</span>
            <select id="sort-by" class="filter-select">
              <option value="created_at" ${sortBy === 'created_at' ? 'selected' : ''}>Mais Recentes</option>
              <option value="id" ${sortBy === 'id' ? 'selected' : ''}>ID</option>
              <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Empresa</option>
              <option value="scans_count" ${sortBy === 'scans_count' ? 'selected' : ''}>Scans</option>
              <option value="last_scan_at" ${sortBy === 'last_scan_at' ? 'selected' : ''}>Último Scan</option>
            </select>
            <button id="btn-toggle-sort-order" class="btn btn-secondary btn-xs" title="Inverter Ordem" style="padding: 4px 6px;">
              ${sortOrder === 'asc' ? getIcon('arrowup', '', 12) : getIcon('arrowdown', '', 12)}
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 4px; margin-left: auto;">
            <span style="font-size: 0.7rem; color: var(--text-muted);">Linhas:</span>
            <select id="per-page-select" class="filter-select">
              <option value="15" ${perPage === 15 ? 'selected' : ''}>15</option>
              <option value="25" ${perPage === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${perPage === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${perPage === 100 ? 'selected' : ''}>100</option>
            </select>
          </div>

          ${hasActiveFilters ? `
            <button id="btn-reset-filters" class="btn btn-ghost btn-xs" style="color: var(--text-muted);">
              Limpar Filtros
            </button>
          ` : ''}

        </div>

      </div>

      <!-- Tabela Workstation de Alta Densidade -->
      <div class="card" style="overflow: hidden;">
        <div style="overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; min-width: 900px;">
            <thead>
              <tr>
                <th style="width: 130px;">ID DA PLACA</th>
                <th style="width: 90px;">STATUS</th>
                <th>EMPRESA / LINK DESTINO</th>
                <th>CLIENTE / VÍNCULO</th>
                <th style="width: 65px; text-align: center;">PIN</th>
                <th style="width: 75px; text-align: center;">SCANS</th>
                <th style="width: 120px;">ÚLTIMA LEITURA</th>
                <th style="width: 105px; text-align: right;">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              ${total === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="width: 36px; height: 36px; background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; color: var(--text-muted);">
                      ${getIcon('qr', '', 18)}
                    </div>
                    <div style="font-weight: 600; font-size: 0.875rem; color: var(--text-main); margin-bottom: 2px;">Nenhuma placa cadastrada</div>
                    <p class="text-xs text-muted mb-3">Emita seu primeiro lote de QR Codes.</p>
                    <a href="#/gerador" class="btn btn-primary btn-xs" style="gap: 4px;">
                      ${getIcon('plus', '', 12)}
                      <span>Emitir Primeiro Lote</span>
                    </a>
                  </td>
                </tr>
              ` : filtered.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="font-size: 0.8125rem;">Nenhuma placa localizada com os filtros atuais.</div>
                    ${hasActiveFilters ? `<button id="btn-empty-reset" class="btn btn-secondary btn-xs mt-2">Limpar Filtros</button>` : ''}
                  </td>
                </tr>
              ` : paginatedPlaques.map(plaque => `
                <tr>
                  
                  <!-- ID da Placa -->
                  <td>
                    <span class="td-id">
                      ${escapeHtml(plaque.id)}
                    </span>
                    ${plaque.batch_name ? `
                      <span style="margin-left: 4px; font-size: 0.6875rem; color: var(--text-muted);" title="Lote: ${escapeHtml(plaque.batch_name)}">
                        (${escapeHtml(plaque.batch_name)})
                      </span>
                    ` : ''}
                  </td>

                  <!-- Status Linear -->
                  <td>
                    <span class="badge ${plaque.status === 'active' ? 'badge-active' : 'badge-virgin'}">
                      <span class="status-dot" style="background-color: ${plaque.status === 'active' ? 'var(--green)' : 'var(--text-subtle)'};"></span>
                      ${plaque.status === 'active' ? 'Ativa' : 'Virgem'}
                    </span>
                  </td>

                  <!-- Empresa & Link -->
                  <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${plaque.name ? `
                      <span style="font-weight: 500; color: var(--text-main);" title="${escapeHtml(plaque.name)}">
                        ${escapeHtml(plaque.name)}
                      </span>
                      ${plaque.target_url ? `
                        <a href="${escapeHtml(plaque.target_url)}" target="_blank" rel="noopener noreferrer" style="margin-left: 4px; display: inline-flex; vertical-align: middle; color: var(--text-muted);" title="${escapeHtml(plaque.target_url)}">
                          ${getIcon('externalLink', '', 11)}
                        </a>
                      ` : ''}
                    ` : `
                      <span style="color: var(--text-muted); font-style: italic; font-size: 0.72rem;">Aguardando ativação</span>
                    `}
                  </td>

                  <!-- Cliente / Comprador -->
                  <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${plaque.client_name || plaque.client_phone ? `
                      <span style="font-weight: 500; color: var(--text-main);" title="${escapeHtml(plaque.client_name || '')}">
                        ${escapeHtml(plaque.client_name || 'Comprador')}
                      </span>
                      ${plaque.client_phone ? `
                        <span class="num-tabular" style="margin-left: 4px; font-size: 0.6875rem; color: var(--text-muted);">
                          (${escapeHtml(plaque.client_phone)})
                        </span>
                      ` : ''}
                    ` : `
                      <span style="color: var(--text-muted); font-size: 0.72rem;">—</span>
                    `}
                  </td>

                  <!-- PIN -->
                  <td style="text-align: center;">
                    <span class="num-tabular" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">
                      ${escapeHtml(plaque.pin || '—')}
                    </span>
                  </td>

                  <!-- Scans -->
                  <td style="text-align: center;">
                    <span class="num-tabular" style="font-weight: 600; font-size: 0.8125rem; color: ${(plaque.scans_count || 0) > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">
                      ${plaque.scans_count || 0}
                    </span>
                  </td>

                  <!-- Última Leitura -->
                  <td class="num-tabular" style="font-size: 0.72rem; color: var(--text-muted);">
                    ${plaque.last_scan_at ? formatRelativeTime(plaque.last_scan_at) : 'Nunca'}
                  </td>

                  <!-- Ações -->
                  <td style="text-align: right;">
                    <div style="display: inline-flex; gap: 3px; justify-content: flex-end; align-items: center;">
                      <button class="btn btn-secondary btn-xs btn-view-qr" data-id="${escapeHtml(plaque.id)}" title="Ver QR Code / Baixar" style="padding: 3px 5px;">
                        ${getIcon('qr', '', 12)}
                      </button>
                      <button class="btn btn-secondary btn-xs btn-edit-plaque" data-id="${escapeHtml(plaque.id)}" title="Editar Destino" style="padding: 3px 5px;">
                        ${getIcon('edit', '', 12)}
                      </button>
                      <button class="btn btn-secondary btn-xs btn-reset-plaque" data-id="${escapeHtml(plaque.id)}" title="Resetar Placa" style="padding: 3px 5px; color: var(--text-muted);">
                        ${getIcon('refresh', '', 12)}
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Barra de Paginação -->
        ${renderPagination({
          totalItems: totalFiltered,
          currentPage: validPage,
          perPage: perPage,
          entityName: 'placas',
          idPrefix: 'plaque'
        })}
      </div>

    </div>
  `;
}

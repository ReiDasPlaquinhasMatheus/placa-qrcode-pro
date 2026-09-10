import { storage } from '../services/storage.js';
import { formatRelativeTime, escapeHtml } from '../utils/helpers.js';
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
  const filtered = [];

  const q = searchQuery ? searchQuery.toLowerCase().trim() : '';
  const filterByLote = (!isSpecificBatch && batchName && batchName !== 'all') ? batchName : null;

  // Filtragem e Métricas em Passada Única Ultra Rápida (O(N))
  for (let i = 0; i < total; i++) {
    const p = basePlaques[i];
    if (p.status === 'active') active++;
    else if (p.status === 'virgin') virgin++;
    totalScans += (p.scans_count || 0);

    // 1. Filtro por Status
    if (currentFilter === 'active' && p.status !== 'active') continue;
    if (currentFilter === 'virgin' && p.status !== 'virgin') continue;

    // 2. Filtro por Lote
    if (filterByLote && p.batch_name !== filterByLote) continue;

    // 3. Filtro por Vínculo de Cliente
    if (clientFilter === 'with_client' && !p.client_name && !p.client_phone && !p.client_code) continue;
    if (clientFilter === 'without_client' && (p.client_name || p.client_phone || p.client_code)) continue;

    // 4. Busca em Tempo Real
    if (q) {
      const match = (p.id && p.id.toLowerCase().includes(q)) || 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.client_name && p.client_name.toLowerCase().includes(q)) ||
        (p.client_phone && p.client_phone.toLowerCase().includes(q)) ||
        (p.client_code && p.client_code.toLowerCase().includes(q)) ||
        (p.target_url && p.target_url.toLowerCase().includes(q)) ||
        (p.batch_name && p.batch_name.toLowerCase().includes(q));
      if (!match) continue;
    }

    filtered.push(p);
  }

  // Ordenação Otimizada
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
      // created_at padrão
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      comparison = timeB - timeA;
      return sortOrder === 'asc' ? -comparison : comparison;
    }
  });

  // Paginação dos Resultados
  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / perPage) || 1;
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedPlaques = filtered.slice((validPage - 1) * perPage, validPage * perPage);

  // Verificação se há algum filtro ativo para exibir botão "Limpar Filtros"
  const hasActiveFilters = currentFilter !== 'all' || 
    searchQuery.trim() !== '' || 
    clientFilter !== 'all' || 
    (!isSpecificBatch && batchName && batchName !== 'all') ||
    sortBy !== 'created_at';

  return `
    <div class="container py-8">
      
      <!-- Topo com Navegação / Título e Ações -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          ${isSpecificBatch ? `
            <a href="#/lotes" class="text-xs text-muted mb-2 inline-flex items-center hover:text-blue" style="gap: 4px;">
              ${getIcon('arrowleft', '', 12)}
              <span>Voltar para Pastas de Lotes</span>
            </a>
            <h1 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
              ${getIcon('folder', '', 24)}
              <span>${escapeHtml(batchName)}</span>
            </h1>
            <p class="text-sm text-muted mt-1">Gerencie exclusivamente os QR Codes desta pasta de lote.</p>
          ` : `
            <h1 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
              ${getIcon('grid', '', 24)}
              <span>Todas as Placas Cadastradas</span>
            </h1>
            <p class="text-sm text-muted mt-1">Listagem geral de todas as plaquinhas registradas no sistema.</p>
          `}
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="btn-export-csv" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            ${getIcon('filetext', '', 14)}
            <span>Exportar CSV (${total})</span>
          </button>
          ${isSpecificBatch ? `
            <button class="btn btn-secondary btn-sm btn-download-batch-zip" data-batch="${escapeHtml(batchName)}" style="display: inline-flex; align-items: center; gap: 6px;">
              ${getIcon('download', '', 14)}
              <span>Baixar Lote ZIP</span>
            </button>
            <a href="#/gerador" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
              ${getIcon('plus', '', 14)}
              <span>Emitir Mais</span>
            </a>
          ` : `
            <button id="btn-export-all-zip" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
              ${getIcon('download', '', 14)}
              <span>Baixar Todos ZIP</span>
            </button>
            <a href="#/gerador" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
              ${getIcon('plus', '', 14)}
              <span>Emitir Lote</span>
            </a>
          `}
        </div>
      </div>

      <!-- Resumo de Métricas -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Total de Placas</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px;">${total}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Ativas</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-green); margin-top: 4px;">${active}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Virgens (Disponíveis)</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-gold); margin-top: 4px;">${virgin}</div>
        </div>
        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Total de Visualizações (Scans)</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--color-blue); margin-top: 4px;">${totalScans}</div>
        </div>
      </div>

      <!-- Barra de Filtros e Busca Rápida -->
      <div class="card p-4 mb-6" style="display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Linha 1: Abas de Status & Campo de Busca -->
        <div style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap;">
          <div class="filter-tabs" style="display: flex; gap: 6px;">
            <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">
              Todas (${total})
            </button>
            <button class="filter-btn ${currentFilter === 'active' ? 'active' : ''}" data-filter="active">
              Ativas (${active})
            </button>
            <button class="filter-btn ${currentFilter === 'virgin' ? 'active' : ''}" data-filter="virgin">
              Virgens (${virgin})
            </button>
          </div>

          <div style="flex: 1; max-width: 380px; min-width: 240px; position: relative;">
            <input 
              type="text" 
              id="table-search" 
              class="input-field" 
              placeholder="Buscar por ID, empresa, cliente, link..." 
              value="${escapeHtml(searchQuery)}"
              style="padding-left: 2.2rem; font-size: 0.85rem;"
            />
            <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none;">
              ${getIcon('search', '', 14)}
            </span>
            ${searchQuery ? `
              <button id="btn-clear-search" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--color-text-muted); cursor: pointer;">
                ${getIcon('close', '', 12)}
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Linha 2: Filtros Avançados (Lote, Cliente, Ordenação, Itens por Página) -->
        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; border-top: 1px solid var(--color-border); padding-top: 0.75rem;">
          
          ${!isSpecificBatch ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="text-xs text-muted">Lote:</span>
              <select id="filter-batch" class="input-field" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: auto; height: 32px;">
                <option value="all" ${(!batchName || batchName === 'all') ? 'selected' : ''}>Todos os Lotes</option>
                ${allBatches.map(b => `
                  <option value="${escapeHtml(b.name)}" ${batchName === b.name ? 'selected' : ''}>
                    ${escapeHtml(b.name)} (${b.count})
                  </option>
                `).join('')}
              </select>
            </div>
          ` : ''}

          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="text-xs text-muted">Cliente:</span>
            <select id="filter-client" class="input-field" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: auto; height: 32px;">
              <option value="all" ${clientFilter === 'all' ? 'selected' : ''}>Todos</option>
              <option value="with_client" ${clientFilter === 'with_client' ? 'selected' : ''}>Com Cliente Vinculado</option>
              <option value="without_client" ${clientFilter === 'without_client' ? 'selected' : ''}>Sem Cliente (Avulsas)</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="text-xs text-muted">Ordenar:</span>
            <select id="sort-by" class="input-field" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: auto; height: 32px;">
              <option value="created_at" ${sortBy === 'created_at' ? 'selected' : ''}>Mais Recentes</option>
              <option value="id" ${sortBy === 'id' ? 'selected' : ''}>ID da Placa</option>
              <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Nome da Empresa</option>
              <option value="scans_count" ${sortBy === 'scans_count' ? 'selected' : ''}>Mais Visualizações</option>
              <option value="last_scan_at" ${sortBy === 'last_scan_at' ? 'selected' : ''}>Última Visualização</option>
            </select>
            <button id="btn-toggle-sort-order" class="btn btn-secondary btn-sm" title="Alternar Crescente/Decrescente" style="height: 32px; padding: 0 8px;">
              ${sortOrder === 'asc' ? getIcon('arrowup', '', 14) : getIcon('arrowdown', '', 14)}
            </button>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
            <span class="text-xs text-muted">Por página:</span>
            <select id="per-page-select" class="input-field" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: auto; height: 32px;">
              <option value="15" ${perPage === 15 ? 'selected' : ''}>15</option>
              <option value="25" ${perPage === 25 ? 'selected' : ''}>25</option>
              <option value="50" ${perPage === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${perPage === 100 ? 'selected' : ''}>100</option>
            </select>
          </div>

          ${hasActiveFilters ? `
            <button id="btn-reset-filters" class="btn btn-secondary btn-sm text-xs" style="height: 32px;">
              Limpar Filtros
            </button>
          ` : ''}

        </div>

      </div>

      <!-- Tabela de Placas Ultra Compacta (1 ÚNICA LINHA POR REGISTRO) -->
      <div class="card p-0" style="overflow: hidden; border: 1px solid var(--color-border);">
        <div style="overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse; min-width: 960px;">
            <thead>
              <tr style="background-color: var(--color-surface); border-bottom: 1px solid var(--color-border); text-align: left; white-space: nowrap;">
                <th style="padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); width: 140px;">ID DA PLACA</th>
                <th style="padding: 0.75rem 0.75rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); width: 100px;">STATUS</th>
                <th style="padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted);">EMPRESA / LINK DESTINO</th>
                <th style="padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted);">CLIENTE / COMPRADOR</th>
                <th style="padding: 0.75rem 0.75rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); width: 75px; text-align: center;">PIN</th>
                <th style="padding: 0.75rem 0.75rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); width: 85px; text-align: center;">SCANS</th>
                <th style="padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); width: 130px;">ÚLTIMA VISUALIZAÇÃO</th>
                <th style="padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--color-text-muted); width: 130px; text-align: right;">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 3rem 1rem; color: var(--color-text-muted);">
                    <div style="margin-bottom: 8px; opacity: 0.4;">${getIcon('search', '', 32)}</div>
                    <div>Nenhuma placa encontrada com os filtros selecionados.</div>
                    ${hasActiveFilters ? `<button id="btn-empty-reset" class="btn btn-secondary btn-sm mt-3">Redefinir Filtros</button>` : ''}
                  </td>
                </tr>
              ` : paginatedPlaques.map(plaque => `
                <tr style="border-bottom: 1px solid var(--color-border); height: 52px; white-space: nowrap; vertical-align: middle;">
                  
                  <!-- ID da Placa (1 linha só) -->
                  <td style="padding: 0.65rem 1rem; white-space: nowrap;">
                    <span class="badge" style="background: rgba(255,255,255,0.06); font-family: monospace; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.5px;">
                      ${escapeHtml(plaque.id)}
                    </span>
                    ${plaque.batch_name ? `
                      <span class="text-xs text-muted" style="margin-left: 6px; font-size: 0.72rem;" title="Pasta de Lote: ${escapeHtml(plaque.batch_name)}">
                        (${escapeHtml(plaque.batch_name)})
                      </span>
                    ` : ''}
                  </td>

                  <!-- Status (1 linha só) -->
                  <td style="padding: 0.65rem 0.75rem; white-space: nowrap;">
                    <span class="badge ${plaque.status === 'active' ? 'badge-active' : 'badge-virgin'}" style="white-space: nowrap;">
                      <span class="status-dot"></span>
                      ${plaque.status === 'active' ? 'Ativa' : 'Virgem'}
                    </span>
                  </td>

                  <!-- Empresa & Link (1 linha só) -->
                  <td style="padding: 0.65rem 1rem; white-space: nowrap; max-width: 280px; overflow: hidden; text-overflow: ellipsis;">
                    ${plaque.name ? `
                      <span style="font-weight: 600; font-size: 0.875rem; color: var(--color-text);" title="${escapeHtml(plaque.name)}">
                        ${escapeHtml(plaque.name)}
                      </span>
                      ${plaque.target_url ? `
                        <a href="${escapeHtml(plaque.target_url)}" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-blue" style="margin-left: 6px; display: inline-flex; vertical-align: middle;" title="Abrir link de avaliação: ${escapeHtml(plaque.target_url)}">
                          ${getIcon('externallink', '', 12)}
                        </a>
                      ` : ''}
                    ` : `
                      <span class="text-xs text-muted" style="font-style: italic;">Plaquinha virgem (aguardando ativação)</span>
                    `}
                  </td>

                  <!-- Cliente / Comprador (1 linha só) -->
                  <td style="padding: 0.65rem 1rem; white-space: nowrap; max-width: 240px; overflow: hidden; text-overflow: ellipsis;">
                    ${plaque.client_name || plaque.client_phone ? `
                      <span style="font-size: 0.85rem; font-weight: 500;" title="${escapeHtml(plaque.client_name || '')}">
                        ${escapeHtml(plaque.client_name || 'Comprador')}
                      </span>
                      ${plaque.client_phone ? `
                        <span class="text-xs text-muted" style="margin-left: 4px; font-family: monospace;">
                          (${escapeHtml(plaque.client_phone)})
                        </span>
                      ` : ''}
                      ${plaque.client_code ? `
                        <span class="text-xs" style="color: var(--color-gold); margin-left: 4px; font-size: 0.72rem;" title="Código de Login Invertido: ${escapeHtml(plaque.client_code)}">
                          [Cód: ${escapeHtml(plaque.client_code)}]
                        </span>
                      ` : ''}
                    ` : `
                      <span class="text-xs text-muted">Sem vínculo</span>
                    `}
                  </td>

                  <!-- PIN (1 linha só) -->
                  <td style="padding: 0.65rem 0.75rem; text-align: center; white-space: nowrap;">
                    <span class="badge" style="background: rgba(255, 184, 0, 0.1); color: var(--color-gold); font-family: monospace; font-weight: 600; font-size: 0.8rem;">
                      ${escapeHtml(plaque.pin || '---')}
                    </span>
                  </td>

                  <!-- Visualizações / Scans (1 linha só) -->
                  <td style="padding: 0.65rem 0.75rem; text-align: center; font-weight: 700; font-size: 0.9rem; white-space: nowrap;">
                    <span style="color: ${(plaque.scans_count || 0) > 0 ? 'var(--color-blue)' : 'var(--color-text-muted)'};">
                      ${plaque.scans_count || 0}
                    </span>
                  </td>

                  <!-- Última Visualização (1 linha só) -->
                  <td style="padding: 0.65rem 1rem; font-size: 0.8rem; color: var(--color-text-muted); white-space: nowrap;">
                    ${plaque.last_scan_at ? formatRelativeTime(plaque.last_scan_at) : 'Nunca'}
                  </td>

                  <!-- Ações (1 linha só com ícones vetoriais nítidos) -->
                  <td style="padding: 0.65rem 1rem; text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 4px; justify-content: flex-end; align-items: center;">
                      <button class="btn btn-secondary btn-sm btn-view-qr" data-id="${escapeHtml(plaque.id)}" title="Ver QR Code / Baixar Arquivos" style="padding: 5px 7px; height: 28px; width: 28px; display: inline-flex; align-items: center; justify-content: center;">
                        ${getIcon('qrcode', '', 14)}
                      </button>
                      <button class="btn btn-secondary btn-sm btn-edit-plaque" data-id="${escapeHtml(plaque.id)}" title="Editar Destino / Dados" style="padding: 5px 7px; height: 28px; width: 28px; display: inline-flex; align-items: center; justify-content: center;">
                        ${getIcon('edit', '', 14)}
                      </button>
                      <button class="btn btn-secondary btn-sm btn-reset-plaque" data-id="${escapeHtml(plaque.id)}" title="Resetar Plaquinha para Virgem" style="padding: 5px 7px; height: 28px; width: 28px; display: inline-flex; align-items: center; justify-content: center; color: var(--color-gold);">
                        ${getIcon('refresh', '', 14)}
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
          currentPage: validPage,
          totalPages: totalPages,
          totalItems: totalFiltered,
          perPage: perPage
        })}
      </div>

    </div>
  `;
}

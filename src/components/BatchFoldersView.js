import { storage } from '../services/storage.js';
import { escapeHtml, normalizeForSearch } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';

export function renderBatchFoldersView({
  searchQuery = '',
  sortBy = 'recent'
} = {}) {
  const allBatches = storage.getBatches();
  const stats = storage.getStats();

  // 1. Filtragem por busca
  // Cópia: getBatches() devolve o array em cache, e o sort abaixo o
  // reordenaria permanentemente ("Mais Recentes" nunca voltaria ao normal).
  let filtered = allBatches.slice();
  if (searchQuery.trim()) {
    const q = normalizeForSearch(searchQuery);
    filtered = filtered.filter(b =>
      normalizeForSearch(b.name).includes(q) ||
      (b.firstId && b.firstId.toLowerCase().includes(q)) ||
      (b.lastId && b.lastId.toLowerCase().includes(q))
    );
  }

  // 2. Ordenação
  filtered.sort((a, b) => {
    if (sortBy === 'count') {
      return b.count - a.count;
    } else if (sortBy === 'active') {
      const rateA = a.count > 0 ? a.active / a.count : 0;
      const rateB = b.count > 0 ? b.active / b.count : 0;
      return rateB - rateA;
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'recent';

  return `
    <div class="container py-6">
      
      <!-- Cabeçalho Principal Workstation -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center;">
              ${getIcon('folder', '', 15)}
            </div>
            <div>
              <h1 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
                Pastas de Lotes
              </h1>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 1px 0 0 0;">
                Organização fabril de QR Codes por remessas e pacotes de impressão
              </p>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 6px;">
          <a href="#/todas-placas" class="btn btn-secondary btn-sm" style="gap: 5px;">
            ${getIcon('grid', '', 13)}
            <span>Inventário Geral (${stats.total})</span>
          </a>
          <a href="#/gerador" class="btn btn-primary btn-sm" style="gap: 5px;">
            ${getIcon('plus', '', 13)}
            <span>Emitir Novo Lote</span>
          </a>
        </div>
      </div>

      <!-- Resumo do Sistema em KPIs Compactos -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
        <div class="card" style="padding: 0.75rem 1rem;">
          <div style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-family: var(--font-mono);">Pastas de Lotes</div>
          <div class="num-tabular" style="font-size: 1.35rem; font-weight: 700; margin-top: 2px; color: var(--text-main);">${allBatches.length}</div>
        </div>

        <div class="card" style="padding: 0.75rem 1rem;">
          <div style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-family: var(--font-mono);">Total Produzido</div>
          <div class="num-tabular" style="font-size: 1.35rem; font-weight: 700; margin-top: 2px; color: var(--text-main);">${stats.total}</div>
        </div>

        <div class="card" style="padding: 0.75rem 1rem;">
          <div style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-family: var(--font-mono);">Placas em Atividade</div>
          <div class="num-tabular" style="font-size: 1.35rem; font-weight: 700; margin-top: 2px; color: #059669;">${stats.active}</div>
        </div>

        <div class="card" style="padding: 0.75rem 1rem;">
          <div style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-family: var(--font-mono);">Telemetria (Scans)</div>
          <div class="num-tabular" style="font-size: 1.35rem; font-weight: 700; margin-top: 2px; color: var(--text-main);">${stats.totalScans.toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <!-- Barra de Filtros e Busca de Pastas de Lotes -->
      ${allBatches.length > 0 ? `
        <div class="filter-bar">
          
          <div class="filter-group">
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">Ordenar por:</span>
            <select id="select-sort-batches" class="filter-select">
              <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Mais Recentes</option>
              <option value="count" ${sortBy === 'count' ? 'selected' : ''}>Maior Capacidade</option>
              <option value="active" ${sortBy === 'active' ? 'selected' : ''}>Taxa de Ativação</option>
              <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Nome da Pasta (A–Z)</option>
            </select>

            ${hasActiveFilters ? `
              <button id="btn-clear-batch-filters" class="btn btn-ghost btn-xs" style="gap: 3px;" title="Limpar filtros">
                ${getIcon('xCircle', '', 12)}
                <span>Limpar</span>
              </button>
            ` : ''}
          </div>

          <div style="width: 240px; max-width: 100%; position: relative;">
            <input 
              type="text" 
              id="input-search-batches" 
              placeholder="Buscar pasta..." 
              value="${escapeHtml(searchQuery)}"
              class="form-input" 
              style="padding: 4px 26px 4px 28px; font-size: 0.75rem; height: 30px;"
            />
            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
              ${getIcon('search', '', 13)}
            </span>
            ${searchQuery ? `
              <button id="btn-clear-batch-search" class="btn-ghost" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); border: none; padding: 2px; color: var(--text-muted); cursor: pointer;" title="Limpar busca">
                ${getIcon('close', '', 11)}
              </button>
            ` : ''}
          </div>

        </div>
      ` : ''}

      <!-- Grid de Pastas de Lotes -->
      ${allBatches.length === 0 ? `
        <div class="card p-12 text-center" style="color: var(--text-muted);">
          <div style="width: 44px; height: 44px; background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: var(--text-muted);">
            ${getIcon('folder', '', 22)}
          </div>
          <h3 style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.25rem;">Nenhum lote criado ainda</h3>
          <p class="text-xs text-muted mb-4">Emita seu primeiro lote de QR Codes para organizar o estoque.</p>
          <a href="#/gerador" class="btn btn-primary btn-sm" style="gap: 5px;">
            ${getIcon('plus', '', 13)}
            <span>Emitir Primeiro Lote</span>
          </a>
        </div>
      ` : filtered.length === 0 ? `
        <div class="card p-8 text-center" style="color: var(--text-muted);">
          <p class="text-xs">Nenhum lote localizado para "${escapeHtml(searchQuery)}".</p>
          <button id="btn-reset-batch-search-inline" class="text-xs text-main font-medium mt-2" style="background:none; border:none; cursor:pointer; text-decoration: underline;">Limpar busca</button>
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 0.75rem;">
          ${filtered.map(batch => {
            const activePercent = batch.count > 0 ? Math.round((batch.active / batch.count) * 100) : 0;
            const encodedName = encodeURIComponent(batch.name);

            return `
              <div class="card card-hover" style="padding: 0.95rem 1.05rem; display: flex; flex-direction: column; justify-content: space-between;">
                
                <div>
                  <!-- Topo do Card de Pasta -->
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.65rem;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <div style="background: var(--bg-subtle); border: 1px solid var(--border-color); width: 32px; height: 32px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-main);">
                        ${getIcon('folder', '', 16)}
                      </div>
                      <div>
                        <a href="#/lote/${encodedName}" style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); display: block; text-decoration: none;">
                          ${escapeHtml(batch.name)}
                        </a>
                        <span class="td-id" style="font-size: 0.6875rem; color: var(--text-muted);">${escapeHtml(batch.firstId)} ... ${escapeHtml(batch.lastId)}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Métricas da Pasta -->
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; font-size: 0.75rem;">
                    <span style="color: var(--text-muted);">Capacidade:</span>
                    <span class="num-tabular" style="font-weight: 600; color: var(--text-main);">${batch.count} un</span>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.55rem; font-size: 0.75rem;">
                    <span style="color: var(--text-muted);">Status:</span>
                    <span class="num-tabular" style="font-size: 0.72rem;">
                      <span style="color: #059669; font-weight: 600;">${batch.active} ativas</span>
                      <span style="color: var(--text-muted); margin: 0 3px;">•</span>
                      <span style="color: var(--text-muted);">${batch.virgin} virgens</span>
                    </span>
                  </div>

                  <!-- Barra de Progresso de Ativação -->
                  <div style="margin-bottom: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.6875rem; color: var(--text-muted); margin-bottom: 3px; font-family: var(--font-mono);">
                      <span>Taxa de Ativação</span>
                      <span class="num-tabular" style="font-weight: 600; color: var(--text-main);">${activePercent}%</span>
                    </div>
                    <div style="background: var(--bg-subtle); height: 4px; border-radius: 999px; overflow: hidden; border: 1px solid var(--border-color);">
                      <div style="background: #0F172A; height: 100%; width: ${activePercent}%; border-radius: 999px;"></div>
                    </div>
                  </div>
                </div>

                <!-- Ações da Pasta -->
                <div style="display: flex; gap: 5px; margin-top: 0.5rem; padding-top: 0.65rem; border-top: 1px solid var(--border-color); align-items: center;">
                  <a href="#/lote/${encodedName}" class="btn btn-primary btn-xs flex-1" style="gap: 4px;">
                    <span>Abrir Lote</span>
                    ${getIcon('arrowRight', '', 12)}
                  </a>
                  <button class="btn btn-secondary btn-xs btn-download-batch-zip" data-batch="${escapeHtml(batch.name)}" title="Baixar ZIP deste lote" style="gap: 3px;">
                    ${getIcon('download', '', 11)}
                    <span>ZIP</span>
                  </button>
                  <button class="btn btn-ghost btn-xs btn-delete-batch-action" data-batch="${escapeHtml(batch.name)}" title="Excluir este lote" style="color: #DC2626; padding: 3px 5px;">
                    ${getIcon('trash', '', 12)}
                  </button>
                </div>

              </div>
            `;
          }).join('')}
        </div>
      `}

    </div>
  `;
}

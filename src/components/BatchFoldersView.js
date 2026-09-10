import { storage } from '../services/storage.js';
import { escapeHtml } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';

export function renderBatchFoldersView({
  searchQuery = '',
  sortBy = 'recent'
} = {}) {
  const allBatches = storage.getBatches();
  const stats = storage.getStats();

  // 1. Filtragem por busca
  let filtered = allBatches;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(b => 
      b.name.toLowerCase().includes(q) ||
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
    // 'recent' padrão (mantém a ordem mais recente)
    return 0;
  });

  const hasActiveFilters = searchQuery.trim() !== '' || sortBy !== 'recent';

  return `
    <div class="container py-8">
      
      <!-- Cabeçalho Principal -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
            ${getIcon('folder', '', 24)}
            <span>Pastas de Lotes</span>
          </h1>
          <p class="text-sm text-muted mt-1">Organize e gerencie seus QR Codes separados por pasta de emissão ou cliente.</p>
        </div>

        <div style="display: flex; gap: 8px;">
          <a href="#/todas-placas" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            ${getIcon('grid', '', 14)}
            <span>Ver Todas as Placas (${stats.total})</span>
          </a>
          <a href="#/gerador" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            ${getIcon('plus', '', 14)}
            <span>Emitir Novo Lote</span>
          </a>
        </div>
      </div>

      <!-- Resumo do Sistema -->
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Pastas de Lotes</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px;">${allBatches.length}</div>
        </div>

        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Total de QR Codes</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px;">${stats.total}</div>
        </div>

        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Plaquinhas Ativas</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--green);">${stats.active}</div>
        </div>

        <div class="card p-4">
          <div class="text-xs text-muted font-medium">Total de Leituras</div>
          <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--blue);">${stats.totalScans}</div>
        </div>
      </div>

      <!-- Barra de Filtros e Busca de Pastas de Lotes -->
      ${allBatches.length > 0 ? `
        <div class="filter-bar">
          
          <div class="filter-group">
            <label for="select-sort-batches" class="text-xs text-muted font-medium">Ordenar por:</label>
            <select id="select-sort-batches" class="filter-select">
              <option value="recent" ${sortBy === 'recent' ? 'selected' : ''}>Mais Recentes</option>
              <option value="count" ${sortBy === 'count' ? 'selected' : ''}>Maior Capacidade</option>
              <option value="active" ${sortBy === 'active' ? 'selected' : ''}>Maior Taxa de Ativação</option>
              <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Nome da Pasta (A–Z)</option>
            </select>

            ${hasActiveFilters ? `
              <button id="btn-clear-batch-filters" class="btn btn-ghost btn-sm text-xs" style="color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;" title="Limpar filtros">
                ${getIcon('xCircle', '', 13)}
                <span>Limpar Filtros</span>
              </button>
            ` : ''}
          </div>

          <div style="width: 260px; max-width: 100%; position: relative;">
            <input 
              type="text" 
              id="input-search-batches" 
              placeholder="Buscar pasta de lote..." 
              value="${escapeHtml(searchQuery)}"
              class="form-input" 
              style="padding: 6px 30px 6px 30px; font-size: 0.8125rem;"
            />
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
              ${getIcon('search', '', 14)}
            </span>
            ${searchQuery ? `
              <button id="btn-clear-batch-search" class="btn-ghost" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; padding: 2px; color: var(--text-muted); cursor: pointer;" title="Limpar busca">
                ${getIcon('close', '', 12)}
              </button>
            ` : ''}
          </div>

        </div>
      ` : ''}

      <!-- Grid de Pastas de Lotes -->
      ${allBatches.length === 0 ? `
        <div class="card p-12 text-center" style="color: var(--text-muted);">
          <div style="width: 56px; height: 56px; background: var(--bg-subtle); border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: var(--text-muted);">
            ${getIcon('folder', '', 28)}
          </div>
          <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem;">Nenhuma pasta de lote criada ainda</h3>
          <p class="text-sm text-muted mb-4">Emita seu primeiro lote de QR Codes para criar uma pasta organizada.</p>
          <a href="#/gerador" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
            ${getIcon('plus', '', 14)}
            <span>Criar Primeiro Lote</span>
          </a>
        </div>
      ` : filtered.length === 0 ? `
        <div class="card p-8 text-center" style="color: var(--text-muted);">
          <p class="text-sm">Nenhuma pasta de lote encontrada para "${escapeHtml(searchQuery)}".</p>
          <button id="btn-reset-batch-search-inline" class="text-blue underline font-medium mt-2" style="background:none; border:none; cursor:pointer;">Limpar busca</button>
        </div>
      ` : `
        <div class="grid grid-cols-3 gap-4">
          ${filtered.map(batch => {
            const activePercent = batch.count > 0 ? Math.round((batch.active / batch.count) * 100) : 0;
            const encodedName = encodeURIComponent(batch.name);

            return `
              <div class="card p-5" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border-color);">
                
                <div>
                  <!-- Topo do Card de Pasta -->
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div style="background: #EEF2FF; border: 1px solid #E0E7FF; width: 42px; height: 42px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #4F46E5;">
                        ${getIcon('folder', '', 22)}
                      </div>
                      <div>
                        <a href="#/lote/${encodedName}" style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); display: block; text-decoration: none;" class="hover:text-blue">
                          ${escapeHtml(batch.name)}
                        </a>
                        <span class="text-xs text-muted font-mono">${escapeHtml(batch.firstId)} ... ${escapeHtml(batch.lastId)}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Métricas da Pasta -->
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; font-size: 0.8125rem;">
                    <span class="text-muted">Capacidade:</span>
                    <span class="font-bold">${batch.count} plaquinhas</span>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; font-size: 0.8125rem;">
                    <span class="text-muted">Status:</span>
                    <span class="font-medium">
                      <span style="color: var(--green);">${batch.active} ativas</span> / 
                      <span style="color: var(--amber);">${batch.virgin} virgens</span>
                    </span>
                  </div>

                  <!-- Barra de Progresso de Ativação -->
                  <div style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
                      <span>Taxa de Ativação</span>
                      <span class="font-bold">${activePercent}%</span>
                    </div>
                    <div style="background: #F1F5F9; height: 6px; border-radius: 999px; overflow: hidden;">
                      <div style="background: var(--green); height: 100%; width: ${activePercent}%; border-radius: 999px;"></div>
                    </div>
                  </div>
                </div>

                <!-- Ações da Pasta -->
                <div style="display: flex; gap: 6px; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); align-items: center;">
                  <a href="#/lote/${encodedName}" class="btn btn-primary btn-sm flex-1" style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span>Abrir Pasta</span>
                    ${getIcon('arrowRight', '', 14)}
                  </a>
                  <button class="btn btn-secondary btn-sm btn-download-batch-zip" data-batch="${escapeHtml(batch.name)}" title="Baixar ZIP exclusivo deste lote" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px;">
                    ${getIcon('download', '', 14)}
                    <span>ZIP</span>
                  </button>
                  <button class="btn btn-ghost btn-sm btn-delete-batch-action" data-batch="${escapeHtml(batch.name)}" title="Excluir este lote" style="color: #DC2626; padding: 4px 6px;">
                    ${getIcon('trash', '', 14)}
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


import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';

export function renderBatchGenerator() {
  const stats = storage.getStats();

  return `
    <div class="container py-8" style="max-width: 680px;">
      
      <!-- Cabeçalho -->
      <div class="mb-6">
        <a href="#/lotes" class="text-xs text-muted mb-2 inline-flex items-center hover:text-blue" style="gap: 4px;">
          ${getIcon('arrowLeft', '', 12)}
          <span>Voltar para Pastas de Lotes</span>
        </a>
        <h1 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
          ${getIcon('plusCircle', '', 24)}
          <span>Emitir Lote de QR Codes</span>
        </h1>
        <p class="text-sm text-muted mt-1">Gere uma sequência de códigos virgens e baixe o pacote pronto para impressão.</p>
      </div>

      <!-- Formulário Limpo -->
      <div class="card p-6">
        <form id="form-batch-create">
          
          <div class="form-group">
            <label class="form-label" for="batch-name">Nome do Lote</label>
            <input type="text" id="batch-name" class="form-input" value="Lote 0${Math.floor(stats.total / 10) + 1}" required />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label" for="batch-prefix">Prefixo</label>
              <input type="text" id="batch-prefix" class="form-input font-mono" value="PLQ-" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="batch-start">Número Inicial</label>
              <input type="number" id="batch-start" class="form-input font-mono" value="${stats.total + 1}" min="1" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="batch-count">Quantidade de Códigos</label>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <button type="button" class="btn btn-secondary btn-sm btn-count-preset" data-count="10">10</button>
              <button type="button" class="btn btn-secondary btn-sm btn-count-preset" data-count="25">25</button>
              <button type="button" class="btn btn-primary btn-sm btn-count-preset" data-count="50">50</button>
              <button type="button" class="btn btn-secondary btn-sm btn-count-preset" data-count="100">100</button>
            </div>
            <input type="number" id="batch-count" class="form-input font-mono" value="50" min="1" max="500" required />
          </div>

          <div class="p-3 mb-6" style="background: var(--bg-subtle); border-radius: 6px; font-size: 0.8125rem;">
            <span class="text-muted">Sequência gerada:</span>
            <span class="font-mono font-bold" id="preview-range">PLQ-001 até PLQ-050</span>
          </div>

          <button type="submit" id="btn-submit-batch" class="btn btn-primary w-full" style="padding: 0.625rem;">
            Gerar Lote e Baixar ZIP
          </button>

        </form>
      </div>

    </div>
  `;
}

import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';

export function renderBatchGenerator() {
  const allBatches = storage.getBatches();
  const defaultPrefix = 'PLQ-';
  const nextNumber = storage.getNextAvailableNumber(defaultPrefix);
  const nextBatchIndex = allBatches.length + 1;
  const defaultBatchName = `Lote ${String(nextBatchIndex).padStart(2, '0')}`;

  const defaultCount = 50;
  const initialAvailability = storage.checkRangeAvailability(defaultPrefix, nextNumber, defaultCount);

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
          <span>Emitir Novo Lote de QR Codes</span>
        </h1>
        <p class="text-sm text-muted mt-1">Gere uma sequência segura de códigos virgens e baixe o pacote pronto para serigrafia ou gráfica.</p>
      </div>

      <!-- Formulário com Validação em Tempo Real -->
      <div class="card p-6">
        <form id="form-batch-create">
          
          <div class="form-group">
            <label class="form-label" for="batch-name">
              <span>Nome da Pasta / Lote</span>
              <span class="text-xs text-muted font-normal">(Ex: Lote 03, Lote Restaurantes, Lote Outubro)</span>
            </label>
            <input type="text" id="batch-name" class="form-input" value="${defaultBatchName}" required />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label" for="batch-prefix">Prefixo dos Códigos</label>
              <input type="text" id="batch-prefix" class="form-input font-mono uppercase" value="${defaultPrefix}" required />
            </div>

            <div class="form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label class="form-label mb-0" for="batch-start">Número Inicial</label>
                <button type="button" id="btn-use-suggested-start" class="btn-ghost text-xs text-blue" style="padding: 0; border: none; cursor: pointer; display: none;">
                  Usar Próximo Livre (#<span id="label-suggested-num">${nextNumber}</span>)
                </button>
              </div>
              <input type="number" id="batch-start" class="form-input font-mono" value="${nextNumber}" min="1" required />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="batch-count">Quantidade de Plaquinhas a Gerar</label>
            <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-sm btn-count-preset" data-count="10">10 unid.</button>
              <button type="button" class="btn btn-secondary btn-sm btn-count-preset" data-count="25">25 unid.</button>
              <button type="button" class="btn btn-primary btn-sm btn-count-preset" data-count="50">50 unid.</button>
              <button type="button" class="btn btn-secondary btn-sm btn-count-preset" data-count="100">100 unid.</button>
              <button type="button" class="btn btn-secondary btn-sm btn-count-preset" data-count="250">250 unid.</button>
            </div>
            <input type="number" id="batch-count" class="form-input font-mono" value="${defaultCount}" min="1" max="1000" required />
          </div>

          <!-- Caixa de Status e Preview de Intervalo -->
          <div id="availability-status-box" class="p-4 mb-6" style="background: ${initialAvailability.available ? '#F0FDF4' : '#FFFBEB'}; border: 1px solid ${initialAvailability.available ? '#BBF7D0' : '#FDE68A'}; border-radius: 8px; font-size: 0.8125rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span class="text-muted font-medium">Sequência a ser emitida:</span>
              <span class="font-mono font-bold" id="preview-range" style="color: var(--text-main); font-size: 0.9375rem;">
                ${initialAvailability.firstId} até ${initialAvailability.lastId} (${defaultCount} plaquinhas)
              </span>
            </div>
            <div id="availability-message" style="display: flex; align-items: center; gap: 6px; color: ${initialAvailability.available ? '#166534' : '#92400E'}; font-size: 0.75rem;">
              ${initialAvailability.available 
                ? `${getIcon('checkCircle', 'text-green', 14)} <span>Todos os ${defaultCount} códigos estão disponíveis e livres para emissão.</span>`
                : `${getIcon('alertTriangle', 'text-amber', 14)} <span>Atenção: ${initialAvailability.existingIds.length} código(s) deste intervalo já existem no sistema.</span>`
              }
            </div>
          </div>

          <!-- Ações de Envio -->
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button type="submit" id="btn-submit-batch-zip" class="btn btn-primary w-full" style="padding: 0.75rem; font-size: 0.9375rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
              ${getIcon('download', '', 16)}
              <span>Gerar Lote e Baixar Pacote ZIP</span>
            </button>

            <button type="button" id="btn-submit-batch-only" class="btn btn-secondary w-full text-xs" style="padding: 0.6rem; color: var(--text-muted);">
              Apenas Criar Lote no Painel (sem baixar ZIP agora)
            </button>
          </div>

        </form>
      </div>

    </div>
  `;
}

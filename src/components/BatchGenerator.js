import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';

export function renderBatchGenerator() {
  const allBatches = storage.getBatches();
  const defaultPrefix = 'PLQ-';
  const nextNumber = storage.getNextAvailableNumber(defaultPrefix);
  // Primeiro "Lote NN" livre. Usar allBatches.length + 1 repetia um nome já
  // existente quando algum lote tinha sido apagado, misturando os dois lotes.
  const takenNames = new Set(allBatches.map(b => b.name.trim().toLowerCase()));
  let nextBatchIndex = allBatches.length + 1;
  while (takenNames.has(`lote ${String(nextBatchIndex).padStart(2, '0')}`)) nextBatchIndex++;
  const defaultBatchName = `Lote ${String(nextBatchIndex).padStart(2, '0')}`;

  const defaultCount = 50;
  const initialAvailability = storage.checkRangeAvailability(defaultPrefix, nextNumber, defaultCount);

  return `
    <div class="container py-6" style="max-width: 620px;">
      
      <!-- Cabeçalho Workstation -->
      <div class="mb-4">
        <a href="#/lotes" class="btn btn-ghost btn-xs mb-1" style="gap: 4px; padding: 2px 4px; color: var(--text-muted);">
          ${getIcon('arrowLeft', '', 11)}
          <span>Voltar para Pastas</span>
        </a>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center;">
            ${getIcon('plusCircle', '', 14)}
          </div>
          <div>
            <h1 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
              Emissão de Novo Lote Fabril
            </h1>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 1px 0 0 0;">
              Geração de identificadores sequenciais com PINs de proteção e arquivos vetoriais para gráfica
            </p>
          </div>
        </div>
      </div>

      <!-- Formulário Workstation -->
      <div class="card" style="padding: 1.25rem;">
        <form id="form-batch-create">
          
          <div class="form-group mb-3">
            <label class="form-label" for="batch-name">
              <span>Identificação do Lote</span>
              <span style="font-size: 0.6875rem; color: var(--text-muted); font-weight: normal; margin-left: 4px;">(Ex: Lote 03, Lote Outubro)</span>
            </label>
            <input type="text" id="batch-name" class="form-input" value="${defaultBatchName}" required />
          </div>

          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="form-group mb-0">
              <label class="form-label" for="batch-prefix">Prefixo</label>
              <input type="text" id="batch-prefix" class="form-input font-mono uppercase" value="${defaultPrefix}" required />
            </div>

            <div class="form-group mb-0">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <label class="form-label mb-0" for="batch-start">Nº Inicial</label>
                <button type="button" id="btn-use-suggested-start" class="btn-ghost btn-xs text-blue" style="padding: 0; border: none; cursor: pointer; display: none;">
                  Próximo livre (#<span id="label-suggested-num">${nextNumber}</span>)
                </button>
              </div>
              <input type="number" id="batch-start" class="form-input font-mono" value="${nextNumber}" min="1" required />
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="form-label" for="batch-count">Tamanho do Lote (Unidades)</label>
            <div style="display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-xs btn-count-preset" data-count="10">10 un</button>
              <button type="button" class="btn btn-secondary btn-xs btn-count-preset" data-count="25">25 un</button>
              <button type="button" class="btn btn-primary btn-xs btn-count-preset" data-count="50">50 un</button>
              <button type="button" class="btn btn-secondary btn-xs btn-count-preset" data-count="100">100 un</button>
              <button type="button" class="btn btn-secondary btn-xs btn-count-preset" data-count="250">250 un</button>
            </div>
            <input type="number" id="batch-count" class="form-input font-mono" value="${defaultCount}" min="1" max="1000" required />
          </div>

          <!-- Caixa de Status e Preview de Intervalo -->
          <div id="availability-status-box" class="p-3 mb-4" style="background: ${initialAvailability.available ? '#ECFDF5' : '#FFFBEB'}; border: 1px solid ${initialAvailability.available ? '#A7F3D0' : '#FDE68A'}; border-radius: var(--radius-sm); font-size: 0.75rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted); font-size: 0.72rem;">Faixa de numeração:</span>
              <span class="num-tabular td-id" id="preview-range" style="font-size: 0.8125rem;">
                ${initialAvailability.firstId} → ${initialAvailability.lastId} (${defaultCount} un)
              </span>
            </div>
            <div id="availability-message" style="display: flex; align-items: center; gap: 6px; color: ${initialAvailability.available ? '#047857' : '#92400E'}; font-size: 0.72rem;">
              ${initialAvailability.available 
                ? `${getIcon('checkCircle', 'text-green', 13)} <span>Todos os ${defaultCount} códigos estão disponíveis no inventário.</span>`
                : `${getIcon('alertTriangle', 'text-amber', 13)} <span>Atenção: ${initialAvailability.existingIds.length} código(s) deste intervalo já existem no sistema.</span>`
              }
            </div>
          </div>

          <!-- Ações de Envio -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <button type="submit" id="btn-submit-batch-zip" class="btn btn-primary w-full" style="padding: 0.55rem; font-size: 0.8125rem; gap: 6px;">
              ${getIcon('download', '', 14)}
              <span>Emitir Lote e Baixar Pacote ZIP</span>
            </button>

            <button type="button" id="btn-submit-batch-only" class="btn btn-secondary w-full btn-xs" style="color: var(--text-muted);">
              Apenas Registrar no Painel (sem baixar arquivos agora)
            </button>
          </div>

        </form>
      </div>

    </div>
  `;
}

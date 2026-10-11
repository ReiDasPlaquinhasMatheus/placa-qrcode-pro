import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';

export function renderBatchGeneratorInstagram() {
  const allBatches = storage.getBatches();
  const defaultPrefix = 'IG-';
  const nextNumber = storage.getNextAvailableNumber(defaultPrefix);

  // Primeiro "Lote Instagram NN" livre
  const takenNames = new Set(allBatches.map(b => b.name.trim().toLowerCase()));
  let nextBatchIndex = 1;
  while (takenNames.has(`lote instagram ${String(nextBatchIndex).padStart(2, '0')}`)) {
    nextBatchIndex++;
  }
  const defaultBatchName = `Lote Instagram ${String(nextBatchIndex).padStart(2, '0')}`;

  const defaultCount = 50;
  const initialAvailability = storage.checkRangeAvailability(defaultPrefix, nextNumber, defaultCount);

  return `
    <div class="container py-6" style="max-width: 680px;">
      
      <!-- Cabeçalho Workstation -->
      <div class="mb-4">
        <a href="#/lotes" class="btn btn-ghost btn-xs mb-1" style="gap: 4px; padding: 2px 4px; color: var(--text-muted);">
          ${getIcon('arrowLeft', '', 11)}
          <span>Voltar para Pastas</span>
        </a>
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: #000000; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${getIcon('instagram', '', 18)}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <h1 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
                  Emissão de Lote Instagram
                </h1>
                <span class="badge" style="background: #000000; color: #FFFFFF; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                  Ícone Central Vetorial
                </span>
              </div>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 1px 0 0 0;">
                Geração de QR Codes dinâmicos com símbolo do Instagram em preto sólido para lojas, corte a laser e acrílico
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Card Explicativo de Engenharia Gráfica -->
      <div class="card p-3 mb-4" style="background: #FAFAFA; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="width: 58px; height: 58px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; position: relative; padding: 4px;">
            <!-- Mini Simulação Visual do QR Code com Logo Preto Central -->
            <svg width="48" height="48" viewBox="0 0 100 100">
              <rect width="100" height="100" fill="#FFFFFF"/>
              <!-- Elementos simbólicos de QR code -->
              <rect x="5" y="5" width="26" height="26" fill="#000000" rx="3"/>
              <rect x="10" y="10" width="16" height="16" fill="#FFFFFF"/>
              <rect x="14" y="14" width="8" height="8" fill="#000000"/>

              <rect x="69" y="5" width="26" height="26" fill="#000000" rx="3"/>
              <rect x="74" y="10" width="16" height="16" fill="#FFFFFF"/>
              <rect x="78" y="14" width="8" height="8" fill="#000000"/>

              <rect x="5" y="69" width="26" height="26" fill="#000000" rx="3"/>
              <rect x="10" y="74" width="16" height="16" fill="#FFFFFF"/>
              <rect x="14" y="78" width="8" height="8" fill="#000000"/>

              <!-- Módulos aleatórios ao redor -->
              <rect x="36" y="8" width="8" height="8" fill="#000000"/>
              <rect x="48" y="8" width="8" height="8" fill="#000000"/>
              <rect x="36" y="84" width="8" height="8" fill="#000000"/>
              <rect x="48" y="84" width="8" height="8" fill="#000000"/>
              <rect x="8" y="38" width="8" height="8" fill="#000000"/>
              <rect x="8" y="50" width="8" height="8" fill="#000000"/>
              <rect x="84" y="38" width="8" height="8" fill="#000000"/>
              <rect x="84" y="50" width="8" height="8" fill="#000000"/>

              <!-- Badge Branco de Proteção Central (Quiet Zone) -->
              <rect x="32" y="32" width="36" height="36" rx="8" fill="#FFFFFF"/>

              <!-- Símbolo Instagram Preto Sólido -->
              <rect x="36" y="36" width="28" height="28" rx="7" fill="none" stroke="#000000" stroke-width="2.5"/>
              <circle cx="50" cy="50" r="6" fill="none" stroke="#000000" stroke-width="2.5"/>
              <circle cx="58" cy="42" r="1.5" fill="#000000"/>
            </svg>
          </div>

          <div style="flex: 1;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #0F172A; display: flex; align-items: center; gap: 4px;">
              <span>Padrão Fabril: Ícone Preto Sólido + Nível H de Correção</span>
            </div>
            <p style="font-size: 0.7rem; color: #475569; margin: 2px 0 0 0; line-height: 1.35;">
              Os QR Codes são gerados em <strong>Nível H (30% de redundância)</strong> com uma máscara de respiro branca, garantindo leitura instantânea em qualquer smartphone e permitindo gravação em <strong>acrílico, metal, corte a laser ou serigrafia</strong>.
            </p>
          </div>
        </div>
      </div>

      <!-- Formulário Workstation -->
      <div class="card" style="padding: 1.25rem;">
        <form id="form-batch-instagram-create">
          
          <div class="form-group mb-3">
            <label class="form-label" for="batch-ig-name">
              <span>Identificação do Lote</span>
              <span style="font-size: 0.6875rem; color: var(--text-muted); font-weight: normal; margin-left: 4px;">(Ex: Lote Instagram 01, Lote Lojas SP)</span>
            </label>
            <input type="text" id="batch-ig-name" class="form-input" value="${defaultBatchName}" required />
          </div>

          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="form-group mb-0">
              <label class="form-label" for="batch-ig-prefix">
                <span>Prefixo</span>
                <span style="font-size: 0.6875rem; color: var(--text-muted); font-weight: normal; margin-left: 4px;">(Padrão: IG-)</span>
              </label>
              <input type="text" id="batch-ig-prefix" class="form-input font-mono uppercase" value="${defaultPrefix}" required />
            </div>

            <div class="form-group mb-0">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                <label class="form-label mb-0" for="batch-ig-start">Nº Inicial</label>
                <button type="button" id="btn-ig-use-suggested-start" class="btn-ghost btn-xs text-blue" style="padding: 0; border: none; cursor: pointer; display: none;">
                  Próximo livre (#<span id="label-ig-suggested-num">${nextNumber}</span>)
                </button>
              </div>
              <input type="number" id="batch-ig-start" class="form-input font-mono" value="${nextNumber}" min="1" required />
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="form-label" for="batch-ig-count">Tamanho do Lote (Unidades)</label>
            <div style="display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap;">
              <button type="button" class="btn btn-secondary btn-xs btn-ig-count-preset" data-count="10">10 un</button>
              <button type="button" class="btn btn-secondary btn-xs btn-ig-count-preset" data-count="25">25 un</button>
              <button type="button" class="btn btn-primary btn-xs btn-ig-count-preset" data-count="50">50 un</button>
              <button type="button" class="btn btn-secondary btn-xs btn-ig-count-preset" data-count="100">100 un</button>
              <button type="button" class="btn btn-secondary btn-xs btn-ig-count-preset" data-count="250">250 un</button>
              <button type="button" class="btn btn-secondary btn-xs btn-ig-count-preset" data-count="500">500 un</button>
            </div>
            <input type="number" id="batch-ig-count" class="form-input font-mono" value="${defaultCount}" min="1" max="1000" required />
          </div>

          <!-- Caixa de Status e Preview de Intervalo -->
          <div id="availability-ig-status-box" class="p-3 mb-4" style="background: ${initialAvailability.available ? '#ECFDF5' : '#FFFBEB'}; border: 1px solid ${initialAvailability.available ? '#A7F3D0' : '#FDE68A'}; border-radius: var(--radius-sm); font-size: 0.75rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted); font-size: 0.72rem;">Faixa de numeração:</span>
              <span class="num-tabular td-id" id="preview-ig-range" style="font-size: 0.8125rem;">
                ${initialAvailability.firstId} → ${initialAvailability.lastId} (${defaultCount} un)
              </span>
            </div>
            <div id="availability-ig-message" style="display: flex; align-items: center; gap: 6px; color: ${initialAvailability.available ? '#047857' : '#92400E'}; font-size: 0.72rem;">
              ${initialAvailability.available 
                ? `${getIcon('checkCircle', 'text-green', 13)} <span>Todos os ${defaultCount} códigos estão disponíveis no inventário.</span>`
                : `${getIcon('alertTriangle', 'text-amber', 13)} <span>Atenção: ${initialAvailability.existingIds.length} código(s) deste intervalo já existem no sistema.</span>`
              }
            </div>
          </div>

          <!-- Ações de Envio -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <button type="submit" id="btn-submit-batch-ig-zip" class="btn btn-primary w-full" style="padding: 0.6rem; font-size: 0.8125rem; gap: 8px; background: #000000; border-color: #000000; color: #FFFFFF;">
              ${getIcon('download', '', 15)}
              <span>Emitir Lote Instagram e Baixar Pacote ZIP</span>
            </button>

            <button type="button" id="btn-submit-batch-ig-only" class="btn btn-secondary w-full btn-xs" style="color: var(--text-muted);">
              Apenas Registrar no Painel (sem baixar arquivos agora)
            </button>
          </div>

        </form>
      </div>

    </div>
  `;
}

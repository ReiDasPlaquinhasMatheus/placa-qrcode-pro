import { storage } from '../services/storage.js';
import { generateCleanQRCodePng } from '../services/qrGenerator.js';
import { escapeHtml } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';

// Modal de Visualização Rápida e Download do QR Code
export async function renderQRModal(plaqueId) {
  const plaque = storage.getPlaqueById(plaqueId);
  if (!plaque) return '';

  const qrDataUrl = await generateCleanQRCodePng(plaque.id, 800, true);
  const isVirgin = plaque.status === 'virgin';

  return `
    <div class="modal-overlay" id="qr-modal" data-id="${escapeHtml(plaque.id)}">
      <div class="modal-box text-center">
        
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <div style="text-align: left;">
            <div style="font-weight: 700; font-size: 1rem;">QR Code: <span class="font-mono text-blue">${escapeHtml(plaque.id)}</span></div>
            <div class="text-xs text-muted">${escapeHtml(plaque.name || 'Virgem (Sem empresa vinculada)')}</div>
          </div>
          <button class="btn-close-modal btn btn-ghost btn-sm" style="padding: 4px 8px;" title="Fechar">
            ${getIcon('close', '', 16)}
          </button>
        </div>

        <!-- Imagem do QR Code 100% Quadrado -->
        <div style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: inline-block; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
          <img src="${qrDataUrl}" alt="QR Code ${escapeHtml(plaque.id)}" style="width: 240px; height: 240px; aspect-ratio: 1/1; display: block; object-fit: contain;" />
        </div>

        <div class="text-xs text-muted mb-6" style="word-break: break-all;">
          ${isVirgin ? 'Aguardando vínculo do link' : escapeHtml(plaque.target_url || '')}
        </div>

        <!-- Botões de Download -->
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button id="btn-download-svg-single" class="btn btn-secondary btn-sm flex-1" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
            ${getIcon('download', '', 14)}
            <span>Baixar SVG (Vetor 1:1)</span>
          </button>
          <button id="btn-download-png-single" class="btn btn-primary btn-sm flex-1" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
            ${getIcon('download', '', 14)}
            <span>Baixar PNG (1000x1000px)</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

// Modal de Edição Rápida
export function renderEditModal(plaqueId) {
  const plaque = storage.getPlaqueById(plaqueId);
  if (!plaque) return '';

  return `
    <div class="modal-overlay" id="edit-plaque-modal">
      <div class="modal-box">
        
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <h3 style="font-size: 1rem; font-weight: 700;">Editar Plaquinha: ${escapeHtml(plaque.id)}</h3>
          <button class="btn-close-modal btn btn-ghost btn-sm" style="padding: 4px 8px;" title="Fechar">
            ${getIcon('close', '', 16)}
          </button>
        </div>

        <form id="form-edit-modal-save" data-id="${escapeHtml(plaque.id)}">
          
          <div class="form-group">
            <label class="form-label" for="edit-name">Nome da Empresa / Estabelecimento</label>
            <input type="text" id="edit-name" class="form-input" value="${escapeHtml(plaque.name || '')}" placeholder="Ex: Restaurante Bom Sabor" />
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-target-url">Link de Destino (Google Meu Negócio)</label>
            <input type="url" id="edit-target-url" class="form-input" value="${escapeHtml(plaque.target_url || '')}" placeholder="https://search.google.com/local/writereview?placeid=..." />
          </div>

          <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              ${getIcon('user', '', 14)}
              <span>Comprador / Cliente Atrelado</span>
            </div>
            <div class="grid grid-cols-2 gap-2 mb-2">
              <input type="text" id="edit-client-name" class="form-input" value="${escapeHtml(plaque.client_name || '')}" placeholder="Nome do Cliente" style="font-size: 0.8125rem; padding: 4px 8px;" />
              <input type="text" id="edit-client-phone" class="form-input font-mono" value="${escapeHtml(plaque.client_phone || '')}" placeholder="WhatsApp: (11) 9..." style="font-size: 0.8125rem; padding: 4px 8px;" />
            </div>
            ${plaque.client_code ? `
              <div class="text-xs text-muted font-mono" style="font-size: 0.7rem; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                ${getIcon('key', '', 12)}
                <span>Código de Login (Invertido): <strong>${escapeHtml(plaque.client_code)}</strong></span>
                <a href="#/cliente/${encodeURIComponent(plaque.client_code)}" target="_blank" class="text-blue ml-2" style="display: inline-flex; align-items: center; gap: 2px;">
                  <span>Abrir Portal</span>
                  ${getIcon('arrowRight', '', 11)}
                </a>
              </div>
            ` : ''}
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label" for="edit-pin">PIN de Segurança</label>
              <input type="text" id="edit-pin" class="form-input font-mono" value="${escapeHtml(plaque.pin || '')}" maxlength="6" />
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-status">Status</label>
              <select id="edit-status" class="form-input">
                <option value="active" ${plaque.status === 'active' ? 'selected' : ''}>Ativo</option>
                <option value="virgin" ${plaque.status === 'virgin' ? 'selected' : ''}>Virgem</option>
                <option value="paused" ${plaque.status === 'paused' ? 'selected' : ''}>Pausado</option>
              </select>
            </div>
          </div>

          <div class="p-3 mb-4 text-xs" style="background: var(--bg-subtle); border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
            <div>
              <span class="text-muted block">Link único do QR Code:</span>
              <code class="font-mono text-blue">${(typeof window !== 'undefined' ? window.location.origin : '')}/r/${escapeHtml(plaque.id)}</code>
            </div>
            <button type="button" class="btn btn-secondary btn-sm btn-copy-link" data-url="${(typeof window !== 'undefined' ? window.location.origin : '')}/r/${escapeHtml(plaque.id)}" style="display: inline-flex; align-items: center; gap: 4px;">
              ${getIcon('copy', '', 13)}
              <span>Copiar</span>
            </button>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem;">
            <button type="button" class="btn btn-ghost btn-close-modal btn-sm">Cancelar</button>
            <button type="submit" class="btn btn-primary btn-sm">Salvar Alterações</button>
          </div>

        </form>
      </div>
    </div>
  `;
}

// Modal do Guia Netlify
export function renderDeployGuideModal() {
  return `
    <div class="modal-overlay" id="deploy-guide-modal">
      <div class="modal-box" style="max-width: 580px;">
        
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <h3 style="font-size: 1rem; font-weight: 700;">Publicação e Hospedagem no Netlify</h3>
          <button class="btn-close-modal btn btn-ghost btn-sm" style="padding: 4px 8px;" title="Fechar">
            ${getIcon('close', '', 16)}
          </button>
        </div>

        <div style="font-size: 0.8125rem; color: var(--text-main); display: flex; flex-direction: column; gap: 12px;">
          <p>O projeto já possui o arquivo <code class="font-mono text-blue">netlify.toml</code> e a Serverless Function configurados para redirecionamento instantâneo em milissegundos.</p>

          <div class="p-3" style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px;">
            <div class="font-bold mb-1">Passo 1: Variáveis no Netlify</div>
            <p class="text-muted">Acesse <strong>Site configuration &rarr; Environment variables</strong> no Netlify e configure:</p>
            <ul style="padding-left: 1.25rem; margin-top: 4px;" class="font-mono text-xs">
              <li>SUPABASE_URL = ${escapeHtml(storage.settings.supabaseUrl || '')}</li>
              <li>SUPABASE_ANON_KEY = ${escapeHtml(storage.settings.supabaseKey || '')}</li>
            </ul>
          </div>

          <div class="p-3" style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px;">
            <div class="font-bold mb-1">Passo 2: Domínio dos QR Codes</div>
            <p class="text-muted">Após publicar, pegue o seu domínio do Netlify (ex: <code>https://meusite.netlify.app</code>) e salve na aba <strong>Configurações</strong> antes de emitir novos lotes para a gráfica.</p>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" class="btn btn-primary btn-sm btn-close-modal">Entendido</button>
        </div>

      </div>
    </div>
  `;
}

// Modal de Progresso em Tempo Real durante Geração de Lotes / ZIP
export function renderProgressModal({ title = 'Gerando Pacote de Arquivos', current = 0, total = 0, percent = 0, message = 'Processando plaquinhas...' }) {
  return `
    <div class="modal-overlay" id="progress-modal" style="z-index: 9999;">
      <div class="modal-box text-center" style="max-width: 440px;">
        
        <div style="width: 48px; height: 48px; background: #EEF2FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; color: #4F46E5;">
          ${getIcon('download', '', 24)}
        </div>

        <h3 id="progress-modal-title" style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">
          ${escapeHtml(title)}
        </h3>

        <p id="progress-modal-message" class="text-xs text-muted mb-4">
          ${escapeHtml(message)}
        </p>

        <!-- Barra de Progresso Animada -->
        <div style="background: #F1F5F9; height: 10px; border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem; border: 1px solid #E2E8F0;">
          <div id="progress-bar-fill" style="background: linear-gradient(90deg, #3B82F6, #2563EB); height: 100%; width: ${percent}%; border-radius: 999px; transition: width 0.15s ease;"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">
          <span id="progress-modal-count">${current} / ${total} gerados</span>
          <span id="progress-modal-percent">${percent}%</span>
        </div>

      </div>
    </div>
  `;
}

// Modal de Confirmação para Excluir Lote
export function renderConfirmDeleteBatchModal(batchName, plaqueCount = 0) {
  return `
    <div class="modal-overlay" id="delete-batch-modal" data-batch="${escapeHtml(batchName)}">
      <div class="modal-box" style="max-width: 460px;">
        
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 1rem;">
          <div style="width: 40px; height: 40px; background: #FEE2E2; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #DC2626; flex-shrink: 0;">
            ${getIcon('trash', '', 20)}
          </div>
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #DC2626; margin-bottom: 4px;">Excluir Pasta de Lote</h3>
            <p class="text-xs text-muted">Esta ação excluirá permanentemente a pasta e todas as plaquinhas vinculadas a ela.</p>
          </div>
        </div>

        <div class="p-3 mb-4" style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; font-size: 0.8125rem;">
          <div style="font-weight: 600; color: #991B1B; margin-bottom: 2px;">Lote selecionado: <strong>${escapeHtml(batchName)}</strong></div>
          <div class="text-xs" style="color: #7F1D1D;">Total de plaquinhas que serão removidas: <strong>${plaqueCount}</strong></div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn btn-ghost btn-sm btn-close-modal">Cancelar</button>
          <button type="button" id="btn-confirm-delete-batch" class="btn btn-primary btn-sm" style="background: #DC2626; border-color: #DC2626;">
            Sim, Excluir Lote
          </button>
        </div>

      </div>
    </div>
  `;
}

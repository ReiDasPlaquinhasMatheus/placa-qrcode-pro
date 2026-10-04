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

          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); flex-wrap: wrap;">
            <button type="button" class="btn btn-sm btn-modal-delete-plaque" data-id="${escapeHtml(plaque.id)}" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; display: inline-flex; align-items: center; gap: 6px; font-weight: 600;" title="Apagar e desvincular esta plaquinha">
              ${getIcon('trash', '', 14)}
              <span>Apagar Plaquinha</span>
            </button>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-ghost btn-close-modal btn-sm">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">Salvar Alterações</button>
            </div>
          </div>

        </form>
      </div>
    </div>
  `;
}

// Modal de edição usado pelo CLIENTE (Portal), separado do modal de
// admin acima. Não mostra nem deixa editar o PIN (o admin acima
// mostrava o PIN em texto puro sem nenhuma confirmação — qualquer um
// com acesso ao portal conseguia ler o PIN real só abrindo "Alterar",
// o que anulava a proteção do botão "Apagar"), nem o campo de Status.
// A alteração exige o PIN pra confirmar e é validada no banco (mesma
// função pública usada na reativação, public_activate_plaque).
export function renderClientEditModal(plaqueId) {
  const plaque = storage.getPlaqueById(plaqueId);
  if (!plaque) return '';

  return `
    <div class="modal-overlay" id="client-edit-plaque-modal" data-id="${escapeHtml(plaque.id)}">
      <div class="modal-box">

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <h3 style="font-size: 1rem; font-weight: 700;">Alterar Plaquinha: ${escapeHtml(plaque.id)}</h3>
          <button class="btn-close-modal btn btn-ghost btn-sm" style="padding: 4px 8px;" title="Fechar">
            ${getIcon('close', '', 16)}
          </button>
        </div>

        <form id="form-client-edit-plaque">

          <div class="form-group">
            <label class="form-label" for="cep-name">Nome da Empresa / Estabelecimento</label>
            <input type="text" id="cep-name" class="form-input" value="${escapeHtml(plaque.name || '')}" placeholder="Ex: Restaurante Bom Sabor" />
          </div>

          <div class="form-group">
            <label class="form-label" for="cep-target-url">Link de Destino (Google Meu Negócio)</label>
            <input type="url" id="cep-target-url" class="form-input" value="${escapeHtml(plaque.target_url || '')}" placeholder="https://search.google.com/local/writereview?placeid=..." required />
          </div>

          <div class="form-group">
            <label class="form-label" for="cep-pin">Digite o PIN de segurança para confirmar</label>
            <input type="password" id="cep-pin" class="form-input font-mono" maxlength="6" placeholder="PIN da plaquinha" autocomplete="off" required />
            <button type="button" id="link-forgot-pin-from-edit" data-id="${escapeHtml(plaque.id)}" class="text-xs text-blue" style="background: none; border: none; padding: 0; margin-top: 6px; cursor: pointer; text-decoration: underline;">
              Esqueci meu PIN
            </button>
          </div>

          <div id="cep-error" style="color: #DC2626; font-size: 0.75rem; margin-bottom: 8px; display: none;"></div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem;">
            <button type="button" class="btn btn-ghost btn-close-modal btn-sm">Cancelar</button>
            <button type="submit" id="btn-submit-client-edit" class="btn btn-primary btn-sm">Salvar Alterações</button>
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
        
        <div style="width: 40px; height: 40px; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: #2563EB;">
          ${getIcon('download', '', 20)}
        </div>

        <h3 id="progress-modal-title" style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">
          ${escapeHtml(title)}
        </h3>

        <p id="progress-modal-message" class="text-xs text-muted mb-3 font-mono">
          ${escapeHtml(message)}
        </p>

        <!-- Barra de Progresso Limpa -->
        <div style="background: #F3F4F6; height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 0.75rem; border: 1px solid var(--border-color);">
          <div id="progress-bar-fill" style="background: #2563EB; height: 100%; width: ${percent}%; border-radius: 3px; transition: width 0.15s ease;"></div>
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

// Modal de Confirmação para Apagar / Desvincular Plaquinha
export function renderConfirmDeletePlaqueModal(plaqueId, isClient = false) {
  const plaque = storage.getPlaqueById(plaqueId);
  if (!plaque) return '';

  // O PIN agora é validado no banco (public_reset_plaque), não mais
  // comparado aqui — o cache local do cliente nem recebe mais o campo
  // pin das APIs públicas. Por isso, no fluxo do cliente, sempre pedimos
  // o PIN e deixamos o servidor decidir se está correto.
  const requirePin = isClient;

  return `
    <div class="modal-overlay" id="delete-plaque-modal" data-id="${escapeHtml(plaque.id)}" data-require-pin="${requirePin ? 'true' : 'false'}">
      <div class="modal-box" style="max-width: 440px;">
        
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #FEE2E2; display: flex; align-items: center; justify-content: center; color: #DC2626; flex-shrink: 0;">
            ${getIcon('trash', '', 20)}
          </div>
          <div style="flex: 1;">
            <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A; margin: 0;">Apagar Plaquinha</h3>
            <span class="font-mono text-xs text-muted">Código: <strong>${escapeHtml(plaque.id)}</strong></span>
          </div>
          <button class="btn-close-modal btn btn-ghost btn-sm" style="padding: 4px 8px;" title="Fechar">
            ${getIcon('close', '', 16)}
          </button>
        </div>

        <div style="font-size: 0.875rem; color: #475569; line-height: 1.5; margin-bottom: 1.25rem;">
          <p style="margin-bottom: 0.75rem;">
            Deseja realmente apagar e desvincular a plaquinha <strong>${escapeHtml(plaque.name || plaque.id)}</strong>?
          </p>
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 10px 12px; font-size: 0.8125rem; color: #92400E; display: flex; gap: 8px;">
            ${getIcon('alertTriangle', 'text-amber', 18)}
            <div>
              <strong>Atenção:</strong> A plaquinha será removida da sua lista e retornará ao estado virgem pronta para ser reutilizada.
            </div>
          </div>
        </div>

        ${requirePin ? `
          <div style="margin-bottom: 1.25rem;">
            <label for="delete-plaque-pin" class="form-label" style="font-size: 0.8125rem; font-weight: 600; color: #0F172A;">
              Digite o PIN de segurança para confirmar:
            </label>
            <input 
              type="password" 
              id="delete-plaque-pin" 
              class="form-input font-mono" 
              maxlength="6" 
              placeholder="Digite o PIN da plaquinha" 
              autocomplete="off"
              style="font-size: 1rem; letter-spacing: 2px; text-align: center;"
            />
            <div id="delete-pin-error" style="color: #DC2626; font-size: 0.75rem; margin-top: 4px; display: none;">
              PIN de segurança incorreto. Tente novamente.
            </div>
            <button type="button" id="link-forgot-pin-from-delete" data-id="${escapeHtml(plaque.id)}" class="text-xs text-blue" style="background: none; border: none; padding: 0; margin-top: 6px; cursor: pointer; text-decoration: underline;">
              Esqueci meu PIN
            </button>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn btn-ghost btn-close-modal btn-sm">Cancelar</button>
          <button type="button" id="btn-confirm-delete-plaque" class="btn btn-sm" style="background: #DC2626; color: #FFFFFF; border: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
            ${getIcon('trash', '', 14)}
            <span>Sim, Apagar Plaquinha</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

// Modal para o cliente configurar (ou trocar/recuperar) a senha do
// Portal. O telefone é a prova de posse, validada no banco.
export function renderClientSetPasswordModal(clientCode, phoneHint = '') {
  return `
    <div class="modal-overlay" id="client-set-password-modal" data-code="${escapeHtml(clientCode || '')}">
      <div class="modal-box" style="max-width: 420px;">

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #EEF4FF; display: flex; align-items: center; justify-content: center; color: #2563EB; flex-shrink: 0;">
            ${getIcon('lock', '', 20)}
          </div>
          <div style="flex: 1;">
            <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A; margin: 0;">Proteger Minha Conta</h3>
            <span class="text-xs text-muted">Configure uma senha de acesso</span>
          </div>
          <button class="btn-close-modal btn btn-ghost btn-sm" style="padding: 4px 8px;" title="Fechar">
            ${getIcon('close', '', 16)}
          </button>
        </div>

        <p style="font-size: 0.8125rem; color: #475569; line-height: 1.5; margin-bottom: 1.25rem;">
          Confirme seu telefone de contato (o mesmo usado na ativação das suas plaquinhas) e escolha uma senha. Nas próximas visitas, essa senha será pedida antes de mostrar seus dados.
        </p>

        <form id="form-client-set-password">
          <div class="form-group mb-3">
            <label class="form-label" for="csp-phone" style="font-size: 0.8125rem; font-weight: 600;">Telefone de Contato</label>
            <input type="tel" id="csp-phone" class="form-input font-mono" value="${escapeHtml(phoneHint)}" placeholder="(11) 98765-4321" required />
          </div>

          <div class="form-group mb-3">
            <label class="form-label" for="csp-password" style="font-size: 0.8125rem; font-weight: 600;">Nova Senha</label>
            <input type="password" id="csp-password" class="form-input" minlength="4" placeholder="Pelo menos 4 caracteres" required autocomplete="new-password" />
          </div>

          <div class="form-group mb-3">
            <label class="form-label" for="csp-password-confirm" style="font-size: 0.8125rem; font-weight: 600;">Confirmar Senha</label>
            <input type="password" id="csp-password-confirm" class="form-input" minlength="4" placeholder="Digite a senha novamente" required autocomplete="new-password" />
          </div>

          <div id="csp-error" style="color: #DC2626; font-size: 0.75rem; margin-bottom: 8px; display: none;"></div>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem;">
            <button type="button" class="btn btn-ghost btn-close-modal btn-sm">Cancelar</button>
            <button type="submit" id="btn-submit-client-set-password" class="btn btn-primary btn-sm">
              Salvar Senha
            </button>
          </div>
        </form>

      </div>
    </div>
  `;
}

// "Esqueci meu PIN" — só funciona pra quem já confirmou a senha nesta
// sessão (a senha já prova quem é a pessoa). Sem senha, oferece ir
// direto pra configurar uma.
export function renderClientResetPinModal(plaqueId) {
  const hasSession = Boolean(storage.getClientSessionInfo()?.token);
  const plaque = storage.getPlaqueById(plaqueId);

  return `
    <div class="modal-overlay" id="client-reset-pin-modal" data-id="${escapeHtml(plaqueId || '')}">
      <div class="modal-box" style="max-width: 420px;">

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: #EEF4FF; display: flex; align-items: center; justify-content: center; color: #2563EB; flex-shrink: 0;">
            ${getIcon('key', '', 20)}
          </div>
          <div style="flex: 1;">
            <h3 style="font-size: 1rem; font-weight: 700; color: #0F172A; margin: 0;">Esqueci meu PIN</h3>
            <span class="text-xs text-muted">Código: <strong>${escapeHtml(plaqueId || '')}</strong></span>
          </div>
          <button class="btn-close-modal btn btn-ghost btn-sm" style="padding: 4px 8px;" title="Fechar">
            ${getIcon('close', '', 16)}
          </button>
        </div>

        ${hasSession ? `
          <p style="font-size: 0.8125rem; color: #475569; line-height: 1.5; margin-bottom: 1.25rem;">
            Como você já confirmou sua senha, pode definir um novo PIN de segurança para essa plaquinha agora, sem precisar do PIN antigo.
          </p>

          <form id="form-client-reset-pin">
            <div class="form-group mb-3">
              <label class="form-label" for="crp-new-pin">Novo PIN de Segurança</label>
              <input type="text" id="crp-new-pin" class="form-input font-mono" maxlength="6" placeholder="Ex: 1234" required autocomplete="off" />
            </div>

            <div id="crp-error" style="color: #DC2626; font-size: 0.75rem; margin-bottom: 8px; display: none;"></div>

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem;">
              <button type="button" class="btn btn-ghost btn-close-modal btn-sm">Cancelar</button>
              <button type="submit" id="btn-submit-client-reset-pin" class="btn btn-primary btn-sm">Salvar Novo PIN</button>
            </div>
          </form>
        ` : `
          <p style="font-size: 0.8125rem; color: #475569; line-height: 1.5; margin-bottom: 1rem;">
            Isso só funciona pra quem já tem uma senha configurada na conta — é ela que confirma que é você, sem precisar do PIN antigo.
          </p>
          <p style="font-size: 0.8125rem; color: #475569; line-height: 1.5; margin-bottom: 1.25rem;">
            Configure uma senha agora pra liberar essa opção, ou fale com o Rei do NFC pra trocar o PIN diretamente.
          </p>

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 1rem;">
            <button type="button" class="btn btn-ghost btn-close-modal btn-sm">Fechar</button>
            <button type="button" id="btn-goto-setup-password-from-pin" data-id="${escapeHtml(plaqueId || '')}" data-phone="${escapeHtml(plaque?.client_phone || '')}" class="btn btn-primary btn-sm">
              Configurar Senha Agora
            </button>
          </div>
        `}

      </div>
    </div>
  `;
}


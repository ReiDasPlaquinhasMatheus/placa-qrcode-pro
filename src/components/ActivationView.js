import { storage } from '../services/storage.js';
import { escapeHtml } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';

export function renderActivationView(plaqueId) {
  const plaque = storage.getPlaqueById(plaqueId);

  if (!plaque) {
    return `
      <div class="container py-12" style="max-width: 480px; text-align: center;">
        <div class="card p-6">
          <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem;">Código não encontrado</h2>
          <p class="text-sm text-muted mb-4">O código <strong>${escapeHtml(plaqueId || '')}</strong> não está cadastrado no sistema.</p>
          <a href="#/" class="btn btn-primary btn-sm">Ir para o Início</a>
        </div>
      </div>
    `;
  }

  const isAlreadyActive = plaque.status === 'active';

  return `
    <div class="container py-8" style="max-width: 480px;" id="activation-card-container">
      <div class="card p-6">
        
        <!-- Cabeçalho -->
        <div class="mb-5">
          <div class="badge ${isAlreadyActive ? 'badge-active' : 'badge-virgin'} mb-2 font-mono">
            Plaquinha: ${escapeHtml(plaque.id)}
          </div>
          <h1 style="font-size: 1.375rem;">
            ${isAlreadyActive ? 'Atualizar Plaquinha QR Code' : 'Ativar Minha Plaquinha QR Code'}
          </h1>
          <p class="text-xs text-muted mt-1">
            ${isAlreadyActive 
              ? 'Esta plaquinha já está vinculada. Você pode atualizar o link de destino abaixo.' 
              : 'Preencha os dados da sua empresa e o link de avaliação do Google para ativar.'}
          </p>
        </div>

        ${isAlreadyActive ? `
          <div class="p-3 mb-4 text-xs" style="background: var(--bg-subtle); border-radius: 6px;">
            <div class="font-medium text-main">${escapeHtml(plaque.name || 'Empresa Cadastrada')}</div>
            <div class="text-muted truncate mt-0.5">${escapeHtml(plaque.target_url || '')}</div>
          </div>
        ` : ''}

        <!-- Formulário do Cliente -->
        <form id="form-activate-plaque" data-id="${escapeHtml(plaque.id)}">
          
          <!-- Seção de Dados do Comprador/Responsável -->
          <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; margin-bottom: 1rem;">
            <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              ${getIcon('user', '', 15)}
              <span>Seus Dados de Acesso</span>
            </div>

            <div class="form-group" style="margin-bottom: 8px;">
              <label class="form-label" for="act-client-name" style="font-size: 0.75rem;">Seu Nome Completo</label>
              <input 
                type="text" 
                id="act-client-name" 
                class="form-input" 
                placeholder="Ex: Carlos Eduardo Silva" 
                value="${escapeHtml(plaque.client_name || '')}" 
                required 
              />
            </div>

            <div class="form-group" style="margin-bottom: 4px;">
              <label class="form-label" for="act-client-phone" style="font-size: 0.75rem;">Telefone de Contato (WhatsApp)</label>
              <input 
                type="tel" 
                id="act-client-phone" 
                class="form-input font-mono" 
                placeholder="(11) 98765-4321" 
                value="${escapeHtml(plaque.client_phone || '')}" 
                required 
              />
            </div>

            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 6px; display: flex; align-items: center; gap: 4px;" id="box-code-preview">
              ${getIcon('info', '', 12)}
              <span>Seu código de login para ver todas as suas placas será o seu número invertido.</span>
            </div>
          </div>

          <!-- Dados da Empresa e Link do Google -->
          <div class="form-group">
            <label class="form-label" for="act-company-name">Nome da Empresa / Estabelecimento</label>
            <input 
              type="text" 
              id="act-company-name" 
              class="form-input" 
              placeholder="Ex: Pizzaria Bella Napoli" 
              value="${escapeHtml(plaque.name || '')}" 
              required 
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="act-google-url">Link de Avaliação do Google</label>
            <input 
              type="url" 
              id="act-google-url" 
              class="form-input" 
              placeholder="https://g.page/r/.../review ou link de avaliação" 
              value="${escapeHtml(plaque.target_url || '')}" 
              required 
            />
            <span class="text-xs text-muted" style="font-size: 0.7rem;">O link direto onde o seu cliente vai dar 5 estrelas.</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="act-pin">PIN de Segurança da Placa (4 dígitos)</label>
            <input 
              type="text" 
              id="act-pin" 
              class="form-input font-mono" 
              placeholder="Ex: 1234" 
              maxlength="6"
              value="${escapeHtml(plaque.pin || '')}" 
            />
            <span class="text-xs text-muted" style="font-size: 0.7rem;">Código de proteção para editar esta plaquinha no futuro.</span>
          </div>

          <button type="submit" id="btn-submit-activate" class="btn btn-primary w-full mt-3" style="padding: 0.625rem;">
            ${isAlreadyActive ? 'Salvar Alterações' : 'Ativar e Vincular Plaquinha'}
          </button>

        </form>

      </div>
    </div>
  `;
}

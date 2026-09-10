import { getIcon } from '../utils/icons.js';

export function renderAdminLoginView() {
  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0F172A; padding: 1.5rem 1rem;">
      <div class="card p-8" style="max-width: 420px; width: 100%; background: #1E293B; border: 1px solid #334155; color: #F8FAFC; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        
        <!-- Topo com Logo -->
        <div class="text-center mb-6">
          <div style="width: 52px; height: 52px; background: #2563EB; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #FFFFFF; margin: 0 auto 12px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);">
            ${getIcon('logo', '', 26)}
          </div>
          <h1 style="font-size: 1.375rem; font-weight: 800; color: #FFFFFF; letter-spacing: -0.02em;">Placas QR Pro</h1>
          <p style="font-size: 0.8125rem; color: #94A3B8; margin-top: 4px;">Painel de Acesso do Administrador</p>
        </div>

        <!-- Formulário de Login do Dono -->
        <form id="form-admin-login">
          
          <div class="form-group mb-3">
            <label class="form-label" for="admin-login-username" style="color: #E2E8F0; font-size: 0.8125rem;">Usuário</label>
            <input 
              type="text" 
              id="admin-login-username" 
              class="form-input font-mono" 
              placeholder="Digite seu usuário" 
              style="background: #0F172A; border-color: #334155; color: #FFFFFF; padding: 0.625rem 0.875rem;" 
              required 
              autofocus 
            />
          </div>

          <div class="form-group mb-4">
            <label class="form-label" for="admin-login-password" style="color: #E2E8F0; font-size: 0.8125rem;">Senha</label>
            <input 
              type="password" 
              id="admin-login-password" 
              class="form-input font-mono" 
              placeholder="••••••••" 
              style="background: #0F172A; border-color: #334155; color: #FFFFFF; padding: 0.625rem 0.875rem;" 
              required 
            />
            <div id="admin-login-error" class="text-xs hidden" style="color: #F87171; margin-top: 6px;"></div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #94A3B8; cursor: pointer;">
              <input type="checkbox" id="admin-remember-me" checked style="accent-color: #2563EB; cursor: pointer;" />
              <span>Manter conectado neste navegador</span>
            </label>
          </div>

          <button type="submit" id="btn-submit-admin-login" class="btn btn-primary w-full" style="padding: 0.625rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>Entrar no Painel</span>
            ${getIcon('arrowRight', '', 16)}
          </button>

        </form>

      </div>
    </div>
  `;
}


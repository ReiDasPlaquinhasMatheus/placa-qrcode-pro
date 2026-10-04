import { getIcon } from '../utils/icons.js';
import { getEnvLabel } from '../utils/helpers.js';

export function renderAdminLoginView() {
  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #090D16; padding: 1.5rem 1rem;">
      <div class="card" style="max-width: 380px; width: 100%; background: #0F1420; border: 1px solid rgba(255, 255, 255, 0.08); color: #F3F4F6; padding: 2rem; box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.5);">
        
        <!-- Topo com Logo Minimalista -->
        <div class="text-center mb-6">
          <img src="/logo.png" alt="Rei do NFC" style="height: 52px; width: 52px; object-fit: contain; margin: 0 auto 10px;" />
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <h1 style="font-size: 1.125rem; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em;">REI DO NFC</h1>
            <span class="sidebar-brand-badge">${getEnvLabel()}</span>
          </div>
          <p style="font-size: 0.72rem; color: #94A3B8; font-family: var(--font-mono); margin-top: 3px;">Painel de Gestão e Fábrica</p>
        </div>

        <!-- Formulário de Login do Dono -->
        <form id="form-admin-login">
          
          <div class="form-group mb-3">
            <label class="form-label" for="admin-login-username" style="color: #CBD5E1; font-size: 0.75rem;">Usuário</label>
            <input 
              type="text" 
              id="admin-login-username" 
              class="form-input font-mono" 
              placeholder="Nome de usuário" 
              style="background: #090D16; border-color: rgba(255, 255, 255, 0.12); color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.8125rem;" 
              required 
              autofocus 
            />
          </div>

          <div class="form-group mb-4">
            <label class="form-label" for="admin-login-password" style="color: #CBD5E1; font-size: 0.75rem;">Senha</label>
            <input 
              type="password" 
              id="admin-login-password" 
              class="form-input font-mono" 
              placeholder="••••••••" 
              style="background: #090D16; border-color: rgba(255, 255, 255, 0.12); color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.8125rem;" 
              required 
            />
            <div id="admin-login-error" class="text-xs hidden" style="color: #F87171; margin-top: 5px; font-family: var(--font-mono);"></div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: #94A3B8; cursor: pointer;">
              <input type="checkbox" id="admin-remember-me" checked style="accent-color: #2563EB; cursor: pointer;" />
              <span>Manter conectado neste navegador</span>
            </label>
          </div>

          <button type="submit" id="btn-submit-admin-login" class="btn btn-primary w-full" style="background: #FFFFFF; color: #090D16; border-color: #FFFFFF; padding: 0.55rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>Acessar Painel</span>
            ${getIcon('arrowRight', '', 14)}
          </button>

        </form>

      </div>
    </div>
  `;
}

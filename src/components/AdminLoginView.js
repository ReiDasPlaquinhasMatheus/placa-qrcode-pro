import { getIcon } from '../utils/icons.js';

export function renderAdminLoginView() {
  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #5AA0FF 0%, #2B73F0 48%, #1448C8 100%); padding: 1.5rem 1rem;">
      <div class="card" style="max-width: 400px; width: 100%; background: #FFFFFF; color: var(--text-main); padding: 2.25rem 2rem; border-radius: 20px; box-shadow: 0 30px 60px -15px rgba(10, 40, 130, 0.55);">
        
        <!-- Topo com Logo Minimalista -->
        <div class="text-center mb-6">
          <img src="/logo.png" alt="Rei do NFC" style="height: 84px; width: 84px; object-fit: contain; margin: 0 auto 10px; display: block;" />
          <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <h1 style="font-size: 1.25rem; font-weight: 700; color: #0F1B3D; letter-spacing: -0.01em;">REI DO NFC</h1>
          </div>
          <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">Painel de Gestão e Fábrica</p>
        </div>

        <!-- Formulário de Login do Dono -->
        <form id="form-admin-login">
          
          <div class="form-group mb-3">
            <label class="form-label" for="admin-login-username" style="color: var(--text-main); font-size: 0.78rem; font-weight: 600;">Usuário</label>
            <input 
              type="text" 
              id="admin-login-username" 
              class="form-input font-mono" 
              placeholder="Nome de usuário" 
              style="background: #F4F8FE; border-color: #E3EAF6; color: var(--text-main); padding: 0.65rem 0.85rem; font-size: 0.8125rem;" 
              required 
              autofocus 
            />
          </div>

          <div class="form-group mb-4">
            <label class="form-label" for="admin-login-password" style="color: var(--text-main); font-size: 0.78rem; font-weight: 600;">Senha</label>
            <input 
              type="password" 
              id="admin-login-password" 
              class="form-input font-mono" 
              placeholder="••••••••" 
              style="background: #F4F8FE; border-color: #E3EAF6; color: var(--text-main); padding: 0.65rem 0.85rem; font-size: 0.8125rem;" 
              required 
            />
            <div id="admin-login-error" class="text-xs hidden" style="color: #E5484D; margin-top: 5px;"></div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: var(--text-muted); cursor: pointer;">
              <input type="checkbox" id="admin-remember-me" checked style="accent-color: #0B5FFF; cursor: pointer;" />
              <span>Manter conectado neste navegador</span>
            </label>
          </div>

          <button type="submit" id="btn-submit-admin-login" class="btn btn-primary w-full" style="padding: 0.7rem; font-weight: 600; font-size: 0.875rem; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 12px;">
            <span>Acessar Painel</span>
            ${getIcon('arrowRight', '', 14)}
          </button>

        </form>

      </div>
    </div>
  `;
}

import { storage } from '../services/storage.js';
import { escapeHtml } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';

export function renderSettingsView() {
  const settings = storage.settings;

  const supabaseSqlSchema = `-- Execute no SQL Editor do Supabase (100% Gratuito):

CREATE TABLE IF NOT EXISTS public.plaques (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  status TEXT DEFAULT 'virgin' CHECK (status IN ('virgin', 'active')),
  target_url TEXT DEFAULT '',
  pin TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  client_phone TEXT DEFAULT '',
  client_code TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  scans_count BIGINT DEFAULT 0,
  last_scan_at TIMESTAMPTZ,
  batch_name TEXT DEFAULT 'Lote 01'
);

ALTER TABLE public.plaques ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso publico completo para placas" ON public.plaques;
CREATE POLICY "Acesso publico completo para placas" ON public.plaques FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.plaques;
`;

  return `
    <div class="container py-8" style="max-width: 760px;">
      
      <!-- Cabeçalho -->
      <div class="mb-6">
        <a href="#/lotes" class="text-xs text-muted mb-2 inline-flex items-center hover:text-blue" style="gap: 4px;">
          ${getIcon('arrowLeft', '', 12)}
          <span>Voltar para Pastas de Lotes</span>
        </a>
        <h1 style="font-size: 1.5rem; display: flex; align-items: center; gap: 8px;">
          ${getIcon('settings', '', 24)}
          <span>Configurações e Produção</span>
        </h1>
        <p class="text-sm text-muted mt-1">Defina o domínio final da internet para impressão gráfica e conecte o banco na nuvem.</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Bloco 1: URL Base dos QR Codes para a Gráfica -->
        <div class="card p-6">
          <h2 style="font-size: 1rem; margin-bottom: 0.25rem;">Domínio Final dos QR Codes (Gráfica / Produção)</h2>
          <p class="text-xs text-muted mb-4">
            Essa é a URL base que será codificada dentro dos QR Codes gerados para impressão.
          </p>

          <form id="form-settings-domain">
            <div class="form-group">
              <label class="form-label" for="cfg-base-url">URL Base de Produção</label>
              <input 
                type="url" 
                id="cfg-base-url" 
                class="form-input font-mono text-xs" 
                placeholder="https://sua-empresa.netlify.app ou https://seusite.com.br" 
                value="${escapeHtml(settings.baseUrl || window.location.origin)}" 
                required
              />
              <span class="text-xs text-muted mt-1">
                Exemplo de link impresso no QR Code: <code class="text-blue font-mono">${escapeHtml((settings.baseUrl || window.location.origin).replace(/\/$/, ''))}/r/PLQ-001</code>
              </span>
            </div>

            <button type="submit" class="btn btn-primary btn-sm mt-2">
              Salvar Domínio dos QR Codes
            </button>
          </form>
        </div>

        <!-- Bloco 2: Banco na Nuvem (Supabase) -->
        <div class="card p-6">
          <h2 style="font-size: 1rem; margin-bottom: 0.25rem;">Banco de Dados na Nuvem (Supabase Gratuito)</h2>
          <p class="text-xs text-muted mb-4">Conecte para que os dados fiquem salvos na nuvem quando publicar no Netlify.</p>

          <form id="form-settings-db">
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label" for="cfg-supabase-url">URL do Projeto Supabase</label>
                <input 
                  type="url" 
                  id="cfg-supabase-url" 
                  class="form-input font-mono text-xs" 
                  placeholder="https://seu-projeto.supabase.co" 
                  value="${escapeHtml(settings.supabaseUrl || '')}" 
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="cfg-supabase-key">Chave Anon Pública</label>
                <input 
                  type="password" 
                  id="cfg-supabase-key" 
                  class="form-input font-mono text-xs" 
                  placeholder="sb_publishable_..." 
                  value="${escapeHtml(settings.supabaseKey || '')}" 
                />
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
              <button type="submit" class="btn btn-primary btn-sm">
                Salvar Credenciais
              </button>

              <button type="button" id="btn-show-sql-schema" class="btn btn-secondary btn-sm">
                Ver SQL da Tabela
              </button>
            </div>
          </form>

          <div id="sql-schema-container" class="hidden mt-4 p-4" style="background: var(--bg-subtle); border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="text-xs font-medium text-main">Script SQL para criar a tabela com suporte a clientes:</span>
              <button id="btn-copy-sql" class="btn btn-secondary btn-sm" style="font-size: 0.75rem;">Copiar SQL</button>
            </div>
            <pre class="font-mono text-xs overflow-x-auto p-3" style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 4px; line-height: 1.5;">${escapeHtml(supabaseSqlSchema)}</pre>
          </div>
        </div>

        <!-- Bloco 3: Segurança do Dono / Usuário e Senha Master -->
        <div class="card p-6">
          <h2 style="font-size: 1rem; margin-bottom: 0.25rem;">Segurança do Administrador (Usuário & Senha Master)</h2>
          <p class="text-xs text-muted mb-4">Altere o usuário e a senha master que você usa para entrar no painel de controle.</p>

          <form id="form-settings-password">
            <div class="form-group mb-4">
              <label class="form-label" for="cfg-admin-user">Nome de Usuário do Dono</label>
              <input 
                type="text" 
                id="cfg-admin-user" 
                class="form-input font-mono text-xs" 
                placeholder="Ex: Matheus" 
                value="${escapeHtml(settings.adminUsername || 'Matheus')}" 
                required
              />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label class="form-label" for="cfg-new-pass">Nova Senha Master (opcional)</label>
                <input 
                  type="password" 
                  id="cfg-new-pass" 
                  class="form-input font-mono text-xs" 
                  placeholder="Deixe em branco para manter a atual" 
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="cfg-confirm-pass">Confirmar Nova Senha</label>
                <input 
                  type="password" 
                  id="cfg-confirm-pass" 
                  class="form-input font-mono text-xs" 
                  placeholder="Confirme a nova senha" 
                />
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-sm mt-2">
              Salvar Credenciais do Dono
            </button>
          </form>
        </div>

        <!-- Bloco 4: Backup -->
        <div class="card p-6">
          <h2 style="font-size: 1rem; margin-bottom: 0.25rem;">Backup e Restauração dos Dados</h2>
          <p class="text-xs text-muted mb-4">Faça download do arquivo JSON com todos os QR codes, links e clientes cadastrados.</p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-download-json-backup" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 6px;">
              ${getIcon('download', '', 14)}
              <span>Baixar Backup (JSON)</span>
            </button>

            <label class="btn btn-secondary btn-sm" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              ${getIcon('database', '', 14)}
              <span>Restaurar Backup JSON</span>
              <input type="file" id="file-restore-json" accept=".json" class="hidden" />
            </label>
          </div>
        </div>

        <!-- Bloco 5: Zerar Banco de Dados (Início Limpo) -->
        <div class="card p-6" style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.02);">
          <h2 style="font-size: 1rem; margin-bottom: 0.25rem; color: var(--danger-color, #dc2626); display: flex; align-items: center; gap: 8px;">
            ${getIcon('trash', '', 18)}
            <span>Zerar Banco de Dados (Começar do Zero)</span>
          </h2>
          <p class="text-xs text-muted mb-4">
            Exclui permanentemente todas as placas, lotes e clientes do navegador, do IndexedDB e da nuvem (Supabase). Use para iniciar a produção do zero absoluto com contagem limpa a partir de <strong>#1</strong>.
          </p>

          <button id="btn-purge-database" class="btn btn-danger btn-sm" style="display: inline-flex; align-items: center; gap: 6px; background-color: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">
            ${getIcon('trash', '', 14)}
            <span>Limpar e Zerar Todas as Placas</span>
          </button>
        </div>

      </div>

    </div>
  `;
}

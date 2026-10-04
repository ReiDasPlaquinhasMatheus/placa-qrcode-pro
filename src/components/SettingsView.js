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

-- ATENÇÃO: NÃO crie nenhuma policy pública (FOR ALL TO anon USING (true)).
-- Isso liberaria PINs, telefones e links de todos os clientes para qualquer
-- pessoa com a chave anon (que é pública). O acesso do app é feito só por
-- funções SECURITY DEFINER: rode, nesta ordem, supabase_rls_hardening.sql,
-- supabase_fix_activate_function.sql, supabase_add_reset_function.sql,
-- supabase_part2_lockdown.sql e supabase_add_client_password.sql
-- (ficam na raiz do projeto).
`;

  return `
    <div class="container py-6" style="max-width: 680px;">
      
      <!-- Cabeçalho Workstation -->
      <div class="mb-4">
        <a href="#/lotes" class="btn btn-ghost btn-xs mb-1" style="gap: 4px; padding: 2px 4px; color: var(--text-muted);">
          ${getIcon('arrowLeft', '', 11)}
          <span>Voltar para Pastas</span>
        </a>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center;">
            ${getIcon('settings', '', 14)}
          </div>
          <div>
            <h1 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em;">
              Configurações & Infraestrutura
            </h1>
            <p style="font-size: 0.72rem; color: var(--text-muted); margin: 1px 0 0 0;">
              Domínio de produção dos links curtos, sincronização em nuvem e segurança master
            </p>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        
        <!-- Bloco 1: URL Base dos QR Codes para a Gráfica -->
        <div class="card" style="padding: 1.15rem;">
          <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">Domínio Final dos QR Codes (Produção Gráfica)</div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            URL raiz gravada na matriz do QR Code impresso no acrílico.
          </p>

          <form id="form-settings-domain">
            <div class="form-group mb-2">
              <label class="form-label" for="cfg-base-url">URL Base</label>
              <input 
                type="url" 
                id="cfg-base-url" 
                class="form-input font-mono" 
                style="font-size: 0.75rem;"
                placeholder="https://placaspro.netlify.app" 
                value="${escapeHtml(settings.baseUrl || window.location.origin)}" 
                required
              />
              <span style="font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 3px; display: block;">
                Exemplo gerado: <strong style="color: var(--text-main);">${escapeHtml((settings.baseUrl || window.location.origin).replace(/\/$/, ''))}/r/PLQ-001</strong>
              </span>
            </div>

            <button type="submit" class="btn btn-primary btn-xs mt-1">
              Salvar Domínio
            </button>
          </form>
        </div>

        <!-- Bloco 2: Banco na Nuvem (Supabase) -->
        <div class="card" style="padding: 1.15rem;">
          <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">Banco de Dados Supabase (Nuvem)</div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.75rem;">Conexão direta para persistência e sincronização de leituras.</p>

          <form id="form-settings-db">
            <div class="grid grid-cols-2 gap-3 mb-2">
              <div class="form-group mb-0">
                <label class="form-label" for="cfg-supabase-url">URL do Projeto</label>
                <input 
                  type="url" 
                  id="cfg-supabase-url" 
                  class="form-input font-mono" 
                  style="font-size: 0.75rem;"
                  placeholder="https://seu-projeto.supabase.co" 
                  value="${escapeHtml(settings.supabaseUrl || '')}" 
                />
              </div>

              <div class="form-group mb-0">
                <label class="form-label" for="cfg-supabase-key">Chave Anon Pública</label>
                <input 
                  type="password" 
                  id="cfg-supabase-key" 
                  class="form-input font-mono" 
                  style="font-size: 0.75rem;"
                  placeholder="sb_publishable_..." 
                  value="${escapeHtml(settings.supabaseKey || '')}" 
                />
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.65rem;">
              <button type="submit" class="btn btn-primary btn-xs">
                Salvar Credenciais
              </button>

              <button type="button" id="btn-show-sql-schema" class="btn btn-secondary btn-xs">
                Ver SQL da Tabela
              </button>
            </div>
          </form>

          <div id="sql-schema-container" class="hidden mt-3 p-3" style="background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.7rem; font-weight: 600; color: var(--text-main);">Script SQL:</span>
              <button id="btn-copy-sql" class="btn btn-secondary btn-xs">Copiar SQL</button>
            </div>
            <pre class="font-mono text-xs overflow-x-auto p-2" style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-xs); line-height: 1.4; font-size: 0.6875rem;">${escapeHtml(supabaseSqlSchema)}</pre>
          </div>
        </div>

        <!-- Bloco 3: Segurança do Dono / Usuário e Senha Master -->
        <div class="card" style="padding: 1.15rem;">
          <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">Segurança do Administrador (Master)</div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.75rem;">Credenciais de acesso restrito ao painel e emissão de lotes.</p>

          <form id="form-settings-password">
            <div class="form-group mb-3">
              <label class="form-label" for="cfg-admin-user">Usuário Master</label>
              <input 
                type="text" 
                id="cfg-admin-user" 
                class="form-input font-mono" 
                style="font-size: 0.75rem;"
                placeholder="Ex: Matheus" 
                value="${escapeHtml(settings.adminUsername || 'Matheus')}" 
                required
              />
            </div>

            <div class="grid grid-cols-2 gap-3 mb-2">
              <div class="form-group mb-0">
                <label class="form-label" for="cfg-new-pass">Nova Senha Master (opcional)</label>
                <input 
                  type="password" 
                  id="cfg-new-pass" 
                  class="form-input font-mono" 
                  style="font-size: 0.75rem;"
                  placeholder="Deixar em branco para manter" 
                />
              </div>

              <div class="form-group mb-0">
                <label class="form-label" for="cfg-confirm-pass">Confirmar Nova Senha</label>
                <input 
                  type="password" 
                  id="cfg-confirm-pass" 
                  class="form-input font-mono" 
                  style="font-size: 0.75rem;"
                  placeholder="Repita a nova senha" 
                />
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-xs mt-2">
              Atualizar Credenciais
            </button>
          </form>
        </div>

        <!-- Bloco 4: Backup -->
        <div class="card" style="padding: 1.15rem;">
          <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">Backup & Restauração</div>
          <p style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.75rem;">Exportação e importação de catálogo em arquivo JSON estruturado.</p>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button id="btn-download-json-backup" class="btn btn-secondary btn-xs" style="gap: 4px;">
              ${getIcon('download', '', 12)}
              <span>Exportar Backup (JSON)</span>
            </button>

            <label class="btn btn-secondary btn-xs" style="cursor: pointer; gap: 4px;">
              ${getIcon('database', '', 12)}
              <span>Restaurar Backup</span>
              <input type="file" id="file-restore-json" accept=".json" class="hidden" />
            </label>
          </div>
        </div>

        <!-- Bloco 5: Zerar Banco de Dados -->
        <div class="card" style="padding: 1.15rem; border: 1px solid #FECACA; background: #FEF2F2;">
          <div style="font-size: 0.875rem; font-weight: 600; color: #DC2626; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
            ${getIcon('trash', '', 14)}
            <span>Zona Crítica: Zerar Banco de Dados</span>
          </div>
          <p style="font-size: 0.72rem; color: #991B1B; margin-bottom: 0.75rem;">
            Remove permanentemente todas as placas, lotes e vínculos do navegador e do Supabase para iniciar produção limpa.
          </p>

          <button id="btn-purge-database" class="btn btn-xs" style="background-color: #DC2626; color: white; border: 1px solid #B91C1C; gap: 4px;">
            ${getIcon('trash', '', 12)}
            <span>Zerar Todas as Placas do Sistema</span>
          </button>
        </div>

      </div>

    </div>
  `;
}

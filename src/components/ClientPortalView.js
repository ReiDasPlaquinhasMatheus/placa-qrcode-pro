import { storage } from '../services/storage.js';
import { formatPhone, formatRelativeTime, escapeHtml, normalizeForSearch } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';
import { renderPagination } from './Pagination.js';

function renderClientPortalLoginStyles() {
  return `
    <style>
      .client-portal-login-screen {
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #090D16;
        background-image: 
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 32px 32px;
        padding: 2rem 1.25rem;
        position: relative;
      }

      .client-login-card {
        background: #0E1526;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
        max-width: 440px;
        width: 100%;
        padding: 2.25rem 2rem;
        position: relative;
        z-index: 10;
      }

      .client-portal-hero-grid {
        max-width: 920px;
        width: 100%;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 3.5rem;
        align-items: center;
        position: relative;
        z-index: 10;
      }

      .client-login-card input:focus {
        background: #131B2E !important;
        border-color: #3B82F6 !important;
        box-shadow: 0 0 0 1px #3B82F6 !important;
        outline: none !important;
      }

      @media (max-width: 820px) {
        .client-portal-hero-grid {
          grid-template-columns: 1fr !important;
          gap: 2rem !important;
        }
        .client-portal-hero-right {
          display: none !important;
        }
        .client-login-card {
          padding: 1.75rem 1.25rem !important;
          max-width: 100% !important;
        }
      }
    </style>
  `;
}

export function renderClientPortalView({
  clientCode = null,
  passwordRequired = false,
  passwordCode = null,
  showPasswordBanner = false,
  searchQuery = '',
  statusFilter = 'all',
  currentPage = 1,
  perPage = 25
} = {}) {
  // 0. Conta já tem senha configurada e ainda não validamos nesta sessão
  if (clientCode && passwordRequired) {
    return `
      <div class="client-portal-login-screen">
        ${renderClientPortalLoginStyles()}
        <div class="client-login-card">
          <div style="margin-bottom: 1.5rem;">
            <div style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 4px; color: #60A5FA; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem;">
              ${getIcon('lock', '', 12)}
              Conta Protegida
            </div>
            <h1 style="font-size: 1.35rem; font-weight: 700; color: #F8FAFC; letter-spacing: -0.02em; margin-bottom: 0.35rem;">
              Autenticação Requerida
            </h1>
            <p style="font-size: 0.8125rem; color: #94A3B8; line-height: 1.5; margin: 0;">
              Digite sua senha de acesso para liberar a visualização e gestão das suas plaquinhas.
            </p>
          </div>

          <form id="form-client-password-login" data-code="${escapeHtml(passwordCode || clientCode)}">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" for="client-password-input" style="color: #CBD5E1; font-size: 0.75rem;">Senha da Conta</label>
              <input
                type="password"
                id="client-password-input"
                class="form-input"
                placeholder="••••••••"
                style="font-size: 0.875rem; padding: 0.65rem 0.85rem; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; width: 100%; background: #0B101D; color: #F8FAFC;"
                required
                autofocus
              />
            </div>
            <div id="client-password-error" style="color: #F87171; font-size: 0.75rem; margin-top: 6px; display: none;"></div>

            <button type="submit" id="btn-submit-client-password" class="btn btn-primary w-full" style="margin-top: 0.75rem; padding: 0.65rem 1rem; font-weight: 600; font-size: 0.8125rem;">
              Desbloquear Painel
            </button>
          </form>

          <div style="margin-top: 1.5rem; text-align: center; display: flex; flex-direction: column; gap: 8px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem;">
            <a href="#" id="link-forgot-client-password" data-code="${escapeHtml(passwordCode || clientCode)}" style="font-size: 0.75rem; color: #60A5FA; font-weight: 500; text-decoration: none;">
              Esqueci minha senha
            </a>
            <a href="#" id="link-portal-password-back" style="font-size: 0.75rem; color: #64748B; text-decoration: none;">
              Voltar para login principal
            </a>
          </div>
        </div>
      </div>
    `;
  }

  const client = clientCode ? storage.getClientByCode(clientCode) : null;

  // 1. Tela de Login Sem Senha (apenas número invertido ou telefone)
  if (!client) {
    return `
      <div class="client-portal-login-screen">
        ${renderClientPortalLoginStyles()}

        <div class="client-portal-hero-grid">
          
          <!-- Lado Esquerdo: Card de Login Linear/Workstation -->
          <div style="display: flex; justify-content: center; width: 100%;">
            <div class="client-login-card">
              
              <!-- Cabeçalho do Card -->
              <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px; color: #94A3B8; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span>
                    Portal do Cliente
                  </div>
                  <span class="font-mono text-xs" style="color: #64748B; font-size: 0.7rem;">v2.6</span>
                </div>
                
                <h1 style="font-size: 1.4rem; font-weight: 700; color: #F8FAFC; letter-spacing: -0.02em; line-height: 1.25; margin-bottom: 0.35rem;">
                  Acesse suas Placas
                </h1>
                
                <p style="font-size: 0.8125rem; color: #94A3B8; line-height: 1.5; margin: 0;">
                  Identifique-se com seu telefone para acompanhar leituras e gerenciar destinos.
                </p>
              </div>

              <!-- Formulário -->
              <form id="form-client-login">
                <div>
                  <label class="form-label" for="client-login-input" style="font-weight: 600; color: #E2E8F0; font-size: 0.75rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>Telefone de Contato ou Código</span>
                    <span style="font-weight: 500; color: #60A5FA; font-size: 0.6875rem;">Acesso rápido</span>
                  </label>
                  
                  <div style="position: relative;">
                    <input 
                      type="text" 
                      id="client-login-input" 
                      class="form-input font-mono" 
                      placeholder="(11) 98765-4321 ou código invertido" 
                      style="font-size: 0.875rem; padding: 0.65rem 0.85rem 0.65rem 2.5rem; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px; width: 100%; background: #0B101D; color: #F8FAFC; transition: border-color 0.15s ease;" 
                      required 
                      autofocus 
                    />
                    <div style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #64748B; pointer-events: none; display: flex; align-items: center;">
                      ${getIcon('phone', '', 15)}
                    </div>
                  </div>

                  <div style="margin-top: 0.75rem; padding: 0.65rem 0.85rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; font-size: 0.725rem; color: #94A3B8; display: flex; align-items: center; gap: 8px;">
                    <span style="color: #60A5FA; flex-shrink: 0;">${getIcon('info', '', 14)}</span>
                    <span>Seu código é o número de WhatsApp com os dígitos invertidos.</span>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary w-full" style="margin-top: 1.25rem; padding: 0.65rem 1rem; font-size: 0.8125rem; font-weight: 600; border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                  <span>Acessar Painel</span>
                  ${getIcon('arrowRight', '', 14)}
                </button>
              </form>

              <!-- Rodapé Separado e Limpo -->
              <div style="margin-top: 1.5rem; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 1rem;">
                <a href="#/login" style="font-size: 0.75rem; color: #64748B; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 5px; transition: color 0.15s;">
                  ${getIcon('lock', '', 13)}
                  <span>Acesso do Administrador</span>
                </a>
              </div>

            </div>
          </div>

          <!-- Lado Direito: Identidade Técnica Minimalista -->
          <div class="client-portal-hero-right" style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 1.25rem;">
              <img 
                src="/logo.png" 
                alt="Rei do NFC" 
                style="width: 48px; height: 48px; object-fit: contain;" 
              />
              <div>
                <div style="font-size: 1.125rem; font-weight: 800; color: #F8FAFC; letter-spacing: -0.01em;">
                  REI DO NFC
                </div>
                <div class="font-mono text-xs" style="color: #64748B; font-size: 0.7rem;">Hardware & QR OS</div>
              </div>
            </div>

            <div style="color: #94A3B8; font-size: 0.8125rem; line-height: 1.6; max-width: 360px;">
              Plataforma para monitoramento de leituras, redirecionamento instantâneo de links e captação de avaliações 5 estrelas no Google Meu Negócio.
            </div>

            <div style="margin-top: 1.75rem; display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 360px;">
              <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px;">
                <span style="color: #10B981;">${getIcon('checkCircle', '', 16)}</span>
                <span style="font-size: 0.75rem; color: #CBD5E1;">QR Codes perpétuos com link editável a qualquer hora</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px;">
                <span style="color: #3B82F6;">${getIcon('barChart', '', 16)}</span>
                <span style="font-size: 0.75rem; color: #CBD5E1;">Contagem de acessos em tempo real com telemetria</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // 2. Painel Privado do Cliente Logado
  const allPlaques = client.plaques || [];
  const activeCount = allPlaques.filter(p => p.status === 'active').length;
  const virginCount = allPlaques.filter(p => p.status === 'virgin').length;
  const totalScans = allPlaques.reduce((sum, p) => sum + (p.scans_count || 0), 0);

  // Filtragem
  let filtered = allPlaques;
  if (statusFilter === 'active') {
    filtered = filtered.filter(p => p.status === 'active');
  } else if (statusFilter === 'virgin') {
    filtered = filtered.filter(p => p.status === 'virgin');
  }

  if (searchQuery.trim()) {
    const q = normalizeForSearch(searchQuery);
    filtered = filtered.filter(p =>
      p.id.toLowerCase().includes(q) ||
      (p.name && normalizeForSearch(p.name).includes(q)) ||
      (p.target_url && p.target_url.toLowerCase().includes(q))
    );
  }

  // Paginação
  const totalFiltered = filtered.length;
  const totalPages = Math.ceil(totalFiltered / perPage) || 1;
  const validPage = Math.max(1, Math.min(currentPage, totalPages));
  const paginatedPlaques = filtered.slice((validPage - 1) * perPage, validPage * perPage);

  return `
    <div style="background: #F8FAFC; min-height: 100vh;">
      
      <!-- Topo do Portal do Cliente -->
      <header style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0; padding: 1rem 0;">
        <div class="container" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="/logo.png" alt="Rei do NFC" style="height: 42px; width: 42px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(37,99,235,0.25));" />
            <div>
              <span class="text-xs text-muted font-medium">Portal do Cliente • Rei do NFC</span>
              <div style="font-size: 1.25rem; font-weight: 700; color: #0F172A; display: flex; align-items: center; gap: 8px;">
                <span>Olá, ${escapeHtml(client.name)}!</span>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="text-xs font-mono" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; background: #F1F5F9; border: 1px solid #E2E8F0;">
              ${getIcon('key', '', 13)} Código: <strong>${escapeHtml(client.client_code)}</strong>
            </div>
            <a href="#/cliente" id="btn-client-logout" data-code="${escapeHtml(client.client_code)}" class="btn btn-ghost btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
              ${getIcon('logOut', '', 14)}
              <span>Sair</span>
            </a>
          </div>
        </div>
      </header>

      <!-- Conteúdo Principal -->
      <div class="container py-8">

        ${(() => {
          if (!showPasswordBanner) return '';
          let dismissed = false;
          try {
            dismissed = typeof localStorage !== 'undefined' && localStorage.getItem('portal_pw_banner_dismissed_' + client.client_code) === '1';
          } catch (e) {}
          if (dismissed) return '';
          return `
            <div id="portal-password-banner" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 12px 16px; margin-bottom: 1.5rem;">
              <div style="display: flex; align-items: center; gap: 10px; font-size: 0.8125rem; color: #1E3A8A;">
                ${getIcon('lock', '', 16)}
                <span><strong>Proteja sua conta:</strong> configure uma senha para acessar suas plaquinhas com mais segurança.</span>
              </div>
              <div style="display: flex; gap: 8px; flex-shrink: 0;">
                <button id="btn-setup-client-password" data-code="${escapeHtml(client.client_code)}" data-phone="${escapeHtml(client.phone || '')}" class="btn btn-primary btn-sm">
                  Configurar agora
                </button>
                <button id="btn-dismiss-password-banner" data-code="${escapeHtml(client.client_code)}" class="btn btn-ghost btn-sm">
                  Agora não
                </button>
              </div>
            </div>
          `;
        })()}

        <!-- CIÊNCIA DE DADOS CLIENTE: Cards de Resumo & KPIs Executivos -->
        ${(() => {
          const analytics = storage.getClientAnalytics(client.client_code || client.phone);
          if (!analytics) return '';

          return `
            <!-- 4 CARDS DE KPIS -->
            <div class="grid grid-cols-4 gap-3 mb-4">
              <div class="stat-card">
                <span class="stat-card-label">Total de Plaquinhas</span>
                <div class="stat-card-value font-mono">${allPlaques.length}</div>
              </div>

              <div class="stat-card">
                <span class="stat-card-label">Plaquinhas Ativas</span>
                <div class="stat-card-value font-mono" style="color: var(--accent-emerald);">${activeCount}</div>
              </div>

              <div class="stat-card">
                <span class="stat-card-label">Leituras Google Totais</span>
                <div class="stat-card-value font-mono" style="color: var(--accent-blue);">${totalScans}</div>
              </div>

              <div class="stat-card">
                <span class="stat-card-label">Leituras nos Últimos 7 Dias</span>
                <div class="stat-card-value font-mono" style="color: #D97706;">${analytics.scanHistory.available ? analytics.scanHistory.last7 : '—'}</div>
                <span style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">
                  ${(() => {
                    const h = analytics.scanHistory;
                    if (!h.available) return 'histórico em ativação';
                    if (h.growthPercent !== null) {
                      return `${h.growthPercent >= 0 ? '▲' : '▼'} ${Math.abs(h.growthPercent)}% vs. semana anterior`;
                    }
                    return h.sinceLabel ? `registrado desde ${h.sinceLabel}` : 'coletando histórico';
                  })()}
                </span>
              </div>
            </div>

            <!-- INSIGHTS EXECUTIVOS EM LINGUAGEM NATURAL -->
            <div class="card p-3 mb-4" style="background: #FFFFFF; border: 1px solid var(--border-color); border-radius: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
                  <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-main);">
                    Resumo da sua conta
                  </span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px;">
                ${analytics.insights.map(ins => `
                  <div style="padding: 8px 10px; background: var(--bg-subtle); border-radius: 6px; border: 1px solid var(--border-color); display: flex; align-items: flex-start; gap: 8px;">
                    <span style="color: #2563EB; flex-shrink: 0; margin-top: 1px;">
                      ${getIcon(ins.icon || 'zap', '', 14)}
                    </span>
                    <div>
                      <div style="font-weight: 600; font-size: 0.75rem; color: var(--text-main); margin-bottom: 2px;">
                        ${escapeHtml(ins.title)}
                      </div>
                      <div style="font-size: 0.7rem; color: var(--text-muted); line-height: 1.4;">
                        ${escapeHtml(ins.desc)}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- GRID DE CIÊNCIA DE DADOS (HORÁRIOS DE PICO & METAS) -->
            <div class="resp-grid-2" style="gap: 12px; margin-bottom: 1rem;">
              
              <!-- Coluna 1: Ranking real de leituras por plaquinha -->
              <div class="card p-3" style="background: #FFFFFF;">
                <div style="margin-bottom: 10px;">
                  <h3 style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); margin: 0;">
                    Leituras por Plaquinha
                  </h3>
                  <p style="font-size: 0.6875rem; color: var(--text-muted); margin: 1px 0 0 0;">
                    Quais pontos físicos mais geram acessos ao seu Google
                  </p>
                </div>

                ${analytics.plaqueRanking.length === 0 ? `
                  <div style="padding: 1rem 0; font-size: 0.75rem; color: var(--text-muted);">
                    Ainda não há leituras registradas. Assim que alguém aproximar o celular de uma plaquinha, ela aparece aqui.
                  </div>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${analytics.plaqueRanking.map(ph => `
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; margin-bottom: 2px; gap: 8px;">
                          <span style="font-weight: 500; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;" title="${escapeHtml(ph.name)}">
                            ${escapeHtml(ph.name)}
                            <span style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">(${escapeHtml(ph.id)})</span>
                          </span>
                          <span class="num-tabular font-mono" style="color: var(--text-muted); font-size: 0.7rem; flex-shrink: 0;">
                            <strong>${ph.scans}</strong> leituras (${ph.percentOfTotal}%)
                          </span>
                        </div>
                        <div style="width: 100%; height: 5px; background: #E5E7EB; border-radius: 999px; overflow: hidden;">
                          <div style="width: ${ph.barPercent}%; height: 100%; background: #0F172A; border-radius: 999px;"></div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>

              <!-- Coluna 2: Previsão de Meta & Saúde dos Pontos -->
              <div class="card p-3" style="background: #FFFFFF; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <h3 style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); margin: 0;">
                      Previsão de Meta no Google Maps
                    </h3>
                    <span class="badge badge-active font-mono" style="font-size: 0.65rem;">
                      Meta: ${analytics.milestone.target}
                    </span>
                  </div>

                  <!-- Barra de Progresso da Meta -->
                  <div style="padding: 8px 10px; background: var(--bg-subtle); border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 600; margin-bottom: 4px;">
                      <span>Progresso Atual: ${analytics.milestone.current} / ${analytics.milestone.target}</span>
                      <span class="text-blue font-mono">${analytics.milestone.percent}%</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #E5E7EB; border-radius: 999px; overflow: hidden; margin-bottom: 4px;">
                      <div style="width: ${analytics.milestone.percent}%; height: 100%; background: #2563EB; border-radius: 999px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">
                      <span>Faltam ${analytics.milestone.remaining} leituras</span>
                      <span>${analytics.milestone.estimatedDays !== null ? `Previsão: ~${analytics.milestone.estimatedDays} dias` : 'Previsão: —'}</span>
                    </div>
                  </div>

                  <!-- Mini Radar de Saúde dos Pontos Físicos -->
                  <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-main); margin-bottom: 4px;">
                    Diagnóstico dos Pontos de Avaliação
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 4px; max-height: 110px; overflow-y: auto;">
                    ${analytics.plaqueHealth.slice(0, 3).map(ph => `
                      <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 6px; background: var(--bg-subtle); border-radius: 4px; font-size: 0.6875rem;">
                        <span style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;" title="${escapeHtml(ph.name)}">
                          ${escapeHtml(ph.name)}
                        </span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span class="badge ${ph.badgeClass}" style="font-size: 0.625rem; padding: 1px 4px;">
                            ${ph.statusLabel}
                          </span>
                          <span class="font-mono num-tabular" style="font-weight: 600;">${ph.scans}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

            </div>

            <!-- Horários de maior movimento (dado real do histórico de leituras) -->
            ${analytics.scanHistory.available ? `
              <div class="card p-3" style="background: #FFFFFF; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                  <div>
                    <h3 style="font-size: 0.8125rem; font-weight: 700; color: var(--text-main); margin: 0;">
                      Horários de Maior Movimento
                    </h3>
                    <p style="font-size: 0.6875rem; color: var(--text-muted); margin: 1px 0 0 0;">
                      Em que parte do dia as leituras acontecem${analytics.scanHistory.sinceLabel ? ` (desde ${escapeHtml(analytics.scanHistory.sinceLabel)})` : ''}
                    </p>
                  </div>
                </div>

                ${analytics.scanHistory.dayparts ? `
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${analytics.scanHistory.dayparts.map(dp => `
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; margin-bottom: 2px; gap: 8px;">
                          <span style="font-weight: 500; color: var(--text-main);">
                            ${escapeHtml(dp.label)}
                            <span style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">(${escapeHtml(dp.range)})</span>
                            ${dp.isPeak ? `<span class="badge badge-active" style="font-size: 0.5625rem; padding: 1px 4px;">Maior movimento</span>` : ''}
                          </span>
                          <span class="num-tabular font-mono" style="color: var(--text-muted); font-size: 0.7rem; flex-shrink: 0;">
                            <strong>${dp.count}</strong> leituras (${dp.percent}%)
                          </span>
                        </div>
                        <div style="width: 100%; height: 5px; background: #E5E7EB; border-radius: 999px; overflow: hidden;">
                          <div style="width: ${dp.percent}%; height: 100%; background: ${dp.isPeak ? '#059669' : '#0F172A'}; border-radius: 999px;"></div>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">
                    Estamos coletando as leituras das suas plaquinhas. Os horários de maior movimento aparecem quando houver pelo menos ${analytics.scanHistory.minForDayparts} leituras registradas (${analytics.scanHistory.total} até agora).
                  </div>
                `}
              </div>
            ` : ''}
          `;
        })()}

        <!-- Barra de Filtros e Busca do Cliente -->
        <div class="filter-bar mb-3">
          
          <div class="filter-group">
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-sm btn-client-filter ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}" data-filter="all">
                Todas (${allPlaques.length})
              </button>
              <button class="btn btn-sm btn-client-filter ${statusFilter === 'active' ? 'btn-primary' : 'btn-ghost'}" data-filter="active">
                Ativas (${activeCount})
              </button>
              <button class="btn btn-sm btn-client-filter ${statusFilter === 'virgin' ? 'btn-primary' : 'btn-ghost'}" data-filter="virgin">
                Virgens (${virginCount})
              </button>
            </div>
          </div>

          <div style="width: 260px; max-width: 100%; position: relative;">
            <input 
              type="text" 
              id="input-search-client-plaques" 
              placeholder="Buscar por código ou empresa..." 
              value="${escapeHtml(searchQuery)}"
              class="form-input" 
              style="padding: 5px 28px 5px 28px; font-size: 0.75rem;"
            />
            <span style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
              ${getIcon('search', '', 13)}
            </span>
            ${searchQuery ? `
              <button id="btn-clear-client-portal-search" class="btn-ghost" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); border: none; padding: 2px; color: var(--text-muted); cursor: pointer;" title="Limpar busca">
                ${getIcon('close', '', 12)}
              </button>
            ` : ''}
          </div>

        </div>

        <div class="table-container" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
          <table class="table client-plaque-table">
            <thead>
              <tr>
                <th style="width: 140px;">Código QR</th>
                <th style="width: 100px;">Status</th>
                <th>Empresa / Link de Avaliação do Google</th>
                <th style="width: 100px;">Leituras</th>
                <th style="width: 140px;">Última Leitura</th>
                <th style="width: 140px; text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${paginatedPlaques.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.8125rem;">
                    Nenhuma plaquinha encontrada para os filtros selecionados.
                  </td>
                </tr>
              ` : paginatedPlaques.map(plaque => {
                const isVirgin = plaque.status === 'virgin';

                return `
                  <tr style="height: 44px; white-space: nowrap; vertical-align: middle;">
                    <!-- Código -->
                    <td class="font-mono font-bold" data-label="Código QR" style="white-space: nowrap;">
                      <span class="text-blue btn-view-qr" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 0.8125rem;" data-id="${escapeHtml(plaque.id)}">
                        ${getIcon('qrcode', '', 14)}
                        <span>${escapeHtml(plaque.id)}</span>
                      </span>
                    </td>

                    <!-- Status -->
                    <td data-label="Status" style="white-space: nowrap;">
                      ${isVirgin
                        ? `<span class="badge badge-virgin">○ Virgem</span>`
                        : `<span class="badge badge-active">● Ativa</span>`
                      }
                    </td>

                    <!-- Link e Empresa -->
                    <td data-label="Empresa / Link de Avaliação" style="white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis;">
                      ${isVirgin ? `
                        <span class="text-muted text-xs">Plaquinha pronta para vincular</span>
                        <a href="#/activate/${escapeHtml(plaque.id)}" class="text-xs text-blue ml-2 font-medium" style="display: inline-flex; align-items: center; gap: 3px;">
                          <span>Vincular Agora</span>
                          ${getIcon('arrowRight', '', 11)}
                        </a>
                      ` : `
                        <span class="font-bold text-sm text-main" title="${escapeHtml(plaque.name || '')}">${escapeHtml(plaque.name || 'Sua Empresa')}</span>
                        ${plaque.target_url ? `
                          <a href="${escapeHtml(plaque.target_url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue ml-2" style="display: inline-flex; vertical-align: middle;" title="${escapeHtml(plaque.target_url)}">
                            ${getIcon('externalLink', '', 12)}
                          </a>
                        ` : ''}
                      `}
                    </td>

                    <!-- Scans -->
                    <td class="font-mono font-bold" data-label="Leituras" style="white-space: nowrap; color: ${(plaque.scans_count || 0) > 0 ? 'var(--accent-blue)' : 'inherit'}; font-size: 0.8125rem;">
                      ${plaque.scans_count || 0}
                    </td>

                    <!-- Último Scan -->
                    <td class="text-xs text-muted font-mono" data-label="Última Leitura" style="white-space: nowrap;">${formatRelativeTime(plaque.last_scan_at)}</td>

                    <!-- Ações do Cliente -->
                    <td class="client-td-actions" data-label="Ações" style="text-align: right; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-secondary btn-sm btn-view-qr" data-id="${escapeHtml(plaque.id)}" title="Visualizar QR Code" style="padding: 3px 8px; font-size: 0.6875rem;">
                          ${getIcon('qrcode', '', 12)} QR
                        </button>
                        <button class="btn btn-primary btn-sm btn-edit-plaque" data-id="${escapeHtml(plaque.id)}" title="Alterar Link de Destino" style="padding: 3px 8px; font-size: 0.6875rem;">
                          ${getIcon('edit', '', 12)} Alterar
                        </button>
                        <button class="btn btn-sm btn-client-delete-plaque" data-id="${escapeHtml(plaque.id)}" title="Apagar / Desvincular Plaquinha" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; padding: 3px 8px; display: inline-flex; align-items: center; gap: 3px; font-weight: 500; font-size: 0.6875rem;">
                          ${getIcon('trash', '', 12)} Apagar
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Barra de Paginação -->
        ${renderPagination({
          totalItems: totalFiltered,
          currentPage: validPage,
          perPage,
          entityName: 'plaquinhas',
          idPrefix: 'client-portal'
        })}

      </div>

    </div>
  `;
}


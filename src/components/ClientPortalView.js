import { storage } from '../services/storage.js';
import { formatPhone, formatRelativeTime, escapeHtml } from '../utils/helpers.js';
import { getIcon } from '../utils/icons.js';
import { renderPagination } from './Pagination.js';

export function renderClientPortalView({
  clientCode = null,
  searchQuery = '',
  statusFilter = 'all',
  currentPage = 1,
  perPage = 25
} = {}) {
  const client = clientCode ? storage.getClientByCode(clientCode) : null;

  // 1. Tela de Login Sem Senha (apenas número invertido ou telefone)
  if (!client) {
    return `
      <div class="client-portal-login-screen">
        <style>
          .client-portal-login-screen {
            min-height: 100vh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at 85% 35%, rgba(59, 130, 246, 0.45) 0%, transparent 55%),
                        radial-gradient(circle at 15% 75%, rgba(29, 78, 216, 0.5) 0%, transparent 60%),
                        linear-gradient(135deg, #06112E 0%, #0A2268 40%, #1D4ED8 85%, #2563EB 100%);
            padding: 2.5rem 1.5rem;
            position: relative;
            overflow: hidden;
          }

          .portal-bg-orb {
            position: absolute;
            right: 5%;
            top: 20%;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(96, 165, 250, 0.35) 0%, rgba(37, 99, 235, 0.1) 60%, transparent 70%);
            border-radius: 50%;
            filter: blur(60px);
            pointer-events: none;
            animation: pulseGlow 6s ease-in-out infinite alternate;
          }

          .client-portal-hero-grid {
            max-width: 1140px;
            width: 100%;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1.05fr 0.95fr;
            gap: 4.5rem;
            align-items: center;
            position: relative;
            z-index: 10;
          }

          .client-login-card {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(6, 17, 46, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.4);
            max-width: 480px;
            width: 100%;
            padding: 2.75rem 2.25rem 2.25rem;
          }

          .client-login-card input:focus {
            background: #FFFFFF !important;
            border-color: #2563EB !important;
            box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15) !important;
            outline: none !important;
          }

          .floating-logo-wrapper {
            position: relative;
            animation: floatLogo 5s ease-in-out infinite;
          }

          @keyframes floatLogo {
            0%, 100% {
              transform: translateY(0px) rotate(0deg);
            }
            50% {
              transform: translateY(-16px) rotate(1.2deg);
            }
          }

          @keyframes pulseGlow {
            0% {
              opacity: 0.4;
              transform: scale(0.95);
            }
            100% {
              opacity: 0.85;
              transform: scale(1.15);
            }
          }

          @media (max-width: 900px) {
            .client-portal-hero-grid {
              grid-template-columns: 1fr !important;
              gap: 2.5rem !important;
            }
            .client-portal-hero-right {
              order: -1;
            }
            .client-login-card {
              padding: 2rem 1.5rem 1.75rem !important;
            }
            .floating-logo-wrapper img {
              max-width: 220px !important;
            }
          }
        </style>

        <div class="portal-bg-orb"></div>

        <div class="client-portal-hero-grid">
          
          <!-- Lado Esquerdo: Caixa de Login Espaçosa e Arejada -->
          <div style="display: flex; justify-content: center; width: 100%;">
            <div class="client-login-card">
              
              <!-- Cabeçalho do Card -->
              <div style="margin-bottom: 2rem;">
                <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; background: #EEF4FF; border: 1px solid #C7D9FF; border-radius: 999px; color: #1D4ED8; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1.25rem;">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: #2563EB;"></span>
                  Área do Cliente
                </div>
                
                <h1 style="font-size: 1.85rem; font-weight: 800; color: #0F172A; letter-spacing: -0.025em; line-height: 1.25; margin-bottom: 0.75rem;">
                  Acesse suas Placas
                </h1>
                
                <p style="font-size: 0.875rem; color: #64748B; line-height: 1.6; font-weight: 400; margin: 0;">
                  Gerencie suas plaquinhas QR Code e acompanhe suas avaliações do Google em tempo real.
                </p>
              </div>

              <!-- Formulário com Espaçamentos Generosos -->
              <form id="form-client-login">
                <div>
                  <label class="form-label" for="client-login-input" style="font-weight: 700; color: #1E293B; font-size: 0.8125rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>Telefone de Contato ou Código</span>
                    <span style="font-weight: 600; color: #2563EB; font-size: 0.75rem; background: #F1F5F9; padding: 2px 8px; border-radius: 6px;">Acesso Direto</span>
                  </label>
                  
                  <div style="position: relative;">
                    <input 
                      type="text" 
                      id="client-login-input" 
                      class="form-input font-mono" 
                      placeholder="Ex: (11) 98765-4321 ou código invertido" 
                      style="font-size: 0.95rem; padding: 0.95rem 1rem 0.95rem 3.1rem; border: 1.5px solid #CBD5E1; border-radius: 12px; width: 100%; background: #F8FAFC; color: #0F172A; transition: all 0.2s ease;" 
                      required 
                      autofocus 
                    />
                    <div style="position: absolute; left: 1.15rem; top: 50%; transform: translateY(-50%); color: #64748B; pointer-events: none; display: flex; align-items: center;">
                      ${getIcon('phone', '', 18)}
                    </div>
                  </div>

                  <div style="margin-top: 1.25rem; padding: 0.85rem 1rem; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 0.775rem; color: #475569; display: flex; align-items: flex-start; gap: 10px; line-height: 1.5;">
                    <span style="color: #2563EB; flex-shrink: 0; margin-top: 2px;">${getIcon('info', '', 15)}</span>
                    <span><strong>Dica:</strong> Seu código de login é o seu número de WhatsApp com os dígitos invertidos.</span>
                  </div>
                </div>

                <button type="submit" class="btn btn-primary w-full" style="margin-top: 2rem; padding: 1rem 1.5rem; font-size: 0.975rem; font-weight: 700; background: linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%); border: none; border-radius: 12px; color: #FFFFFF; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 10px 22px -5px rgba(37, 99, 235, 0.45); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;">
                  <span>Acessar Minhas Plaquinhas</span>
                  ${getIcon('arrowRight', '', 18)}
                </button>
              </form>

              <!-- Rodapé Separado e Limpo -->
              <div style="margin-top: 2.25rem; text-align: center; border-top: 1px solid #F1F5F9; padding-top: 1.5rem;">
                <a href="#/login" style="font-size: 0.775rem; color: #64748B; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; transition: color 0.15s;">
                  ${getIcon('lock', '', 14)}
                  <span>Painel do Administrador</span>
                </a>
              </div>

            </div>
          </div>

          <!-- Lado Direito: Logo Flutuante -->
          <div class="client-portal-hero-right" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
            <div class="floating-logo-wrapper">
              <img 
                src="/logo.png" 
                alt="Rei do NFC" 
                style="width: 340px; max-width: 100%; height: auto; object-fit: contain; filter: drop-shadow(0 25px 45px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 65px rgba(96, 165, 250, 0.55));" 
              />
            </div>

            <div style="margin-top: 2rem; color: #FFFFFF;">
              <div style="display: inline-block; padding: 5px 16px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #93C5FD; backdrop-filter: blur(8px); margin-bottom: 0.85rem;">
                Tecnologia & Inovação
              </div>
              <h2 style="font-size: 2.25rem; font-weight: 900; color: #FFFFFF; letter-spacing: -0.02em; line-height: 1.15; text-shadow: 0 4px 16px rgba(0,0,0,0.4);">
                REI DO NFC
              </h2>
              <p style="font-size: 0.95rem; color: #BFDBFE; margin-top: 0.75rem; max-width: 380px; line-height: 1.55; text-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                Gerenciamento inteligente, avaliações 5 estrelas e redirecionamento dinâmico para o seu negócio.
              </p>
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
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.id.toLowerCase().includes(q) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
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
            <div class="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-xs font-mono" style="gap: 4px;">
              ${getIcon('key', '', 13)} Código: <strong>${escapeHtml(client.client_code)}</strong>
            </div>
            <a href="#/cliente" class="btn btn-ghost btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
              ${getIcon('logOut', '', 14)}
              <span>Sair</span>
            </a>
          </div>
        </div>
      </header>

      <!-- Conteúdo Principal -->
      <div class="container py-8">
        
        <!-- Cards de Resumo do Cliente -->
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="card p-4">
            <div class="text-xs text-muted font-medium">Minhas Plaquinhas</div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px;">${allPlaques.length}</div>
          </div>

          <div class="card p-4">
            <div class="text-xs text-muted font-medium">Plaquinhas Ativas</div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--green);">${activeCount}</div>
          </div>

          <div class="card p-4">
            <div class="text-xs text-muted font-medium">Avaliações / Leituras Google</div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--blue);">${totalScans}</div>
          </div>
        </div>

        <!-- Barra de Filtros e Busca do Cliente -->
        <div class="filter-bar">
          
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
              placeholder="Buscar plaquinha..." 
              value="${escapeHtml(searchQuery)}"
              class="form-input" 
              style="padding: 6px 30px 6px 30px; font-size: 0.8125rem;"
            />
            <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
              ${getIcon('search', '', 14)}
            </span>
            ${searchQuery ? `
              <button id="btn-clear-client-portal-search" class="btn-ghost" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: none; padding: 2px; color: var(--text-muted); cursor: pointer;" title="Limpar busca">
                ${getIcon('close', '', 12)}
              </button>
            ` : ''}
          </div>

        </div>

        <div class="table-container" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
          <table class="table">
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
                  <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    Nenhuma plaquinha encontrada para os filtros selecionados.
                  </td>
                </tr>
              ` : paginatedPlaques.map(plaque => {
                const isVirgin = plaque.status === 'virgin';

                return `
                  <tr style="height: 50px; white-space: nowrap; vertical-align: middle;">
                    <!-- Código -->
                    <td class="font-mono font-bold" style="white-space: nowrap;">
                      <span class="text-blue btn-view-qr" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" data-id="${escapeHtml(plaque.id)}">
                        ${getIcon('qrcode', '', 15)}
                        <span>${escapeHtml(plaque.id)}</span>
                      </span>
                    </td>

                    <!-- Status -->
                    <td style="white-space: nowrap;">
                      ${isVirgin 
                        ? `<span class="badge badge-virgin">Virgem</span>`
                        : `<span class="badge badge-active">Ativo</span>`
                      }
                    </td>

                    <!-- Link e Empresa (1 linha só) -->
                    <td style="white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis;">
                      ${isVirgin ? `
                        <span class="text-muted text-xs">Plaquinha pronta para vincular</span>
                        <a href="#/activate/${escapeHtml(plaque.id)}" class="text-xs text-blue ml-2 font-medium" style="display: inline-flex; align-items: center; gap: 3px;">
                          <span>Vincular Agora</span>
                          ${getIcon('arrowright', '', 12)}
                        </a>
                      ` : `
                        <span class="font-bold text-sm text-main" title="${escapeHtml(plaque.name || '')}">${escapeHtml(plaque.name || 'Sua Empresa')}</span>
                        ${plaque.target_url ? `
                          <a href="${escapeHtml(plaque.target_url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-blue ml-2" style="display: inline-flex; vertical-align: middle;" title="${escapeHtml(plaque.target_url)}">
                            ${getIcon('externallink', '', 12)}
                          </a>
                        ` : ''}
                      `}
                    </td>

                    <!-- Scans -->
                    <td class="font-mono font-bold" style="white-space: nowrap; color: ${(plaque.scans_count || 0) > 0 ? 'var(--color-blue)' : 'inherit'};">
                      ${plaque.scans_count || 0}
                    </td>

                    <!-- Último Scan -->
                    <td class="text-xs text-muted" style="white-space: nowrap;">${formatRelativeTime(plaque.last_scan_at)}</td>

                    <!-- Ações do Cliente -->
                    <td style="text-align: right; white-space: nowrap;">
                      <div style="display: inline-flex; gap: 4px;">
                        <button class="btn btn-secondary btn-sm btn-view-qr" data-id="${escapeHtml(plaque.id)}" title="Visualizar QR Code">
                          ${getIcon('qrcode', '', 14)} QR
                        </button>
                        <button class="btn btn-primary btn-sm btn-edit-plaque" data-id="${escapeHtml(plaque.id)}" title="Alterar Link de Destino">
                          ${getIcon('edit', '', 14)} Alterar
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


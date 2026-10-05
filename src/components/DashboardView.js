// Placa QR Pro - Dashboard & Métricas Analíticas
// Estilo Linear / Clean Tech (Alta Densidade, Workstation, Sem Clichês de IA)
import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';
import { formatPhone, escapeHtml } from '../utils/helpers.js';

export function renderDashboardView(options = {}) {
  const selectedPeriod = parseInt(options.period || 14, 10);
  const activeSeries = options.series || 'both'; // 'scans', 'activations', 'both'
  const metrics = storage.getDashboardMetrics(selectedPeriod);
  const hasEventHistory = metrics.scanSource === 'events';
  const historySinceLabel = metrics.scanHistorySince
    ? new Date(metrics.scanHistorySince).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : '';

  // Dados do gráfico
  const timeline = metrics.timeline;
  const maxScans = Math.max(1, ...timeline.map(t => t.scans));
  const maxActivations = Math.max(1, ...timeline.map(t => t.activations));
  const maxVal = Math.max(maxScans, maxActivations, 5);

  // Cálculos do Donut Chart (Taxa de Ativação)
  const totalPlaques = metrics.totalPlaques || 1;
  const activePercent = (metrics.totalActive / totalPlaques) * 100;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (activePercent / 100) * circumference;

  // Top 3 do ranking
  const top1 = metrics.topClients[0] || null;
  const top2 = metrics.topClients[1] || null;
  const top3 = metrics.topClients[2] || null;

  return `
    <!-- Topo Workstation -->
    <div class="content-header" style="background: #FFFFFF; border-bottom: 1px solid var(--border-color); padding: 0.85rem 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 28px; height: 28px; border-radius: var(--radius-sm); background: var(--bg-subtle); border: 1px solid var(--border-color); color: var(--text-main); display: flex; align-items: center; justify-content: center;">
              ${getIcon('barchart', '', 15)}
            </div>
            <div>
              <h1 style="font-size: 1.125rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.02em; line-height: 1.2;">
                Métricas & Tráfego
              </h1>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 1px 0 0 0;">
                Telemetria de leituras em tempo real, ativações de placas e clientes líderes
              </p>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <!-- Seletor de Período Linear -->
          <div class="filter-tabs">
            <button class="filter-btn btn-dashboard-period ${selectedPeriod === 1 ? 'active' : ''}" data-period="1">
              Hoje
            </button>
            <button class="filter-btn btn-dashboard-period ${selectedPeriod === 7 ? 'active' : ''}" data-period="7">
              7D
            </button>
            <button class="filter-btn btn-dashboard-period ${selectedPeriod === 14 ? 'active' : ''}" data-period="14">
              14D
            </button>
            <button class="filter-btn btn-dashboard-period ${selectedPeriod === 30 ? 'active' : ''}" data-period="30">
              30D
            </button>
          </div>

          <a href="#/todas-placas" class="btn btn-secondary btn-sm" style="gap: 5px;">
            ${getIcon('grid', '', 13)}
            <span>Ver Inventário</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Corpo com Espaçamento Otimizado -->
    <div class="content-body" style="padding: 1.25rem;">
      
      <!-- CARDS DE KPIs: borda colorida no topo, número grande, ícone à direita -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">

        ${renderKpiCard({
          color: 'purple', icon: 'qr', value: metrics.totalScans.toLocaleString('pt-BR'), label: 'Leituras Totais',
          footer: `
            <span class="badge ${metrics.todayScans > 0 ? 'badge-active' : 'badge-virgin'}">${metrics.todayScans > 0 ? '+' : ''}${metrics.todayScans} hoje</span>
            <span style="color: var(--text-muted);">Ontem: ${metrics.yesterdayNoHistory ? '—' : metrics.yesterdayScans}</span>`
        })}

        ${renderKpiCard({
          color: 'amber', icon: 'zap', value: metrics.totalActive.toLocaleString('pt-BR'), label: 'Placas em Uso',
          footer: `
            <span class="badge badge-active">${metrics.activationRate}% da frota</span>
            <span style="color: var(--text-muted);">+${metrics.todayActivations} hoje</span>`
        })}

        ${renderKpiCard({
          color: 'indigo', icon: 'users', value: String(metrics.uniqueActiveClients), label: 'Clientes com Placas',
          footer: `<a href="#/clientes" style="color: var(--kpi-indigo); font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"><span>Ver diretório completo</span>${getIcon('arrowright', '', 11)}</a>`
        })}

        ${renderKpiCard({
          color: 'blue', icon: 'award', value: escapeHtml(top1 ? top1.name : 'Nenhum'), label: 'Parceiro Destaque', textValue: true,
          footer: `
            <span class="badge badge-virgin">${top1 ? top1.activeCount : 0} placas</span>
            <span style="color: var(--text-muted);">${top1 ? top1.totalScans : 0} leituras</span>`
        })}

        ${renderKpiCard({
          color: 'green', icon: 'star', value: `~${(metrics.networkEstimatedReviews || 0).toLocaleString('pt-BR')}`, label: 'Reviews Google Estimados',
          footer: `
            <span class="badge badge-active" title="Os 20% de clientes com mais leituras geram esta fatia do total de leituras">Pareto: ${metrics.paretoShare || '0.0'}%</span>
            <span style="color: var(--text-muted);">~22% das leituras</span>`
        })}

      </div>

      <!-- SEÇÃO 1: GRÁFICO COMPACTO DE LINHA DO TEMPO & DONUT DE ESTOQUE -->
      <div class="resp-grid-chart" style="gap: 0.75rem; margin-bottom: 1rem;">
        
        <!-- Bloco do Gráfico Workstation -->
        <div class="card" style="padding: 1rem 1.15rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.85rem;">
            <div>
              <h2 style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>${selectedPeriod === 1 ? 'Volume de Leituras e Ativações (24 Horas)' : 'Evolução Diária de Tráfego'}</span>
                <span class="badge badge-virgin" style="font-family: var(--font-mono);">
                  ${selectedPeriod === 1 ? 'Hoje' : `${selectedPeriod} dias`}
                </span>
              </h2>
            </div>

            <!-- Filtro de Séries do Gráfico -->
            <div class="filter-tabs">
              <button class="filter-btn btn-dashboard-series ${activeSeries === 'both' ? 'active' : ''}" data-series="both">
                Ambos
              </button>
              <button class="filter-btn btn-dashboard-series ${activeSeries === 'scans' ? 'active' : ''}" data-series="scans">
                Leituras
              </button>
              <button class="filter-btn btn-dashboard-series ${activeSeries === 'activations' ? 'active' : ''}" data-series="activations">
                Ativações
              </button>
            </div>
          </div>

          <!-- GRÁFICO SVG RESPONSIVO COM ALTURA COMPACTA -->
          <div style="width: 100%; overflow-x: auto;">
            <div style="min-width: 540px; position: relative;">
              ${renderTimelineSvgChart(timeline, maxVal, activeSeries)}
            </div>
          </div>

          <!-- Legenda do Gráfico Minimalista -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border-color); font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #0B5FFF;"></span>
                <span>Leituras (Scans)</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="width: 10px; height: 10px; border-radius: 50%; background: #F5A524;"></span>
                <span>Novas Placas</span>
              </div>
            </div>
            <div>
              <span>${hasEventHistory
                ? (historySinceLabel ? `Histórico detalhado desde ${historySinceLabel}` : 'Histórico detalhado ativo: aguardando as primeiras leituras')
                : 'Leituras por dia aproximadas (histórico detalhado desativado)'}</span>
            </div>
          </div>
        </div>

        <!-- Bloco de Status do Estoque (Clean Donut) -->
        <div class="card" style="padding: 1rem; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <h2 style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); margin: 0;">
              Status da Frota
            </h2>
            <p style="font-size: 0.6875rem; color: var(--text-muted); margin: 2px 0 0 0;">
              Proporção de placas ativadas vs virgens
            </p>

            <!-- Donut SVG Compacto -->
            <div style="display: flex; justify-content: center; align-items: center; margin: 0.85rem 0 0.5rem;">
              <div style="position: relative; width: 96px; height: 96px;">
                <svg width="96" height="96" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
                  <!-- Background Track -->
                  <circle cx="50" cy="50" r="${radius}" fill="transparent" stroke="#E8F0FD" stroke-width="8"></circle>
                  <!-- Active Slice -->
                  <circle cx="50" cy="50" r="${radius}" fill="transparent" stroke="#0B5FFF" stroke-width="8"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s ease;"></circle>
                </svg>

                <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
                  <span class="num-tabular" style="font-size: 1.25rem; font-weight: 700; color: var(--text-main); line-height: 1;">${metrics.activationRate}%</span>
                  <span style="font-size: 0.5625rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">Ativas</span>
                </div>
              </div>
            </div>

            <!-- Detalhes do Estoque Compacto -->
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: var(--bg-subtle); border-radius: var(--radius-xs); border: 1px solid var(--border-color); font-size: 0.72rem;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: #059669;"></span>
                  <span style="color: var(--text-main);">Ativadas</span>
                </div>
                <span class="num-tabular" style="font-weight: 600; color: var(--text-main);">${metrics.totalActive}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: var(--bg-subtle); border-radius: var(--radius-xs); border: 1px solid var(--border-color); font-size: 0.72rem;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: #9CA3AF;"></span>
                  <span style="color: var(--text-main);">Disponíveis</span>
                </div>
                <span class="num-tabular" style="font-weight: 600; color: var(--text-muted);">${metrics.totalVirgin}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: #FFFFFF; border-radius: var(--radius-xs); border: 1px solid var(--border-color); font-size: 0.72rem;">
                <span style="color: var(--text-muted); font-weight: 500;">Total Lotes</span>
                <span class="num-tabular" style="font-weight: 700; color: var(--text-main);">${metrics.totalPlaques}</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 0.75rem;">
            <a href="#/gerador" class="btn btn-primary btn-sm w-full" style="gap: 5px;">
              ${getIcon('plus', '', 13)}
              <span>Emitir Novo Lote</span>
            </a>
          </div>
        </div>

      </div>

      <!-- SEÇÃO 2: RANKING LEADERBOARD COMPACTO -->
      <div style="margin-bottom: 1rem;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h2 style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
              <span>Classificação de Clientes por Ativações</span>
            </h2>
          </div>

          <span class="badge badge-virgin" style="font-family: var(--font-mono);">
            ${metrics.topClients.length} parceiros com placas ativas
          </span>
        </div>

        <!-- PÓDIO DOS 3 PRIMEIROS (CARDS COMPACTOS) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
          ${renderPodiumCard(top1, 1)}
          ${renderPodiumCard(top2, 2)}
          ${renderPodiumCard(top3, 3)}
        </div>

        <!-- TABELA RANKING LEADERBOARD COMPACTA -->
        <div class="card" style="overflow: hidden; margin-bottom: 1rem;">
          <div class="table-container" style="border: none;">
            <table class="table" style="margin: 0; width: 100%;">
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">Pos</th>
                  <th>Cliente / Parceiro</th>
                  <th>Telefone</th>
                  <th style="min-width: 140px;">Proporção</th>
                  <th style="text-align: center;">Placas</th>
                  <th style="text-align: center;">Scans</th>
                  <th style="width: 110px; text-align: right;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderLeaderboardRows(metrics.topClients)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- CIÊNCIA DE DADOS ADMIN: RADAR DE SAÚDE DA BASE & DETECTOR DE CHURN -->
        <div class="card p-4" style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 0.85rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <h3 style="font-size: 0.875rem; font-weight: 700; color: var(--text-main); margin: 0;">
                  Radar de Retenção & Saúde da Base (CRM Preditivo)
                </h3>
                <span class="badge badge-active" style="font-size: 0.65rem;">Ciência de Dados</span>
              </div>
              <p style="font-size: 0.72rem; color: var(--text-muted); margin: 2px 0 0 0;">
                Monitore o engajamento de cada cliente e atue proativamente via WhatsApp antes do abandono.
              </p>
            </div>

            <!-- Chips de Filtro Rápido do Radar -->
            <div style="display: flex; gap: 4px; flex-wrap: wrap;" id="radar-filter-container">
              <button class="btn btn-xs btn-radar-filter active" data-category="all" style="font-size: 0.6875rem; padding: 3px 8px;">
                Todos (${metrics.topClients.length})
              </button>
              <button class="btn btn-xs btn-radar-filter" data-category="power" style="font-size: 0.6875rem; padding: 3px 8px;">
                🚀 Campeões (${(metrics.clientHealthMatrix?.power || []).length})
              </button>
              <button class="btn btn-xs btn-radar-filter" data-category="accelerating" style="font-size: 0.6875rem; padding: 3px 8px;">
                📈 Acelerando (${(metrics.clientHealthMatrix?.accelerating || []).length})
              </button>
              <button class="btn btn-xs btn-radar-filter" data-category="stable" style="font-size: 0.6875rem; padding: 3px 8px;">
                ⏸️ Estáveis (${(metrics.clientHealthMatrix?.stable || []).length})
              </button>
              <button class="btn btn-xs btn-radar-filter" data-category="atRisk" style="font-size: 0.6875rem; padding: 3px 8px; color: #DC2626; border-color: #FECACA; background: #FEF2F2;">
                ⚠️ Em Risco (${(metrics.clientHealthMatrix?.atRisk || []).length})
              </button>
            </div>
          </div>

          <!-- Tabela do Radar com WhatsApp Direto -->
          <div class="table-container" style="border: 1px solid var(--border-color); border-radius: var(--radius-sm); max-height: 280px; overflow-y: auto;">
            <table class="table" style="margin: 0; width: 100%; font-size: 0.75rem;">
              <thead style="position: sticky; top: 0; background: #F8FAFC; z-index: 2;">
                <tr>
                  <th>Cliente</th>
                  <th style="width: 120px;">Classificação</th>
                  <th style="width: 90px; text-align: center;">Placas</th>
                  <th style="width: 90px; text-align: center;">Scans</th>
                  <th style="width: 130px;">Última Interação</th>
                  <th style="width: 140px; text-align: right;">Ação Proativa</th>
                </tr>
              </thead>
              <tbody id="radar-table-body">
                ${renderRadarRows(metrics.clientHealthMatrix)}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- SEÇÃO 3: DISTRIBUIÇÃO POR LOTES & ÚLTIMAS ATIVAÇÕES -->
      <div class="resp-grid-2" style="gap: 0.75rem;">
        
        <!-- Distribuição por Lotes & Burn Rate -->
        <div class="card" style="padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <h3 style="font-size: 0.8125rem; font-weight: 600; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
                ${getIcon('folder', '', 14)}
                <span>Distribuição & Giro de Lotes (Burn Rate)</span>
              </h3>
              <span style="font-size: 0.65rem; color: var(--text-muted);">Velocidade de consumo e estoque restante</span>
            </div>
            <a href="#/lotes" style="font-size: 0.6875rem; font-weight: 500; color: var(--text-muted); text-decoration: none;">Ver Pastas</a>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${metrics.batchDistribution.map(b => {
              const pct = parseFloat(b.percentActive) || 0;
              return `
                <div style="padding: 6px 8px; background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; margin-bottom: 4px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(b.name)}</span>
                      ${b.isStockLow ? `<span class="badge" style="background: #FEF3C7; color: #92400E; font-size: 0.625rem; padding: 1px 4px;">⚠️ Estoque Baixo</span>` : ''}
                    </div>
                    <span class="num-tabular" style="color: var(--text-muted);">
                      <strong style="color: var(--text-main);">${b.active}</strong> / ${b.total} ativas (${b.percentActive}%)
                    </span>
                  </div>

                  <div style="width: 100%; height: 5px; background: #E5E7EB; border-radius: 999px; overflow: hidden; margin-bottom: 4px;">
                    <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #4D86FF, #0B5FFF); border-radius: 999px;"></div>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono);">
                    <span>${b.virgin} placas virgens disponíveis</span>
                    <span style="color: ${b.virgin === 0 ? 'var(--text-muted)' : (b.burnRateDaysRemaining <= 10 ? '#DC2626' : 'inherit')}; font-weight: 500;">
                      ${b.virgin === 0 ? 'Lote 100% Ativado' : `Estoque: ~${b.burnRateDaysRemaining} dias`}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Feed de Últimas Ativações Compacto -->
        <div class="card" style="padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="font-size: 0.8125rem; font-weight: 600; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 6px;">
              ${getIcon('zap', '', 14)}
              <span>Últimas Placas Ativadas</span>
            </h3>
            <span class="badge badge-active" style="font-family: var(--font-mono);">Ao Vivo</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${metrics.recentActivations.length === 0 ? `
              <div style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.75rem;">
                Nenhuma plaquinha ativada recentemente.
              </div>
            ` : metrics.recentActivations.map(p => {
              const actDate = p.activated_at ? new Date(p.activated_at) : null;
              const formattedTime = actDate ? `${actDate.toLocaleDateString('pt-BR')} ${actDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                  <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                    <span class="td-id" style="font-size: 0.72rem; flex-shrink: 0;">${escapeHtml(p.id)}</span>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <span style="font-weight: 500; font-size: 0.75rem; color: var(--text-main);">${escapeHtml(p.name || 'Empresa')}</span>
                      <span style="font-size: 0.6875rem; color: var(--text-muted); margin-left: 4px;">(${escapeHtml(p.client_name || 'Desconhecido')})</span>
                    </div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0; margin-left: 8px;">
                    <span class="num-tabular" style="font-size: 0.6875rem; color: var(--text-muted);">${formattedTime}</span>
                    <span class="num-tabular" style="font-size: 0.6875rem; font-weight: 600; color: var(--text-main); margin-left: 6px;">${p.scans_count || 0} scans</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>

    </div>
  `;
}

// Cartão de KPI (borda colorida no topo, número grande, ícone à direita)
function renderKpiCard({ color, icon, value, label, footer = '', textValue = false }) {
  return `
    <div class="card kpi-card kpi-${color}">
      <div class="kpi-top">
        <div style="min-width: 0;">
          <div class="kpi-value ${textValue ? 'kpi-value-text' : ''}" ${textValue ? `title="${value}"` : ''}>${value}</div>
          <div class="kpi-label">${label}</div>
        </div>
        <div class="kpi-icon">${getIcon(icon, '', 18)}</div>
      </div>
      ${footer ? `<div class="kpi-footer">${footer}</div>` : ''}
    </div>
  `;
}

// Renderizador do Card de Pódio
function renderPodiumCard(client, rank) {
  if (!client) {
    return `
      <div class="card" style="padding: 0.75rem; border: 1px dashed var(--border-color); background: var(--bg-subtle); text-align: center; color: var(--text-muted);">
        <span style="font-size: 0.72rem;">Posição #${rank} disponível</span>
      </div>
    `;
  }

  const isFirst = rank === 1;

  return `
    <div class="card" style="padding: 0.75rem 0.85rem; border-color: ${isFirst ? 'var(--text-main)' : 'var(--border-color)'};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
        <span class="badge ${isFirst ? 'badge-active' : 'badge-virgin'}" style="font-family: var(--font-mono);">
          #${rank} Lugar
        </span>
        <span class="num-tabular" style="font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono);">
          ${client.percentOfTotalActive}% do total
        </span>
      </div>

      <div style="margin-bottom: 0.55rem;">
        <div style="font-size: 0.875rem; font-weight: 600; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(client.name)}">
          ${escapeHtml(client.name)}
        </div>
        <div style="font-size: 0.6875rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 1px;">
          ${client.phone ? formatPhone(client.phone) : 'Sem telefone'}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px 8px; background: var(--bg-subtle); border-radius: var(--radius-xs); border: 1px solid var(--border-color); margin-bottom: 0.55rem;">
        <div>
          <span style="font-size: 0.5625rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Placas</span>
          <div class="num-tabular" style="font-size: 0.9375rem; font-weight: 700; color: var(--text-main);">
            ${client.activeCount}
          </div>
        </div>
        <div>
          <span style="font-size: 0.5625rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Scans</span>
          <div class="num-tabular" style="font-size: 0.9375rem; font-weight: 700; color: var(--text-main);">
            ${client.totalScans}
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 4px;">
        <a href="#/todas-placas?client=${encodeURIComponent(client.name)}" class="btn btn-secondary btn-xs" style="flex: 1; justify-content: center;">
          ${getIcon('grid', '', 11)}
          <span>Placas</span>
        </a>
        ${client.code ? `
          <a href="#/cliente/${encodeURIComponent(client.code)}" target="_blank" class="btn btn-ghost btn-xs" title="Portal do Cliente">
            ${getIcon('externalLink', '', 11)}
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

// Renderizador das Linhas da Tabela de Líderes Compacta
function renderLeaderboardRows(clients) {
  if (!clients || clients.length === 0) {
    return `
      <tr>
        <td colspan="7" style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.75rem;">
          Nenhum cliente com placas ativadas até o momento.
        </td>
      </tr>
    `;
  }

  const topScore = clients[0].activeCount || 1;

  return clients.slice(0, 10).map((c, idx) => {
    const barWidth = Math.max(4, Math.round((c.activeCount / topScore) * 100));

    return `
      <tr>
        <td style="text-align: center; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600; color: var(--text-muted);">
          #${idx + 1}
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">
            ${escapeHtml(c.name)}
          </div>
          ${c.code ? `<div style="font-size: 0.625rem; color: var(--text-muted); font-family: var(--font-mono);">ID: ${escapeHtml(c.code)}</div>` : ''}
        </td>
        <td>
          <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap;">
            ${c.phone ? formatPhone(c.phone) : '—'}
          </span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="flex: 1; height: 4px; background: var(--bg-subtle); border-radius: 999px; overflow: hidden;">
              <div style="width: ${barWidth}%; height: 100%; background: linear-gradient(90deg, #4D86FF, #0B5FFF); border-radius: 999px;"></div>
            </div>
            <span class="num-tabular" style="font-size: 0.625rem; font-family: var(--font-mono); color: var(--text-muted); width: 28px; text-align: right;">${c.percentOfTotalActive}%</span>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="badge badge-active num-tabular">
            ${c.activeCount}
          </span>
        </td>
        <td style="text-align: center;" class="num-tabular">
          ${c.totalScans}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 3px;">
            <a href="#/todas-placas?client=${encodeURIComponent(c.name)}" class="btn btn-secondary btn-xs" title="Ver Placas">
              ${getIcon('grid', '', 11)}
            </a>
            ${c.code ? `
              <a href="#/cliente/${encodeURIComponent(c.code)}" target="_blank" class="btn btn-ghost btn-xs" title="Portal do Cliente">
                ${getIcon('externalLink', '', 11)}
              </a>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Renderizador das Linhas do Radar de Saúde & Detector de Churn
function renderRadarRows(matrix) {
  if (!matrix) return '';
  // Quem precisa de atenção primeiro: Em Risco (nunca lidas e as paradas há
  // mais tempo no topo), depois o resto.
  const atRiskFirst = (matrix.atRisk || []).slice().sort((a, b) => {
    const da = a.daysSinceScan === null ? Infinity : a.daysSinceScan;
    const db = b.daysSinceScan === null ? Infinity : b.daysSinceScan;
    return db - da;
  });
  const allClients = [
    ...atRiskFirst,
    ...(matrix.stable || []),
    ...(matrix.accelerating || []),
    ...(matrix.power || [])
  ];

  if (allClients.length === 0) {
    return `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.75rem;">
          Nenhum cliente cadastrado no momento.
        </td>
      </tr>
    `;
  }

  const categoryLabels = {
    power: { label: '🚀 Campeão', bg: '#ECFDF5', color: '#047857' },
    accelerating: { label: '📈 Acelerando', bg: '#EFF6FF', color: '#1D4ED8' },
    stable: { label: '⏸️ Estável', bg: '#F3F4F6', color: '#374151' },
    atRisk: { label: '⚠️ Em Risco', bg: '#FEF2F2', color: '#DC2626' }
  };

  return allClients.map(c => {
    const cat = categoryLabels[c.category] || categoryLabels.stable;
    let lastScanLabel = 'Sem leituras ainda';
    if (c.daysSinceScan !== null) {
      if (c.daysSinceScan === 0) lastScanLabel = 'Hoje';
      else if (c.daysSinceScan === 1) lastScanLabel = 'Ontem';
      else lastScanLabel = `há ${c.daysSinceScan} dias`;
    }

    return `
      <tr class="radar-client-row" data-category="${c.category}">
        <td>
          <div style="font-weight: 600; color: var(--text-main); font-size: 0.75rem;">
            ${escapeHtml(c.name)}
          </div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap;">
            ${c.phone ? formatPhone(c.phone) : (c.code ? `Cód: ${escapeHtml(c.code)}` : 'Sem contato')}
          </div>
        </td>
        <td>
          <span class="badge" style="background: ${cat.bg}; color: ${cat.color}; font-size: 0.65rem; font-weight: 600;">
            ${cat.label}
          </span>
        </td>
        <td style="text-align: center;" class="num-tabular font-mono">
          ${c.activeCount}
        </td>
        <td style="text-align: center;" class="num-tabular font-mono">
          ${c.totalScans}
        </td>
        <td class="font-mono text-xs" style="color: ${c.category === 'atRisk' ? '#DC2626' : 'var(--text-muted)'}; font-size: 0.6875rem;">
          ${lastScanLabel}
        </td>
        <td style="text-align: right;">
          ${c.whatsappUrl ? `
            <a href="${c.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-xs" style="background: #059669; color: #FFFFFF; border: none; font-size: 0.65rem; padding: 3px 8px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; text-decoration: none;" title="Abrir conversa pré-formatada no WhatsApp">
              ${getIcon('phone', '', 11)}
              <span>${c.category === 'atRisk' ? 'Apoio WhatsApp' : (c.category === 'power' ? 'Upsell WhatsApp' : 'Contatar')}</span>
            </a>
          ` : `
            <span style="font-size: 0.65rem; color: var(--text-muted);">Sem WhatsApp</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

// Renderizador do Gráfico SVG de Linha do Tempo Compacto
function renderTimelineSvgChart(timeline, maxVal, activeSeries) {
  const width = 720;
  const height = 160;
  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = 16;
  const paddingBottom = 26;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const count = timeline.length;
  const colWidth = chartWidth / count;

  // Grid horizontal com 3 linhas
  const gridLines = [0, 0.5, 1];
  const gridHtml = gridLines.map(ratio => {
    const y = paddingTop + chartHeight * (1 - ratio);
    const labelVal = Math.round(maxVal * ratio);
    return `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#E5E7EB" stroke-width="1" />
      <text x="${paddingLeft - 6}" y="${y + 3}" fill="#9CA3AF" font-size="9" font-weight="500" text-anchor="end" font-family="'JetBrains Mono', monospace">${labelVal}</text>
    `;
  }).join('');

  // Barras / Séries Minimalistas
  const barsHtml = timeline.map((item, i) => {
    const x = paddingLeft + i * colWidth;
    const barWidth = Math.max(10, colWidth * 0.35);

    const scansHeight = (item.scans / maxVal) * chartHeight;
    const actHeight = (item.activations / maxVal) * chartHeight;

    const scansY = paddingTop + (chartHeight - scansHeight);
    const actY = paddingTop + (chartHeight - actHeight);

    let barsContent = '';

    if (activeSeries === 'scans') {
      const centerX = x + (colWidth - barWidth) / 2;
      barsContent = `
        <rect x="${centerX}" y="${paddingTop}" width="${barWidth}" height="${chartHeight}" rx="${barWidth / 2}" fill="#EEF3FD" />
        <rect x="${centerX}" y="${scansY}" width="${barWidth}" height="${scansHeight}" rx="${barWidth / 2}" fill="#0B5FFF" />
      `;
    } else if (activeSeries === 'activations') {
      const centerX = x + (colWidth - barWidth) / 2;
      barsContent = `
        <rect x="${centerX}" y="${paddingTop}" width="${barWidth}" height="${chartHeight}" rx="${barWidth / 2}" fill="#EEF3FD" />
        <rect x="${centerX}" y="${actY}" width="${barWidth}" height="${actHeight}" rx="${barWidth / 2}" fill="#F5A524" />
      `;
    } else {
      // Ambos lado a lado
      const halfWidth = (barWidth / 2);
      const x1 = x + (colWidth / 2) - halfWidth - 1;
      const x2 = x + (colWidth / 2) + 1;

      barsContent = `
        <rect x="${x1}" y="${paddingTop}" width="${halfWidth}" height="${chartHeight}" rx="${halfWidth / 2}" fill="#EEF3FD" />
        <rect x="${x2}" y="${paddingTop}" width="${halfWidth}" height="${chartHeight}" rx="${halfWidth / 2}" fill="#EEF3FD" />
        <rect x="${x1}" y="${scansY}" width="${halfWidth}" height="${scansHeight}" rx="${halfWidth / 2}" fill="#0B5FFF" />
        <rect x="${x2}" y="${actY}" width="${halfWidth}" height="${actHeight}" rx="${halfWidth / 2}" fill="#F5A524" />
      `;
    }

    const labelX = x + colWidth / 2;
    const labelY = height - 8;
    const isToday = item.isToday;

    return `
      <g class="chart-col-group" style="cursor: pointer;">
        <rect x="${x}" y="${paddingTop}" width="${colWidth}" height="${chartHeight}" fill="transparent">
          <title>${item.label}: ${item.noHistory ? 'sem histórico detalhado' : `${item.scans} leituras`} | ${item.activations} ativações</title>
        </rect>
        ${barsContent}
        <text x="${labelX}" y="${labelY}" fill="${isToday ? '#0B5FFF' : '#5B6B86'}" font-size="9" font-weight="${isToday ? '700' : '500'}" text-anchor="middle" font-family="'JetBrains Mono', monospace">
          ${item.shortLabel}
        </text>
      </g>
    `;
  }).join('');

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
      ${gridHtml}
      <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="#E5E7EB" stroke-width="1" />
      ${barsHtml}
    </svg>
  `;
}

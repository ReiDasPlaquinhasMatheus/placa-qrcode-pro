// Placa QR Pro - Dashboard & Métricas Analíticas
// Design Compacto, Elegante e Refinado (Visual Executivo em Família Montserrat)
import { storage } from '../services/storage.js';
import { getIcon } from '../utils/icons.js';
import { formatPhone, escapeHtml } from '../utils/helpers.js';

export function renderDashboardView(options = {}) {
  const selectedPeriod = parseInt(options.period || 14, 10);
  const activeSeries = options.series || 'both'; // 'scans', 'activations', 'both'
  const metrics = storage.getDashboardMetrics(selectedPeriod);

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

  // Top 3 do pódio
  const top1 = metrics.topClients[0] || null;
  const top2 = metrics.topClients[1] || null;
  const top3 = metrics.topClients[2] || null;

  return `
    <!-- Topo Compacto -->
    <div class="content-header" style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0; padding: 0.9rem 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(37,99,235,0.1); color: #2563EB; display: flex; align-items: center; justify-content: center;">
              ${getIcon('barchart', '', 18)}
            </div>
            <div>
              <h1 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin: 0; letter-spacing: -0.01em; line-height: 1.2;">
                Dashboard & Métricas
              </h1>
              <p style="font-size: 0.75rem; color: #64748B; margin: 1px 0 0 0;">
                Métricas ao vivo de leituras, novas ativações e ranking de parceiros
              </p>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- Seletor de Período Compacto -->
          <div style="display: inline-flex; background: #F1F5F9; padding: 2px; border-radius: 8px; border: 1px solid #E2E8F0;">
            <button class="btn btn-sm btn-dashboard-period ${selectedPeriod === 1 ? 'btn-primary' : 'btn-ghost'}" data-period="1" style="padding: 4px 10px; font-weight: 700; border-radius: 6px; font-size: 0.72rem;">
              Hoje
            </button>
            <button class="btn btn-sm btn-dashboard-period ${selectedPeriod === 7 ? 'btn-primary' : 'btn-ghost'}" data-period="7" style="padding: 4px 10px; font-weight: 700; border-radius: 6px; font-size: 0.72rem;">
              7 Dias
            </button>
            <button class="btn btn-sm btn-dashboard-period ${selectedPeriod === 14 ? 'btn-primary' : 'btn-ghost'}" data-period="14" style="padding: 4px 10px; font-weight: 700; border-radius: 6px; font-size: 0.72rem;">
              14 Dias
            </button>
            <button class="btn btn-sm btn-dashboard-period ${selectedPeriod === 30 ? 'btn-primary' : 'btn-ghost'}" data-period="30" style="padding: 4px 10px; font-weight: 700; border-radius: 6px; font-size: 0.72rem;">
              30 Dias
            </button>
          </div>

          <a href="#/todas-placas" class="btn btn-outline btn-sm" style="font-weight: 700; font-size: 0.75rem; gap: 5px; padding: 5px 11px; border-radius: 7px;">
            ${getIcon('grid', '', 14)}
            <span>Ver Placas</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Corpo com Espaçamento Otimizado -->
    <div class="content-body" style="padding: 1.25rem 1.5rem;">
      
      <!-- 4 CARDS DE MÉTRICAS RÁPIDAS (KPIs COMPACTOS) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        
        <!-- Card 1: Leituras / Scans -->
        <div class="card" style="padding: 0.9rem 1.15rem; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border: 1px solid #E2E8F0; border-radius: 12px; position: relative; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;">Leituras (Scans)</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: #0F172A; line-height: 1.15; margin-top: 3px;">
                ${metrics.totalScans.toLocaleString('pt-BR')}
              </div>
            </div>
            <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(37,99,235,0.1); color: #2563EB; display: flex; align-items: center; justify-content: center;">
              ${getIcon('qr', '', 18)}
            </div>
          </div>
          <div style="margin-top: 8px; display: flex; align-items: center; gap: 6px; font-size: 0.75rem;">
            <span style="display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: ${metrics.todayScans > 0 ? '#16A34A' : '#64748B'}; background: ${metrics.todayScans > 0 ? 'rgba(22,163,74,0.1)' : '#F1F5F9'}; padding: 1px 6px; border-radius: 5px; font-size: 0.7rem;">
              ${metrics.todayScans > 0 ? getIcon('trendingup', '', 12) : ''}
              ${metrics.todayScans} hoje
            </span>
            <span style="color: #94A3B8; font-size: 0.7rem;">Ontem: ${metrics.yesterdayScans}</span>
          </div>
        </div>

        <!-- Card 2: Placas Ativadas -->
        <div class="card" style="padding: 0.9rem 1.15rem; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border: 1px solid #E2E8F0; border-radius: 12px; position: relative; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;">Placas Ativadas</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: #0F172A; line-height: 1.15; margin-top: 3px;">
                ${metrics.totalActive.toLocaleString('pt-BR')}
              </div>
            </div>
            <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(16,185,129,0.1); color: #10B981; display: flex; align-items: center; justify-content: center;">
              ${getIcon('zap', '', 18)}
            </div>
          </div>
          <div style="margin-top: 8px; display: flex; align-items: center; gap: 6px; font-size: 0.75rem;">
            <span style="display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: #059669; background: rgba(16,185,129,0.1); padding: 1px 6px; border-radius: 5px; font-size: 0.7rem;">
              ${metrics.activationRate}% ativadas
            </span>
            <span style="color: #94A3B8; font-size: 0.7rem;">+${metrics.todayActivations} hoje</span>
          </div>
        </div>

        <!-- Card 3: Clientes Únicos -->
        <div class="card" style="padding: 0.9rem 1.15rem; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border: 1px solid #E2E8F0; border-radius: 12px; position: relative; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;">Clientes Ativadores</span>
              <div style="font-size: 1.5rem; font-weight: 800; color: #0F172A; line-height: 1.15; margin-top: 3px;">
                ${metrics.uniqueActiveClients}
              </div>
            </div>
            <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(168,85,247,0.1); color: #9333EA; display: flex; align-items: center; justify-content: center;">
              ${getIcon('users', '', 18)}
            </div>
          </div>
          <div style="margin-top: 8px; display: flex; align-items: center; gap: 6px; font-size: 0.75rem;">
            <a href="#/clientes" style="color: #2563EB; font-weight: 700; font-size: 0.7rem; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;">
              <span>Ver todos (${metrics.uniqueActiveClients})</span>
              ${getIcon('arrowright', '', 11)}
            </a>
          </div>
        </div>

        <!-- Card 4: Top Ativador Líder -->
        <div class="card" style="padding: 0.9rem 1.15rem; background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%); border: 1px solid #E2E8F0; border-radius: 12px; position: relative; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;">Líder de Ativações</span>
              <div style="font-size: 1.05rem; font-weight: 800; color: #0F172A; line-height: 1.25; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="${escapeHtml(top1 ? top1.name : 'Nenhum')}">
                ${escapeHtml(top1 ? top1.name : 'Nenhum ainda')}
              </div>
            </div>
            <div style="width: 36px; height: 36px; border-radius: 9px; background: rgba(234,179,8,0.12); color: #CA8A04; display: flex; align-items: center; justify-content: center;">
              ${getIcon('award', '', 18)}
            </div>
          </div>
          <div style="margin-top: 8px; display: flex; align-items: center; gap: 6px; font-size: 0.75rem;">
            <span style="font-weight: 700; color: #B45309; background: rgba(234,179,8,0.15); padding: 1px 6px; border-radius: 5px; font-size: 0.7rem;">
              ${top1 ? top1.activeCount : 0} placas
            </span>
            <span style="color: #94A3B8; font-size: 0.7rem;">${top1 ? top1.totalScans : 0} leituras</span>
          </div>
        </div>

      </div>

      <!-- SEÇÃO 1: GRÁFICO COMPACTO DE LINHA DO TEMPO & DONUT DE ESTOQUE -->
      <div style="display: grid; grid-template-columns: 2.3fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
        
        <!-- Bloco do Gráfico -->
        <div class="card" style="padding: 1.15rem 1.25rem; border: 1px solid #E2E8F0; border-radius: 14px; background: #FFFFFF; box-shadow: 0 2px 10px rgba(15,23,42,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
            <div>
              <h2 style="font-size: 0.95rem; font-weight: 800; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 6px;">
                <span>${selectedPeriod === 1 ? 'Leituras e Ativações de Hoje (Por Horário)' : 'Evolução Diária de Leituras e Ativações'}</span>
                <span class="badge" style="background: rgba(37,99,235,0.1); color: #2563EB; font-size: 0.65rem; font-weight: 700; padding: 2px 6px;">
                  ${selectedPeriod === 1 ? 'Hoje (24 Horas)' : `Últimos ${selectedPeriod} dias`}
                </span>
              </h2>
              <p style="font-size: 0.75rem; color: #64748B; margin: 2px 0 0 0;">
                ${selectedPeriod === 1 ? 'Volume de scans e novas plaquinhas ativadas por faixa de horário hoje' : 'Volume de scans de clientes e novas plaquinhas ativadas por data'}
              </p>
            </div>

            <!-- Filtro de Séries do Gráfico -->
            <div style="display: flex; align-items: center; gap: 4px;">
              <button class="btn btn-sm btn-dashboard-series ${activeSeries === 'both' ? 'btn-primary' : 'btn-ghost'}" data-series="both" style="font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 5px;">
                Tudo
              </button>
              <button class="btn btn-sm btn-dashboard-series ${activeSeries === 'scans' ? 'btn-primary' : 'btn-ghost'}" data-series="scans" style="font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 5px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #2563EB;"></span>
                <span>Leituras</span>
              </button>
              <button class="btn btn-sm btn-dashboard-series ${activeSeries === 'activations' ? 'btn-primary' : 'btn-ghost'}" data-series="activations" style="font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 5px; display: flex; align-items: center; gap: 4px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #10B981;"></span>
                <span>Ativações</span>
              </button>
            </div>
          </div>

          <!-- GRÁFICO SVG RESPONSIVO COM ALTURA COMPACTA -->
          <div style="width: 100%; overflow-x: auto;">
            <div style="min-width: 580px; position: relative;">
              ${renderTimelineSvgChart(timeline, maxVal, activeSeries)}
            </div>
          </div>

          <!-- Legenda do Gráfico -->
          <div style="display: flex; justify-content: center; align-items: center; gap: 1.5rem; margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px solid #F1F5F9; font-size: 0.72rem;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 2px; background: linear-gradient(180deg, #3B82F6 0%, #2563EB 100%);"></span>
              <span style="color: #334155; font-weight: 600;">Leituras (Scans)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 2px; background: linear-gradient(180deg, #34D399 0%, #10B981 100%);"></span>
              <span style="color: #334155; font-weight: 600;">Placas Ativadas</span>
            </div>
            <div style="color: #94A3B8; font-size: 0.6875rem;">
              <span>Passe o mouse nas colunas para ver detalhes</span>
            </div>
          </div>
        </div>

        <!-- Bloco de Taxa de Ativação Geral (Donut / Estoque Compacto) -->
        <div class="card" style="padding: 1.15rem 1.25rem; border: 1px solid #E2E8F0; border-radius: 14px; background: #FFFFFF; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 2px 10px rgba(15,23,42,0.02);">
          <div>
            <h2 style="font-size: 0.95rem; font-weight: 800; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 6px;">
              <span>Status do Estoque</span>
            </h2>
            <p style="font-size: 0.75rem; color: #64748B; margin: 2px 0 0 0;">
              Proporção de placas ativadas vs virgens
            </p>

            <!-- Donut SVG Compacto -->
            <div style="display: flex; justify-content: center; align-items: center; margin: 0.9rem 0 0.6rem;">
              <div style="position: relative; width: 110px; height: 110px;">
                <svg width="110" height="110" viewBox="0 0 100 100" style="transform: rotate(-90deg);">
                  <!-- Background Track -->
                  <circle cx="50" cy="50" r="${radius}" fill="transparent" stroke="#F1F5F9" stroke-width="10"></circle>
                  <!-- Active Slice -->
                  <circle cx="50" cy="50" r="${radius}" fill="transparent" stroke="url(#donutGradient)" stroke-width="10"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.8s ease;"></circle>
                  <defs>
                    <linearGradient id="donutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#3B82F6" />
                      <stop offset="100%" stop-color="#2563EB" />
                    </linearGradient>
                  </defs>
                </svg>

                <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
                  <span style="font-size: 1.35rem; font-weight: 800; color: #0F172A; line-height: 1;">${metrics.activationRate}%</span>
                  <span style="font-size: 0.6rem; font-weight: 700; color: #64748B; text-transform: uppercase; margin-top: 2px;">Ativadas</span>
                </div>
              </div>
            </div>

            <!-- Detalhes do Estoque Compacto -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #F8FAFC; border-radius: 7px; border: 1px solid #E2E8F0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #2563EB;"></span>
                  <span style="font-size: 0.75rem; font-weight: 600; color: #334155;">Placas Ativas</span>
                </div>
                <span style="font-weight: 800; font-size: 0.85rem; color: #0F172A;">${metrics.totalActive}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #F8FAFC; border-radius: 7px; border: 1px solid #E2E8F0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #94A3B8;"></span>
                  <span style="font-size: 0.75rem; font-weight: 600; color: #334155;">Disponíveis</span>
                </div>
                <span style="font-weight: 800; font-size: 0.85rem; color: #64748B;">${metrics.totalVirgin}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #EFF6FF; border-radius: 7px; border: 1px solid #BFDBFE;">
                <span style="font-size: 0.75rem; font-weight: 700; color: #1E40AF;">Total em Estoque</span>
                <span style="font-weight: 800; font-size: 0.85rem; color: #1E40AF;">${metrics.totalPlaques}</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 0.85rem;">
            <a href="#/gerador" class="btn btn-primary btn-sm btn-block" style="font-weight: 700; font-size: 0.75rem; gap: 5px; padding: 7px 10px; border-radius: 7px;">
              ${getIcon('plus', '', 14)}
              <span>Emitir Novo Lote</span>
            </a>
          </div>
        </div>

      </div>

      <!-- SEÇÃO 2: QUEM MAIS ESTÁ ATIVANDO (PÓDIO & RANKING LEADERBOARD COMPACTOS) -->
      <div style="margin-bottom: 1.25rem;">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.9rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="color: #EAB308;">${getIcon('award', '', 20)}</span>
              <h2 style="font-size: 1.05rem; font-weight: 800; color: #0F172A; margin: 0; letter-spacing: -0.01em;">
                Quem Mais Está Ativando Plaquinhas
              </h2>
            </div>
            <p style="font-size: 0.75rem; color: #64748B; margin: 2px 0 0 0;">
              Ranking de parceiros e clientes com maior volume de ativações e leituras
            </p>
          </div>

          <span style="font-size: 0.7rem; font-weight: 700; color: #64748B; background: #F1F5F9; padding: 3px 8px; border-radius: 5px;">
            ${metrics.topClients.length} parceiros com placas ativas
          </span>
        </div>

        <!-- PÓDIO DOS 3 PRIMEIROS COLOCADOS (CARDS COMPACTOS) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
          
          <!-- 1º LUGAR (OURO) -->
          ${renderPodiumCard(top1, 1)}

          <!-- 2º LUGAR (PRATA) -->
          ${renderPodiumCard(top2, 2)}

          <!-- 3º LUGAR (BRONZE) -->
          ${renderPodiumCard(top3, 3)}

        </div>

        <!-- TABELA RANKING LEADERBOARD COMPACTA -->
        <div class="card" style="border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; background: #FFFFFF; box-shadow: 0 2px 10px rgba(15,23,42,0.02);">
          <div style="padding: 0.75rem 1.15rem; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em;">
              Classificação dos Parceiros
            </span>
            <span style="font-size: 0.7rem; color: #64748B; font-weight: 600;">
              Ordenado por: Quantidade de Placas Ativadas
            </span>
          </div>

          <div class="table-container" style="margin: 0; border: none;">
            <table class="table" style="margin: 0; width: 100%;">
              <thead>
                <tr style="background: #FFFFFF; font-size: 0.75rem;">
                  <th style="width: 55px; text-align: center; padding: 8px 10px;">Posição</th>
                  <th style="padding: 8px 10px;">Cliente / Parceiro</th>
                  <th style="padding: 8px 10px;">Telefone</th>
                  <th style="min-width: 150px; padding: 8px 10px;">Progresso Relativo</th>
                  <th style="text-align: center; padding: 8px 10px;">Placas</th>
                  <th style="text-align: center; padding: 8px 10px;">Scans</th>
                  <th style="width: 120px; text-align: right; padding: 8px 10px;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderLeaderboardRows(metrics.topClients)}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- SEÇÃO 3: DISTRIBUIÇÃO POR LOTES & ÚLTIMAS ATIVAÇÕES COMPACTAS -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        
        <!-- Distribuição por Lotes -->
        <div class="card" style="padding: 1.15rem 1.25rem; border: 1px solid #E2E8F0; border-radius: 14px; background: #FFFFFF; box-shadow: 0 2px 10px rgba(15,23,42,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.9rem; font-weight: 800; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 6px;">
              ${getIcon('folder', '', 16)}
              <span>Ativações por Lote de Produção</span>
            </h3>
            <a href="#/lotes" style="font-size: 0.72rem; font-weight: 700; color: #2563EB; text-decoration: none;">Ver Pastas</a>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${metrics.batchDistribution.map(b => {
              const pct = parseFloat(b.percentActive) || 0;
              return `
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; margin-bottom: 3px;">
                    <div style="font-weight: 700; color: #1E293B;">${escapeHtml(b.name)}</div>
                    <div style="color: #64748B;">
                      <span style="font-weight: 800; color: #0F172A;">${b.active}</span> / ${b.total} ativadas 
                      <span style="color: #2563EB; font-weight: 700; margin-left: 3px;">(${b.percentActive}%)</span>
                    </div>
                  </div>
                  <div style="width: 100%; height: 6px; background: #F1F5F9; border-radius: 999px; overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #3B82F6 0%, #2563EB 100%); border-radius: 999px;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Feed de Últimas Ativações Compacto -->
        <div class="card" style="padding: 1.15rem 1.25rem; border: 1px solid #E2E8F0; border-radius: 14px; background: #FFFFFF; box-shadow: 0 2px 10px rgba(15,23,42,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
            <h3 style="font-size: 0.9rem; font-weight: 800; color: #0F172A; margin: 0; display: flex; align-items: center; gap: 6px;">
              ${getIcon('zap', '', 16)}
              <span>Últimas Placas Ativadas</span>
            </h3>
            <span class="badge" style="background: rgba(16,185,129,0.1); color: #059669; font-size: 0.65rem; font-weight: 700; padding: 2px 6px;">Ao Vivo</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${metrics.recentActivations.length === 0 ? `
              <div style="text-align: center; padding: 1.5rem; color: #94A3B8; font-size: 0.8125rem;">
                Nenhuma plaquinha ativada recentemente.
              </div>
            ` : metrics.recentActivations.map(p => {
              const actDate = p.activated_at ? new Date(p.activated_at) : null;
              const formattedTime = actDate ? `${actDate.toLocaleDateString('pt-BR')} às ${actDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Data não informada';
              return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
                  <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <span class="badge badge-primary" style="font-weight: 800; font-size: 0.7rem; flex-shrink: 0; padding: 2px 6px;">${escapeHtml(p.id)}</span>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      <div style="font-weight: 700; font-size: 0.8125rem; color: #0F172A; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name || 'Empresa Sem Nome')}</div>
                      <div style="font-size: 0.7rem; color: #64748B;">Ativado por: <strong style="color: #334155;">${escapeHtml(p.client_name || 'Desconhecido')}</strong></div>
                    </div>
                  </div>
                  <div style="text-align: right; flex-shrink: 0; margin-left: 8px;">
                    <div style="font-size: 0.65rem; color: #94A3B8; font-weight: 600;">${formattedTime}</div>
                    <div style="font-size: 0.72rem; color: #2563EB; font-weight: 700;">${p.scans_count || 0} scans</div>
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

// Renderizador do Card de Pódio Compacto (1º, 2º e 3º lugares)
function renderPodiumCard(client, rank) {
  if (!client) {
    return `
      <div class="card" style="padding: 1rem; border: 1px dashed #CBD5E1; border-radius: 12px; background: #F8FAFC; text-align: center; color: #94A3B8;">
        <span style="font-size: 0.75rem;">Posição #${rank} disponível</span>
      </div>
    `;
  }

  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;

  const medalEmoji = isFirst ? '🥇' : (isSecond ? '🥈' : '🥉');
  const badgeColor = isFirst 
    ? 'background: linear-gradient(135deg, #FEF08A 0%, #FACC15 100%); color: #854D0E; border: 1px solid #FDE047;'
    : (isSecond 
      ? 'background: linear-gradient(135deg, #F1F5F9 0%, #CBD5E1 100%); color: #334155; border: 1px solid #E2E8F0;'
      : 'background: linear-gradient(135deg, #FFEDD5 0%, #FDBA74 100%); color: #9A3412; border: 1px solid #FED7AA;');

  const cardBorder = isFirst ? 'border: 1.5px solid #FACC15;' : 'border: 1px solid #E2E8F0;';
  const cardBg = isFirst ? 'background: linear-gradient(180deg, #FEFCE8 0%, #FFFFFF 100%);' : 'background: #FFFFFF;';

  return `
    <div class="card" style="padding: 1rem 1.15rem; border-radius: 12px; ${cardBorder} ${cardBg} position: relative; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,0.02);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 1.25rem; line-height: 1;">${medalEmoji}</span>
          <span style="font-size: 0.6875rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 6px; border-radius: 5px; ${badgeColor}">
            ${rank}º Lugar
          </span>
        </div>
        <span style="font-size: 0.7rem; font-weight: 700; color: #64748B;">
          ${client.percentOfTotalActive}% do total
        </span>
      </div>

      <div style="margin-bottom: 0.75rem;">
        <h3 style="font-size: 0.95rem; font-weight: 800; color: #0F172A; margin: 0; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(client.name)}">
          ${escapeHtml(client.name)}
        </h3>
        <p style="font-size: 0.75rem; color: #64748B; margin: 2px 0 0 0;">
          ${client.phone ? formatPhone(client.phone) : 'Sem telefone'}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 7px 10px; background: rgba(15,23,42,0.03); border-radius: 8px; margin-bottom: 0.75rem;">
        <div>
          <span style="font-size: 0.625rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Ativações</span>
          <div style="font-size: 1.05rem; font-weight: 800; color: #0F172A; line-height: 1.1; margin-top: 1px;">
            ${client.activeCount} <span style="font-size: 0.6875rem; font-weight: 600; color: #64748B;">placas</span>
          </div>
        </div>
        <div>
          <span style="font-size: 0.625rem; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Scans</span>
          <div style="font-size: 1.05rem; font-weight: 800; color: #2563EB; line-height: 1.1; margin-top: 1px;">
            ${client.totalScans} <span style="font-size: 0.6875rem; font-weight: 600; color: #64748B;">leituras</span>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 6px;">
        <a href="#/todas-placas?client=${encodeURIComponent(client.name)}" class="btn btn-outline btn-xs" style="flex: 1; font-weight: 700; font-size: 0.72rem; justify-content: center; padding: 4px 8px; border-radius: 6px;">
          ${getIcon('grid', '', 12)}
          <span>Ver Placas</span>
        </a>
        ${client.code ? `
          <a href="#/cliente/${encodeURIComponent(client.code)}" target="_blank" class="btn btn-ghost btn-xs" style="font-weight: 700; font-size: 0.72rem; padding: 4px 6px; border-radius: 6px;" title="Ver Portal do Cliente">
            ${getIcon('externalLink', '', 12)}
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
        <td colspan="7" style="text-align: center; padding: 2rem; color: #94A3B8; font-size: 0.8125rem;">
          Nenhum cliente com placas ativadas até o momento.
        </td>
      </tr>
    `;
  }

  const topScore = clients[0].activeCount || 1;

  return clients.slice(0, 10).map((c, idx) => {
    const isTop3 = idx < 3;
    const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
    const barWidth = Math.max(4, Math.round((c.activeCount / topScore) * 100));

    return `
      <tr style="height: 44px; font-size: 0.8125rem;">
        <td style="text-align: center; font-weight: 800; font-size: 0.85rem; color: ${isTop3 ? '#0F172A' : '#64748B'}; padding: 6px 10px;">
          ${medal}
        </td>
        <td style="padding: 6px 10px;">
          <div style="font-weight: 700; color: #0F172A; line-height: 1.2;">
            ${escapeHtml(c.name)}
          </div>
          <div style="font-size: 0.6875rem; color: #94A3B8;">
            ${c.code ? `Código: <span style="font-family: monospace; font-weight: 700;">${escapeHtml(c.code)}</span>` : 'Sem código único'}
          </div>
        </td>
        <td style="padding: 6px 10px;">
          <span style="font-size: 0.75rem; color: #334155; font-weight: 600;">
            ${c.phone ? formatPhone(c.phone) : '<span style="color: #94A3B8;">Não informado</span>'}
          </span>
        </td>
        <td style="padding: 6px 10px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="flex: 1; height: 6px; background: #F1F5F9; border-radius: 999px; overflow: hidden;">
              <div style="width: ${barWidth}%; height: 100%; background: ${idx === 0 ? '#EAB308' : (idx === 1 ? '#94A3B8' : (idx === 2 ? '#F97316' : '#2563EB'))}; border-radius: 999px;"></div>
            </div>
            <span style="font-size: 0.65rem; font-weight: 700; color: #64748B; width: 32px; text-align: right;">${c.percentOfTotalActive}%</span>
          </div>
        </td>
        <td style="text-align: center; padding: 6px 10px;">
          <span class="badge" style="background: rgba(16,185,129,0.1); color: #059669; font-weight: 800; font-size: 0.75rem; padding: 2px 7px;">
            ${c.activeCount}
          </span>
        </td>
        <td style="text-align: center; font-weight: 700; font-size: 0.78rem; color: #2563EB; padding: 6px 10px;">
          ${c.totalScans}
        </td>
        <td style="text-align: right; padding: 6px 10px;">
          <div style="display: inline-flex; gap: 4px;">
            <a href="#/todas-placas?client=${encodeURIComponent(c.name)}" class="btn btn-outline btn-xs" style="font-weight: 700; font-size: 0.7rem; padding: 3px 6px; border-radius: 5px;" title="Ver Placas">
              ${getIcon('grid', '', 12)}
              <span>Placas</span>
            </a>
            ${c.code ? `
              <a href="#/cliente/${encodeURIComponent(c.code)}" target="_blank" class="btn btn-ghost btn-xs" style="padding: 3px 5px; border-radius: 5px;" title="Portal do Cliente">
                ${getIcon('externalLink', '', 12)}
              </a>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Renderizador do Gráfico SVG de Linha do Tempo Compacto
function renderTimelineSvgChart(timeline, maxVal, activeSeries) {
  const width = 720;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 32;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const count = timeline.length;
  const colWidth = chartWidth / count;

  // Grid horizontal com 4 linhas
  const gridLines = [0, 0.33, 0.66, 1];
  const gridHtml = gridLines.map(ratio => {
    const y = paddingTop + chartHeight * (1 - ratio);
    const labelVal = Math.round(maxVal * ratio);
    return `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#E2E8F0" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${paddingLeft - 6}" y="${y + 3.5}" fill="#94A3B8" font-size="9.5" font-weight="600" text-anchor="end" font-family="Montserrat, sans-serif">${labelVal}</text>
    `;
  }).join('');

  // Barras / Séries Compactas
  const barsHtml = timeline.map((item, i) => {
    const x = paddingLeft + i * colWidth;
    const barWidth = Math.max(12, colWidth * 0.40);

    const scansHeight = (item.scans / maxVal) * chartHeight;
    const actHeight = (item.activations / maxVal) * chartHeight;

    const scansY = paddingTop + (chartHeight - scansHeight);
    const actY = paddingTop + (chartHeight - actHeight);

    let barsContent = '';

    if (activeSeries === 'scans') {
      const centerX = x + (colWidth - barWidth) / 2;
      barsContent = `
        <rect x="${centerX}" y="${scansY}" width="${barWidth}" height="${scansHeight}" rx="3" fill="url(#blueBarGrad)" class="chart-bar" />
      `;
    } else if (activeSeries === 'activations') {
      const centerX = x + (colWidth - barWidth) / 2;
      barsContent = `
        <rect x="${centerX}" y="${actY}" width="${barWidth}" height="${actHeight}" rx="3" fill="url(#greenBarGrad)" class="chart-bar" />
      `;
    } else {
      // Ambos lado a lado
      const halfWidth = (barWidth / 2) + 1;
      const x1 = x + (colWidth / 2) - halfWidth - 1;
      const x2 = x + (colWidth / 2) + 1;

      barsContent = `
        <rect x="${x1}" y="${scansY}" width="${halfWidth}" height="${scansHeight}" rx="2.5" fill="url(#blueBarGrad)" class="chart-bar" />
        <rect x="${x2}" y="${actY}" width="${halfWidth}" height="${actHeight}" rx="2.5" fill="url(#greenBarGrad)" class="chart-bar" />
      `;
    }

    // Label no eixo X
    const labelX = x + colWidth / 2;
    const labelY = height - 10;
    const isToday = item.isToday;

    return `
      <g class="chart-col-group" style="cursor: pointer;">
        <!-- Área transparente para capturar hover com tooltip nativo SVG -->
        <rect x="${x}" y="${paddingTop}" width="${colWidth}" height="${chartHeight}" fill="transparent">
          <title>${item.label}: ${item.scans} leituras | ${item.activations} ativações</title>
        </rect>
        ${barsContent}
        <text x="${labelX}" y="${labelY}" fill="${isToday ? '#2563EB' : '#64748B'}" font-size="9.5" font-weight="${isToday ? '800' : '600'}" text-anchor="middle" font-family="Montserrat, sans-serif">
          ${item.shortLabel}
        </text>
        ${isToday ? `<circle cx="${labelX}" cy="${labelY + 6}" r="1.5" fill="#2563EB" />` : ''}
      </g>
    `;
  }).join('');

  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible; font-family: Montserrat, sans-serif;">
      <defs>
        <linearGradient id="blueBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3B82F6" />
          <stop offset="100%" stop-color="#1D4ED8" />
        </linearGradient>
        <linearGradient id="greenBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#34D399" />
          <stop offset="100%" stop-color="#059669" />
        </linearGradient>
      </defs>
      
      <!-- Linhas do Grid -->
      ${gridHtml}

      <!-- Eixo X Base -->
      <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="#CBD5E1" stroke-width="1.2" />

      <!-- Barras -->
      ${barsHtml}
    </svg>
  `;
}

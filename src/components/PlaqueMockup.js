import { generateQRCodeDataUrl, generatePlaqueDesignSvg } from '../services/qrGenerator.js';
import { downloadSvg, downloadPng } from '../services/exporter.js';

export async function renderPlaqueMockup(plaque, currentStyle = 'crystal') {
  const qrDataUrl = await generateQRCodeDataUrl(plaque.id, 400);
  const isVirgin = plaque.status === 'virgin';
  const companyName = plaque.name || (isVirgin ? 'Placa Pronta p/ Ativação' : 'Sua Empresa Aqui');
  
  const styleClass = 
    currentStyle === 'black' ? 'plaque-style-black' :
    currentStyle === 'white' ? 'plaque-style-white' : 'plaque-style-crystal';

  return `
    <div class="flex flex-col items-center">
      
      <!-- Seletor de Estilo do Acrílico -->
      <div class="flex items-center gap-2 mb-4 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl">
        <button class="btn-style-select px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
          currentStyle === 'crystal' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
        }" data-style="crystal">
          💎 Acrílico Cristal
        </button>
        <button class="btn-style-select px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
          currentStyle === 'black' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
        }" data-style="black">
          🖤 Black Piano
        </button>
        <button class="btn-style-select px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
          currentStyle === 'white' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
        }" data-style="white">
          ⚪ Branco Clean
        </button>
      </div>

      <!-- Simulador Físico da Placa 3D -->
      <div class="plaque-acrylic-container">
        <div class="plaque-stand ${styleClass}" id="mockup-stand-card">
          
          <!-- Topo: Google G Logo Oficial -->
          <div class="flex flex-col items-center gap-1.5 mt-2">
            <svg class="w-8 h-8 drop-shadow" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>

            <!-- 5 Estrelas Douradas -->
            <div class="star-rating">
              ${[1, 2, 3, 4, 5].map(() => `
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              `).join('')}
            </div>
          </div>

          <!-- Chamada Principal -->
          <div class="text-center my-1">
            <h4 class="text-sm font-extrabold uppercase tracking-tight leading-tight">Avalie nossa empresa</h4>
            <p class="text-[11px] opacity-75 font-medium">Aponte a câmera do seu celular</p>
          </div>

          <!-- QR Code Centralizado em Box Branco Físico -->
          <div class="plaque-qr-box">
            <img src="${qrDataUrl}" alt="QR Code ${plaque.id}" class="w-36 h-36 object-contain" />
          </div>

          <!-- Nome da Empresa / Rodapé com ID da Placa -->
          <div class="text-center w-full mt-1">
            <p class="text-xs font-bold truncate max-w-[200px] mx-auto text-blue-500 mb-1">${companyName}</p>
            <div class="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-500/15 border border-slate-400/20 text-[10px] font-mono font-bold tracking-wider opacity-85">
              ${plaque.id}
            </div>
          </div>

          <!-- Base Física de Acrílico (Apoio de Mesa) -->
          <div class="plaque-base"></div>
        </div>
      </div>

      <!-- Ações de Download do Mockup -->
      <div class="flex items-center gap-3 mt-6">
        <button id="btn-download-svg-single" class="btn btn-secondary btn-sm flex items-center gap-2">
          <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Baixar SVG (Corte Laser)</span>
        </button>

        <button id="btn-download-png-single" class="btn btn-primary btn-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Baixar PNG (300 DPI)</span>
        </button>
      </div>

    </div>
  `;
}

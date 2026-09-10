import QRCode from 'qrcode';
import { getPlaqueRedirectUrl } from '../utils/helpers.js';

/**
 * Gera QR Code em formato PNG 100% QUADRADO (1:1 - 1000x1000px)
 * - QR Code GRANDE maximizando o espaço útil do quadrado.
 * - Margens finas e uniformes.
 * - Escrita do ID posicionada bem próxima da margem inferior do QR Code, pequena e discreta.
 */
export async function generateCleanQRCodePng(plaqueId, size = 1000, includeLabel = true) {
  const url = getPlaqueRedirectUrl(plaqueId);

  // 1. Cria canvas 100% QUADRADO (largura = altura = size)
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = size;
  finalCanvas.height = size;
  const ctx = finalCanvas.getContext('2d');

  // Fundo branco sólido
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  if (!includeLabel) {
    // Modo puro: QR Code maximizado
    const qrSize = Math.round(size * 0.92);
    const offset = Math.round((size - qrSize) / 2);
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, url, {
      width: qrSize,
      margin: 0,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'Q'
    });
    ctx.drawImage(qrCanvas, offset, offset);
    return finalCanvas.toDataURL('image/png', 1.0);
  }

  // 2. Modo com ID rente à margem:
  // QR Code ocupa ~88% do espaço, posicionado bem no topo/centro
  const qrSize = Math.round(size * 0.88); // 880px para canvas de 1000px
  const qrX = Math.round((size - qrSize) / 2); // 60px
  const qrY = Math.round(size * 0.045); // 45px (termina em 45 + 880 = 925px)

  const qrCanvas = document.createElement('canvas');
  await QRCode.toCanvas(qrCanvas, url, {
    width: qrSize,
    margin: 0,
    color: { dark: '#000000', light: '#FFFFFF' },
    errorCorrectionLevel: 'Q'
  });

  // Desenha o QR Code
  ctx.drawImage(qrCanvas, qrX, qrY);

  // 3. Escrita do ID bem próxima da margem inferior do QR Code
  const textY = Math.round(size * 0.962); // 962px (logo abaixo do QR Code)
  const fontSize = Math.round(size * 0.026); // 26px (pequeno, elegante e nítido)

  ctx.fillStyle = '#334155';
  ctx.font = `bold ${fontSize}px 'JetBrains Mono', 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.fillText(plaqueId, size / 2, textY);

  return finalCanvas.toDataURL('image/png', 1.0);
}

/**
 * Gera QR Code em formato vetorial SVG 100% QUADRADO (viewBox="0 0 1000 1000")
 * - QR Code grande
 * - Escrita do ID rente à margem inferior
 */
export async function generateCleanQRCodeSvg(plaqueId, includeLabel = true) {
  const url = getPlaqueRedirectUrl(plaqueId);
  
  const qrSvgRaw = await QRCode.toString(url, {
    type: 'svg',
    margin: 0,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'Q'
  });

  const qrInnerMatch = qrSvgRaw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const qrInner = qrInnerMatch ? qrInnerMatch[1] : '';

  if (!includeLabel) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="1000" height="1000" fill="#FFFFFF" />
  <svg x="40" y="40" width="920" height="920" viewBox="0 0 1000 1000">
    ${qrInner}
  </svg>
</svg>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <!-- Fundo 100% Quadrado Branco -->
  <rect width="1000" height="1000" fill="#FFFFFF" />
  
  <!-- QR Code Grande Centralizado (880x880) -->
  <svg x="60" y="45" width="880" height="880" viewBox="0 0 1000 1000">
    ${qrInner}
  </svg>

  <!-- Escrita do ID Rente à Margem Inferior do QR Code -->
  <text x="500" y="962" font-family="'JetBrains Mono', 'Courier New', monospace" font-weight="700" font-size="26" fill="#334155" text-anchor="middle" letter-spacing="2">
    ${plaqueId}
  </text>
</svg>`;
}

// Aliases para máxima compatibilidade entre componentes
export const generateQRCodeDataUrl = generateCleanQRCodePng;
export const generatePlaqueDesignSvg = generateCleanQRCodeSvg;


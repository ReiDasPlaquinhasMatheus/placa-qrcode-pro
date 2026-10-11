import QRCode from 'qrcode';
import { getPlaqueRedirectUrl, isInstagramPlaque } from '../utils/helpers.js';

// Auxiliar para desenhar retângulo arredondado com suporte cross-browser no Canvas
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

// Renderiza o ícone do Instagram em Preto Sólido no Canvas
function drawInstagramSolidLogoCanvas(ctx, cx, cy, qrSize) {
  // 1. Zona de respiro branca (Quiet Zone)
  const badgeSize = Math.round(qrSize * 0.22); // ~194px para QR de 880px
  const badgeRadius = Math.round(badgeSize * 0.22); // ~42px
  const badgeX = cx - badgeSize / 2;
  const badgeY = cy - badgeSize / 2;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, badgeRadius);
  ctx.fill();

  // 2. Ícone Instagram em Preto Sólido
  const iconSize = Math.round(qrSize * 0.155); // ~136px
  const iconRadius = Math.round(iconSize * 0.28); // ~38px
  const strokeW = Math.max(5, Math.round(iconSize * 0.082)); // ~11px
  const iconX = cx - iconSize / 2;
  const iconY = cy - iconSize / 2;

  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = strokeW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Moldura quadrada arredondada
  drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, iconRadius);
  ctx.stroke();

  // Lente central circular
  const lensRadius = Math.round(iconSize * 0.23); // ~31px
  ctx.beginPath();
  ctx.arc(cx, cy, lensRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Ponto do flash superior direito
  const dotRadius = Math.max(3, Math.round(strokeW * 0.65)); // ~7px
  const dotOffset = Math.round(iconSize * 0.26); // ~35px
  ctx.beginPath();
  ctx.arc(cx + dotOffset, cy - dotOffset, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Retorna os elementos vetoriais SVG do logotipo Instagram em Preto Sólido
function getInstagramSolidLogoSvg(cx, cy, qrSize) {
  const badgeSize = Math.round(qrSize * 0.22);
  const badgeRadius = Math.round(badgeSize * 0.22);
  const badgeX = cx - badgeSize / 2;
  const badgeY = cy - badgeSize / 2;

  const iconSize = Math.round(qrSize * 0.155);
  const iconRadius = Math.round(iconSize * 0.28);
  const strokeW = Math.max(5, Math.round(iconSize * 0.082));
  const iconX = cx - iconSize / 2;
  const iconY = cy - iconSize / 2;

  const lensRadius = Math.round(iconSize * 0.23);
  const dotRadius = Math.max(3, Math.round(strokeW * 0.65));
  const dotOffset = Math.round(iconSize * 0.26);

  return `
  <!-- Zona de Respiro Branca Central -->
  <rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeRadius}" ry="${badgeRadius}" fill="#FFFFFF" />

  <!-- Logotipo Instagram Preto Sólido (Vetor Puro para Corte Laser e Gráfica) -->
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${iconRadius}" ry="${iconRadius}" fill="none" stroke="#000000" stroke-width="${strokeW}" stroke-linejoin="round" />
  <circle cx="${cx}" cy="${cy}" r="${lensRadius}" fill="none" stroke="#000000" stroke-width="${strokeW}" />
  <circle cx="${cx + dotOffset}" cy="${cy - dotOffset}" r="${dotRadius}" fill="#000000" />
  `;
}

/**
 * Gera QR Code em formato PNG 100% QUADRADO (1:1 - 1000x1000px)
 * - QR Code GRANDE maximizando o espaço útil do quadrado.
 * - Margens finas e uniformes.
 * - Suporte opcional ao símbolo do Instagram em preto sólido centralizado.
 * - Escrita do ID posicionada bem próxima da margem inferior do QR Code, pequena e discreta.
 */
export async function generateCleanQRCodePng(plaqueId, size = 1000, includeLabel = true, options = {}) {
  const cleanId = typeof plaqueId === 'object' ? (plaqueId.id || '') : String(plaqueId || '');
  const url = getPlaqueRedirectUrl(cleanId);
  const hasInstagramLogo = options.logo === 'instagram' || isInstagramPlaque(plaqueId);

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
      errorCorrectionLevel: hasInstagramLogo ? 'H' : 'Q'
    });
    ctx.drawImage(qrCanvas, offset, offset);

    if (hasInstagramLogo) {
      drawInstagramSolidLogoCanvas(ctx, size / 2, size / 2, qrSize);
    }

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
    errorCorrectionLevel: hasInstagramLogo ? 'H' : 'Q'
  });

  // Desenha o QR Code
  ctx.drawImage(qrCanvas, qrX, qrY);

  // Se for Instagram, desenha o logo no centro exato do QR Code
  if (hasInstagramLogo) {
    const cx = qrX + qrSize / 2;
    const cy = qrY + qrSize / 2;
    drawInstagramSolidLogoCanvas(ctx, cx, cy, qrSize);
  }

  // 3. Escrita do ID bem próxima da margem inferior do QR Code
  const textY = Math.round(size * 0.962); // 962px (logo abaixo do QR Code)
  const fontSize = Math.round(size * 0.026); // 26px (pequeno, elegante e nítido)

  ctx.fillStyle = '#334155';
  ctx.font = `bold ${fontSize}px 'Montserrat', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '2px';
  ctx.fillText(cleanId, size / 2, textY);

  return finalCanvas.toDataURL('image/png', 1.0);
}

/**
 * Gera QR Code em formato vetorial SVG 100% QUADRADO (viewBox="0 0 1000 1000")
 * - QR Code grande
 * - Suporte opcional ao símbolo do Instagram em vetor puro no centro
 * - Escrita do ID rente à margem inferior
 */
export async function generateCleanQRCodeSvg(plaqueId, includeLabel = true, options = {}) {
  const cleanId = typeof plaqueId === 'object' ? (plaqueId.id || '') : String(plaqueId || '');
  const url = getPlaqueRedirectUrl(cleanId);
  const hasInstagramLogo = options.logo === 'instagram' || isInstagramPlaque(plaqueId);
  
  const qrSvgRaw = await QRCode.toString(url, {
    type: 'svg',
    margin: 0,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: hasInstagramLogo ? 'H' : 'Q'
  });

  const qrInnerMatch = qrSvgRaw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  const qrInner = qrInnerMatch ? qrInnerMatch[1] : '';
  // O desenho do QR vem em unidades de módulo (ex: 0 0 29 29). Usar esse
  // viewBox é o que faz o QR ocupar a área toda; com 0 0 1000 1000 ele
  // saía minúsculo no canto superior esquerdo do arquivo.
  const qrViewBoxMatch = qrSvgRaw.match(/viewBox="([^"]+)"/i);
  const qrViewBox = qrViewBoxMatch ? qrViewBoxMatch[1] : '0 0 1000 1000';

  if (!includeLabel) {
    const qrSize = 920;
    const cx = 500;
    const cy = 500;
    const logoSvg = hasInstagramLogo ? getInstagramSolidLogoSvg(cx, cy, qrSize) : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <rect width="1000" height="1000" fill="#FFFFFF" />
  <svg x="40" y="40" width="920" height="920" viewBox="${qrViewBox}" shape-rendering="crispEdges">
    ${qrInner}
  </svg>${logoSvg}
</svg>`;
  }

  const qrSize = 880;
  const cx = 500;
  const cy = 485;
  const logoSvg = hasInstagramLogo ? getInstagramSolidLogoSvg(cx, cy, qrSize) : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <!-- Fundo 100% Quadrado Branco -->
  <rect width="1000" height="1000" fill="#FFFFFF" />
  
  <!-- QR Code Grande Centralizado (880x880) -->
  <svg x="60" y="45" width="880" height="880" viewBox="${qrViewBox}" shape-rendering="crispEdges">
    ${qrInner}
  </svg>
${logoSvg}
  <!-- Escrita do ID Rente à Margem Inferior do QR Code -->
  <text x="500" y="962" font-family="'Montserrat', sans-serif" font-weight="700" font-size="26" fill="#334155" text-anchor="middle" letter-spacing="2">
    ${cleanId}
  </text>
</svg>`;
}

// Aliases para máxima compatibilidade entre componentes
export const generateQRCodeDataUrl = generateCleanQRCodePng;
export const generatePlaqueDesignSvg = generateCleanQRCodeSvg;

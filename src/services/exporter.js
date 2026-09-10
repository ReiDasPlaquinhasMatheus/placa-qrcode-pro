import JSZip from 'jszip';
import { generateCleanQRCodePng, generateCleanQRCodeSvg } from './qrGenerator.js';

// Baixar um único arquivo SVG
export function downloadSvg(svgContent, filename = 'qrcode.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Baixar um único arquivo PNG
export function downloadPng(dataUrl, filename = 'qrcode.png') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Exportação instantânea em CSV de alta velocidade para lotes massivos (10.000+ placas)
export function exportBatchCsv(plaques, filename = 'plaquinhas-export.csv') {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://suaplaca.com';
  let csv = 'ID da Placa,Nome da Empresa,Status,PIN de Seguranca,Link Direcionado,Lote,Nome do Cliente,Telefone,Codigo de Acesso,Scans,Criado Em,Ativado Em\n';

  for (let i = 0; i < plaques.length; i++) {
    const p = plaques[i];
    csv += `"${p.id}","${(p.name || 'Virgem').replace(/"/g, '""')}","${p.status}","${p.pin || ''}","${origin}/r/${p.id}","${(p.batch_name || 'Geral').replace(/"/g, '""')}","${(p.client_name || '').replace(/"/g, '""')}","${p.client_phone || ''}","${p.client_code || ''}",${p.scans_count || 0},"${p.created_at || ''}","${p.activated_at || ''}"\n`;
  }

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Exportar Lote em arquivo ZIP com Proteção de Memória e Chunking Assíncrono
export async function exportBatchZip(plaques, batchName = 'Lote-QRCodes', onProgress = () => {}) {
  const total = plaques.length;

  // Se o lote for muito massivo (> 500 imagens de 1000px), avisa e limita para não estourar RAM do navegador
  if (total > 500) {
    const proceed = confirm(`Atenção: Você está tentando exportar ${total} imagens de alta resolução em um único arquivo ZIP.\n\nIsso pode consumir bastante memória do navegador.\n\nDeseja continuar com o download do ZIP completo? (Dica: Você também pode usar a exportação rápida em CSV).`);
    if (!proceed) return;
  }

  const zip = new JSZip();
  const folderPng = zip.folder('QRCodes-PNG-Alta-Resolucao');
  const folderSvg = zip.folder('QRCodes-SVG-Vetoriais');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let csvContent = 'ID da Placa,Nome da Empresa,Status,PIN de Seguranca,Link Direcionado,Lote\n';

  for (let i = 0; i < total; i++) {
    const plaque = plaques[i];
    onProgress(i + 1, total, plaque.id);

    // 1. Gera PNG em Alta Resolução (1000px com ID no rodapé)
    const qrPngUrl = await generateCleanQRCodePng(plaque.id, 1000, true);
    if (qrPngUrl) {
      const qrBase64 = qrPngUrl.split(',')[1];
      folderPng.file(`${plaque.id}-qrcode.png`, qrBase64, { base64: true });
    }

    // 2. Gera SVG Vetorial
    const svgContent = await generateCleanQRCodeSvg(plaque.id, true);
    folderSvg.file(`${plaque.id}-qrcode.svg`, svgContent);

    csvContent += `"${plaque.id}","${plaque.name || 'Virgem'}","${plaque.status}","${plaque.pin || ''}","${origin}/r/${plaque.id}","${plaque.batch_name || batchName}"\n`;

    // Cede o controle ao event loop a cada 20 itens para manter a UI fluida
    if (i % 20 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Adiciona CSV de controle
  zip.file(`Controle-${batchName}.csv`, csvContent);

  // Instruções simples
  const readme = `LOTE DE QR CODES DINÂMICOS
===========================================
Nome do Lote: ${batchName}
Total de QR Codes: ${total}
Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}

Arquivos neste pacote:
- Pasta 'QRCodes-PNG-Alta-Resolucao': Imagens em 1000x1000px (100% Quadradas 1:1) com identificador interno prontas para impressão e serigrafia.
- Pasta 'QRCodes-SVG-Vetoriais': Vetores quadrados infinitamente escaláveis para gráfica, corte laser e serigrafia.
- Arquivo 'Controle.csv': Tabela com os IDs, links e PINs de segurança.
`;
  zip.file('LEIA-ME.txt', readme);

  // Gera e dispara download
  const blob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${batchName}-${total}-qrcodes.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

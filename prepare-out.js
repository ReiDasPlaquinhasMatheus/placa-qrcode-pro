// Script de Preparação do Pacote de Produção (out / out.zip)
// Compatível com Hostinger, cPanel, Apache, Netlify, Vercel e Servidores VPS
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Iniciando preparação do pacote de produção "out"...');

// 1. Executa Vite Build
console.log('📦 1/5 Compilando projeto via Vite...');
execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });

const outDir = path.join(__dirname, 'out');
const distDir = path.join(__dirname, 'dist');
const desktopDir = path.join(os.homedir(), 'Desktop');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 2. Cria arquivo .htaccess para Apache / LiteSpeed (Hostinger / cPanel)
console.log('⚙️  2/5 Configurando regras de roteamento (.htaccess e _redirects)...');
const htaccessContent = `# ========================================================================
# REGRAS DE ROTEAMENTO SPA (PLACA QR CODE PRO) - HOSTINGER / CPANEL / APACHE
# ========================================================================
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Caching e Desempenho
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set X-Frame-Options "SAMEORIGIN"
  Header set X-XSS-Protection "1; mode=block"

  # Cache longo para arquivos com hash único
  <FilesMatch "\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
    Header set Cache-Control "max-age=31536000, public"
  </FilesMatch>

  # HTML sempre atualizado
  <FilesMatch "index\\.html$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires 0
  </FilesMatch>
</IfModule>
`;
fs.writeFileSync(path.join(outDir, '.htaccess'), htaccessContent, 'utf-8');

// 3. Fallback 404.html e _redirects para Netlify/Cloudflare/GitHub Pages
if (fs.existsSync(path.join(outDir, 'index.html'))) {
  fs.copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
}
fs.writeFileSync(path.join(outDir, '_redirects'), '/*    /index.html   200\n', 'utf-8');

// 4. Cria arquivo COMO_SUBIR_NA_HOSTINGER.txt dentro da pasta out
const guideContent = `========================================================================
 GUIA RÁPIDO: COMO SUBIR A PASTA OUT NA SUA HOSPEDAGEM (HOSTINGER / CPANEL)
========================================================================

Este pacote contém o sistema "Placa QR Code Pro" 100% compilado e otimizado.

COMO PUBLICAR NA HOSTINGER:
1. Acesse o seu hPanel (hpanel.hostinger.com) da Hostinger.
2. Vá em "Sites" -> clique em "Gerenciar" no seu domínio.
3. Abra o "Gerenciador de Arquivos" (File Manager) e entre na pasta:
   👉 public_html (ou a pasta do seu subdomínio)
4. Faça o upload do arquivo "out.zip" (ou "placa-qrcode-pro-out.zip") que foi
   gerado diretamente na sua Área de Trabalho (Desktop).
5. Clique com o botão direito no arquivo zip e selecione "Extrair" (Extract).
   ⚠️ Atenção: Certifique-se de extrair o CONTEÚDO diretamente dentro de public_html
   (para que o index.html fique em public_html/index.html).
6. Se sobrar o arquivo .zip após extrair, você pode apagá-lo.
7. Pronto! Acesse seu domínio no navegador.

O QUE JÁ ESTÁ INCLUSO:
- O novo logotipo oficial configurado.
- Todas as fontes Montserrat carregadas.
- Portal do cliente atualizado com fundo azul e design moderno.
- Tabela de placas espaçada e formatada.
- Sincronização em nuvem via Supabase com suporte a mais de 1.500 placas.
- Arquivo .htaccess para navegação limpa sem erro 404 em nenhuma rota.
========================================================================
`;
fs.writeFileSync(path.join(outDir, 'COMO_SUBIR_NA_HOSTINGER.txt'), guideContent, 'utf-8');

// 5. Sincroniza com a pasta dist (para garantir compatibilidade máxima)
console.log('🔄 3/5 Sincronizando pasta dist com out...');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  const files = fs.readdirSync(source);
  files.forEach(file => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);
    if (fs.lstatSync(curSource).isDirectory()) {
      copyFolderRecursiveSync(curSource, curTarget);
    } else {
      fs.copyFileSync(curSource, curTarget);
    }
  });
}
copyFolderRecursiveSync(outDir, distDir);

// 6. Compacta a pasta out em arquivo ZIP usando JSZip
console.log('🗜️  4/5 Gerando arquivo out.zip compactado...');
async function generateZip() {
  const zip = new JSZip();

  function addFolderToZip(folderPath, zipFolder) {
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const fullPath = path.join(folderPath, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const subZip = zipFolder.folder(file);
        addFolderToZip(fullPath, subZip);
      } else {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(file, content);
      }
    }
  }

  addFolderToZip(outDir, zip);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  // Salva no projeto: out.zip
  const projectZipPath = path.join(__dirname, 'out.zip');
  fs.writeFileSync(projectZipPath, zipBuffer);
  console.log(`   ✅ Arquivo local criado: ${projectZipPath} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);

  // Salva na Área de Trabalho (Desktop) se existir
  if (fs.existsSync(desktopDir)) {
    const desktopZip1 = path.join(desktopDir, 'out.zip');
    const desktopZip2 = path.join(desktopDir, 'placa-qrcode-pro-out.zip');
    fs.writeFileSync(desktopZip1, zipBuffer);
    fs.writeFileSync(desktopZip2, zipBuffer);
    console.log(`   ✅ Arquivo na Área de Trabalho: ${desktopZip1}`);
    console.log(`   ✅ Arquivo na Área de Trabalho: ${desktopZip2}`);
  }
}

generateZip().then(() => {
  console.log('\n🎉 5/5 Concluído com sucesso!');
  console.log('---------------------------------------------------------');
  console.log('📁 Pasta out: ' + outDir);
  console.log('📁 Arquivo out.zip: ' + path.join(__dirname, 'out.zip'));
  if (fs.existsSync(desktopDir)) {
    console.log('🖥️  Área de Trabalho: ' + path.join(desktopDir, 'placa-qrcode-pro-out.zip'));
  }
  console.log('---------------------------------------------------------');
}).catch(err => {
  console.error('❌ Erro ao gerar zip:', err);
  process.exit(1);
});

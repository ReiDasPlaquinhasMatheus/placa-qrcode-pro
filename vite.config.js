import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve(__dirname, 'server-db.json');

// Inicializa banco de dados local compartilhado (Produção limpa a partir do zero)
function getInitialDb() {
  return [];
}

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return getInitialDb();
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao escrever no banco local:', err);
  }
}

// Plugin de API Compartilhada para Rede Local (PC + Celular sincronizados)
function localNetworkApiPlugin() {
  return {
    name: 'local-network-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;

        // Interceptador de Redirecionamento Dinâmico de QR Code /r/:id
        if (url.startsWith('/r/')) {
          const plaqueId = url.replace('/r/', '').split('?')[0].trim().toUpperCase();
          const plaques = readDb();
          const index = plaques.findIndex(p => p.id.toUpperCase() === plaqueId);

          if (index >= 0) {
            const plaque = plaques[index];
            if (plaque.status === 'active' && plaque.target_url && (plaque.target_url.startsWith('http://') || plaque.target_url.startsWith('https://'))) {
              // Incrementa contagem de visualizações/scans
              plaque.scans_count = (plaque.scans_count || 0) + 1;
              plaque.last_scan_at = new Date().toISOString();
              writeDb(plaques);

              res.statusCode = 302;
              res.setHeader('Location', plaque.target_url);
              return res.end();
            }
          }

          // Se for virgem ou inválida: redireciona para ativação
          res.statusCode = 302;
          res.setHeader('Location', `/#/activate/${plaqueId}`);
          return res.end();
        }

        // Endpoint GET /api/plaques
        if (url === '/api/plaques' && req.method === 'GET') {
          const plaques = readDb();
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(JSON.stringify(plaques));
        }

        // Endpoint POST /api/plaques (Salvar/Ativar/Atualizar)
        if (url === '/api/plaques' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const updatedPlaque = JSON.parse(body);
              const plaques = readDb();
              const index = plaques.findIndex(p => p.id.toUpperCase() === updatedPlaque.id.toUpperCase());

              if (index >= 0) {
                plaques[index] = { ...plaques[index], ...updatedPlaque };
              } else {
                plaques.unshift(updatedPlaque);
              }

              writeDb(plaques);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.end(JSON.stringify({ success: true, plaque: updatedPlaque }));
            } catch (err) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // Endpoint POST /api/plaques/batch
        if (url === '/api/plaques/batch' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const newPlaques = JSON.parse(body);
              const plaques = readDb();
              const merged = [...newPlaques, ...plaques];
              writeDb(merged);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.end(JSON.stringify({ success: true, count: merged.length }));
            } catch (err) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // Endpoint POST /api/plaques/sync (substitui tudo no restore)
        if (url === '/api/plaques/sync' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const allPlaques = JSON.parse(body);
              writeDb(allPlaques);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.end(JSON.stringify({ success: true, count: allPlaques.length }));
            } catch (err) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // Endpoint POST /api/plaques/reset (Zerar tudo)
        if (url === '/api/plaques/reset' && req.method === 'POST') {
          writeDb([]);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(JSON.stringify({ success: true, count: 0 }));
        }

        // Endpoint DELETE /api/batches/:name
        if (url.startsWith('/api/batches/') && req.method === 'DELETE') {
          const rawBatchName = decodeURIComponent(url.replace('/api/batches/', '').split('?')[0]);
          const plaques = readDb();
          const filtered = plaques.filter(p => (p.batch_name || 'Lote Geral').trim().toLowerCase() !== rawBatchName.trim().toLowerCase());
          writeDb(filtered);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(JSON.stringify({ success: true, deleted: plaques.length - filtered.length, remaining: filtered.length }));
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [localNetworkApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});

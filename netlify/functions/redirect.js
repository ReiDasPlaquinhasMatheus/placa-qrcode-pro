// Netlify Serverless Function: Redirecionamento instantâneo e seguro de QR Code
// Conecta com o Supabase Cloud para consultar e atualizar a contagem de scans em tempo real.

function isValidHttpUrl(string) {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (!url.hostname || url.hostname.length < 3) return false;
    return true;
  } catch (_) {
    return false;
  }
}

export async function handler(event, context) {
  const plaqueId = event.queryStringParameters?.id || event.path.split('/').pop();

  if (!plaqueId) {
    return {
      statusCode: 400,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      },
      body: '<h1>ID de Plaquinha não informado.</h1>'
    };
  }

  const normalizedId = String(plaqueId).trim().toUpperCase();
  const origin = event.headers.host 
    ? (event.headers['x-forwarded-proto'] || 'https') + '://' + event.headers.host 
    : '';

  // 1. Credenciais do Supabase (anon key — pública por design)
  const supabaseUrl = process.env.SUPABASE_URL || 'https://zhxtmrhrbtqbsjcbvaim.supabase.co';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_qzS4vaixU3R0ILND8ejg0g_O-1_Rx2V';

  if (supabaseUrl && supabaseKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      // Usa a função RPC public_record_scan: o incremento do contador e a
      // leitura do destino acontecem atomicamente dentro do banco, sem
      // precisar de SELECT + PATCH livres na tabela com a anon key.
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/public_record_scan`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_id: normalizedId })
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const result = Array.isArray(data) ? data[0] : data;

        if (result && result.status === 'active' && result.target_url && isValidHttpUrl(result.target_url)) {
          return {
            statusCode: 302,
            headers: {
              'Location': result.target_url,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Content-Type-Options': 'nosniff'
            },
            body: ''
          };
        }
      }
    } catch (err) {
      console.error('Erro na consulta do Supabase na Serverless Function:', err);
    }
  }

  // 2. Se a placa for virgem, inexistente ou link inválido: redireciona para ativação
  const activationUrl = `${origin}/#/activate/${encodeURIComponent(normalizedId)}`;

  return {
    statusCode: 302,
    headers: {
      'Location': activationUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    },
    body: ''
  };
}

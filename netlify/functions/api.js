// Netlify Serverless API para gerenciamento de placas e sincronização opcional
export async function handler(event, context) {
  const method = event.httpMethod;
  const path = event.path;

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'online',
      service: 'Placa QR Code Pro API',
      timestamp: new Date().toISOString()
    })
  };
}

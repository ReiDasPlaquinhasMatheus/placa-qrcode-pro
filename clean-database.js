// Script para limpeza total e início limpo do banco de dados (Produção do Zero)
const SUPABASE_URL = 'https://zhxtmrhrbtqbsjcbvaim.supabase.co';
const SUPABASE_KEY = 'sb_publishable_qzS4vaixU3R0ILND8ejg0g_O-1_Rx2V';

async function cleanProductionDatabase() {
  console.log('===============================================================');
  console.log('🧹 INICIANDO LIMPEZA TOTAL DO BANCO DE DADOS (START FROM ZERO)');
  console.log('===============================================================');

  try {
    // 1. Consulta registros atuais no Supabase
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/plaques?select=id,name,batch_name`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (checkRes.ok) {
      const records = await checkRes.json();
      console.log(`📊 Registros de teste encontrados no Supabase: ${records.length}`);

      if (records.length > 0) {
        console.log('🗑️ Excluindo todos os registros de teste da nuvem...');
        const delRes = await fetch(`${SUPABASE_URL}/rest/v1/plaques?id=neq.ZZZZZZ`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
        console.log(`✅ Resposta da exclusão no Supabase Cloud: Status ${delRes.status}`);
      } else {
        console.log('✅ Supabase Cloud já está 100% limpo (0 registros).');
      }
    } else {
      console.warn(`Aviso: Supabase retornou status ${checkRes.status}.`);
    }

    // 2. Confirmação final no Supabase
    const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/plaques?select=id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (verifyRes.ok) {
      const remaining = await verifyRes.json();
      console.log(`🔍 Total final de placas no Supabase: ${remaining.length}`);
      if (remaining.length === 0) {
        console.log('🏆 BANCO NA NUVEM SUPABASE 100% LIMPO E ZERADO COM SUCESSO!');
      }
    }
  } catch (err) {
    console.error('Erro ao limpar Supabase:', err);
  }
}

cleanProductionDatabase();

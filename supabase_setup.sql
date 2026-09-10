-- =======================================================
-- SCHEMA SQL: Placa QR Code Pro
-- Execute este script no SQL Editor do seu painel Supabase
-- (https://supabase.com/dashboard/project/zhxtmrhrbtqbsjcbvaim/sql)
-- =======================================================

-- 1. Criação da tabela de placas (com suporte a Clientes/Compradores)
CREATE TABLE IF NOT EXISTS public.plaques (
    id TEXT PRIMARY KEY,
    name TEXT DEFAULT '',
    status TEXT DEFAULT 'virgin' CHECK (status IN ('virgin', 'active')),
    target_url TEXT DEFAULT '',
    pin TEXT DEFAULT '',
    client_name TEXT DEFAULT '',
    client_phone TEXT DEFAULT '',
    client_code TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    scans_count BIGINT DEFAULT 0,
    last_scan_at TIMESTAMPTZ,
    batch_name TEXT DEFAULT 'Lote 01'
);

-- 2. Garante que as colunas de cliente existam em tabelas já criadas
ALTER TABLE public.plaques ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT '';
ALTER TABLE public.plaques ADD COLUMN IF NOT EXISTS client_phone TEXT DEFAULT '';
ALTER TABLE public.plaques ADD COLUMN IF NOT EXISTS client_code TEXT DEFAULT '';

-- 3. Habilita Row Level Security (RLS)
ALTER TABLE public.plaques ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Acesso Público (Leitura, ativação e registro de scans)
DROP POLICY IF EXISTS "Acesso publico completo para placas" ON public.plaques;
CREATE POLICY "Acesso publico completo para placas" 
ON public.plaques 
FOR ALL 
TO anon, authenticated
USING (true) 
WITH CHECK (true);

-- 5. Habilita Realtime para a tabela (opcional)
ALTER PUBLICATION supabase_realtime ADD TABLE public.plaques;

-- 6. Seed inicial de placas de demonstração com clientes
INSERT INTO public.plaques (id, name, status, target_url, pin, client_name, client_phone, client_code, created_at, activated_at, scans_count, last_scan_at, batch_name)
VALUES 
    ('PLQ-001', 'Pizzaria Bella Napoli', 'active', 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4', '1234', 'Marcos Silva', '(11) 98765-4321', '12345678911', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', 142, NOW() - INTERVAL '35 minutes', 'Lote 01'),
    ('PLQ-002', 'Barbearia Vintage Club', 'active', 'https://search.google.com/local/writereview?placeid=ChIJQ1t_tDeuEmsRUsoyG83frY5', '5678', 'Carlos Santos', '(21) 99888-7766', '66778889912', NOW() - INTERVAL '7 days', NOW() - INTERVAL '3 days', 89, NOW() - INTERVAL '2 hours', 'Lote 01'),
    ('PLQ-003', '', 'virgin', '', '9012', '', '', '', NOW() - INTERVAL '2 days', NULL, 0, NULL, 'Lote 02'),
    ('PLQ-004', '', 'virgin', '', '3456', '', '', '', NOW() - INTERVAL '2 days', NULL, 0, NULL, 'Lote 02')
ON CONFLICT (id) DO UPDATE SET
    client_name = EXCLUDED.client_name,
    client_phone = EXCLUDED.client_phone,
    client_code = EXCLUDED.client_code;

-- =======================================================
-- ENDURECIMENTO DE SEGURANÇA: Placa QR Code Pro
-- Execute no SQL Editor do seu painel Supabase
-- (https://supabase.com/dashboard/project/zhxtmrhrbtqbsjcbvaim/sql)
--
-- Problema que isso resolve: a policy criada em supabase_setup.sql
-- ("Acesso publico completo para placas", USING (true) WITH CHECK (true))
-- permite que QUALQUER PESSOA na internet, usando a anon key publica
-- (que já está exposta, é normal ela ser publica), leia, altere ou
-- apague QUALQUER linha da tabela `plaques` diretamente via API REST
-- do Supabase — sem passar pelo painel, sem PIN, sem login nenhum.
--
-- Como o app não usa Supabase Auth (não existe "usuário autenticado"
-- de verdade), a correção não pode ser um simples "exigir auth.uid()"
-- — isso quebraria TODO o sistema (scan de QR, ativação, portal do
-- cliente e o próprio painel admin usam a mesma anon key).
--
-- A solução: mover toda leitura/escrita para funções (RPC) que rodam
-- no servidor do Supabase com regras de negócio embutidas (PIN
-- verificado no banco, não no navegador) e, para ações de dono/admin,
-- uma sessão validada no próprio banco (tabela admin_sessions), sem
-- depender de service_role key nem de infraestrutura nova.
--
-- ORDEM DE APLICAÇÃO (IMPORTANTE — leia antes de rodar):
--   1) Rode a PARTE 1 (aditiva) agora. Ela só CRIA tabelas/funções
--      novas. A policy antiga (USING true) continua ativa, então
--      nada quebra e o app antigo continua funcionando normalmente
--      enquanto o novo código não for implantado.
--   2) Eu (Claude) testo as novas funções via curl com a anon key,
--      usando um ID de teste descartável.
--   3) O novo código do app (que já vai usar essas funções) é
--      implantado no Netlify e testado nos 4 fluxos: scan de QR,
--      ativação de placa, portal do cliente e painel admin.
--   4) SÓ DEPOIS de confirmar que tudo funciona, rode a PARTE 2
--      (bloqueio), que remove o acesso direto e aberto à tabela.
-- =======================================================


-- =======================================================
-- PARTE 1 — ADITIVA (segura para rodar agora, nada quebra)
-- =======================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------
-- 1. Credenciais e sessões do Dono/Admin
-- -------------------------------------------------------
create table if not exists public.admin_credentials (
  id boolean primary key default true check (id),
  username text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_credentials enable row level security;

-- Semente com a MESMA credencial já configurada no código do app
-- (usuário Matheus, senha já trocada). Se você já mudou a senha pelo
-- painel de Configurações antes de rodar este script, ajuste o hash
-- abaixo para o hash atual (Configurações > Credenciais mostra como
-- gerar, ou me avise para eu recalcular).
insert into public.admin_credentials (id, username, password_hash)
values (true, 'Matheus', '48992b376198f6a96c4856c6479377108d0919dcd93c89af68bd961081068ce8')
on conflict (id) do nothing;

create table if not exists public.admin_sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table public.admin_sessions enable row level security;

create or replace function public.admin_check_session(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or trim(p_token) = '' then
    return false;
  end if;
  return exists(
    select 1 from public.admin_sessions
    where token = p_token::uuid and expires_at > now()
  );
exception when others then
  return false;
end;
$$;

create or replace function public.admin_login(p_username text, p_password_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.admin_credentials%rowtype;
  v_token uuid;
begin
  select * into v_row from public.admin_credentials where id = true;
  if v_row.username is null then
    return null;
  end if;
  if lower(trim(p_username)) <> lower(trim(v_row.username))
     or trim(coalesce(p_password_hash, '')) <> v_row.password_hash then
    return null;
  end if;

  delete from public.admin_sessions where expires_at < now();

  insert into public.admin_sessions default values returning token into v_token;
  return v_token::text;
end;
$$;

create or replace function public.admin_change_credentials(p_token text, p_new_username text, p_new_password_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_check_session(p_token) then
    raise exception 'INVALID_SESSION';
  end if;
  update public.admin_credentials
    set username = coalesce(nullif(trim(p_new_username), ''), username),
        password_hash = coalesce(nullif(trim(p_new_password_hash), ''), password_hash),
        updated_at = now()
    where id = true;
  return true;
end;
$$;

-- -------------------------------------------------------
-- 2. Funções PÚBLICAS (sem login — usadas por qualquer visitante,
--    mas cada uma só faz exatamente a operação de negócio permitida,
--    nunca leitura/escrita livre da tabela)
-- -------------------------------------------------------

-- Redirecionamento de QR Code + contagem de scan (substitui o
-- SELECT + PATCH manual que hoje o redirect.js faz direto na tabela)
create or replace function public.public_record_scan(p_id text)
returns table(target_url text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := upper(trim(p_id));
  v_url text;
  v_status text;
begin
  select p.target_url, p.status into v_url, v_status
  from public.plaques p where p.id = v_id;

  if v_status = 'active' and v_url is not null and v_url <> ''
     and (v_url ilike 'http://%' or v_url ilike 'https://%') then
    update public.plaques
      set scans_count = coalesce(scans_count, 0) + 1,
          last_scan_at = now()
      where id = v_id;
    return query select v_url, v_status;
  else
    return query select null::text, coalesce(v_status, 'not_found');
  end if;
end;
$$;

-- Leitura pública de UMA placa (sem o campo pin) — usada pela tela
-- de ativação para saber se a placa existe e seu estado atual
create or replace function public.public_get_plaque(p_id text)
returns table(
  id text, name text, status text, target_url text,
  client_name text, client_phone text, client_code text,
  created_at timestamptz, activated_at timestamptz,
  scans_count bigint, last_scan_at timestamptz, batch_name text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.status, p.target_url,
         p.client_name, p.client_phone, p.client_code,
         p.created_at, p.activated_at,
         p.scans_count, p.last_scan_at, p.batch_name
  from public.plaques p
  where p.id = upper(trim(p_id));
$$;

-- Ativação / atualização de placa com PIN validado NO BANCO
-- (antes, a checagem de PIN só existia no JavaScript do navegador)
create or replace function public.public_activate_plaque(
  p_id text,
  p_pin_attempt text,
  p_name text,
  p_target_url text,
  p_client_name text,
  p_client_phone text,
  p_client_code text,
  p_new_pin text
)
returns table(
  id text, name text, status text, target_url text,
  client_name text, client_phone text, client_code text,
  activated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := upper(trim(p_id));
  v_row public.plaques%rowtype;
begin
  -- Observação: como esta função declara RETURNS TABLE(id, name, status, ...),
  -- o PL/pgSQL cria variáveis de saída com esses mesmos nomes. Por isso toda
  -- referência à tabela `plaques` abaixo usa o alias `t`/`p` explicitamente
  -- (sem isso, "id"/"name"/"status" ficam ambíguos entre coluna e variável).
  select * into v_row from public.plaques t where t.id = v_id;
  if not found then
    raise exception 'PLAQUE_NOT_FOUND';
  end if;

  if v_row.status = 'active' and v_row.pin is not null and v_row.pin <> '' then
    if p_pin_attempt is null or trim(p_pin_attempt) <> trim(v_row.pin) then
      raise exception 'INVALID_PIN';
    end if;
  end if;

  if p_target_url is null or not (p_target_url ilike 'http://%' or p_target_url ilike 'https://%') then
    raise exception 'INVALID_URL';
  end if;

  update public.plaques t set
    name = coalesce(nullif(trim(p_name), ''), v_row.name, 'Empresa Cadastrada'),
    target_url = p_target_url,
    status = 'active',
    activated_at = now(),
    pin = coalesce(nullif(trim(p_new_pin), ''), v_row.pin),
    client_name = coalesce(nullif(trim(p_client_name), ''), v_row.client_name),
    client_phone = coalesce(nullif(trim(p_client_phone), ''), v_row.client_phone),
    client_code = coalesce(nullif(trim(p_client_code), ''), v_row.client_code)
  where t.id = v_id;

  return query
    select p.id, p.name, p.status, p.target_url,
           p.client_name, p.client_phone, p.client_code, p.activated_at
    from public.plaques p where p.id = v_id;
end;
$$;

-- Cliente apaga/reseta a PRÓPRIA placa informando o PIN — sem precisar de
-- sessão de admin. Usada pelo botão "Apagar" no Portal do Cliente.
create or replace function public.public_reset_plaque(p_id text, p_pin_attempt text)
returns table(id text, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := upper(trim(p_id));
  v_row public.plaques%rowtype;
begin
  select * into v_row from public.plaques t where t.id = v_id;
  if not found then
    raise exception 'PLAQUE_NOT_FOUND';
  end if;

  if v_row.pin is null or v_row.pin = ''
     or p_pin_attempt is null or trim(p_pin_attempt) <> trim(v_row.pin) then
    raise exception 'INVALID_PIN';
  end if;

  update public.plaques t set
    name = '',
    status = 'virgin',
    target_url = '',
    client_name = '',
    client_phone = '',
    client_code = '',
    activated_at = null,
    pin = '1234'
  where t.id = v_id;

  return query select p.id, p.status from public.plaques p where p.id = v_id;
end;
$$;

-- Busca das placas de UM cliente pelo código invertido ou telefone
-- (substitui o SELECT com filtro OR livre que hoje o portal faz)
create or replace function public.public_get_client_plaques(p_query text)
returns table(
  id text, name text, status text, target_url text,
  client_name text, client_phone text, client_code text,
  created_at timestamptz, activated_at timestamptz,
  scans_count bigint, last_scan_at timestamptz, batch_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := trim(coalesce(p_query, ''));
  v_digits text := regexp_replace(v_clean, '\D', '', 'g');
  v_reversed text := reverse(v_digits);
begin
  if v_clean = '' then
    return;
  end if;
  return query
    select p.id, p.name, p.status, p.target_url,
           p.client_name, p.client_phone, p.client_code,
           p.created_at, p.activated_at,
           p.scans_count, p.last_scan_at, p.batch_name
    from public.plaques p
    where p.client_code = v_clean
       or p.client_code = v_digits
       or p.client_code = v_reversed
       or p.client_phone = v_clean;
end;
$$;

-- -------------------------------------------------------
-- 3. Funções de ADMIN (exigem um token de sessão válido, obtido via
--    admin_login — quem não tiver token válido recebe INVALID_SESSION)
-- -------------------------------------------------------

create or replace function public.admin_list_plaques(p_token text, p_limit int default 5000, p_offset int default 0)
returns setof public.plaques
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_check_session(p_token) then
    raise exception 'INVALID_SESSION';
  end if;
  return query select * from public.plaques order by created_at desc limit p_limit offset p_offset;
end;
$$;

-- Upsert em lote (usado para criar lotes novos, editar placa pelo
-- painel, resetar placa e restaurar backup JSON)
create or replace function public.admin_upsert_plaques(p_token text, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.admin_check_session(p_token) then
    raise exception 'INVALID_SESSION';
  end if;

  insert into public.plaques (
    id, name, status, target_url, pin, client_name, client_phone, client_code,
    created_at, activated_at, scans_count, last_scan_at, batch_name
  )
  select
    upper(trim(r->>'id')),
    r->>'name',
    coalesce(r->>'status', 'virgin'),
    r->>'target_url',
    r->>'pin',
    r->>'client_name',
    r->>'client_phone',
    r->>'client_code',
    coalesce((r->>'created_at')::timestamptz, now()),
    (r->>'activated_at')::timestamptz,
    coalesce((r->>'scans_count')::bigint, 0),
    (r->>'last_scan_at')::timestamptz,
    coalesce(r->>'batch_name', 'Lote 01')
  from jsonb_array_elements(p_rows) as r
  on conflict (id) do update set
    name = excluded.name,
    status = excluded.status,
    target_url = excluded.target_url,
    pin = excluded.pin,
    client_name = excluded.client_name,
    client_phone = excluded.client_phone,
    client_code = excluded.client_code,
    activated_at = excluded.activated_at,
    scans_count = excluded.scans_count,
    last_scan_at = excluded.last_scan_at,
    batch_name = excluded.batch_name;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_delete_by_batch(p_token text, p_batch_name text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.admin_check_session(p_token) then
    raise exception 'INVALID_SESSION';
  end if;
  delete from public.plaques where lower(trim(batch_name)) = lower(trim(p_batch_name));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_delete_by_id(p_token text, p_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_check_session(p_token) then
    raise exception 'INVALID_SESSION';
  end if;
  delete from public.plaques where id = upper(trim(p_id));
  return found;
end;
$$;

create or replace function public.admin_reset_all(p_token text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.admin_check_session(p_token) then
    raise exception 'INVALID_SESSION';
  end if;
  delete from public.plaques;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -------------------------------------------------------
-- 4. Permissões de execução das funções (RPC) — isso NÃO dá acesso
--    direto à tabela, só permite chamar as funções acima
-- -------------------------------------------------------
grant execute on function public.public_record_scan(text) to anon, authenticated;
grant execute on function public.public_get_plaque(text) to anon, authenticated;
grant execute on function public.public_activate_plaque(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.public_reset_plaque(text, text) to anon, authenticated;
grant execute on function public.public_get_client_plaques(text) to anon, authenticated;

grant execute on function public.admin_login(text, text) to anon, authenticated;
grant execute on function public.admin_check_session(text) to anon, authenticated;
grant execute on function public.admin_change_credentials(text, text, text) to anon, authenticated;
grant execute on function public.admin_list_plaques(text, int, int) to anon, authenticated;
grant execute on function public.admin_upsert_plaques(text, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_by_batch(text, text) to anon, authenticated;
grant execute on function public.admin_delete_by_id(text, text) to anon, authenticated;
grant execute on function public.admin_reset_all(text) to anon, authenticated;

-- admin_credentials e admin_sessions nunca devem ser lidas/escritas
-- diretamente via REST — só por dentro das funções SECURITY DEFINER
-- acima. RLS ligado e sem nenhuma policy já bloqueia isso por padrão,
-- mas revogamos os grants também por camada extra de segurança.
revoke all on public.admin_credentials from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;

-- =======================================================
-- Fim da PARTE 1. Neste ponto a tabela `plaques` continua com a
-- policy antiga aberta — nada em produção muda ainda. Só rode a
-- PARTE 2 depois que o novo app estiver implantado e testado.
-- =======================================================


-- =======================================================
-- PARTE 2 — BLOQUEIO (rode SÓ depois de confirmar que o novo
-- código do app já está no ar e os 4 fluxos foram testados:
-- scan de QR code, ativação de placa nova, portal do cliente e
-- login/edição no painel admin)
-- =======================================================

-- drop policy if exists "Acesso publico completo para placas" on public.plaques;
-- revoke all on public.plaques from anon, authenticated;

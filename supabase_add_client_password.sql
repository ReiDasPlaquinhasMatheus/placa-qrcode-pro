-- Adiciona senha opcional para o Portal do Cliente, sem quebrar acesso
-- de clientes já cadastrados. Seguro rodar junto com o que já existe.
--
-- Como funciona:
--   - Nova tabela `clients` guarda a senha (separada de `plaques`, que
--     hoje duplica telefone/código em cada placa).
--   - public_get_client_plaques (já usada hoje) continua funcionando
--     igual para quem NUNCA configurou senha — comportamento inalterado.
--   - Quem configura senha passa a precisar dela nas próximas visitas;
--     o acesso só-por-telefone deixa de valer para esse cliente
--     específico (senão a senha não protegeria nada de verdade).
--   - "Esqueci minha senha" reaproveita client_set_password: confirma o
--     telefone de novo (mesma prova que o sistema já usa hoje) e define
--     uma senha nova.

create table if not exists public.clients (
  client_code text primary key,
  phone text,
  password_hash text,
  password_set_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.clients enable row level security;
revoke all on public.clients from anon, authenticated;

create table if not exists public.client_sessions (
  token uuid primary key default gen_random_uuid(),
  client_code text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
alter table public.client_sessions enable row level security;
revoke all on public.client_sessions from anon, authenticated;

-- Aceita telefone OU código invertido (igual public_get_client_plaques) e
-- devolve o client_code CANÔNICO se essa conta já tem senha configurada,
-- ou null (não encontrado, ou encontrado mas sem senha). Não expõe
-- nenhum dado da placa — só diz se deve pedir senha, e com qual código
-- chamar client_login/client_set_password depois.
create or replace function public.client_has_password(p_query text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := trim(coalesce(p_query, ''));
  v_digits text := regexp_replace(v_clean, '\D', '', 'g');
  v_reversed text := reverse(v_digits);
  v_matched_code text;
begin
  if v_clean = '' then
    return null;
  end if;

  select p.client_code into v_matched_code
  from public.plaques p
  where p.client_code = v_clean
     or p.client_code = v_digits
     or p.client_code = v_reversed
     or p.client_phone = v_clean
  limit 1;

  if v_matched_code is null then
    return null;
  end if;

  if exists(
    select 1 from public.clients c
    where c.client_code = v_matched_code and c.password_hash is not null
  ) then
    return v_matched_code;
  end if;

  return null;
end;
$$;

create or replace function public.client_check_session(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if p_token is null or trim(p_token) = '' then
    return null;
  end if;
  select client_code into v_code from public.client_sessions
    where token = p_token::uuid and expires_at > now();
  return v_code;
exception when others then
  return null;
end;
$$;

-- Configura (ou troca, se já existir) a senha de um cliente. Confirma
-- posse verificando se o telefone informado bate com alguma placa já
-- vinculada a esse client_code. Serve tanto para o primeiro cadastro
-- quanto para "esqueci minha senha" (é a mesma operação).
create or replace function public.client_set_password(
  p_client_code text,
  p_phone_attempt text,
  p_new_password_hash text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := trim(p_client_code);
  v_phone_digits text := regexp_replace(coalesce(p_phone_attempt, ''), '\D', '', 'g');
  v_match_count int;
  v_token uuid;
begin
  if v_code = '' or v_phone_digits = '' or p_new_password_hash is null or trim(p_new_password_hash) = '' then
    raise exception 'INVALID_INPUT';
  end if;

  select count(*) into v_match_count
  from public.plaques p
  where p.client_code = v_code
    and regexp_replace(coalesce(p.client_phone, ''), '\D', '', 'g') = v_phone_digits;

  if v_match_count = 0 then
    raise exception 'PHONE_MISMATCH';
  end if;

  insert into public.clients (client_code, phone, password_hash, password_set_at)
  values (v_code, p_phone_attempt, trim(p_new_password_hash), now())
  on conflict (client_code) do update set
    password_hash = excluded.password_hash,
    phone = excluded.phone,
    password_set_at = now();

  delete from public.client_sessions where client_code = v_code or expires_at < now();
  insert into public.client_sessions (client_code) values (v_code) returning token into v_token;
  return v_token::text;
end;
$$;

create or replace function public.client_login(p_client_code text, p_password_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.clients%rowtype;
  v_token uuid;
begin
  select * into v_row from public.clients where client_code = trim(p_client_code);
  if not found or v_row.password_hash is null then
    return null;
  end if;
  if trim(coalesce(p_password_hash, '')) <> v_row.password_hash then
    return null;
  end if;

  delete from public.client_sessions where expires_at < now();
  insert into public.client_sessions (client_code) values (v_row.client_code) returning token into v_token;
  return v_token::text;
end;
$$;

-- Leitura das placas do cliente via sessão de senha (usada quando o
-- client_code já tem senha configurada)
create or replace function public.public_get_client_plaques_by_session(p_token text)
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
  v_code text := public.client_check_session(p_token);
begin
  if v_code is null then
    raise exception 'INVALID_SESSION';
  end if;
  return query
    select p.id, p.name, p.status, p.target_url,
           p.client_name, p.client_phone, p.client_code,
           p.created_at, p.activated_at,
           p.scans_count, p.last_scan_at, p.batch_name
    from public.plaques p
    where p.client_code = v_code;
end;
$$;

-- Camada extra de segurança: se o client_code já tiver senha, a função
-- pública "livre" (sem sessão) passa a recusar e sinaliza que precisa
-- de senha, em vez de continuar devolvendo os dados sem nenhuma
-- verificação. O app já decide isso antes via client_has_password, mas
-- isso evita que alguém chame a função antiga direto e ainda funcione.
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
  v_matched_code text;
begin
  if v_clean = '' then
    return;
  end if;

  select p.client_code into v_matched_code
  from public.plaques p
  where p.client_code = v_clean
     or p.client_code = v_digits
     or p.client_code = v_reversed
     or p.client_phone = v_clean
  limit 1;

  if v_matched_code is not null and exists(
    select 1 from public.clients c
    where c.client_code = v_matched_code and c.password_hash is not null
  ) then
    raise exception 'PASSWORD_REQUIRED';
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

grant execute on function public.client_has_password(text) to anon, authenticated;
grant execute on function public.client_check_session(text) to anon, authenticated;
grant execute on function public.client_set_password(text, text, text) to anon, authenticated;
grant execute on function public.client_login(text, text) to anon, authenticated;
grant execute on function public.public_get_client_plaques_by_session(text) to anon, authenticated;

-- HISTÓRICO REAL DE LEITURAS (scan_events)
--
-- Hoje o banco guarda só o TOTAL de leituras de cada placa e a data da última.
-- Este script passa a gravar cada leitura (placa + data/hora), o que permite
-- ter "hoje/ontem", gráfico diário e horário de pico de verdade.
--
-- É ADITIVO e seguro para rodar com tudo no ar:
--   - não altera, apaga nem move nenhuma placa, cliente, PIN ou link;
--   - a contagem atual (scans_count / last_scan_at) continua sendo feita
--     exatamente como antes;
--   - se a gravação do histórico falhar por qualquer motivo, o
--     redirecionamento do QR do cliente continua funcionando normalmente.
--
-- Pode rodar mais de uma vez sem problema.

-- 1) Tabela de eventos (sem acesso direto pela chave pública)
create table if not exists public.scan_events (
  id bigint generated always as identity primary key,
  plaque_id text not null references public.plaques(id) on delete cascade,
  scanned_at timestamptz not null default now()
);

create index if not exists scan_events_plaque_time_idx
  on public.scan_events (plaque_id, scanned_at);
create index if not exists scan_events_time_idx
  on public.scan_events (scanned_at);

alter table public.scan_events enable row level security;
revoke all on public.scan_events from anon, authenticated;

-- 2) Contagem de leitura: MESMA função de antes (mesma assinatura e mesmo
--    retorno), só somando a gravação do evento dentro de um bloco protegido.
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

    -- Histórico: se falhar, ignora (nunca pode derrubar o redirecionamento)
    begin
      insert into public.scan_events (plaque_id) values (v_id);
    exception when others then
      null;
    end;

    return query select v_url, v_status;
  else
    return query select null::text, coalesce(v_status, 'not_found');
  end if;
end;
$$;

-- 3) Estatísticas para o painel do ADMIN (exige sessão de admin válida).
--    Devolve leituras agrupadas por dia e hora (fuso de Brasília).
create or replace function public.admin_scan_stats(p_token text, p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 90);
  v_from timestamptz;
  v_since timestamptz;
  v_rows jsonb;
begin
  if not public.admin_check_session(p_token) then
    raise exception 'INVALID_SESSION';
  end if;

  v_from := (date_trunc('day', now() at time zone 'America/Sao_Paulo')
             - make_interval(days => v_days - 1)) at time zone 'America/Sao_Paulo';

  select min(e.scanned_at) into v_since from public.scan_events e;

  select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'h', x.h, 'n', x.n) order by x.d, x.h), '[]'::jsonb)
    into v_rows
  from (
    select ((e.scanned_at at time zone 'America/Sao_Paulo')::date)::text as d,
           extract(hour from (e.scanned_at at time zone 'America/Sao_Paulo'))::int as h,
           count(*) as n
    from public.scan_events e
    where e.scanned_at >= v_from
    group by 1, 2
  ) x;

  return jsonb_build_object('since', v_since, 'rows', v_rows);
end;
$$;

-- 4) Estatísticas de UM cliente (uso interno das duas funções públicas abaixo;
--    não é chamável diretamente pela chave pública).
--    Só conta leituras DEPOIS da ativação atual da placa: se uma placa for
--    resetada e vendida a outro cliente, o novo dono não herda as leituras
--    do dono anterior.
create or replace function public._client_scan_stats(p_code text, p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 90);
  v_from timestamptz;
  v_since timestamptz;
  v_rows jsonb;
begin
  v_from := (date_trunc('day', now() at time zone 'America/Sao_Paulo')
             - make_interval(days => v_days - 1)) at time zone 'America/Sao_Paulo';

  select min(e.scanned_at) into v_since
  from public.scan_events e
  join public.plaques p on p.id = e.plaque_id
  where p.client_code = p_code
    and p.status = 'active'
    and e.scanned_at >= coalesce(p.activated_at, '-infinity'::timestamptz);

  select coalesce(jsonb_agg(jsonb_build_object('d', x.d, 'h', x.h, 'n', x.n) order by x.d, x.h), '[]'::jsonb)
    into v_rows
  from (
    select ((e.scanned_at at time zone 'America/Sao_Paulo')::date)::text as d,
           extract(hour from (e.scanned_at at time zone 'America/Sao_Paulo'))::int as h,
           count(*) as n
    from public.scan_events e
    join public.plaques p on p.id = e.plaque_id
    where p.client_code = p_code
      and p.status = 'active'
      and e.scanned_at >= coalesce(p.activated_at, '-infinity'::timestamptz)
      and e.scanned_at >= v_from
    group by 1, 2
  ) x;

  return jsonb_build_object('since', v_since, 'rows', v_rows);
end;
$$;

revoke all on function public._client_scan_stats(text, int) from public, anon, authenticated;

-- 5a) Cliente COM senha: usa a sessão de senha (igual public_get_client_plaques_by_session)
create or replace function public.public_get_client_scan_stats_by_session(p_token text, p_days int default 30)
returns jsonb
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
  return public._client_scan_stats(v_code, p_days);
end;
$$;

-- 5b) Cliente SEM senha: telefone ou código invertido (igual public_get_client_plaques).
--     Se a conta tem senha, recusa — mesma regra do resto do portal.
create or replace function public.public_get_client_scan_stats(p_query text, p_days int default 30)
returns jsonb
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
    return jsonb_build_object('since', null, 'rows', '[]'::jsonb);
  end if;

  select p.client_code into v_matched_code
  from public.plaques p
  where p.client_code = v_clean
     or p.client_code = v_digits
     or p.client_code = v_reversed
     or p.client_phone = v_clean
  limit 1;

  if v_matched_code is null then
    return jsonb_build_object('since', null, 'rows', '[]'::jsonb);
  end if;

  if exists(
    select 1 from public.clients c
    where c.client_code = v_matched_code and c.password_hash is not null
  ) then
    raise exception 'PASSWORD_REQUIRED';
  end if;

  return public._client_scan_stats(v_matched_code, p_days);
end;
$$;

grant execute on function public.admin_scan_stats(text, int) to anon, authenticated;
grant execute on function public.public_get_client_scan_stats_by_session(text, int) to anon, authenticated;
grant execute on function public.public_get_client_scan_stats(text, int) to anon, authenticated;

-- PARA DESFAZER (se algum dia precisar): rode de novo a função
-- public_record_scan que está no arquivo supabase_rls_hardening.sql (sem a
-- parte do insert). A tabela scan_events pode ficar parada sem prejuízo.

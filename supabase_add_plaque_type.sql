-- PLACAS INSTAGRAM: guarda o tipo da placa (google | instagram) no banco.
--
-- Antes, o painel marcava a placa como Instagram só no navegador; o campo
-- não era salvo e, ao recarregar, a placa voltava a ser tratada como Google
-- (a não ser que o código começasse com IG-/INSTA-).
--
-- SEGURO PARA AS PLACAS EXISTENTES:
--  * Só ADICIONA a coluna `type`. Nenhum link, PIN, cliente, contador ou
--    status é alterado.
--  * Todas as placas que já existem ficam como 'google' (nenhuma placa atual
--    usa os prefixos IG- / INSTA-; se usar, vira 'instagram').
--  * admin_upsert_plaques passa a gravar `type`, mas NUNCA apaga o tipo de
--    uma placa já existente quando o painel envia a placa sem o campo
--    (ex: cache antigo, restauração de backup).
--  * public_get_plaque devolve as mesmas colunas de antes + `type` no final.
--  * O redirecionamento (public_record_scan) não muda.
--
-- Tudo roda numa transação: se qualquer passo falhar, nada é aplicado.
-- Pode rodar mais de uma vez.

begin;

-- 1. Coluna nova (nula = placa antiga; o app trata como Google)
alter table public.plaques add column if not exists type text;

update public.plaques
set type = case
  when upper(id) like 'IG-%' or upper(id) like 'INSTA-%' then 'instagram'
  else 'google'
end
where type is null;

alter table public.plaques drop constraint if exists plaques_type_check;
alter table public.plaques add constraint plaques_type_check
  check (type is null or type in ('google', 'instagram'));

-- 2. Upsert do painel: igual ao anterior + coluna type
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
    created_at, activated_at, scans_count, last_scan_at, batch_name, type
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
    coalesce(r->>'batch_name', 'Lote 01'),
    case when r->>'type' in ('google', 'instagram') then r->>'type' end
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
    batch_name = excluded.batch_name,
    -- Sem type no envio, mantém o que já está salvo
    type = coalesce(excluded.type, public.plaques.type);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.admin_upsert_plaques(text, jsonb) to anon, authenticated;

-- 3. Leitura pública de uma placa (tela de ativação): mesmas colunas + type.
--    Mudar as colunas de retorno exige recriar a função.
drop function if exists public.public_get_plaque(text);

create function public.public_get_plaque(p_id text)
returns table(
  id text, name text, status text, target_url text,
  client_name text, client_phone text, client_code text,
  created_at timestamptz, activated_at timestamptz,
  scans_count bigint, last_scan_at timestamptz, batch_name text,
  type text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.status, p.target_url,
         p.client_name, p.client_phone, p.client_code,
         p.created_at, p.activated_at,
         p.scans_count, p.last_scan_at, p.batch_name,
         p.type
  from public.plaques p
  where p.id = upper(trim(p_id));
$$;

grant execute on function public.public_get_plaque(text) to anon, authenticated;

commit;

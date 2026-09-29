-- Correção pontual da função public_activate_plaque (bug: "column reference
-- id is ambiguous"). Seguro rodar mesmo já tendo rodado a PARTE 1 antes —
-- isso apenas substitui a função pela versão corrigida.

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

grant execute on function public.public_activate_plaque(text, text, text, text, text, text, text, text) to anon, authenticated;

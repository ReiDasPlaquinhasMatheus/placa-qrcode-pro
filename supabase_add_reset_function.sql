-- Adiciona a função public_reset_plaque, que faltava: permite o cliente
-- apagar/resetar a PRÓPRIA placa (informando o PIN correto) sem precisar
-- de sessão de administrador. Seguro rodar mesmo já tendo rodado a
-- PARTE 1 antes — isso só adiciona uma função nova.

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

grant execute on function public.public_reset_plaque(text, text) to anon, authenticated;

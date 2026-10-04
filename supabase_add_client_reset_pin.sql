-- "Esqueci meu PIN" para o cliente — só funciona pra quem já tem senha
-- configurada (a senha já prova quem é a pessoa, então dá pra deixar
-- resetar o PIN de qualquer placa dela sem precisar do PIN antigo).
-- Quem não tem senha continua precisando falar com o admin.

create or replace function public.client_reset_pin(
  p_id text,
  p_session_token text,
  p_new_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.client_check_session(p_session_token);
  v_clean_id text := upper(trim(p_id));
  v_plaque_code text;
begin
  if v_code is null then
    raise exception 'INVALID_SESSION';
  end if;

  if p_new_pin is null or length(trim(p_new_pin)) < 3 then
    raise exception 'INVALID_PIN';
  end if;

  select client_code into v_plaque_code from public.plaques where id = v_clean_id;

  if v_plaque_code is null then
    raise exception 'PLAQUE_NOT_FOUND';
  end if;

  if v_plaque_code <> v_code then
    raise exception 'NOT_OWNER';
  end if;

  update public.plaques set pin = trim(p_new_pin) where id = v_clean_id;
  return true;
end;
$$;

grant execute on function public.client_reset_pin(text, text, text) to anon, authenticated;

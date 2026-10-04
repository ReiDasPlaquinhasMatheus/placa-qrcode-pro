-- CORREÇÃO: a listagem do painel admin estava perdendo placas.
--
-- admin_list_plaques paginava ordenando só por created_at. Um lote inteiro é
-- criado com o MESMO created_at (700 placas no maior lote), então a ordem entre
-- elas não era garantida: a mesma placa aparecia em duas páginas e outras não
-- apareciam em nenhuma. Resultado medido: o banco tem 2752 placas, mas o painel
-- só recebia 2638 distintas (114 ocultas e 114 duplicadas).
--
-- Esta versão desempata por id, então a paginação passa a ser determinística.
-- Mesma assinatura e mesmo retorno: o app não precisa de nenhum ajuste.
-- Não altera nenhum dado. Pode rodar mais de uma vez.

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
  return query
    select * from public.plaques
    order by created_at desc, id asc
    limit p_limit offset p_offset;
end;
$$;

grant execute on function public.admin_list_plaques(text, int, int) to anon, authenticated;

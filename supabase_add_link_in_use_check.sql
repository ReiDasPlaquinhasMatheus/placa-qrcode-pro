-- AVISO "ESTE LINK JÁ É DE OUTRA EMPRESA"
--
-- Caso real: a placa da Ka Pratas foi ativada com o link EXATO da Gipsy Restaurante
-- (outro cliente). O QR da Ka passou a abrir a Gipsy e ninguém percebeu até testar.
--
-- Esta função deixa o formulário de ativação perguntar ao banco, ANTES de salvar,
-- se algum OUTRO cliente já usa o mesmo link em uma placa ativa. Devolve só
-- verdadeiro/falso (nunca nomes nem dados de outros clientes). O app apenas AVISA
-- e pede confirmação: dois funcionários da mesma empresa podem usar o mesmo link.
--
-- Aditivo e seguro: só cria funções novas; não altera nenhuma placa, cliente, PIN
-- ou link. Pode rodar mais de uma vez.

-- Reduz o link a uma "chave" comparável: links de avaliação por placeid comparam só o
-- placeid; links curtos/de rede social ignoram parâmetros de rastreio (?g_st=...).
create or replace function public.normalize_review_link(p_url text)
returns text
language plpgsql
immutable
as $$
declare
  v_orig text := btrim(coalesce(p_url, ''));
  v_u text;
  v_host text;
  v_pid text;
begin
  if v_orig = '' then
    return null;
  end if;

  v_pid := substring(v_orig from 'placeid=([A-Za-z0-9_-]+)');
  if v_pid is not null then
    return 'placeid:' || v_pid;
  end if;

  v_u := regexp_replace(v_orig, '#.*$', '');
  v_u := regexp_replace(v_u, '^https?://(www\.)?', '', 'i');
  v_host := lower(substring(v_u from '^([^/?]+)'));

  if v_host in ('maps.app.goo.gl', 'goo.gl', 'g.page', 'share.google', 'instagram.com', 'facebook.com', 'wa.me', 'w.app') then
    v_u := regexp_replace(v_u, '\?.*$', '');
  end if;

  v_u := regexp_replace(v_u, '/+$', '');
  return lower(v_host) || substring(v_u from '^[^/?]+(.*)$');
end;
$$;

create or replace function public.public_link_in_use_by_other_client(
  p_url text,
  p_exclude_id text,
  p_client_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := public.normalize_review_link(p_url);
  v_exclude text := upper(trim(coalesce(p_exclude_id, '')));
  v_code text := coalesce(nullif(trim(coalesce(p_client_code, '')), ''), '');
begin
  if v_key is null then
    return false;
  end if;

  return exists (
    select 1
    from public.plaques p
    where p.status = 'active'
      and p.target_url is not null
      and p.target_url <> ''
      and p.id <> v_exclude
      and coalesce(p.client_code, '') <> v_code
      and public.normalize_review_link(p.target_url) = v_key
  );
end;
$$;

grant execute on function public.normalize_review_link(text) to anon, authenticated;
grant execute on function public.public_link_in_use_by_other_client(text, text, text) to anon, authenticated;

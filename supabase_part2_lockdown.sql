-- PARTE 2 — BLOQUEIO FINAL
-- Rode isso SÓ DEPOIS de confirmar que o site em produção já está usando
-- o novo código (que fala com o banco via RPC, não mais direto na tabela).
-- Isso remove a policy antiga que deixava a tabela plaques aberta para
-- qualquer pessoa na internet ler/alterar/apagar usando a anon key.

drop policy if exists "Acesso publico completo para placas" on public.plaques;
revoke all on public.plaques from anon, authenticated;

-- Alinha auth.users (contas legadas com email Gmail) ao login interno P38.
-- Idempotente: só actualiza quando o email auth ainda é o email operacional antigo.

update auth.users a
set
  email = lower(trim(u.login)) || '@login.p38.internal',
  raw_user_meta_data = coalesce(a.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'login', lower(trim(u.login)),
      'password_set', coalesce((a.raw_user_meta_data->>'password_set')::boolean, true),
      'must_activate', coalesce((a.raw_user_meta_data->>'must_activate')::boolean, false)
    )
from public.usuario u
where u.login is not null
  and trim(u.login) <> ''
  and lower(coalesce(nullif(trim(u.email), ''), nullif(trim(u.dados->>'email'), ''))) = lower(a.email)
  and a.email not like '%@login.p38.internal';

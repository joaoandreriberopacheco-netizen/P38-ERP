-- Login interno P38 (usuário + senha, sem email obrigatório).
-- O email em auth.users é sintético: <login>@login.p38.internal

alter table public.usuario add column if not exists login text;
alter table public.usuario add column if not exists auth_ativado boolean not null default false;

-- Preencher login a partir de nickname ou email local
update public.usuario set login = lower(trim(nickname))
where (login is null or trim(login) = '')
  and nickname is not null and trim(nickname) <> '';

update public.usuario set login = lower(trim(split_part(email, '@', 1)))
where (login is null or trim(login) = '')
  and email is not null and trim(email) <> ''
  and email not like '%@login.p38.internal';

create unique index if not exists idx_usuario_login_unique
  on public.usuario (lower(login))
  where login is not null and trim(login) <> '';

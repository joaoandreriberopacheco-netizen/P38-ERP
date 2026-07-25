-- Login interno P38 (usuário + senha, sem email obrigatório).
-- O email em auth.users é sintético: <login>@login.p38.internal

alter table public.usuario add column if not exists login text;
alter table public.usuario add column if not exists auth_ativado boolean not null default false;
alter table public.usuario add column if not exists nickname text;
alter table public.usuario add column if not exists email text;

-- Garantir nickname a partir de dados (produção pode não ter corrido 009)
update public.usuario
set nickname = coalesce(nullif(trim(nickname), ''), nullif(trim(dados->>'nickname'), ''))
where (nickname is null or trim(nickname) = '')
  and dados->>'nickname' is not null
  and trim(dados->>'nickname') <> '';

-- Preencher login a partir de nickname ou email local
update public.usuario
set login = lower(trim(coalesce(nullif(trim(login), ''), nickname, dados->>'nickname')))
where (login is null or trim(login) = '')
  and coalesce(nullif(trim(nickname), ''), nullif(trim(dados->>'nickname'), '')) is not null;

update public.usuario
set login = lower(trim(split_part(coalesce(email, dados->>'email', ''), '@', 1)))
where (login is null or trim(login) = '')
  and coalesce(nullif(trim(email), ''), nullif(trim(dados->>'email'), '')) is not null
  and coalesce(nullif(trim(email), ''), nullif(trim(dados->>'email'), '')) not like '%@login.p38.internal';

create unique index if not exists idx_usuario_login_unique
  on public.usuario (lower(login))
  where login is not null and trim(login) <> '';

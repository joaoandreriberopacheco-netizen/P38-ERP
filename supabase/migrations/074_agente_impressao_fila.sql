-- Agente de impressão térmica local (PC da loja) + fila para impressão remota.

create table if not exists public.agente_impressao (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Caixa principal',
  token text not null unique,
  ip_impressora text,
  porta integer not null default 9100,
  ativo boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.fila_impressao_termica (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agente_impressao(id) on delete cascade,
  pedido_id text not null,
  ip_impressora text,
  porta integer not null default 9100,
  status text not null default 'pending',
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint fila_impressao_termica_status_check
    check (status in ('pending', 'processing', 'done', 'failed'))
);

create index if not exists idx_fila_impressao_pending
  on public.fila_impressao_termica (agente_id, created_at)
  where status = 'pending';

alter table public.agente_impressao disable row level security;
alter table public.fila_impressao_termica disable row level security;

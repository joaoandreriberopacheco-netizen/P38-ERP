-- Fase 3 — fundação multi-tenant (sem quebrar operação single-tenant actual).
-- Não altera RLS nem dados existentes; prepara piloto externo.

CREATE TABLE IF NOT EXISTS public.empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.empresa IS 'Registo de empresas/tenants — Fase 3 piloto externo';

-- Bootstrap: empresa da operação actual (single-tenant hoje)
INSERT INTO public.empresa (id, nome, slug)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Operação principal',
  'principal'
)
ON CONFLICT (id) DO NOTHING;

-- Ligação futura utilizador → empresa (coluna opcional, sem backfill obrigatório)
ALTER TABLE IF EXISTS public.usuario
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresa(id);

CREATE INDEX IF NOT EXISTS idx_usuario_empresa_id ON public.usuario (empresa_id);

COMMENT ON COLUMN public.usuario.empresa_id IS 'Tenant — NULL = legado single-tenant até migração piloto';

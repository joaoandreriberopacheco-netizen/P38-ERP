# Checklist — utilizador piloto externo (Fase 3)

Para o **primeiro negócio** que não és tu. Marca quando concluído.

## Antes de convidar

- [ ] Migração `054_tenant_empresa_foundation` aplicada em produção
- [ ] Registo `empresa` criado para o piloto (nome + slug)
- [ ] Perfil de acesso definido (só módulos que ele precisa — ver `P38_MODULOS_E_PERFIS.md`)
- [ ] Dados de demonstração **ou** importação inicial acordada
- [ ] Sentry activo (opcional mas recomendado)

## Onboarding (dia 1)

- [ ] Criar utilizador / convite (`/ativar-acesso` ou `convidar-usuarios`)
- [ ] Associar `usuario.empresa_id` ao tenant piloto
- [ ] Sessão de 30 min: 3 fluxos (PDV ou venda, compra/conferência, margem ou fluxo)
- [ ] Telemóvel do piloto testado (login + 1 tarefa real)

## Semana 1

- [ ] Contacto diário (WhatsApp) — “o que travou?”
- [ ] Registar bugs/melhorias (Flare ou lista simples)
- [ ] Ajustar permissões se menu estiver pesado

## Semana 2–4

- [ ] Preencher [`marketing/CASE_STUDY_TEMPLATE.md`](./marketing/CASE_STUDY_TEMPLATE.md)
- [ ] Decisão: continua piloto / paga / para

## Critérios de sucesso

| Métrica | Meta |
|---------|------|
| Usa o sistema **sem ti** ≥ 3 dias/semana | Sim |
| Consegue fechar o dia (caixa ou fluxo) no telemóvel | Sim |
| Voltaria ao Excel? | Não |

---

*Um piloto bem documentado vale mais que dez features novas.*

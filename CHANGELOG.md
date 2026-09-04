# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).  
Versão segue [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [1.1.0] - 2026-08-06

### Adicionado

- Sentry opcional (`NEXT_PUBLIC_SENTRY_DSN`) — ver `docs/SENTRY_SETUP.md`
- Smoke HTTP no CI (`/login`, `/landing.html`)
- Branch `staging` + documentação de homologação
- Fundação multi-tenant: migração `054_tenant_empresa_foundation.sql`
- Checklists: piloto externo, roteiro parceiro, roadmap multi-tenant

### Alterado

- `@base44/sdk` movido para `devDependencies`; shim no bundle Next de produção
- CI corre também na branch `staging`

## [1.0.0] - 2026-08-06

### Adicionado

- Identidade de produto: README, landing `/landing.html`, documentação de módulos e perfis
- Plano de profissionalização (`docs/PROFISSIONALIZACAO_P38.md`)
- CI GitHub Actions: build Next + smoke estrutural
- Versão semântica visível no app (build stamp)
- Legado Vite/Base44 isolado em `legacy/`

### Alterado

- Nome do pacote: `base44-app` → `p38-erp`
- README deixou de referenciar Base44/Vite como produção

### Removido

- Artefactos temporários de agente (`_mcp_*`) da raiz do repositório

[1.1.0]: https://github.com/joaoandreriberopacheco-netizen/P38-ERP/releases/tag/v1.1.0
[1.0.0]: https://github.com/joaoandreriberopacheco-netizen/P38-ERP/releases/tag/v1.0.0

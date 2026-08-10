# Sentry — monitorização de erros (Fase 2)

Opcional. **Sem DSN configurado, o P38 funciona igual** — zero impacto.

## 1. Criar projecto

1. https://sentry.io → novo projecto **React** (ou JavaScript browser)
2. Copiar o **DSN**

## 2. Gravar secrets

| Onde | Variável |
|------|----------|
| **Vercel** (produção) | `NEXT_PUBLIC_SENTRY_DSN` |
| **GitHub Actions** | igual (se quiseres no build) |
| **Staging** | `NEXT_PUBLIC_SENTRY_DSN` + `NEXT_PUBLIC_P38_ENV=staging` |

Opcional (legado Vite scripts): `VITE_SENTRY_DSN`, `VITE_P38_ENV`.

## 3. Validar

1. Deploy com DSN gravado
2. Abrir app → consola não deve mostrar aviso Sentry
3. Forçar erro de teste numa página dev (remover depois) ou usar Sentry → test event

## Código

- Inicialização: `src/lib/p38Monitoring.js`
- Boot: `app/providers.next.jsx` (`initP38Monitoring`)

## Privacidade

O `beforeSend` remove `Authorization` dos headers. Revisar antes de piloto externo se precisares de mais mascaramento (PII).

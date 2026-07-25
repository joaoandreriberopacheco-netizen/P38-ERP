# Chaves P38 — ficheiro mestre (legado / não recomendado)

**Configuração profissional:** usa os painéis **GitHub Secrets** e **Cursor Cloud Secrets**.

Guia passo a passo: [`docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md`](../docs/migration/P38_CONFIGURAR_SECRETS_PASSO_A_PASSO.md)

## Auditar se está tudo certo

```bash
npm run secrets:audit
```

Mostra, para cada chave, se está presente e se o acesso funciona — sem mostrar passwords.

## Ficheiro txt (opcional, não usar como fonte principal)

O ficheiro `p38-chaves.txt` foi uma alternativa temporária. Para continuidade da empresa, os secrets devem estar no **GitHub** e no **Cursor Cloud**, não num ficheiro local.

Se ainda existir `p38-chaves.txt`, podes apagá-lo depois de migrar para os painéis.

Modelo de referência (só nomes): `p38-chaves.exemplo.txt`

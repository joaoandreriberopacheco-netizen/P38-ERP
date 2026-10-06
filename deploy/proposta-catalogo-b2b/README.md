# Proposta comercial — Catálogo B2B P38

Página estática para **prospecção**: explica o catálogo B2B, liga às demonstrações ao vivo e convida para piloto de 30 dias.

## Onde está o ficheiro

| Local | URL após deploy |
|-------|-----------------|
| `public/proposta-catalogo-b2b.html` (canónico) | `https://p-38erp.vercel.app/proposta-catalogo-b2b.html` |
| `deploy/proposta-catalogo-b2b/index.html` (cópia) | Projecto Vercel isolado, se criar |

Regenerar a cópia em `deploy/` a partir do canónico:

```bash
cp public/proposta-catalogo-b2b.html deploy/proposta-catalogo-b2b/index.html
```

## Como usar na prospecção

1. Envie o link por WhatsApp ou e-mail.
2. Peça para abrir **uma demonstração ao vivo** no telemóvel (secção “Demonstrações”).
3. Fecho: botão **Solicitar piloto** ou e-mail `contato@p38erp.com.br`.

## Deploy isolado (opcional)

Igual aos catálogos: importar repo, **Root Directory** `deploy/proposta-catalogo-b2b`, preset **Other**, sem build.

# Criar repositório no GitHub (uma vez)

O agente Cloud não tem permissão para **criar** repos na conta GitHub. O código já está preparado em `p38-catalogo-b2b/` — falta só publicar.

## Passos (2 minutos)

1. Abrir https://github.com/new
2. **Repository name:** `p38-catalogo-b2b`
3. **Public**
4. **Não** marcar README, .gitignore nem licença (repo vazio)
5. Criar repositório

Depois, no terminal (ou pedir ao agente):

```bash
cd p38-catalogo-b2b
git init -b main
git add .
git commit -m "chore: catálogo B2B extraído do P38-ERP"
git remote add origin https://github.com/joaoandreriberopacheco-netizen/p38-catalogo-b2b.git
git push -u origin main
```

URL final: https://github.com/joaoandreriberopacheco-netizen/p38-catalogo-b2b

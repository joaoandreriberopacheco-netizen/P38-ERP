# Criar repositório no GitHub (uma vez)

O agente Cloud **não consegue criar** repos na tua conta GitHub (permissão da integração). O código **já está publicado** como branch no P38-ERP:

**https://github.com/joaoandreriberopacheco-netizen/P38-ERP/tree/p38-catalogo-b2b**

## Passos finais (2 minutos)

1. Abrir https://github.com/new
2. **Repository name:** `p38-catalogo-b2b`
3. **Public** · **sem** README, .gitignore nem licença
4. Criar repositório vazio
5. No clone local (pasta `p38-catalogo-b2b`):

```bash
npm run repo:publicar
```

Ou manualmente:

```bash
git remote add github-catalogo https://github.com/joaoandreriberopacheco-netizen/p38-catalogo-b2b.git
git push github-catalogo main:main
```

URL final: https://github.com/joaoandreriberopacheco-netizen/p38-catalogo-b2b

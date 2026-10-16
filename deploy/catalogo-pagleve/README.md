# Catálogo PagLeve — deploy isolado (Vercel)

Site estático **separado do P38 ERP**. Estoque Novo Aleixo com visual premium inspirado na marca Pague Leve (vermelho / dourado, tipografia Playfair + DM Sans).

## Gerar / atualizar

```bash
npm run catalogo:publicar-pagleve
```

Lê `files/pagleve/raio-x-pagleve-site-verificado.csv` e grava `deploy/catalogo-pagleve/index.html`.

## Link público (após deploy)

**https://catalogo-pague-leve.vercel.app/**

## Criar projecto Vercel (uma vez)

1. [vercel.com/new](https://vercel.com/new) → repo **P38-ERP**
2. **Root Directory:** `deploy/catalogo-pagleve`
3. **Framework:** Other (sem build)
4. Nome sugerido: `catalogo-pague-leve`
5. Secret GitHub: `VERCEL_CATALOGO_PAGLEVE_PROJECT_ID` (ver workflow)

Instagram oficial: https://www.instagram.com/paguelevepisoseporcelanatos/

Rodapé: **Powered by P38 sistemas**.

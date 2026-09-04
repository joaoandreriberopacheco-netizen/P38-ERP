# A29-ERP — cópia local SÓ PARA LEITURA (referência)

> Explorador de ficheiros: abre primeiro [`PLACA_AVISO.txt`](PLACA_AVISO.txt) nesta pasta.

```
================================================================================
||                                                                            ||
||   ESTE DIRECTÓRIO NÃO É CÓDIGO DO VAREJOSYNC. NÃO FAZ PARTE DO BUILD.     ||
||   NÃO IMPORTAR EM `src/`. NÃO COPIAR SEGREDOS. NÃO COMMITAR O CHECKOUT.     ||
||                                                                            ||
||   Propósito: referência local do **Mana** (`a29-erp`). Piloto 2026: Mana é   ||
||   a **doca seca do Galileu** (app fluvial), não espelho paralelo do P-38.   ||
||   Ver [`../galileu-pathway.md`](../galileu-pathway.md).                     ||
||                                                                            ||
================================================================================
```

## Fonte canónica (a29-erp)

- **Remoto Git (exemplo):** `https://github.com/joaoandreriberopacheco-netizen/a29-erp.git` — confirma no teu GitHub se o URL mudou; não commits credenciais.
- **Pasta local típica (irmão do varejosync):** `Documentos\GitHub\a29-erp` (mesmo nível que esta pasta `varejosync`).

## Como actualizar o checkout

A pasta `docs/reference-a29-erp/checkout/` está listada no `.gitignore` na raiz do **varejosync**: o conteúdo **não** sobe para o remoto; fica só na tua máquina (referência local). Se precisares do mesmo noutro PC, repete clone ou cópia aí.

### A) Clonar (rede; útil sem cópia local do monorepo)

Na raiz do **varejosync**, substitui o URL se o teu fork for outro:

```powershell
New-Item -ItemType Directory -Force -Path docs/reference-a29-erp/checkout | Out-Null
Set-Location docs/reference-a29-erp/checkout
git clone --depth 1 https://github.com/joaoandreriberopacheco-netizen/a29-erp.git .
```

Bash equivalente:

```bash
mkdir -p docs/reference-a29-erp/checkout && cd docs/reference-a29-erp/checkout && git clone --depth 1 https://github.com/joaoandreriberopacheco-netizen/a29-erp.git .
```

Para **só puxar alterações** quando já clonaste com Git nesta pasta: `git -C docs/reference-a29-erp/checkout fetch && git -C docs/reference-a29-erp/checkout pull` (a partir da raiz do varejosync).

### B) Copiar do repo local (PowerShell; sem `node_modules` / `.next` / `.git`)

Se já tens o **a29-erp** ao lado (ex.: `..\a29-erp` em relação à raiz do varejosync), podes **espelhar** ficheiros úteis sem clonar outra vez (exclui pastas pesadas e ficheiros `.env*`):

```powershell
Set-Location "C:\caminho\para\varejosync"
$src = Join-Path (Resolve-Path "..") "a29-erp"
$dst = Join-Path (Get-Location) "docs\reference-a29-erp\checkout"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /MIR /E /XD node_modules .next .git dist build .turbo .vercel /XF .env .env.local .env.development.local .env.production.local /R:1 /W:1
```

Notas rápidas:

- Códigos de saída do `robocopy` **0–7** costumam indicar sucesso (ex.: `1` = ficheiros copiados).
- Se antes tinhas feito **clone** dentro de `checkout`, pode ficar um `.git` órfão; apaga `checkout\.git` se quiseres só cópia de ficheiros, sem segundo repositório embutido.

## O que fazer (uma vez na tua máquina)

1. Garante que existe a pasta `checkout` (ver secção **Como actualizar o checkout** acima).

2. Escolhe **clone (A)** ou **cópia local (B)**.

3. Opcional (só se usaste **clone** com Git): atualizar para ver diferenças:

   ```bash
   cd docs/reference-a29-erp/checkout && git fetch && git pull
   ```

## Regras

| Faz | Não faz |
|-----|---------|
| Ler, pesquisar, comparar ficheiros | `import` a partir de `checkout/` no Vite/React |
| Copiar **ideias** ou excertos para `src/` à mão, adaptando | Apontar `alias` no `vite.config` para esta pasta |
| Documentar diferenças em PR/commit do varejosync | Commitar o conteúdo de `checkout/` (está gitignored) |
| Tratar código A29 como fonte de verdade **só** para o monorepo A29 | Assumir que APIs/RLS do A29 existem no Base44 |

## Onde cruzar com o VarejoSync

- Inventário e gap (preencher após clone A29): [`docs/migration/A29_EMBALAGENS_INVENTORY.md`](../migration/A29_EMBALAGENS_INVENTORY.md), [`docs/migration/A29_VS_VAREJO_EMBALAGENS_GAP.md`](../migration/A29_VS_VAREJO_EMBALAGENS_GAP.md)
- Domínio de unidades / embalagens no cliente: `src/lib/productUnits.js`
- Planilhas embalagens: `src/components/produtos/massa/`

## Modelo de tabela de gaps (copiar para notas ou PR)

| Área | A29 (caminho) | VarejoSync (caminho) | Acção |
|------|---------------|----------------------|--------|
| Domínio | `…` | `src/lib/productUnits.js` | … |
| UI produto | `…` | `…` | … |
| Import massa | `…` | `ImportacaoProdutos.jsx` / `embalagensPlanilhaUtils.js` | … |
| OCR compras | `…` | `ImportadorPedidoCompra.jsx` / integrações | … |
| Catálogo | `…` | `…` | … |

Quando `checkout/` estiver vazio, o Cursor/agente não consegue inventariar o A29 aqui — preenche primeiro com **clone (A)** ou **cópia local (B)** acima.

## Atalho (Windows)

Na raiz do varejosync, com URL real do monorepo:

```powershell
$env:A29_ERP_GIT_URL = 'https://github.com/joaoandreriberopacheco-netizen/a29-erp.git'
.\scripts\clone-a29-reference.ps1
```

Ou: `.\scripts\clone-a29-reference.ps1 -RemoteUrl 'https://github.com/TEU_ORG/a29-erp.git'`

Também há `PLACA_AVISO.txt` nesta pasta para quem abre o explorador de ficheiros.

# Espelho P38 → a29-erp

Pasta de **exportação** do código VarejoSync para o monorepo **a29-erp**. Não entra no build de produção do Base44.

## Fluxo (2 passos)

```bash
# Tudo num comando (pack + push, mantém paleta A29 por defeito)
npm run mirror:sync -- ../a29-erp

# Ou em dois passos:
npm run mirror:pack
npm run mirror:push -- ../a29-erp
```

Por defeito o **push preserva a paleta do A29** (`tailwind.config.js`, `globals.css`, `index.css`, `p38-identity.css`) e actualiza páginas, componentes e layout com as últimas mudanças do VarejoSync.

Para sobrescrever também as cores: `npm run mirror:push -- ../a29-erp --no-preserve-theme`

Destino no a29-erp: **`legacy/varejosync/`** (snapshot da UI Vite + integrações P38).

## Carimbo de auditoria (palavra-chave)

Cada `mirror:pack` gera **`VAREJO_UI_SYNC.stamp`** na raiz do espelho. No A29 fica em:

```
a29-erp/legacy/varejosync/VAREJO_UI_SYNC.stamp
```

Palavra-chave para procurar: **`VAREJO_UI_SYNC`**

```bash
# No monorepo a29-erp
grep -r "VAREJO_UI_SYNC" legacy/varejosync/
cat legacy/varejosync/VAREJO_UI_SYNC.stamp
```

O ficheiro inclui `export_id` (único por export), commit do varejosync, data e branch.

## mirrorpass (senha de uma palavra)

Ficheiro **`legacy/varejosync/mirrorpass`** — uma só palavra (ex. `mirrorf24e329e`).

**É sempre a mais recente:** só existe um ficheiro; cada `mirror:sync` substitui o anterior. Não há lista de senhas antigas no A29.

Para data e commit de origem, vê também `legacy/varejosync/VAREJO_UI_SYNC.stamp` (`exported_at`, `export_id`).

```bash
cat legacy/varejosync/mirrorpass
cat legacy/varejosync/VAREJO_UI_SYNC.stamp
```

O agente no **a29-erp** responde a *"qual a mirrorpass?"* ou *"qual é a última?"* lendo estes ficheiros.

Snippet para colar no `AGENTS.md` do a29: [`docs/reference-a29-erp/MIRRORPASS_AGENT.md`](../docs/reference-a29-erp/MIRRORPASS_AGENT.md).

## Sync automático (GitHub Actions)

Com secrets `A29_ERP_GIT_URL` e `A29_ERP_DEPLOY_TOKEN` no varejosync: **Actions → Sync mirror to a29-erp → Run workflow**.

## O que vai no espelho

| Origem (varejosync) | Destino (a29-erp) |
|---------------------|-------------------|
| `mirror/p38-ui/` | `legacy/varejosync/` |

Inclui: `src/` (páginas, componentes, `integrations/p38`, etc.), `public/`, ficheiros Vite na raiz.  
**Não inclui:** `base44/` (funções serverless Base44), `node_modules/`, `.env*`.

Lista completa: [`p38-ui/INVENTARIO.md`](./p38-ui/INVENTARIO.md).

## Estrutura

```
mirror/
├── README.md           ← este ficheiro
├── live/               ← carimbos (mirrorpass, stamp) — manter no Git para A29
└── p38-ui/             ← espelho UI (scaffold; gerado por mirror:pack)
```

O pacote `mirror/legacy/` foi removido do repositório (duplicata pesada). Para gerar de novo: `npm run mirror:pack-legacy`.

## Pacote completo (`mirror/legacy/` — gerado localmente)

Para sync **manual** com o A29 (substituir `legacy/varejosync/`):

```bash
npm run mirror:pack-legacy    # copia + valida funções + build:raw verde
```

Depois copia `mirror/legacy/` → `a29-erp/legacy/varejosync/`.

## Estrutura (p38-ui — legado)

## Notas

- O conteúdo **gerado** pelo `mirror:pack` fica **fora do Git** (ver `.gitignore` em `p38-ui/`). Só a documentação e scripts sobem para o remoto.
- Depois de validares no A29, não há sync automático — repete pack + push quando quiseres actualizar o snapshot.
- Para **ler** o a29-erp sem exportar (comparação de embalagens, OCR, etc.): [`docs/reference-a29-erp/README.md`](../docs/reference-a29-erp/README.md).

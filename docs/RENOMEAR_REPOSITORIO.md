# Renomear repositório GitHub → `p38-erp`

O agente Cloud **não tem permissão** para renomear o repositório (HTTP 403). Faz em **2 minutos** no browser:

## Passos

1. Abre: https://github.com/joaoandreriberopacheco-netizen/varejosync/settings  
2. Em **Repository name**, escreve: `p38-erp`  
3. Clica **Rename**

O GitHub redireciona automaticamente `varejosync` → `p38-erp` (URLs antigas continuam a funcionar por um tempo).

## Depois do rename (opcional, no PC)

```bash
git remote set-url origin https://github.com/joaoandreriberopacheco-netizen/p38-erp.git
```

## O que **não** precisas de mudar

| Serviço | Nota |
|---------|------|
| **Vercel** | Mantém ligado ao repo; GitHub redirect resolve |
| **GitHub Actions** | Workflows seguem no mesmo repo renomeado |
| **Secrets** | Ficam no repositório (só muda o nome) |

## Atualizar link no CHANGELOG (opcional)

Após rename, o release tag URL passa a:

`https://github.com/joaoandreriberopacheco-netizen/p38-erp/releases/tag/v1.0.0`

---

*Domínio customizado (Vercel) ficou de fora por decisão do dono — ver `PROFISSIONALIZACAO_P38.md`.*

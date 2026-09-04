# Prompt — colar no agente Cursor do **a29-erp** (uma vez)

O varejosync é **privado** — usa `gh` ou clone, não raw.githubusercontent.com.

Copia o bloco abaixo **inteiro** no chat do agente do **a29-erp**.  
Depois podes só perguntar *"qual a mirrorpass?"*.

---

## Prompt (copiar tudo dentro do bloco)

```
Tarefa única: instalar mirrorpass do VarejoSync no A29.

1) Obter os carimbos do repo privado varejosync (branch main), pasta mirror/live/:
   - mirrorpass
   - VAREJO_UI_SYNC.stamp
   - MIRROR_PASS.leia-me.txt

   Opção A — se tens varejosync ao lado do a29-erp no disco:
     copiar de ../varejosync/mirror/live/ para legacy/varejosync/

   Opção B — com GitHub CLI autenticado:
     gh api repos/joaoandreriberopacheco-netizen/P38-ERP/contents/mirror/live/mirrorpass?ref=main --jq '.content' | base64 -d > legacy/varejosync/mirrorpass
     (repetir para VAREJO_UI_SYNC.stamp e MIRROR_PASS.leia-me.txt)

   Opção C — clone raso temporário:
     git clone --depth 1 --branch main https://github.com/joaoandreriberopacheco-netizen/P38-ERP.git /tmp/p38-erp-mirror
     cp /tmp/p38-erp-mirror/mirror/live/mirrorpass /tmp/p38-erp-mirror/mirror/live/VAREJO_UI_SYNC.stamp /tmp/p38-erp-mirror/mirror/live/MIRROR_PASS.leia-me.txt legacy/varejosync/

2) Garantir que existem em legacy/varejosync/ (criar pasta se faltar).

3) Adicionar ao AGENTS.md (ou .cursor/rules/mirrorpass-a29.mdc):
   - Perguntas mirrorpass / senha do espelho / chegou o varejo → ler legacy/varejosync/mirrorpass (uma palavra; sempre a mais recente).
   - NÃO confundir com Modo Flare (features/modo-flare).
   - Se mirrorpass não existir → sync ainda não chegou.

4) Commit: chore(legacy): mirrorpass do varejosync + regra agente
   Push (ou PR draft).

5) Responde: a mirrorpass gravada + exported_at do stamp.
```

---

## Depois (só perguntar)

- *"Qual a mirrorpass?"*
- *"Chegou o espelho do varejo?"*

---

## Senha publicada agora no varejosync main

Ver `mirror/live/mirrorpass` no repo varejosync (após merge em main).

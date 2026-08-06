# Contrato de Dados — flare-pending.json

> Schema Version: 1.1 | Caminho: `docs/flare-export/flare-pending.json`

## Estrutura

```json
{
  "_meta": {
    "schema_version": "1.1",
    "generated_by": "base44/exportFlareToGithub",
    "exported_at": "ISO8601",
    "environment": "production",
    "app": "p38-erp",
    "count": 0,
    "content_hash": "hex8chars",
    "valid_statuses": ["pending","in_progress","ready_for_verify","resolved","reopened","ignored"],
    "github": { "owner": "...", "repo": "...", "branch": "main", "path": "docs/flare-export/flare-pending.json" }
  },
  "items": [{
    "id": "string (UUID Base44)",
    "status": "pending | in_progress | ready_for_verify | resolved | reopened | ignored",
    "file_path": "src/pages/Home.jsx",
    "line": 42,
    "column": 6,
    "source_location_raw": "src/pages/Home.jsx:42:6",
    "component_name": "Home",
    "briefing": "Descrição do problema",
    "action_briefing": "Acção objectiva esperada",
    "confidence": "high | medium",
    "resolution_precision": "high | medium | unknown | null",
    "context_image_url": "https://... | null",
    "route": "/rota-react | null",
    "created_date": "ISO8601",
    "updated_date": "ISO8601"
  }]
}
```

## Política de Versionamento
- **Patch** (1.1 → 1.2): novos campos opcionais — retrocompatível
- **Minor** (1.x → 2.0): campos removidos ou renomeados — breaking
- Cursor DEVE verificar `_meta.schema_version` antes de consumir
- Breaking changes: 2 sprints de deprecação antes da remoção

## Idempotência
O campo `content_hash` identifica unicamente o estado do payload.
Se o hash não mudou desde o último commit, a função faz skip sem commit duplicado.

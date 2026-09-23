# Rollback migrations 104–105 (card vermelho após desmembramento)

## Quando usar

Se a regra «vermelho só após 1.º despacho» causar problema operacional e precisar voltar ao comportamento anterior (views da migration 103).

## Passos

1. **Restaurar views da 103**:

   ```bash
   npm run db:rollback-104
   ```

2. **Marcar migrations como revertidas** (opcional):

   ```sql
   delete from supabase_migrations.schema_migrations
   where version in (
     '104_card_vermelho_apos_desmembramento',
     '105_card_vermelho_falta_operacional'
   );
   ```

3. **Revert no Git** (JS + migrations):

   ```bash
   git revert <commits-104-105> --no-edit
   git push origin cursor/pedido-desmembramento-folha-290b
   ```

## O que o rollback desfaz

- Remove `p38_pedido_desmembramento_iniciado()`
- Restaura views **sem** gate de desmembramento iniciado
- Card vermelho volta a incluir pedidos sem 1.º embarque (ex. Cocil DZU-XV3)

## Verificação

```bash
npm run compras:listar-vermelho-normal
```

Com rollback: ~37 vermelhos (comportamento antigo inflado).  
Com 104+105: **8 vermelhos**, **33 normais** (regra acordada).

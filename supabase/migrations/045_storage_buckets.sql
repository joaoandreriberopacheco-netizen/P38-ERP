-- 045_storage_buckets.sql
-- Buckets de Storage usados pelo P38 (anexos, imagens, comprovantes).
-- Sem estes buckets, UploadFile no importador OCR devolve "Bucket not found".

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('anexos', 'anexos', true, 52428800),
  ('produtos-imagens', 'produtos-imagens', true, 10485760),
  ('comprovantes', 'comprovantes', true, 52428800)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Single-tenant: anon/authenticated podem ler e escrever nos buckets P38.
do $$
declare
  pol record;
begin
  for pol in
    select *
    from (values
      ('p38_anexos_select', 'anexos', 'select'),
      ('p38_anexos_insert', 'anexos', 'insert'),
      ('p38_anexos_update', 'anexos', 'update'),
      ('p38_anexos_delete', 'anexos', 'delete'),
      ('p38_produtos_imagens_select', 'produtos-imagens', 'select'),
      ('p38_produtos_imagens_insert', 'produtos-imagens', 'insert'),
      ('p38_produtos_imagens_update', 'produtos-imagens', 'update'),
      ('p38_produtos_imagens_delete', 'produtos-imagens', 'delete'),
      ('p38_comprovantes_select', 'comprovantes', 'select'),
      ('p38_comprovantes_insert', 'comprovantes', 'insert'),
      ('p38_comprovantes_update', 'comprovantes', 'update'),
      ('p38_comprovantes_delete', 'comprovantes', 'delete')
    ) as t(policy_name, bucket_id, cmd)
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policy_name);

    if pol.cmd = 'select' then
      execute format(
        'create policy %I on storage.objects for select to anon, authenticated using (bucket_id = %L)',
        pol.policy_name,
        pol.bucket_id
      );
    elsif pol.cmd = 'insert' then
      execute format(
        'create policy %I on storage.objects for insert to anon, authenticated with check (bucket_id = %L)',
        pol.policy_name,
        pol.bucket_id
      );
    elsif pol.cmd = 'update' then
      execute format(
        'create policy %I on storage.objects for update to anon, authenticated using (bucket_id = %L)',
        pol.policy_name,
        pol.bucket_id
      );
    elsif pol.cmd = 'delete' then
      execute format(
        'create policy %I on storage.objects for delete to anon, authenticated using (bucket_id = %L)',
        pol.policy_name,
        pol.bucket_id
      );
    end if;
  end loop;
end$$;

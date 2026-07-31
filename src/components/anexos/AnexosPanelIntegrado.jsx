import React, { useState, useEffect, useMemo } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { listarAnexos } from '@/functions/listarAnexos';
import { deletarAnexo } from '@/functions/deletarAnexo';
import { uploadAnexoDrive } from '@/functions/uploadAnexoDrive';
import AnexosModal from './AnexosModal';

/**
 * @param {{ referencia_tipo: string, referencia_id: string, label: string }[]} referencias
 * @param {{ referencia_tipo: string, referencia_id: string } | null} [uploadTarget] — onde novos uploads são gravados; default primeiro da lista
 */
export default function AnexosPanelIntegrado({
  referencias = [],
  referenciaNomero = '',
  inline = false,
  readOnly = false,
  uploadTarget = null,
  initialModalOpen = false,
  onModalClose = null,
}) {
  const [anexos, setAnexos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(initialModalOpen);

  const alvoUpload = useMemo(() => {
    if (uploadTarget?.referencia_tipo && uploadTarget?.referencia_id) return uploadTarget;
    const first = referencias[0];
    if (first?.referencia_tipo && first?.referencia_id) {
      return { referencia_tipo: first.referencia_tipo, referencia_id: first.referencia_id };
    }
    return null;
  }, [referencias, uploadTarget]);

  const carregar = async () => {
    if (!referencias.length) {
      setAnexos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const lotes = await Promise.all(
        referencias.map(async (r) => {
          const res = await listarAnexos({
            referencia_tipo: r.referencia_tipo,
            referencia_id: r.referencia_id,
          });
          const list = res.data?.anexos || [];
          return list.map((a) => ({ ...a, origem_label: r.label }));
        })
      );
      const merged = lotes.flat();
      const byId = new Map();
      merged.forEach((a) => {
        if (a?.id && !byId.has(a.id)) byId.set(a.id, a);
      });
      setAnexos([...byId.values()]);
    } finally {
      setLoading(false);
    }
  };

  const refsKey = referencias
    .map((r) => `${r.referencia_tipo}:${r.referencia_id}`)
    .sort()
    .join('|');

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refsKey cobre mudanças nas referências
  }, [refsKey]);

  useEffect(() => {
    if (initialModalOpen) setModalOpen(true);
  }, [initialModalOpen]);

  const handleUpload = async (file, tipoSelecionado, e) => {
    if (!alvoUpload || readOnly) return tipoSelecionado;
    setUploading(true);
    try {
      await uploadAnexoDrive({
        file,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        referencia_tipo: alvoUpload.referencia_tipo,
        referencia_id: alvoUpload.referencia_id,
        referencia_numero: referenciaNomero,
        tipo_documento: tipoSelecionado,
      });
      await carregar();
    } finally {
      setUploading(false);
    }
    if (e) e.target.value = '';
    return tipoSelecionado;
  };

  const handleDelete = async (anexo) => {
    await deletarAnexo({ anexo_id: anexo.id, drive_file_id: anexo.drive_file_id });
    setAnexos((prev) => prev.filter((a) => a.id !== anexo.id));
  };

  const fabClass = inline
    ? 'relative flex items-center justify-center w-9 h-9 rounded-full bg-muted hover:bg-muted dark:hover:bg-muted transition-colors'
    : 'fixed right-6 z-[55] flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg transition-colors hover:bg-primary/90 dark:bg-muted dark:hover:bg-card p38-bottom-fab1';
  const iconClass = inline
    ? 'w-4 h-4 text-muted-foreground dark:text-foreground/90'
    : 'w-5 h-5 text-foreground dark:text-foreground';
  const badgeClass = inline
    ? 'absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-muted text-foreground dark:bg-card dark:text-foreground text-[0.5rem] font-bold flex items-center justify-center'
    : 'absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-card text-foreground text-[0.55rem] font-bold flex items-center justify-center shadow';

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={fabClass}
        title="Anexos"
      >
        {loading ? (
          <Loader2 className={`${iconClass} animate-spin`} />
        ) : (
          <Paperclip className={iconClass} />
        )}
        {!loading && anexos.length > 0 && (
          <span className={badgeClass}>{anexos.length > 9 ? '9+' : anexos.length}</span>
        )}
      </button>

      <AnexosModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          onModalClose?.();
        }}
        anexos={anexos}
        onUpload={handleUpload}
        onDelete={handleDelete}
        uploading={uploading}
        referenciaNomero={referenciaNomero}
        readOnly={readOnly}
      />
    </>
  );
}

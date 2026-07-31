import React, { useState, useEffect } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { listarAnexos } from '@/functions/listarAnexos';
import { deletarAnexo } from '@/functions/deletarAnexo';
import { uploadAnexoDrive } from '@/functions/uploadAnexoDrive';
import AnexosModal from './AnexosModal';

export default function AnexosPanel({ referenciaId, referenciaTipo, referenciaNomero = '', inline = false, readOnly = false }) {
  const [anexos, setAnexos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const res = await listarAnexos({ referencia_tipo: referenciaTipo, referencia_id: referenciaId });
    setAnexos(res.data?.anexos || []);
    setLoading(false);
  };

  useEffect(() => {
    if (referenciaId && referenciaTipo) carregar();
  }, [referenciaId, referenciaTipo]);

  const handleUpload = async (file, tipoSelecionado, e) => {
    setUploading(true);
    try {
      await uploadAnexoDrive({
        file,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        referencia_tipo: referenciaTipo,
        referencia_id: referenciaId,
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
    setAnexos(prev => prev.filter(a => a.id !== anexo.id));
  };

  const fabClass = inline
    ? "relative flex items-center justify-center w-9 h-9 rounded-full bg-muted hover:bg-muted dark:hover:bg-muted transition-colors"
    : "fixed right-6 z-[55] flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg transition-colors hover:bg-primary/90 dark:bg-muted dark:hover:bg-card p38-bottom-fab1";
  const iconClass = inline
    ? "w-4 h-4 text-muted-foreground dark:text-foreground/90"
    : "w-5 h-5 text-foreground dark:text-foreground";
  const badgeClass = inline
    ? "absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-muted text-foreground dark:bg-card dark:text-foreground text-[0.5rem] font-bold flex items-center justify-center"
    : "absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-card text-foreground text-[0.55rem] font-bold flex items-center justify-center shadow";

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={fabClass}
        title="Anexos"
      >
        {loading
          ? <Loader2 className={`${iconClass} animate-spin`} />
          : <Paperclip className={iconClass} />
        }
        {!loading && anexos.length > 0 && (
          <span className={badgeClass}>
            {anexos.length > 9 ? '9+' : anexos.length}
          </span>
        )}
      </button>

      <AnexosModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
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
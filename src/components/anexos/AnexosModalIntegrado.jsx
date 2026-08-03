import React, { useEffect, useMemo, useState } from 'react';
import { listarAnexos } from '@/functions/listarAnexos';
import { deletarAnexo } from '@/functions/deletarAnexo';
import { uploadAnexoDrive } from '@/functions/uploadAnexoDrive';
import AnexosModal from './AnexosModal';

/**
 * Modal de anexos com lista agregada de várias referências (mesma UX que AnexosPanelIntegrado).
 */
export default function AnexosModalIntegrado({
  isOpen,
  onClose,
  referencias = [],
  referenciaNomero = '',
  readOnly = false,
  uploadTarget = null,
}) {
  const [anexos, setAnexos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const alvoUpload = useMemo(() => {
    if (uploadTarget?.referencia_tipo && uploadTarget?.referencia_id) return uploadTarget;
    const first = referencias[0];
    if (first?.referencia_tipo && first?.referencia_id) {
      return { referencia_tipo: first.referencia_tipo, referencia_id: first.referencia_id };
    }
    return null;
  }, [referencias, uploadTarget]);

  const refsKey = referencias
    .map((r) => `${r.referencia_tipo}:${r.referencia_id}`)
    .sort()
    .join('|');

  const carregar = async () => {
    if (!isOpen || !referencias.length) {
      setAnexos([]);
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

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refsKey + isOpen
  }, [refsKey, isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className={loading && anexos.length === 0 ? 'opacity-95' : ''}>
      <AnexosModal
        isOpen={isOpen}
        onClose={onClose}
        anexos={anexos}
        onUpload={handleUpload}
        onDelete={handleDelete}
        uploading={uploading}
        referenciaNomero={referenciaNomero}
        readOnly={readOnly}
      />
    </div>
  );
}

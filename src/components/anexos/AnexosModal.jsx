import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, FileText, Image, File, Trash2, ExternalLink, Loader2, Upload, Printer, Plus } from 'lucide-react';
import exportAnexosToPdf from '@/components/anexos/exportAnexosToPdf';
import TipoDocumentoSearch from '@/components/anexos/TipoDocumentoSearch';
import { TIPOS_DOCUMENTO_ANEXO, ORDEM_TIPOS_DOCUMENTO_ANEXO } from '@/lib/tiposDocumentoAnexo';
import { brandSurface } from '@/lib/brandSurfaces';

const TIPOS_DOCUMENTO = TIPOS_DOCUMENTO_ANEXO;
const ORDER = ORDEM_TIPOS_DOCUMENTO_ANEXO;
const sendDebugLog = (payload) => {
  fetch('http://127.0.0.1:7433/ingest/19dc4542-f04e-4f0d-8afd-9f77d7005162', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '0cc0d0' },
    body: JSON.stringify({
      sessionId: '0cc0d0',
      runId: 'initial',
      timestamp: Date.now(),
      ...payload,
    }),
  }).catch(() => {});
};

function ThumbnailIcon({ anexo, large = false }) {
  const [imgError, setImgError] = useState(false);
  const size = large ? 'w-12 h-12 rounded-2xl' : 'w-10 h-10 rounded-xl';
  const iconSize = large ? 'w-6 h-6' : 'w-5 h-5';

  if (anexo.url_thumbnail && !imgError) {
    return (
      <img
        src={anexo.url_thumbnail}
        alt={anexo.nome_arquivo}
        className={`${size} flex-none object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }
  const isPdf = anexo.mime_type?.includes('pdf');
  const isImage = anexo.mime_type?.startsWith('image/');
  return (
    <div className={`${size} flex flex-none items-center justify-center bg-muted dark:bg-muted`}>
      {isPdf ? (
        <FileText className={`${iconSize} text-muted-foreground dark:text-muted-foreground`} />
      ) : isImage ? (
        <Image className={`${iconSize} text-muted-foreground dark:text-muted-foreground`} />
      ) : (
        <File className={`${iconSize} text-muted-foreground dark:text-muted-foreground`} />
      )}
    </div>
  );
}

function AnexoCard({ anexo, onDelete, readOnly = false }) {
  const [deleting, setDeleting] = useState(false);
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`flex items-center gap-3 rounded-2xl p-3 ${brandSurface.card}`}>
      <ThumbnailIcon anexo={anexo} />
      <div className="min-w-0 flex-1">
        <a
          href={anexo.url_drive}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground dark:text-foreground dark:hover:text-foreground"
        >
          <span className="truncate">{anexo.nome_arquivo}</span>
          <ExternalLink className="h-3.5 w-3.5 flex-none text-muted-foreground dark:text-muted-foreground" />
        </a>
        {anexo.origem_label && (
          <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-muted-foreground">{anexo.origem_label}</p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground dark:text-muted-foreground">{formatSize(anexo.tamanho_bytes)}</p>
        {anexo.descricao && (
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground dark:text-muted-foreground">{anexo.descricao}</p>
        )}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={async () => {
            setDeleting(true);
            await onDelete(anexo);
            setDeleting(false);
          }}
          disabled={deleting}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

export default function AnexosModal({ isOpen, onClose, anexos, onUpload, onDelete, uploading, referenciaNomero, pedidoId, readOnly = false }) {
  const [tipoSelecionado, setTipoSelecionado] = useState('Comprovante');
  const [tiposCustomizados, setTiposCustomizados] = useState([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (!isOpen) setAddSheetOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const modalRoot = document.querySelector('.fixed.inset-0.z-\\[100\\]');
    const addFab = document.querySelector('button[title="Adicionar anexo"]');
    // #region agent log
    sendDebugLog({
      hypothesisId: 'H2',
      location: 'AnexosModal.jsx:113',
      message: 'Anexos modal layering snapshot',
      data: {
        isOpen,
        addSheetOpen,
        modalClass: modalRoot?.className || null,
        addFabClass: addFab?.className || null,
        addFabRect: addFab?.getBoundingClientRect() || null,
      },
    });
    // #endregion
  }, [isOpen, addSheetOpen, anexos.length]);

  const handleExportPdf = async () => {
    if (exportingPdf || anexos.length === 0) return;

    setExportingPdf(true);
    await exportAnexosToPdf(anexos, { pedidoId, pedidoNumero: referenciaNomero });
    setExportingPdf(false);
  };

  const tiposDisponiveis = useMemo(() => {
    const tiposDosAnexos = anexos.map((a) => a.tipo_documento).filter(Boolean);
    return Array.from(new Set([...TIPOS_DOCUMENTO, ...tiposCustomizados, ...tiposDosAnexos]));
  }, [anexos, tiposCustomizados]);

  const grupos = useMemo(() => {
    const ordemFinal = [...ORDER, ...tiposDisponiveis.filter((tipo) => !ORDER.includes(tipo))];
    return ordemFinal.reduce((acc, tipo) => {
      const itens = anexos.filter((a) => (a.tipo_documento || 'Comprovante') === tipo);
      if (itens.length > 0) acc.push({ tipo, itens });
      return acc;
    }, []);
  }, [anexos, tiposDisponiveis]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const tipoUsado = await onUpload(file, tipoSelecionado, e);
    if (tipoUsado && !TIPOS_DOCUMENTO.includes(tipoUsado)) {
      setTiposCustomizados((prev) => (prev.includes(tipoUsado) ? prev : [...prev, tipoUsado]));
    }
    setAddSheetOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden ${brandSurface.pageScreen}`}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-4 pt-6">
        <div className="min-w-0">
          <h2 className="font-glacial text-xl font-semibold text-foreground dark:text-foreground">Anexos</h2>
          {referenciaNomero && (
            <p className="mt-0.5 truncate text-xs uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">{referenciaNomero}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf || anexos.length === 0}
            className="flex h-9 items-center justify-center gap-2 rounded-full bg-muted px-3 transition-colors hover:bg-muted disabled:opacity-50 dark:bg-muted dark:hover:bg-muted/80"
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            <span className="text-xs font-medium text-muted-foreground dark:text-foreground">PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted dark:bg-muted dark:hover:bg-muted/80"
          >
            <X className="h-4 w-4 text-muted-foreground dark:text-foreground" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-t-3xl bg-card px-5 py-5 shadow-inner dark:bg-card">
        {anexos.length === 0 ? (
          <div className="flex h-full min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted dark:bg-muted">
              <File className="h-7 w-7 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">Nenhum anexo ainda</p>
            {!readOnly && (
              <p className="max-w-xs text-xs text-muted-foreground dark:text-muted-foreground">
                Use o botão + para escolher o tipo de documento e enviar um arquivo.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {readOnly && (
              <div className={`rounded-2xl px-4 py-3 text-sm ${brandSurface.cardInset} text-muted-foreground dark:text-muted-foreground`}>
                Visualização apenas: você pode abrir os anexos, mas não pode adicionar nem excluir arquivos.
              </div>
            )}
            {grupos.map(({ tipo, itens }) => (
              <div key={tipo}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">{tipo}</span>
                  <span className="text-[0.65rem] text-muted-foreground dark:text-muted-foreground/50">·</span>
                  <span className="text-[0.65rem] text-muted-foreground dark:text-muted-foreground">{itens.length}</span>
                </div>
                <div className="space-y-2">
                  {itens.map((anexo) => (
                    <AnexoCard key={anexo.id} anexo={anexo} onDelete={onDelete} readOnly={readOnly} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => setAddSheetOpen(true)}
            className="fixed right-5 z-[102] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 p38-bottom-fab1 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:right-8"
            title="Adicionar anexo"
          >
            <Plus className="h-7 w-7" />
          </button>

          {addSheetOpen && (
            <div
              className="fixed inset-0 z-[103] flex flex-col justify-end bg-black/45 backdrop-blur-[2px]"
              role="presentation"
              onClick={() => !uploading && setAddSheetOpen(false)}
            >
              <div
                className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-border bg-background px-5 pb-8 pt-5 shadow-2xl"
                style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
                role="dialog"
                aria-label="Adicionar anexo"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
                <p className="mb-3 text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground">
                  Tipo do documento
                </p>
                <TipoDocumentoSearch
                  tipos={tiposDisponiveis}
                  value={tipoSelecionado}
                  onChange={setTipoSelecionado}
                  hideListUntilFocused
                  generousPadding
                  onAdicionarTipoNovo={(t) =>
                    setTiposCustomizados((prev) => (prev.includes(t) ? prev : [...prev, t]))
                  }
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading || !String(tipoSelecionado || '').trim()}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-muted/50 py-4 text-foreground/90 transition-colors hover:bg-muted dark:text-foreground disabled:opacity-40"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      <span className="text-sm font-medium">Selecionar arquivo</span>
                    </>
                  )}
                </button>
                <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

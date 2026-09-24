/** Alguns apps enviam imagem só como data URL no campo text. */
export function fileFromDataUrlText(text) {
  const s = String(text || '').trim();
  const m = s.match(/^data:((?:image\/[a-z0-9.+-]+)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const b64 = m[2].replace(/\s/g, '');
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = type === 'application/pdf' ? '.pdf' : type.includes('png') ? '.png' : '.jpg';
    return new File([bytes], `partilha${ext}`, { type });
  } catch (_) {
    return null;
  }
}

/**
 * Extrai ficheiros do multipart do Web Share Target (Chrome/Android/WhatsApp).
 * Usado no fallback POST (Next) e espelhado em public/sw.js.
 */
export function collectFilesFromShareFormData(formData) {
  const out = [];
  const seen = new Set();
  const add = (v) => {
    if (!v) return;
    let file = null;
    if (typeof File !== 'undefined' && v instanceof File && v.size > 0) {
      file = v;
    } else if (typeof Blob !== 'undefined' && v instanceof Blob && v.size > 0) {
      const nome = v.name || 'arquivo';
      try {
        file = new File([v], nome, { type: v.type || 'application/octet-stream' });
      } catch (_) {
        file = v;
      }
    }
    if (!file || file.size === 0) return;
    const key = `${file.name}|${file.size}|${file.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(file);
  };

  const fieldNames = [
    'files',
    'file',
    'files[]',
    'image',
    'media',
    'attachment',
    'share',
    'documents',
    'images',
    'photos',
    'picture',
  ];
  for (const name of fieldNames) {
    try {
      formData.getAll(name).forEach(add);
    } catch (_) {
      /* ignore */
    }
  }

  if (out.length === 0) {
    try {
      for (const [key, val] of formData.entries()) {
        if (key === 'title' || key === 'text' || key === 'url') continue;
        add(val);
      }
    } catch (_) {
      /* ignore */
    }
  }

  if (out.length === 0) {
    try {
      const textVal = formData.get('text');
      const fromDataUrl = fileFromDataUrlText(textVal);
      if (fromDataUrl) out.push(fromDataUrl);
    } catch (_) {
      /* ignore */
    }
  }

  return out;
}

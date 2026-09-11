/**
 * Fotos de forro PVC e perfis — revendedores (Forrotex, Oca/Plasmeg).
 * Dimensões alinhadas ao mix P38: 8×200×6000 mm (forros) e perfis 6 m.
 */
export const FORRO_PVC_IMAGENS = {
  '2IB-P0W': {
    url: 'https://cdn.awsli.com.br/800x800/2620/2620642/produto/232674636/forro-pvc-branco-frisado-gso6f9n302.jpg',
    fonte_ref: 'forrotex:forro-frisado-200x8',
    label: 'Forro PVC branco frisado',
  },
  '683-4QL': {
    url: 'https://cdn.awsli.com.br/800x800/2405/2405744/produto/367325457/255555-1000-1000-fn7psy7oxu.jpg',
    fonte_ref: 'oca-plasmeg:forro-canelado-gemini',
    label: 'Forro PVC branco canalado Gemini',
  },
  'LSZ-65P': {
    url: 'https://cdn.awsli.com.br/800x800/2405/2405744/produto/367325500/255559-1000-1000-vrzw7b0fl0.jpg',
    fonte_ref: 'oca-plasmeg:perfil-colonial',
    label: 'Perfil PVC colonial branco 6 m',
  },
  'QYI-7MI': {
    url: 'https://cdn.awsli.com.br/800x800/2620/2620642/produto/226640092/perfil-f-pvc--1--na5vuyesw7.jpg',
    fonte_ref: 'forrotex:perfil-f',
    label: 'Perfil PVC F branco 6 m',
  },
  'LXE-85B': {
    url: 'https://cdn.awsli.com.br/800x800/2620/2620642/produto/226641576/perfil-h-pvc-bf0dw2dctr.jpg',
    fonte_ref: 'forrotex:perfil-h',
    label: 'Perfil PVC H branco 6 m',
  },
  'E6M-3SX': {
    url: 'https://cdn.awsli.com.br/800x800/2620/2620642/produto/226636166/perfil-u-pvc-gff0vssy8o.jpg',
    fonte_ref: 'forrotex:perfil-u',
    label: 'Perfil PVC U branco 6 m',
  },
};

/**
 * @param {string} codigoInterno — SKU P38 (codigo_interno)
 */
export function resolveForroPvcImagem(codigoInterno) {
  const key = String(codigoInterno || '').toUpperCase();
  const hit = FORRO_PVC_IMAGENS[key];
  if (!hit?.url) return null;
  return {
    url: hit.url,
    fonte: 'import',
    fonte_ref: hit.fonte_ref,
    label: hit.label,
  };
}

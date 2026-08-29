import manifest from '@/data/estudoCatalogManifest.generated.json';

let _cache = null;

/** Manifest JSON gerado a partir do Excel de estudo — âncora offline. */
export function getEstudoCatalogManifest() {
  if (!_cache) _cache = manifest;
  return _cache;
}

export function getEstudoManifestMeta() {
  const m = getEstudoCatalogManifest();
  return {
    source: m.source,
    version: m.version,
    count: m.count,
    sheets: m.sheets || [],
  };
}

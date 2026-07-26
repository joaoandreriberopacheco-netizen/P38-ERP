/**
 * Refina hierarquia de produto (campos 1–5) com regras de negócio P38.
 * Campo 1 = produto de compra; campo 2 = apresentação; 4–5 = variante/marca.
 */

function norm(s) {
  return String(s || '').trim();
}

function upper(s) {
  return norm(s).toUpperCase();
}

function formatVolume(raw) {
  const t = norm(raw).replace(/\s+/g, ' ');
  const m = t.match(/(\d+[,.]?\d*)\s*(L|ML|KG|G)\b/i);
  if (!m) return t;
  const n = m[1].replace('.', ',');
  const u = upper(m[2]);
  if (u === 'L' || u === 'ML') return `(${n} ${u === 'ML' ? 'ML' : 'L'})`;
  return `${n} ${u}`;
}

function extractPresentation(text) {
  const t = norm(text);
  const patterns = [
    /\((\d+[,.]?\d*\s*(?:L|ML|KG|G))\)/i,
    /\b(BD|GL|SC)\b(?:\s*(\d+[,.]?\d*\s*KG))?/i,
    /\b(\d+[,.]?\d*\s*KG)\b/i,
    /\b(\d+[,.]?\d*\s*(?:ML|L))\b/i,
    /\b(\d+\s*[x×]\s*\d+(?:\s*[x×]\s*\d+)?(?:\s*M)?)\b/i,
    /\b(\d+\s*MM)\b/i,
    /\b(\d+\s*M)\b/i,
    /\b(\d+\/\d+)\b/,
    /\b(\d+[,.]?\d*)\s*"\b/,
    /\bDN\s*(\d+)\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    if (re.source.includes('L|ML|KG')) return formatVolume(m[1] || m[0]);
    if (m[1] && /^\d+\s*[x×]/i.test(m[1])) return upper(m[1].replace(/×/g, 'x'));
    return norm(m[1] || m[0]);
  }
  return '';
}

function extractMarcaFromNome(nome, marca) {
  if (norm(marca)) return norm(marca);
  const brands = [
    'HIPERCOR', 'VERBRAS', 'CITYCOLOR', 'TRAMONTINA', 'QUARTZOLIT', 'JBMIX',
    'HIDRACOR', 'IQUINE', 'VERTEX', 'POUPE+', 'LUX', 'ILUMI', 'PERLEX', 'ROMA',
    'TEKBOND', 'COLORGIN', 'RENNER', 'NORTFORT', 'JAPI', 'TIGRE', 'AMANCO',
  ];
  const n = upper(nome);
  for (const b of brands) {
    if (n.includes(b)) return b.charAt(0) + b.slice(1).toLowerCase().replace('hypercor', 'Hipercor');
  }
  const found = brands.find((b) => n.includes(b));
  return found || '';
}

function buildNome(h1, h2, h3, h4, h5) {
  return [h1, h2, h3, h4, h5].map(norm).filter(Boolean).join(' ').trim();
}

function inferTintaProduct(nome) {
  const n = upper(nome);
  if (/ESMALTE/.test(n)) return 'TINTA ESMALTE SINTÉTICO';
  if (/SELADOR/.test(n)) return 'TINTA SELADOR ACRÍLICO';
  if (/THINNER/.test(n)) return 'THINNER';
  if (/VERNIZ/.test(n)) return 'VERNIZ';
  if (/SPRAY/.test(n)) return 'TINTA SPRAY';
  if (/P\/\s*PISO|PARA PISO/.test(n)) return 'TINTA P/ PISO';
  if (/ACR.*FOSCO/.test(n)) return 'TINTA ACR. FOSCO ECON.';
  if (/SEMI.?BRILHO/.test(n)) return 'TINTA SEMI-BRILHO';
  if (/STANDARD/.test(n)) return 'TINTA STANDARD';
  if (/ASFALT/.test(n)) return 'TINTA ASFÁLTICA';
  if (/TINTA/.test(n)) return 'TINTA';
  return '';
}

function inferMassaProduct(nome) {
  const n = upper(nome);
  if (/MASSA\s+CORRIDA/.test(n)) return 'MASSA CORRIDA';
  if (/MASSA\s+ACRIL/.test(n)) return 'MASSA ACRÍLICA';
  if (/MASSA\s+ASFALT/.test(n)) return 'MASSA ASFÁLTICA';
  if (/MANTA\s+L[IÍ]QUIDA/.test(n)) return 'MANTA LÍQUIDA';
  return '';
}

function inferPerfilPvc(nome) {
  const n = upper(nome);
  if (!/PERFIL/.test(n) || !/PVC/.test(n)) return null;
  let tipo = 'PERFIL PVC';
  if (/COLONIAL/.test(n)) tipo = 'PERFIL PVC COLONIAL';
  else if (/\bU\b/.test(n) || / PERFIL DE PVC U /.test(n)) tipo = 'PERFIL PVC U';
  else if (/\bF\b/.test(n)) tipo = 'PERFIL PVC F';
  const comp = n.match(/\b(\d+)\s*M\b/);
  return { h1: tipo, h2: comp ? `${comp[1]} M` : 'AVULSO' };
}

function inferTomada(nome) {
  if (!/TOMADA/.test(upper(nome))) return null;
  const n = upper(nome);
  const amps = n.match(/(\d+)\s*A/);
  const tipo = /DUPLA/.test(n) ? 'DUPLA' : 'SIMPLES';
  const linha = n.match(/(ARIA|LUX|ILUMI)/);
  return {
    h1: 'TOMADA',
    h2: amps ? `${amps[1]}A ${tipo}` : tipo,
    h3: linha ? linha[1] : '',
  };
}

function inferTorneira(nome) {
  if (!/TORNEIRA/.test(upper(nome))) return null;
  const n = upper(nome);
  let tipo = 'TORNEIRA';
  if (/P\/\s*LAVATORIO|LAVATORIO/.test(n)) tipo = 'TORNEIRA P/ LAVATÓRIO';
  else if (/P\/\s*JARDIM|JARDIM/.test(n)) tipo = 'TORNEIRA P/ JARDIM';
  else if (/MESA/.test(n)) tipo = 'TORNEIRA DE MESA';
  else if (/MONOCOMANDO/.test(n)) tipo = 'TORNEIRA MONOCOMANDO';
  const dn = n.match(/DN\s*(\d+)/);
  const bit = n.match(/BICA\s+(MOVEL|MÓVEL|FIXA)/);
  const h3 = [dn ? `DN${dn[1]}` : '', bit ? 'BICA MÓVEL' : ''].filter(Boolean).join(' ');
  return { h1: tipo, h2: h3 || extractPresentation(nome) || 'AVULSO', h3: '' };
}

function inferRevestimento(nome) {
  const n = upper(nome);
  if (!/^(REV|REVESTIMENTO)\b/.test(n) && !/REVESTIMENTO/.test(n)) {
    const dim = n.match(/\b(\d+\s*[x×]\s*\d+)\b/);
    if (dim && /REV|FILETO|EURO|GALICIA/i.test(nome)) {
      return { h1: 'REVESTIMENTO', h2: dim[1].replace(/×/g, 'x'), h3: '' };
    }
    return null;
  }
  const dim = extractPresentation(nome);
  return { h1: 'REVESTIMENTO', h2: dim || 'AVULSO', h3: '' };
}

function inferTeTubo(nome) {
  const n = upper(nome);
  if (/^TE\s+/.test(n) || /\bTE\s+ESGOTO/.test(n)) {
    const mm = n.match(/(\d+)\s*MM/);
    return { h1: 'TE ESGOTO', h2: mm ? `${mm[1]} MM` : extractPresentation(nome) || 'AVULSO' };
  }
  if (/^TUBO\s+/.test(n) || /\bTUBO\s+ESGOTO/.test(n)) {
    const mm = n.match(/(\d+)\s*MM/);
    return { h1: 'TUBO ESGOTO', h2: mm ? `${mm[1]} MM` : 'AVULSO' };
  }
  return null;
}

function inferRegistro(nome) {
  if (!/REGISTRO/.test(upper(nome))) return null;
  const n = upper(nome);
  let h1 = 'REGISTRO';
  if (/ESFERA/.test(n)) h1 = 'REGISTRO ESFERA';
  if (/ESGOTO/.test(n)) h1 = 'REGISTRO ESGOTO';
  if (/PRESSAO|PRESSÃO/.test(n)) h1 = 'REGISTRO PRESSÃO';
  const rosca = n.match(/(\d+\/\d+|\d+\s*MM)/);
  return { h1, h2: rosca ? rosca[1] : extractPresentation(nome) || 'AVULSO' };
}

function inferArgamassaMassaFromNome(nome) {
  const massa = inferMassaProduct(nome);
  if (massa) {
    const apres = extractPresentation(nome) || (/\bBD\b/i.test(nome) ? extractPresentation(nome.replace('BD', '')) : '');
    const kg = nome.match(/(\d+)\s*KG/i);
    return {
      h1: massa,
      h2: kg ? `${kg[1]} KG` : apres || 'AVULSO',
    };
  }
  if (/ARGAMASSA/.test(upper(nome))) {
    const kg = nome.match(/(\d+)\s*KG/i);
    const ac = nome.match(/AC-(\d)/i);
    return {
      h1: ac ? `ARGAMASSA AC-${ac[1]}` : 'ARGAMASSA',
      h2: kg ? `${kg[1]} KG` : 'AVULSO',
    };
  }
  return null;
}

function inferMateriaisBasicos(nome) {
  const n = upper(nome);
  if (/^AREIA\b/.test(n)) return { h1: 'AREIA', h2: 'A GRANEL' };
  if (/^SEIXO\b/.test(n)) return { h1: 'SEIXO', h2: 'A GRANEL' };
  if (/CIMENTO\s+PORTLAND|PORTLAND/.test(n)) return { h1: 'CIMENTO PORTLAND', h2: extractPresentation(nome) || '42,5 KG' };
  if (/CIMENTO\s+BRANCO/.test(n)) return { h1: 'CIMENTO BRANCO', h2: extractPresentation(nome) || 'AVULSO' };
  return null;
}

function inferLampadaSpot(nome) {
  const n = upper(nome);
  if (/SPOT\s+LED/.test(n)) {
    const w = n.match(/(\d+)\s*W/);
    const k = n.match(/(\d{4})K/);
    return {
      h1: 'SPOT LED',
      h2: [w ? `${w[1]}W` : '', k ? `${k[1]}K` : ''].filter(Boolean).join(' ') || 'AVULSO',
    };
  }
  if (/LAMPADA|LÂMPADA/.test(n)) {
    return { h1: 'LÂMPADA LED', h2: extractPresentation(nome) || 'AVULSO' };
  }
  return null;
}

function shortenProductName(nome, maxWords = 4) {
  const stop = new Set(['DE', 'DA', 'DO', 'PARA', 'P/', 'COM', 'E', 'O', 'A']);
  const words = norm(nome).split(/\s+/).filter((w) => !stop.has(upper(w)));
  return words.slice(0, maxWords).join(' ') || norm(nome);
}

/**
 * Refina hierarquia a partir do estado ANTES (original) + nome/marca.
 */
export function refinarHierarquiaProduto(row = {}) {
  const nome = norm(row.nome);
  const marca = norm(row.marca);
  const antes = {
    h1: norm(row.h1_antes ?? row.campo_hierarquico_1 ?? row.h1_atual),
    h2: norm(row.h2_antes ?? row.campo_hierarquico_2 ?? row.h2_atual),
    h3: norm(row.h3_antes ?? row.campo_hierarquico_3 ?? row.h3_atual),
    h4: norm(row.h4_antes ?? row.campo_hierarquico_4 ?? row.h4_atual),
    h5: norm(row.h5_antes ?? row.campo_hierarquico_5 ?? row.h5_atual),
  };

  const apres = extractPresentation(nome) || extractPresentation(antes.h1);
  const marcaInf = extractMarcaFromNome(nome, marca) || antes.h5;

  let depois = null;
  let motivo = '';

  const chain = [
    () => { const r = inferArgamassaMassaFromNome(nome); if (r) { motivo = 'Massa/argamassa: produto + apresentação'; return r; } return null; },
    () => { const t = inferTintaProduct(nome); if (t) { motivo = 'Tinta/verniz: produto + volume'; return { h1: t, h2: apres || antes.h2 || 'AVULSO' }; } return null; },
    () => { const r = inferMateriaisBasicos(nome); if (r) { motivo = 'Material básico'; return r; } return null; },
    () => { const r = inferRevestimento(nome); if (r) { motivo = 'Revestimento + formato'; return r; } return null; },
    () => { const r = inferPerfilPvc(nome); if (r) { motivo = 'Perfil PVC + comprimento'; return r; } return null; },
    () => { const r = inferTomada(nome); if (r) { motivo = 'Tomada: amperagem + linha'; return r; } return null; },
    () => { const r = inferTorneira(nome); if (r) { motivo = 'Torneira por uso'; return r; } return null; },
    () => { const r = inferTeTubo(nome); if (r) { motivo = 'Conexão hidráulica'; return r; } return null; },
    () => { const r = inferRegistro(nome); if (r) { motivo = 'Registro + medida'; return r; } return null; },
    () => { const r = inferLampadaSpot(nome); if (r) { motivo = 'Iluminação'; return r; } return null; },
  ];

  for (const fn of chain) {
    const r = fn();
    if (r) {
      depois = {
        h1: r.h1,
        h2: r.h2 || 'AVULSO',
        h3: r.h3 || '',
        h4: r.h4 || '',
        h5: marcaInf,
      };
      break;
    }
  }

  // TINTA já cadastrada com volume no h2 e tipo no h3 — inverter
  if (!depois && upper(antes.h1) === 'TINTA' && antes.h3 && /^\(/.test(antes.h2)) {
    depois = {
      h1: `TINTA ${antes.h3}`,
      h2: formatVolume(antes.h2) || antes.h2,
      h3: '',
      h4: antes.h4,
      h5: marcaInf,
    };
    motivo = 'Corrigir inversão TINTA: tipo no h1, volume no h2';
  }

  if (!depois && antes.h1 && antes.h1 !== nome && antes.h1.length < nome.length && apres) {
    depois = { h1: antes.h1, h2: apres, h3: antes.h3, h4: antes.h4, h5: marcaInf };
    motivo = 'Manter produto, extrair apresentação do nome';
  }

  if (!depois) {
    const short = shortenProductName(nome, 5);
    depois = {
      h1: short,
      h2: apres || 'AVULSO',
      h3: '',
      h4: '',
      h5: marcaInf,
    };
    motivo = apres ? 'Nome curto + apresentação' : 'Produto avulso — revisar depois';
  }

  depois.nome = buildNome(depois.h1, depois.h2, depois.h3, depois.h4, depois.h5);

  const antesLabel = buildNome(antes.h1, antes.h2, antes.h3, antes.h4, antes.h5) || nome;
  const mudou = antesLabel !== depois.nome
    || antes.h1 !== depois.h1 || antes.h2 !== depois.h2;

  return {
    antes,
    depois,
    antes_label: antesLabel,
    depois_label: depois.nome,
    mudou,
    motivo,
  };
}

export function formatHierarchyLine(h1, h2, h3, h4, h5) {
  const parts = [h1, h2, h3, h4, h5].map(norm).filter(Boolean);
  return parts.length ? parts.join(' › ') : '—';
}

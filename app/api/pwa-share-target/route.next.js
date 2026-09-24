import { NextResponse } from 'next/server';
import { collectFilesFromShareFormData } from '@/lib/pwaShareTargetCollect';
import { buildShareTargetBootstrapHtml } from '@/lib/pwaShareTargetBootstrapHtml';

export const runtime = 'nodejs';

function redirectTorre(origin, params) {
  const qs = new URLSearchParams(params);
  qs.set('share-target', '1');
  return NextResponse.redirect(`${origin}/AnexoCompartilhado?${qs.toString()}`, 303);
}

/**
 * Web Share Target (fallback servidor). Não usar pasta em /AnexoCompartilhado — quebra GET da página.
 */
export async function POST(request) {
  const url = new URL(request.url);
  const origin = url.origin;

  let formData;
  try {
    formData = await request.formData();
  } catch (_) {
    return redirectTorre(origin, { 'share-error': '1' });
  }

  const title = (formData.get('title') && String(formData.get('title'))) || '';
  const text = (formData.get('text') && String(formData.get('text'))) || '';
  const urlParam = (formData.get('url') && String(formData.get('url'))) || '';
  const files = collectFilesFromShareFormData(formData);

  if (files.length === 0) {
    return redirectTorre(origin, {
      'share-error': 'no-files',
      ...(title ? { title } : {}),
      ...(text ? { text } : {}),
      ...(urlParam ? { url: urlParam } : {}),
    });
  }

  const file = files[files.length - 1];
  const id = `share-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const maxBootstrapBytes = 12 * 1024 * 1024;
  if (buffer.length > maxBootstrapBytes) {
    return redirectTorre(origin, { 'share-error': 'too-large' });
  }

  const base64 = buffer.toString('base64');
  const html = buildShareTargetBootstrapHtml(origin, {
    id,
    name: file.name || 'arquivo',
    type: file.type || 'application/octet-stream',
    base64,
    title,
    text,
    urlParam,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

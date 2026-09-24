import { handlePwaShareTargetPost } from '@/lib/pwaShareTargetPost';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Pages Router API — evita bug do Vercel build (ENOENT route_client-reference-manifest)
 * com route handlers em app/api + pageExtensions *.next.js
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost';
  const url = `${proto}://${host}${req.url || '/api/pwa-share-target'}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null || key === 'host') continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  const request = new Request(url, {
    method: 'POST',
    headers,
    body: req,
    duplex: 'half',
  });

  const response = await handlePwaShareTargetPost(request);
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      res.appendHeader(key, value);
    } else {
      res.setHeader(key, value);
    }
  });
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

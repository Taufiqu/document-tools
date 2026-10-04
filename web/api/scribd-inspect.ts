/**
 * Scribd Pre-flight Inspector — Vercel Serverless Function
 * =========================================================
 * Fetches metadata (title, page_count) from Scribd's embed HTML without
 * spinning up Chromium. This is a pure fetch + regex operation, typically
 * completing in < 1 second.
 *
 * The embed URL format is: https://www.scribd.com/embeds/<docId>/content
 * Scribd injects the document config as an inline JS call:
 *   new Scribd.EmbedsShow("#...", { "document": { "id": ..., "page_count": ..., "title": ... } })
 *
 * The response drives the client-side strategy selection:
 *   - pageCount <= CHUNK_THRESHOLD  → "vector" (single serverless Chromium pass)
 *   - pageCount > CHUNK_THRESHOLD   → "chunked" (batched serverless + client-side pdf-lib merge)
 */

const CHUNK_THRESHOLD = 15;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Matches: https://www.scribd.com/document/123456789/Title
//      or: https://www.scribd.com/doc/123456789/Title
const SCRIBD_DOC_RE = /scribd\.com\/(?:document|doc)\/(\d+)\//;

// Matches the inline JSON config Scribd emits in the embed HTML
const PAGE_COUNT_RE = /["\s]page_count[":\s]+(\d+)/;
const TITLE_RE = /"title"\s*:\s*"([^"]+)"/;

type RequestLike = { method?: string; url?: string; query?: Record<string, string> };
type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', '*');

  if (request.method && request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const url: string = (request.query?.url as string) ?? '';
  if (!url || !url.includes('scribd.com')) {
    return response.status(400).json({ error: 'Provide a valid Scribd document URL via ?url=' });
  }

  const idMatch = SCRIBD_DOC_RE.exec(url);
  if (!idMatch) {
    return response
      .status(400)
      .json({ error: 'Could not extract document ID from URL. Use the format scribd.com/document/<id>/...' });
  }

  const docId = idMatch[1];
  const embedUrl = `https://www.scribd.com/embeds/${docId}/content`;

  let html: string;
  try {
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return response.status(502).json({ error: `Scribd returned HTTP ${res.status}` });
    }
    html = await res.text();
  } catch (err) {
    return response
      .status(504)
      .json({ error: `Failed to reach Scribd: ${err instanceof Error ? err.message : 'timeout'}` });
  }

  const pageCountMatch = PAGE_COUNT_RE.exec(html);
  const titleMatch = TITLE_RE.exec(html);

  if (!pageCountMatch) {
    return response
      .status(422)
      .json({ error: 'Could not read page count from Scribd embed. The document may be private or removed.' });
  }

  const pageCount = parseInt(pageCountMatch[1], 10);
  const title = titleMatch ? titleMatch[1].replace(/_/g, ' ') : `scribd_${docId}`;
  const strategy: 'vector' | 'chunked' = pageCount <= CHUNK_THRESHOLD ? 'vector' : 'chunked';

  return response.status(200).json({
    docId,
    embedUrl,
    title,
    pageCount,
    strategy,
    chunkThreshold: CHUNK_THRESHOLD,
  });
}

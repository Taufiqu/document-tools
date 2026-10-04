/**
 * Scribd Engine — Client-Side Orchestrator
 * =========================================
 * Manages the two adaptive download strategies:
 *
 *   "vector"  — Short docs (≤ 15 pages): single serverless Chromium call via
 *               /api/scribd-render-full, returns complete PDF binary.
 *
 *   "chunked" — Long docs (> 15 pages): batches of pages rendered by
 *               /api/scribd-render-chunk, then merged client-side by pdf-lib.
 *               Shows live progress to the user while chunks arrive.
 *
 * The inspect step (pre-flight) determines which path to take.
 */

import { PDFDocument } from 'pdf-lib';

// ─── Public Types ────────────────────────────────────────────────────────────

export interface ScribdInspectResult {
  docId: string;
  embedUrl: string;
  title: string;
  pageCount: number;
  strategy: 'vector' | 'chunked';
  chunkThreshold: number;
}

export interface ScribdDownloadOptions {
  /** Called repeatedly as chunks complete. progress is 0-100. */
  onProgress?: (completed: number, total: number, progress: number) => void;
}

export type ScribdDownloadResult = {
  pdfBytes: Uint8Array;
  title: string;
  pageCount: number;
  strategy: 'vector' | 'chunked';
};

// ─── Constants ───────────────────────────────────────────────────────────────

/** Pages per serverless render request in chunked mode. */
const CHUNK_SIZE = 8;

// ─── Inspect ─────────────────────────────────────────────────────────────────

/**
 * Pre-flight: fetch document metadata from the Vercel serverless inspector.
 * Fast — no Chromium, < 1 second.
 */
export async function scribdInspect(scribdUrl: string): Promise<ScribdInspectResult> {
  const res = await fetch(`/api/scribd-inspect?url=${encodeURIComponent(scribdUrl)}`);
  const body = await res.json();
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Inspect failed (HTTP ${res.status})`);
  }
  return body as ScribdInspectResult;
}

// ─── Download ────────────────────────────────────────────────────────────────

/**
 * Download a Scribd document as a PDF Uint8Array, automatically choosing the
 * fastest strategy based on the pre-flight inspect result.
 */
export async function scribdDownload(
  inspect: ScribdInspectResult,
  options: ScribdDownloadOptions = {},
): Promise<ScribdDownloadResult> {
  if (inspect.strategy === 'vector') {
    return downloadVector(inspect, options);
  }
  return downloadChunked(inspect, options);
}

// ─── Vector Strategy (short docs ≤ 15 pages) ─────────────────────────────────

async function downloadVector(
  inspect: ScribdInspectResult,
  options: ScribdDownloadOptions,
): Promise<ScribdDownloadResult> {
  options.onProgress?.(0, inspect.pageCount, 5);

  const res = await fetch('/api/scribd-render-full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docId: inspect.docId, embedUrl: inspect.embedUrl }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Render failed (HTTP ${res.status})`);
  }

  options.onProgress?.(inspect.pageCount, inspect.pageCount, 90);

  const arrayBuffer = await res.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);

  options.onProgress?.(inspect.pageCount, inspect.pageCount, 100);

  return { pdfBytes, title: inspect.title, pageCount: inspect.pageCount, strategy: 'vector' };
}

// ─── Chunked Strategy (long docs > 15 pages) ─────────────────────────────────

async function downloadChunked(
  inspect: ScribdInspectResult,
  options: ScribdDownloadOptions,
): Promise<ScribdDownloadResult> {
  const { docId, embedUrl, pageCount, title } = inspect;
  const chunks = buildChunks(pageCount, CHUNK_SIZE);
  const chunkPdfs: Uint8Array[] = new Array(chunks.length);
  let completedPages = 0;

  for (let i = 0; i < chunks.length; i++) {
    const { from, to } = chunks[i];

    const res = await fetch('/api/scribd-render-chunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, embedUrl, from, to }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        (body as { error?: string }).error ??
          `Chunk ${from}-${to} render failed (HTTP ${res.status})`,
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    chunkPdfs[i] = new Uint8Array(arrayBuffer);

    completedPages += to - from + 1;
    const progress = Math.round((completedPages / pageCount) * 90) + 5;
    options.onProgress?.(completedPages, pageCount, progress);
  }

  // Merge all chunk PDFs client-side using pdf-lib (already bundled in DocuCraft)
  options.onProgress?.(completedPages, pageCount, 92);
  const pdfBytes = await mergePdfChunks(chunkPdfs);
  options.onProgress?.(pageCount, pageCount, 100);

  return { pdfBytes, title, pageCount, strategy: 'chunked' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildChunks(pageCount: number, chunkSize: number): Array<{ from: number; to: number }> {
  const chunks: Array<{ from: number; to: number }> = [];
  for (let from = 1; from <= pageCount; from += chunkSize) {
    chunks.push({ from, to: Math.min(from + chunkSize - 1, pageCount) });
  }
  return chunks;
}

async function mergePdfChunks(chunkPdfs: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const chunkBytes of chunkPdfs) {
    const src = await PDFDocument.load(chunkBytes);
    const copiedPages = await merged.copyPages(src, src.getPageIndices());
    copiedPages.forEach((page) => merged.addPage(page));
  }
  return merged.save();
}

/**
 * Scribd Pre-flight Inspector — Vercel Serverless Function
 * =========================================================
 * Fetches metadata (title, page_count) from Scribd.
 *
 * Strategy:
 * 1. Fast Path: Plain HTTP fetch + regex. If Scribd returns full HTML without
 *    WAF challenges, this resolves in < 1s.
 * 2. Browser Fallback: If Scribd serves a WAF challenge ("Client Challenge"),
 *    launches headless Chromium via Puppeteer to solve the challenge and extract
 *    the page count and metadata directly from window.docManager / DOM.
 */

import fs from 'fs';
import * as chromiumModule from '@sparticuz/chromium';
import * as puppeteerModule from 'puppeteer-core';

const chromium = (chromiumModule as any).default ?? chromiumModule;
const puppeteer = (puppeteerModule as any).default ?? puppeteerModule;

export const maxDuration = 60;
export const runtime = 'nodejs';

const CHUNK_THRESHOLD = 15;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Matches: https://www.scribd.com/document/123456789/Title
//      or: https://www.scribd.com/doc/123456789/Title
const SCRIBD_DOC_RE = /scribd\.com\/(?:document|doc)\/(\d+)/;

// Matches the inline JSON config Scribd emits in the embed HTML
const PAGE_COUNT_RE = /["\s]page_count[":\s]+(\d+)/;
const TITLE_RE = /"title"\s*:\s*"([^"]+)"/;

type RequestLike = { method?: string; url?: string; query?: Record<string, string> };
type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  if (!isServerless) {
    const localPaths = [
      process.env.CHROME_PATH,
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean) as string[];

    const executablePath = localPaths.find((p) => p && fs.existsSync(p));
    if (executablePath) {
      return puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }
  }

  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

async function fetchOEmbedTitle(scribdUrl: string): Promise<string | null> {
  try {
    const oembedUrl = `https://www.scribd.com/services/oembed?url=${encodeURIComponent(scribdUrl)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as { title?: string };
      return data.title ?? null;
    }
  } catch {}
  return null;
}

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

  // Start oEmbed title fetch in background
  const oEmbedPromise = fetchOEmbedTitle(url);

  let pageCount = 0;
  let title = '';

  // ── Step 1: Fast Path via fetch() ───────────────────────────────────────────
  try {
    const res = await fetch(embedUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const html = await res.text();
      const pageCountMatch = PAGE_COUNT_RE.exec(html);
      const titleMatch = TITLE_RE.exec(html);

      if (pageCountMatch) {
        pageCount = parseInt(pageCountMatch[1], 10);
        if (titleMatch) {
          title = titleMatch[1].replace(/_/g, ' ');
        }
      }
    }
  } catch {
    // If fast fetch fails or times out, proceed to browser fallback
  }

  // ── Step 2: Browser Fallback (if fast path was challenged/blocked) ───────────
  if (!pageCount || pageCount <= 0) {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

      await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 35_000 });

      // Wait for docManager or rendered pages (allows Scribd WAF challenge to settle)
      await page.waitForFunction(
        () => !!(window as any).docManager?.pages || document.querySelectorAll('.outer_page').length > 0,
        { timeout: 15_000 }
      ).catch(() => {});

      const browserMeta = await page.evaluate(() => {
        const manager = (window as any).docManager;
        const managerPages = manager?.pages ? Object.values(manager.pages).filter(Boolean).length : 0;
        const outerPages = document.querySelectorAll('.outer_page').length;
        const html = document.documentElement.innerHTML;
        const pcMatch = html.match(/["\s]page_count[":\s]+(\d+)/)?.[1];
        const tMatch = html.match(/"title"\s*:\s*"([^"]+)"/)?.[1];

        return {
          pageCount: managerPages || outerPages || (pcMatch ? parseInt(pcMatch, 10) : 0),
          title: tMatch || document.title || '',
        };
      });

      if (browserMeta.pageCount > 0) {
        pageCount = browserMeta.pageCount;
        if (!title && browserMeta.title && browserMeta.title !== 'Scribd') {
          title = browserMeta.title.replace(/_/g, ' ');
        }
      }
    } catch (browserErr) {
      console.error('[scribd-inspect:browser-fallback]', browserErr);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  // Resolving clean title from oEmbed if available
  const oEmbedTitle = await oEmbedPromise;
  if (oEmbedTitle) {
    title = oEmbedTitle;
  } else if (!title) {
    title = `scribd_${docId}`;
  }

  if (!pageCount || pageCount <= 0) {
    return response
      .status(422)
      .json({ error: 'Could not read page count from Scribd embed. The document may be private or removed.' });
  }

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

/**
 * Scribd Render Chunk — Vercel Serverless Function
 * ==================================================
 * Renders a small batch of pages (from→to) for long Scribd documents.
 * Each invocation handles a "chunk" of CHUNK_SIZE pages and returns a
 * partial PDF binary. The client-side scribd-engine.ts merges all chunks.
 *
 * Strategy: "chunked"
 * Typical execution time per chunk: 5–12 seconds (well within 60s limit).
 * PDF quality: full vector text (searchable & copy-able).
 *
 * Technique for isolating pages per chunk:
 *   1. Navigate to embed URL.
 *   2. Use window.docManager to load ONLY the target batch pages.
 *   3. Hide all other pages via CSS (display: none).
 *   4. Print via Page.printToPDF — only visible pages render.
 *   5. Return binary PDF for this chunk.
 */

import fs from 'fs';
import * as chromiumModule from '@sparticuz/chromium';
import * as puppeteerModule from 'puppeteer-core';

// CJS interop: these packages use module.exports so we access .default if available
const chromium = (chromiumModule as any).default ?? chromiumModule;
const puppeteer = (puppeteerModule as any).default ?? puppeteerModule;

async function launchBrowser() {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env.CHROME_PATH,
    ].filter(Boolean) as string[];

    const executablePath = chromePaths.find((p) => p && fs.existsSync(p));
    return puppeteer.launch({
      headless: true,
      executablePath: executablePath || undefined,
      channel: executablePath ? undefined : 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

export const maxDuration = 60;
export const runtime = 'nodejs';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

type RequestLike = {
  method?: string;
  body?: { docId?: string; embedUrl?: string; from?: number; to?: number };
};
type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  send: (body: Buffer | Uint8Array) => void;
};

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { docId, embedUrl, from, to } = request.body ?? {};

  if (!docId || !embedUrl || from == null || to == null || from < 1 || to < from) {
    return response
      .status(400)
      .json({ error: 'docId, embedUrl, from (≥1), and to (≥from) are required' });
  }

  const targetPages: number[] = [];
  for (let p = from; p <= to; p++) targetPages.push(p);

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 45_000 });

    // Remove UI chrome, toolbars, and cookie banners
    await page.evaluate(() => {
      const overlaySelectors = [
        '[class*="cookie"]', '[class*="Cookie"]', '[class*="consent"]',
        '[class*="gdpr"]', '[id*="cookie"]', '[id*="onetrust"]',
        '.toolbar_top', '.toolbar_bottom',
        '[class*="paywall"]', '[class*="upgrade"]',
      ];
      overlaySelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => (el as HTMLElement).remove());
      });
    });

    // Load ONLY the target batch pages via docManager, hide all others
    await page.evaluate(
      async (pages: number[]) => {
        const manager = (window as any).docManager;
        if (!manager?.pages) return;

        const allPages = Object.values(manager.pages).filter(Boolean) as any[];

        // Load and display only target pages
        for (const p of allPages) {
          const isTarget = pages.includes(p.pageNum);
          if (isTarget) {
            try { if (!p.loadHasStarted) p.load(); } catch {}
          }
        }

        // Wait for target pages to render
        await Promise.allSettled(
          allPages
            .filter((p: any) => pages.includes(p.pageNum))
            .map(
              (p: any) =>
                new Promise<void>((resolve) => {
                  const check = setInterval(() => {
                    if (p.innerPageElem) { clearInterval(check); resolve(); }
                  }, 80);
                  setTimeout(() => { clearInterval(check); resolve(); }, 20_000);
                }),
            ),
        );

        // Turn on images for target pages
        allPages.forEach((p: any) => {
          if (!pages.includes(p.pageNum)) return;
          try { p.display(); p.turnOnImages(); } catch {}
        });

        // Hide all non-target page DOM elements
        document.querySelectorAll('.outer_page, [id^="outer_page_"]').forEach((el) => {
          const htmlEl = el as HTMLElement;
          const pageId = parseInt(htmlEl.id?.replace('outer_page_', '') ?? '0', 10);
          htmlEl.style.display = pages.includes(pageId) ? '' : 'none';
        });
      },
      targetPages,
    );

    // Inject print CSS
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        .toolbar_top, .toolbar_bottom, [class*="cookie"], [class*="banner"],
        [class*="paywall"], [class*="upgrade"] { display: none !important; }
        @page { margin: 0; }
        body { margin: 0 !important; }
      `;
      document.head.appendChild(style);
    });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="scribd_${docId}_p${from}-${to}.pdf"`,
    );
    return response.send(Buffer.from(pdfBuffer));

  } catch (err) {
    console.error('[scribd-render-chunk]', err);
    return response
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Chunk render failed' });
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Scribd Render Full — Vercel Serverless Function
 * =================================================
 * Renders an entire short Scribd document (≤ 15 pages) to PDF in a single
 * serverless invocation using @sparticuz/chromium + puppeteer-core.
 *
 * Strategy: "vector"
 * Typical execution time: 8–20 seconds (safe within Vercel's 60s maxDuration).
 * PDF quality: full vector text (searchable & copy-able).
 *
 * Requires in package.json (api/):
 *   "@sparticuz/chromium": "^131.0.0"
 *   "puppeteer-core": "^23.0.0"
 */

// NOTE: These imports are resolved at Vercel build time. They are not bundled
// into the frontend — this file is a Node.js-only serverless function.
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
  body?: { docId?: string; embedUrl?: string };
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

  const { docId, embedUrl } = request.body ?? {};
  if (!docId || !embedUrl) {
    return response.status(400).json({ error: 'docId and embedUrl are required' });
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    // Navigate to the public embed URL (no paywall)
    await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 45_000 });

    // Dismiss cookie banners and remove UI chrome
    await page.evaluate(() => {
      const overlaySelectors = [
        '[class*="cookie"]', '[class*="Cookie"]', '[class*="consent"]',
        '[class*="gdpr"]', '[id*="cookie"]', '[id*="onetrust"]',
        '.toolbar_top', '.toolbar_bottom',
      ];
      overlaySelectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => (el as HTMLElement).remove());
      });
    });

    // Wait for Scribd's docManager to expose pages, then force-load all of them
    await page.evaluate(async () => {
      const manager = (window as any).docManager;
      if (!manager?.pages) return;
      const pages = Object.values(manager.pages).filter(Boolean) as any[];
      await Promise.allSettled(
        pages.map(async (p: any) => {
          try { if (!p.loadHasStarted) p.load(); } catch {}
          await new Promise<void>((resolve) => {
            const check = setInterval(() => { if (p.innerPageElem) { clearInterval(check); resolve(); } }, 100);
            setTimeout(() => { clearInterval(check); resolve(); }, 25_000);
          });
          try { p.display(); p.turnOnImages(); } catch {}
        })
      );
    });

    // Inject print-optimized CSS
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

    // Print entire document to PDF
    const pdfBuffer = await page.pdf({
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="scribd_${docId}.pdf"`);
    return response.send(Buffer.from(pdfBuffer));

  } catch (err) {
    console.error('[scribd-render-full]', err);
    return response
      .status(500)
      .json({ error: err instanceof Error ? err.message : 'Render failed' });
  } finally {
    if (browser) await browser.close();
  }
}

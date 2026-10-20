import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export type RedactionStyle = 'blackout' | 'whiteout' | 'text-redacted';

export interface RedactionBox {
  id: string;
  pageNumber: number; // 1-based index
  xRatio: number; // 0 to 1 relative to page width
  yRatio: number; // 0 to 1 relative to page height (from top)
  widthRatio: number; // 0 to 1 relative to page width
  heightRatio: number; // 0 to 1 relative to page height
  style: RedactionStyle;
  label?: string;
}

export interface RedactPdfOptions {
  secureFlatten?: boolean; // If true, rasterizes redacted pages to destroy underlying text vectors
  quality?: number; // 0.85 - 0.95 for rasterization
  onProgress?: (current: number, total: number, message: string) => void;
}

// Dynamically load pdfjs-dist for client-side rendering
let pdfjsLib: any = null;

async function getPdfJs() {
  if (typeof window === 'undefined') return null;
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      }
    } catch (e) {
      console.warn('pdfjs-dist dynamic import warning:', e);
    }
  }
  return pdfjsLib;
}

/**
 * Render a page directly to an HTMLCanvasElement with high DPI.
 */
async function renderPageToCanvas(
  pdfDocument: any,
  pageNumber: number,
  scale = 2.0
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const page = await pdfDocument.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Cannot get 2d context for page rendering');

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return { canvas, width: viewport.width, height: viewport.height };
}

/**
 * Burns redaction boxes directly into the pixel raster of a canvas.
 */
function burnRedactionBoxesIntoCanvas(
  canvas: HTMLCanvasElement,
  boxes: RedactionBox[]
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  for (const box of boxes) {
    const rx = box.xRatio * w;
    const ry = box.yRatio * h;
    const rw = box.widthRatio * w;
    const rh = box.heightRatio * h;

    if (box.style === 'whiteout') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rx, ry, rw, rh);
      // Optional subtle clean border for visual guide
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
    } else {
      // Solid blackout
      ctx.fillStyle = '#09090b';
      ctx.fillRect(rx, ry, rw, rh);

      if (box.style === 'text-redacted') {
        const text = box.label || '[DISENSOR]';
        // Auto-scale font size to fit neatly within height and width
        const fontSize = Math.max(9, Math.min(Math.round(rh * 0.55), Math.round(rw / (text.length * 0.7))));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#f4f4f5';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, rx + rw / 2, ry + rh / 2);
      }
    }
  }
}

/**
 * Applies redaction boxes to a PDF.
 * If `secureFlatten` is true (recommended for privacy), redacted pages are rasterized and burnt into pixel images
 * so that underlying text and vector objects are physically destroyed at the byte level.
 * Unredacted pages are preserved as vector pages to minimize file size and maintain crispness.
 */
export async function applyRedactionsToPdf(
  rawPdfBytes: Uint8Array,
  boxes: RedactionBox[],
  options: RedactPdfOptions = {}
): Promise<Uint8Array> {
  const { secureFlatten = true, quality = 0.92, onProgress } = options;

  if (boxes.length === 0) {
    return rawPdfBytes;
  }

  // Group boxes by pageNumber (1-based)
  const boxesByPage = new Map<number, RedactionBox[]>();
  for (const box of boxes) {
    const list = boxesByPage.get(box.pageNumber) || [];
    list.push(box);
    boxesByPage.set(box.pageNumber, list);
  }

  const srcDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  if (secureFlatten) {
    const pdfjs = await getPdfJs();
    if (!pdfjs) {
      throw new Error('PDF rendering library not initialized');
    }

    onProgress?.(0, totalPages, 'Membaca struktur dokumen...');
    const copyBuffer = new Uint8Array(rawPdfBytes).buffer;
    const pdfJsDoc = await pdfjs.getDocument({ data: copyBuffer }).promise;

    const outDoc = await PDFDocument.create();

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageNumber = pageIdx + 1;
      const pageBoxes = boxesByPage.get(pageNumber);

      onProgress?.(pageIdx + 1, totalPages, `Memproses halaman ${pageNumber} dari ${totalPages}...`);

      if (!pageBoxes || pageBoxes.length === 0) {
        // Page has no redactions: copy as crisp vector page
        const [copiedPage] = await outDoc.copyPages(srcDoc, [pageIdx]);
        outDoc.addPage(copiedPage);
      } else {
        // Page has redactions: render to high-res canvas, burn pixels, and replace page
        const srcPage = srcDoc.getPage(pageIdx);
        const { width: pWidth, height: pHeight } = srcPage.getSize();

        // High DPI render (scale 2.0 = ~144-200 DPI)
        const { canvas } = await renderPageToCanvas(pdfJsDoc, pageNumber, 2.0);
        burnRedactionBoxesIntoCanvas(canvas, pageBoxes);

        // Convert canvas to JPEG blob
        const blob: Blob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', quality);
        });

        const imgBytes = new Uint8Array(await blob.arrayBuffer());
        const embeddedImg = await outDoc.embedJpg(imgBytes);

        const newPage = outDoc.addPage([pWidth, pHeight]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: pWidth,
          height: pHeight,
        });
      }
    }

    onProgress?.(totalPages, totalPages, 'Menyusun file PDF hasil sensor...');
    return await outDoc.save();
  } else {
    // Vector overlay mode: draws rectangles on existing PDF vector stream
    onProgress?.(1, totalPages, 'Membubuhkan kotak sensor vektor...');
    const font = await srcDoc.embedFont(StandardFonts.HelveticaBold);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageNumber = pageIdx + 1;
      const pageBoxes = boxesByPage.get(pageNumber);
      if (!pageBoxes || pageBoxes.length === 0) continue;

      const page = srcDoc.getPage(pageIdx);
      const { width: pageWidth, height: pageHeight } = page.getSize();

      for (const box of pageBoxes) {
        const x = Math.max(0, Math.min(pageWidth, box.xRatio * pageWidth));
        const w = Math.max(1, box.widthRatio * pageWidth);
        const h = Math.max(1, box.heightRatio * pageHeight);
        // In pdf-lib: y=0 is at bottom
        const y = Math.max(0, pageHeight - (box.yRatio + box.heightRatio) * pageHeight);

        if (box.style === 'whiteout') {
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(1, 1, 1),
          });
        } else {
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(0.04, 0.04, 0.04),
          });

          if (box.style === 'text-redacted') {
            const label = box.label || '[DISENSOR]';
            const fontSize = Math.max(7, Math.min(h * 0.55, w / (label.length * 0.7)));
            const textWidth = font.widthOfTextAtSize(label, fontSize);
            const textHeight = font.heightAtSize(fontSize);

            const tx = x + (w - textWidth) / 2;
            const ty = y + (h - textHeight) / 2;

            page.drawText(label, {
              x: Math.max(x, tx),
              y: Math.max(y, ty),
              size: fontSize,
              font,
              color: rgb(0.95, 0.95, 0.95),
            });
          }
        }
      }
    }

    onProgress?.(totalPages, totalPages, 'Menyelesaikan dokumen...');
    return await srcDoc.save();
  }
}

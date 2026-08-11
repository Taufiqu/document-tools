import JSZip from 'jszip';

/**
 * PDF Renderer using pdfjs-dist / Canvas for client-side visual thumbnail & image generation.
 */

export type ImageExportFormat = 'png' | 'jpeg' | 'webp';

// Dynamically import pdfjs-dist on client side
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
      console.warn('pdfjs-dist dynamic import notice:', e);
    }
  }
  return pdfjsLib;
}

/**
 * Render a specific page of a PDF document to a data URL image.
 */
export async function renderPdfPageToDataUrl(
  pdfData: Uint8Array,
  pageNumber: number,
  scale = 0.6
): Promise<string> {
  const pdfjs = await getPdfJs();

  if (pdfjs && pdfjs.getDocument) {
    try {
      const copyBuffer = new Uint8Array(pdfData).buffer;
      const loadingTask = pdfjs.getDocument({ data: copyBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNumber);

      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (context) {
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        return canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (err) {
      console.warn('PdfJs thumbnail rendering error, using fallback canvas generator:', err);
    }
  }

  return createFallbackPageThumbnail(pageNumber);
}

/**
 * Renders all pages of a PDF into high-definition images and packages them into a ZIP blob.
 */
export async function renderPdfPagesToImagesZip(
  pdfData: Uint8Array,
  format: ImageExportFormat = 'png',
  scale = 2.0,
  baseName = 'document',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const pdfjs = await getPdfJs();
  if (!pdfjs || !pdfjs.getDocument) {
    throw new Error('PDF Rendering engine could not be initialized.');
  }

  const copyBuffer = new Uint8Array(pdfData).buffer;
  const loadingTask = pdfjs.getDocument({ data: copyBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const zip = new JSZip();
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : format;

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) {
      onProgress(i, totalPages);
    }

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!context) continue;

    // Fill white background for non-transparent exports
    if (format === 'jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), mimeType, 0.92);
    });

    const pageNumStr = String(i).padStart(String(totalPages).length, '0');
    zip.file(`${baseName}_page_${pageNumStr}.${ext}`, blob);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Fallback visual card when web worker / wasm renderer is initializing.
 */
function createFallbackPageThumbnail(pageNumber: number): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, 160, 220);

  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 140, 200);

  ctx.fillStyle = '#475569';
  ctx.fillRect(25, 30, 110, 8);
  ctx.fillRect(25, 50, 110, 5);
  ctx.fillRect(25, 65, 90, 5);
  ctx.fillRect(25, 80, 105, 5);
  ctx.fillRect(25, 95, 80, 5);

  ctx.beginPath();
  ctx.arc(80, 145, 24, 0, 2 * Math.PI);
  ctx.fillStyle = '#2563eb';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`P${pageNumber}`, 80, 145);

  return canvas.toDataURL('image/png');
}

import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

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

export interface RenderedPdfImage {
  pageNumber: number;
  blob: Blob;
  dataUrl: string;
  filename: string;
  width: number;
  height: number;
}

export interface RenderPdfToImagesResult {
  images: RenderedPdfImage[];
  zipBlob: Blob;
  zipFilename: string;
  isSinglePage: boolean;
  singleImageBlob?: Blob;
  singleImageFilename?: string;
}

/**
 * Renders all pages of a PDF into high-definition images, providing direct single-image access and ZIP packaging.
 */
export async function renderPdfPagesToImages(
  pdfData: Uint8Array,
  format: ImageExportFormat = 'png',
  scale = 2.0,
  baseName = 'document',
  onProgress?: (current: number, total: number) => void
): Promise<RenderPdfToImagesResult> {
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

  const images: RenderedPdfImage[] = [];

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

    const dataUrl = canvas.toDataURL(mimeType, 0.92);
    const blob: Blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), mimeType, 0.92);
    });

    const pageNumStr = String(i).padStart(String(totalPages).length, '0');
    const filename = totalPages === 1 ? `${baseName}.${ext}` : `${baseName}_page_${pageNumStr}.${ext}`;

    images.push({
      pageNumber: i,
      blob,
      dataUrl,
      filename,
      width: canvas.width,
      height: canvas.height,
    });

    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const isSinglePage = totalPages === 1;

  return {
    images,
    zipBlob,
    zipFilename: `${baseName}_images_${format.toUpperCase()}.zip`,
    isSinglePage,
    singleImageBlob: isSinglePage && images.length > 0 ? images[0].blob : undefined,
    singleImageFilename: isSinglePage && images.length > 0 ? images[0].filename : undefined,
  };
}

/**
 * Legacy wrapper: Renders all pages of a PDF into images and returns ZIP blob.
 */
export async function renderPdfPagesToImagesZip(
  pdfData: Uint8Array,
  format: ImageExportFormat = 'png',
  scale = 2.0,
  baseName = 'document',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const result = await renderPdfPagesToImages(pdfData, format, scale, baseName, onProgress);
  return result.zipBlob;
}

export interface CompressPdfOptions {
  level?: 'extreme' | 'recommended' | 'mild';
  customQuality?: number; // 0.1 to 1.0
  customScale?: number; // 1.0 to 2.0
  onProgress?: (current: number, total: number) => void;
}

/**
 * Compresses a PDF file by downsampling embedded raster streams and optimizing page structures in browser RAM.
 */
export async function compressPdf(
  pdfData: Uint8Array,
  options: CompressPdfOptions = {}
): Promise<Uint8Array> {
  const pdfjs = await getPdfJs();
  if (!pdfjs || !pdfjs.getDocument) {
    throw new Error('PDF Rendering engine could not be initialized.');
  }

  let scale = 1.4;
  let quality = 0.72;

  if (options.level === 'extreme') {
    scale = 1.0;
    quality = 0.50;
  } else if (options.level === 'mild') {
    scale = 1.8;
    quality = 0.85;
  }

  if (options.customScale) scale = options.customScale;
  if (options.customQuality) quality = options.customQuality;

  const copyBuffer = new Uint8Array(pdfData).buffer;
  const loadingTask = pdfjs.getDocument({ data: copyBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= totalPages; i++) {
    if (options.onProgress) {
      options.onProgress(i, totalPages);
    }

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!context) continue;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64Data = dataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let b = 0; b < binaryStr.length; b++) {
      bytes[b] = binaryStr.charCodeAt(b);
    }

    const embeddedJpg = await outDoc.embedJpg(bytes);
    const originalWidth = viewport.width / scale;
    const originalHeight = viewport.height / scale;

    const outPage = outDoc.addPage([originalWidth, originalHeight]);
    outPage.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: originalWidth,
      height: originalHeight,
    });
  }

  return await outDoc.save();
}

/**
 * Converts all pages of a PDF into ink-efficient Grayscale / High Contrast B&W PDF.
 */
export async function renderPdfToGrayscalePdf(
  pdfData: Uint8Array,
  contrast = 1.0, // 0.8 to 2.0
  brightness = 0, // -50 to 50
  scale = 2.0,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const pdfjs = await getPdfJs();
  if (!pdfjs || !pdfjs.getDocument) {
    throw new Error('PDF Rendering engine could not be initialized.');
  }

  const copyBuffer = new Uint8Array(pdfData).buffer;
  const loadingTask = pdfjs.getDocument({ data: copyBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const outDoc = await PDFDocument.create();

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

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Apply Grayscale & Contrast adjustments to pixel buffer
    const imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    for (let p = 0; p < d.length; p += 4) {
      const r = d[p];
      const g = d[p + 1];
      const b = d[p + 2];

      // Luminance Grayscale formula
      let gray = 0.299 * r + 0.587 * g + 0.114 * b + brightness;

      // Contrast multiplier
      if (contrast !== 1.0) {
        gray = (gray - 128) * contrast + 128;
      }

      gray = Math.max(0, Math.min(255, gray));

      d[p] = gray;
      d[p + 1] = gray;
      d[p + 2] = gray;
    }

    context.putImageData(imgData, 0, 0);

    // Convert to JPEG Uint8Array
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const base64Data = dataUrl.split(',')[1];
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let b = 0; b < binaryStr.length; b++) {
      bytes[b] = binaryStr.charCodeAt(b);
    }

    const embeddedJpg = await outDoc.embedJpg(bytes);
    const originalWidth = viewport.width / scale;
    const originalHeight = viewport.height / scale;

    const outPage = outDoc.addPage([originalWidth, originalHeight]);
    outPage.drawImage(embeddedJpg, {
      x: 0,
      y: 0,
      width: originalWidth,
      height: originalHeight,
    });
  }

  return await outDoc.save();
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

  ctx.fillStyle = '#121215';
  ctx.fillRect(0, 0, 160, 220);

  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, 140, 200);

  ctx.fillStyle = '#27272a';
  ctx.fillRect(25, 30, 110, 8);
  ctx.fillRect(25, 50, 110, 5);
  ctx.fillRect(25, 65, 90, 5);
  ctx.fillRect(25, 80, 105, 5);

  ctx.fillStyle = '#fafafa';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`P${pageNumber}`, 80, 145);

  return canvas.toDataURL('image/png');
}

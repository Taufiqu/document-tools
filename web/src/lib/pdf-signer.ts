import { PDFDocument } from 'pdf-lib';

export interface PlacedSignItem {
  id: string;
  type: 'signature' | 'materai' | 'stamp' | 'custom';
  pageNumber: number; // 1-based index
  // Normalized coordinates (0 to 1) relative to page dimensions
  xRatio: number; // x / pageWidth (from left: 0 to 1)
  yRatio: number; // y / pageHeight (from top: 0 to 1)
  widthRatio: number; // width / pageWidth
  heightRatio: number; // height / pageHeight
  opacity: number; // 0.1 to 1.0
  imageBytes: Uint8Array; // PNG bytes
  dataUrl: string; // Preview URL on canvas
  label?: string;
}

/**
 * Trims transparent outer margins around a canvas drawing so the bounding box is tight.
 */
export function trimCanvas(canvas: HTMLCanvasElement, padding = 8): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let top = height;
  let bottom = 0;
  let left = width;
  let right = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 12) {
        found = true;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (!found) return canvas;

  top = Math.max(0, top - padding);
  bottom = Math.min(height - 1, bottom + padding);
  left = Math.max(0, left - padding);
  right = Math.min(width - 1, right + padding);

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  if (!trimmedCtx) return canvas;

  trimmedCtx.drawImage(
    canvas,
    left,
    top,
    trimmedWidth,
    trimmedHeight,
    0,
    0,
    trimmedWidth,
    trimmedHeight
  );

  return trimmedCanvas;
}

/**
 * Magic Background Remover for signature photos on paper:
 * Converts white/off-white paper background into transparent alpha while keeping ink crisp.
 */
export async function removePaperBackground(
  imageElement: HTMLImageElement,
  threshold = 215,
  smoothness = 35
): Promise<{ blob: Blob; dataUrl: string; bytes: Uint8Array; width: number; height: number }> {
  const canvas = document.createElement('canvas');
  const w = imageElement.naturalWidth || imageElement.width;
  const h = imageElement.naturalHeight || imageElement.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.drawImage(imageElement, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Perceived brightness
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    if (brightness >= threshold) {
      data[i + 3] = 0; // Fully transparent
    } else if (brightness > threshold - smoothness) {
      // Smooth gradient transition for clean anti-aliasing
      const factor = (threshold - brightness) / smoothness;
      data[i + 3] = Math.round(data[i + 3] * factor);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Auto trim transparent margins
  const trimmedCanvas = trimCanvas(canvas, 6);

  const dataUrl = trimmedCanvas.toDataURL('image/png');
  const blob: Blob = await new Promise((resolve) => {
    trimmedCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
  });

  const arrayBuffer = await blob.arrayBuffer();
  return {
    blob,
    dataUrl,
    bytes: new Uint8Array(arrayBuffer),
    width: trimmedCanvas.width,
    height: trimmedCanvas.height,
  };
}

/**
 * Loads an image file and converts to PNG Uint8Array and DataURL.
 */
export async function processImageFile(
  file: File,
  removeBackground = false
): Promise<{ bytes: Uint8Array; dataUrl: string; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });

    if (removeBackground) {
      const res = await removePaperBackground(img);
      return { bytes: res.bytes, dataUrl: res.dataUrl, width: res.width, height: res.height };
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');
    ctx.drawImage(img, 0, 0);

    const trimmed = trimCanvas(canvas, 4);
    const dataUrl = trimmed.toDataURL('image/png');
    const blob: Blob = await new Promise((resolve) => {
      trimmed.toBlob((b) => resolve(b || new Blob()), 'image/png');
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());

    return { bytes, dataUrl, width: trimmed.width, height: trimmed.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Stamps all placed signatures, e-materai, and stamps onto the target PDF.
 */
export async function applySignaturesToPdf(
  rawPdfBytes: Uint8Array,
  items: PlacedSignItem[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // Cache embedded image objects
  const embeddedCache = new Map<string, any>();

  for (const item of items) {
    if (item.pageNumber < 1 || item.pageNumber > pages.length) continue;
    const page = pages[item.pageNumber - 1];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    let embedded = embeddedCache.get(item.id);
    if (!embedded) {
      embedded = await pdfDoc.embedPng(item.imageBytes);
      embeddedCache.set(item.id, embedded);
    }

    // Map normalized ratios to PDF coordinates
    // In pdf-lib: (0, 0) is bottom-left, y increases upwards.
    const x = Math.max(0, Math.min(pageWidth, item.xRatio * pageWidth));
    const width = Math.max(1, item.widthRatio * pageWidth);
    const height = Math.max(1, item.heightRatio * pageHeight);
    const y = Math.max(0, pageHeight - (item.yRatio + item.heightRatio) * pageHeight);

    page.drawImage(embedded, {
      x,
      y,
      width,
      height,
      opacity: Math.max(0.05, Math.min(1.0, item.opacity ?? 1.0)),
    });
  }

  return await pdfDoc.save();
}

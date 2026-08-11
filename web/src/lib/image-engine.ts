import { PDFDocument, PageSizes } from 'pdf-lib';
import JSZip from 'jszip';

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  width: number;
  height: number;
}

export interface ConvertedImageItem {
  id: string;
  originalName: string;
  targetName: string;
  blob: Blob;
  dataUrl: string;
  originalSize: number;
  convertedSize: number;
  width: number;
  height: number;
}

export interface ConvertPngToJpgOptions {
  quality?: number; // 10 to 100, default 92
  backgroundColor?: string; // hex color for alpha channel replacement, default '#ffffff'
  targetFormat?: 'image/jpeg' | 'image/webp';
}

export interface FaviconBundleResult {
  zipBlob: Blob;
  singleIcoBlob: Blob;
  files: Array<{ name: string; blob: Blob; dataUrl: string; size: number }>;
  htmlSnippet: string;
}

/**
 * Loads an image File into an HTMLImageElement for canvas processing.
 */
function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image in browser memory using HTML5 Canvas rendering.
 */
export async function compressImage(
  file: File,
  quality: number, // 0.1 to 1.0 (or 10 to 100)
  maxDimension?: number,
  outputFormat = 'image/jpeg'
): Promise<CompressedImageResult> {
  const normQuality = quality > 1 ? quality / 100 : quality;
  const img = await loadImageElement(file);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (maxDimension && (width > maxDimension || height > maxDimension)) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas context.');

  // If outputting JPEG, fill white background for transparency
  if (outputFormat === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL(outputFormat, normQuality);

  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), outputFormat, normQuality);
  });

  const originalSize = file.size;
  const compressedSize = blob.size;
  const reductionPercentage = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

  return {
    blob,
    dataUrl,
    originalSize,
    compressedSize,
    reductionPercentage,
    width,
    height,
  };
}

/**
 * Generates an ICO binary structure and PNG web pack assets.
 */
export async function generateFaviconBundle(file: File): Promise<FaviconBundleResult> {
  const img = await loadImageElement(file);
  const zip = new JSZip();
  const files: Array<{ name: string; blob: Blob; dataUrl: string; size: number }> = [];

  const targets = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  // Generate PNG icons
  const pngBlobsForIco: Array<{ size: number; buffer: ArrayBuffer }> = [];

  for (const t of targets) {
    const canvas = document.createElement('canvas');
    canvas.width = t.size;
    canvas.height = t.size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, t.size, t.size);
      const dataUrl = canvas.toDataURL('image/png');
      const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png'));
      const buffer = await blob.arrayBuffer();

      if ([16, 32, 48].includes(t.size)) {
        pngBlobsForIco.push({ size: t.size, buffer });
      }

      files.push({ name: t.name, blob, dataUrl, size: t.size });
      zip.file(t.name, buffer);
    }
  }

  // Create single multi-size .ico file
  const icoBlob = createIcoBlobFromPngBuffers(pngBlobsForIco);
  const icoBuffer = await icoBlob.arrayBuffer();
  files.unshift({ name: 'favicon.ico', blob: icoBlob, dataUrl: '', size: 32 });
  zip.file('favicon.ico', icoBuffer);

  // Generate HTML tags snippet
  const htmlSnippet = `<!-- Favicon & Web Icons -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#090d16" />`;

  zip.file('favicon_html.txt', htmlSnippet);

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  return {
    zipBlob,
    singleIcoBlob: icoBlob,
    files,
    htmlSnippet,
  };
}

/**
 * Creates a valid Windows ICO format file containing embedded PNG images.
 */
function createIcoBlobFromPngBuffers(pngs: Array<{ size: number; buffer: ArrayBuffer }>): Blob {
  // ICO Header: 6 bytes (Reserved 2, Type 2, Count 2)
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = pngs.length;
  let offset = headerSize + numImages * dirEntrySize;

  const totalSize = offset + pngs.reduce((acc, p) => acc + p.buffer.byteLength, 0);
  const icoBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(icoBuffer);

  // Header
  view.setUint16(0, 0, true); // Reserved
  view.setUint16(2, 1, true); // Type (1 for ICO)
  view.setUint16(4, numImages, true); // Count

  // Directory entries
  pngs.forEach((png, i) => {
    const entryOffset = headerSize + i * dirEntrySize;
    view.setUint8(entryOffset, png.size >= 256 ? 0 : png.size); // Width
    view.setUint8(entryOffset + 1, png.size >= 256 ? 0 : png.size); // Height
    view.setUint8(entryOffset + 2, 0); // Palette count
    view.setUint8(entryOffset + 3, 0); // Reserved
    view.setUint16(entryOffset + 4, 1, true); // Color planes
    view.setUint16(entryOffset + 6, 32, true); // Bits per pixel
    view.setUint32(entryOffset + 8, png.buffer.byteLength, true); // Size of image data
    view.setUint32(entryOffset + 12, offset, true); // Offset of image data

    // Copy PNG bytes
    new Uint8Array(icoBuffer, offset, png.buffer.byteLength).set(new Uint8Array(png.buffer));
    offset += png.buffer.byteLength;
  });

  return new Blob([icoBuffer], { type: 'image/x-icon' });
}

export interface ImageToPdfOptions {
  margin?: number;
  orientation?: 'portrait' | 'landscape' | 'auto';
  pageSize?: 'A4' | 'LETTER';
}

/**
 * Converts multiple image files into a single unified PDF document.
 */
export async function imagesToPdf(
  imageFiles: File[],
  options: ImageToPdfOptions = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const margin = options.margin ?? 20;

  for (const file of imageFiles) {
    const arrayBuffer = await file.arrayBuffer();
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

    let pdfImage;
    if (isPng) {
      pdfImage = await doc.embedPng(arrayBuffer);
    } else {
      pdfImage = await doc.embedJpg(arrayBuffer);
    }

    const imgWidth = pdfImage.width;
    const imgHeight = pdfImage.height;

    let isLandscape = false;
    if (options.orientation === 'landscape') {
      isLandscape = true;
    } else if (options.orientation === 'portrait') {
      isLandscape = false;
    } else {
      isLandscape = imgWidth > imgHeight;
    }

    const [pageWidth, pageHeight] = isLandscape
      ? [PageSizes.A4[1], PageSizes.A4[0]]
      : [PageSizes.A4[0], PageSizes.A4[1]];

    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;

    const x = margin + (availableWidth - scaledWidth) / 2;
    const y = margin + (availableHeight - scaledHeight) / 2;

    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawImage(pdfImage, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  }

  return await doc.save();
}

/**
 * Converts a PNG image to high-quality JPG/JPEG client-side with background color fill for alpha channels.
 */
export async function convertPngToJpg(
  file: File,
  options: ConvertPngToJpgOptions = {}
): Promise<ConvertedImageItem> {
  const quality = options.quality ?? 92;
  const normQuality = quality > 1 ? quality / 100 : quality;
  const bgColor = options.backgroundColor ?? '#ffffff';
  const targetFormat = options.targetFormat ?? 'image/jpeg';
  const ext = targetFormat === 'image/webp' ? 'webp' : 'jpg';

  const img = await loadImageElement(file);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas context.');

  // Solid background fill to properly handle transparent PNGs without dark artifacts
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const dataUrl = canvas.toDataURL(targetFormat, normQuality);
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), targetFormat, normQuality);
  });

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const targetName = `${baseName}.${ext}`;

  return {
    id: `converted-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    originalName: file.name,
    targetName,
    blob,
    dataUrl,
    originalSize: file.size,
    convertedSize: blob.size,
    width,
    height,
  };
}

/**
 * Batch converts multiple PNG files to JPG/JPEG and packages them into a ZIP if multiple.
 */
export async function batchConvertPngToJpg(
  files: File[],
  options: ConvertPngToJpgOptions = {}
): Promise<{ items: ConvertedImageItem[]; zipBlob?: Blob }> {
  const items: ConvertedImageItem[] = [];
  const zip = new JSZip();

  for (const file of files) {
    const item = await convertPngToJpg(file, options);
    items.push(item);
    if (files.length > 1) {
      zip.file(item.targetName, item.blob);
    }
  }

  let zipBlob: Blob | undefined;
  if (files.length > 1) {
    zipBlob = await zip.generateAsync({ type: 'blob' });
  }

  return { items, zipBlob };
}

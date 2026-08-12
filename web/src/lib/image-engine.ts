import { PDFDocument, PageSizes } from 'pdf-lib';
import JSZip from 'jszip';
import { ScanFilterType, ScanFilterOptions, processImageFileWithFilter } from './scan-engine';

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

export interface PasFotoPreset {
  id: '2x3' | '3x4' | '4x6' | 'passport';
  label: string;
  widthMm: number;
  heightMm: number;
  widthPx: number; // at 300 DPI: (mm / 25.4) * 300
  heightPx: number;
}

export const PAS_FOTO_PRESETS: Record<string, PasFotoPreset> = {
  '2x3': { id: '2x3', label: '2 × 3 cm', widthMm: 21.6, heightMm: 27.9, widthPx: 255, heightPx: 330 },
  '3x4': { id: '3x4', label: '3 × 4 cm', widthMm: 27.9, heightMm: 38.1, widthPx: 330, heightPx: 450 },
  '4x6': { id: '4x6', label: '4 × 6 cm', widthMm: 38.1, heightMm: 55.9, widthPx: 450, heightPx: 660 },
  passport: { id: 'passport', label: 'Paspor (3.5 × 4.5 cm)', widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
};

export interface PasFotoOptions {
  preset: '2x3' | '3x4' | '4x6' | 'passport' | 'custom';
  customWidthPx?: number;
  customHeightPx?: number;
  backgroundColor?: string; // e.g. '#db2728' (Merah CPNS), '#2563eb' (Biru KTP), '#ffffff' (Putih), or ''
  quality?: number; // 10 to 100, default 95
  maxFileSizeKb?: number; // e.g. 200 or 300
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
  const reduction = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

  return {
    blob,
    dataUrl,
    originalSize,
    compressedSize,
    reductionPercentage: reduction,
    width,
    height,
  };
}

export interface ImageToPdfOptions {
  pageSize?: 'A4' | 'Letter' | 'F4' | 'Fit';
  orientation?: 'portrait' | 'landscape' | 'auto';
  margin?: number; // points
  scanFilter?: ScanFilterType;
  filterOptions?: ScanFilterOptions;
}

/**
 * Compiles multiple raster image files into a multi-page PDF document with realistic scan filters.
 */
export async function imagesToPdf(
  files: File[],
  options: ImageToPdfOptions = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const margin = options.pageSize === 'Fit' ? 0 : options.margin ?? 20;

  for (const file of files) {
    let imageBytes: Uint8Array;
    let isPng = false;

    if (options.scanFilter && options.scanFilter !== 'original') {
      // Process through realistic scan filter engine
      const processed = await processImageFileWithFilter(
        file,
        options.scanFilter,
        options.filterOptions
      );
      const buffer = await processed.blob.arrayBuffer();
      imageBytes = new Uint8Array(buffer);
      isPng = false; // scan engine outputs JPEG
    } else {
      const arrayBuffer = await file.arrayBuffer();
      imageBytes = new Uint8Array(arrayBuffer);
      isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    }

    let embeddedImage;
    if (isPng) {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    }

    const { width: imgWidth, height: imgHeight } = embeddedImage;

    let isLandscape = false;
    if (options.orientation === 'landscape') {
      isLandscape = true;
    } else if (options.orientation === 'portrait') {
      isLandscape = false;
    } else {
      isLandscape = imgWidth > imgHeight;
    }

    let pageWidth = imgWidth;
    let pageHeight = imgHeight;

    if (options.pageSize === 'Letter') {
      const [baseW, baseH] = PageSizes.Letter;
      pageWidth = isLandscape ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
      pageHeight = isLandscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
    } else if (options.pageSize === 'F4') {
      const [baseW, baseH] = [609.45, 935.43]; // F4 Folio points (215 x 330 mm)
      pageWidth = isLandscape ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
      pageHeight = isLandscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
    } else if (options.pageSize === 'Fit') {
      pageWidth = imgWidth;
      pageHeight = imgHeight;
    } else {
      // Default: A4
      const [baseW, baseH] = PageSizes.A4;
      pageWidth = isLandscape ? Math.max(baseW, baseH) : Math.min(baseW, baseH);
      pageHeight = isLandscape ? Math.min(baseW, baseH) : Math.max(baseW, baseH);
    }

    const printableW = Math.max(10, pageWidth - margin * 2);
    const printableH = Math.max(10, pageHeight - margin * 2);

    const scale = Math.min(printableW / imgWidth, printableH / imgHeight, 1);
    const drawW = imgWidth * scale;
    const drawH = imgHeight * scale;

    const posX = margin + (printableW - drawW) / 2;
    const posY = margin + (printableH - drawH) / 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImage, {
      x: posX,
      y: posY,
      width: drawW,
      height: drawH,
    });
  }

  return await pdfDoc.save();
}

/**
 * Creates multi-resolution .ico binaries and complete PWA icon bundles.
 */
export async function generateFaviconBundle(sourceImage: File): Promise<FaviconBundleResult> {
  const img = await loadImageElement(sourceImage);
  const zip = new JSZip();
  const files: Array<{ name: string; blob: Blob; dataUrl: string; size: number }> = [];

  const targets = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ];

  for (const t of targets) {
    const canvas = document.createElement('canvas');
    canvas.width = t.size;
    canvas.height = t.size;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, t.size, t.size);

    const dataUrl = canvas.toDataURL('image/png');
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b || new Blob()), 'image/png'));

    files.push({ name: t.name, blob, dataUrl, size: t.size });
    zip.file(t.name, blob);
  }

  const ico16 = files.find((f) => f.name === 'favicon-16x16.png')!.blob;
  const ico32 = files.find((f) => f.name === 'favicon-32x32.png')!.blob;
  const singleIcoBlob = await createMultiResolutionIco([ico16, ico32]);

  zip.file('favicon.ico', singleIcoBlob);

  const manifestContent = JSON.stringify(
    {
      name: 'DocuCraft Studio',
      short_name: 'DocuCraft',
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#09090b',
      background_color: '#09090b',
      display: 'standalone',
    },
    null,
    2
  );
  zip.file('site.webmanifest', manifestContent);

  const htmlSnippet = `<!-- Favicon & Web Icons -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">`;

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  return {
    zipBlob,
    singleIcoBlob,
    files,
    htmlSnippet,
  };
}

async function createMultiResolutionIco(pngBlobs: Blob[]): Promise<Blob> {
  const pngBuffers = await Promise.all(pngBlobs.map((b) => b.arrayBuffer()));
  const numImages = pngBuffers.length;

  const headerSize = 6;
  const dirEntrySize = 16;
  let totalOffset = headerSize + numImages * dirEntrySize;

  const header = new Uint8Array(headerSize);
  header[2] = 1;
  header[4] = numImages;

  const entries: Uint8Array[] = [];
  for (let i = 0; i < numImages; i++) {
    const buf = pngBuffers[i];
    const size = i === 0 ? 16 : 32;

    const entry = new Uint8Array(dirEntrySize);
    entry[0] = size;
    entry[1] = size;
    entry[2] = 0;
    entry[3] = 0;
    entry[4] = 1;
    entry[6] = 32;

    const len = buf.byteLength;
    entry[8] = len & 0xff;
    entry[9] = (len >> 8) & 0xff;
    entry[10] = (len >> 16) & 0xff;
    entry[11] = (len >> 24) & 0xff;

    entry[12] = totalOffset & 0xff;
    entry[13] = (totalOffset >> 8) & 0xff;
    entry[14] = (totalOffset >> 16) & 0xff;
    entry[15] = (totalOffset >> 24) & 0xff;

    entries.push(entry);
    totalOffset += len;
  }

  const parts = [header, ...entries, ...pngBuffers];
  return new Blob(parts as any, { type: 'image/x-icon' });
}

/**
 * Converts a PNG image to JPG/JPEG with solid background fill.
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
 * Batch converts multiple PNG files to JPG/JPEG.
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

/**
 * Crops, resizes, and processes formal ID / Pas Foto with standard presets and background options.
 */
export async function processPasFoto(
  file: File,
  options: PasFotoOptions,
  cropArea?: { x: number; y: number; width: number; height: number }
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; size: number }> {
  const img = await loadImageElement(file);

  let targetWidth = 330;
  let targetHeight = 450;

  if (options.preset !== 'custom') {
    const p = PAS_FOTO_PRESETS[options.preset] || PAS_FOTO_PRESETS['3x4'];
    targetWidth = p.widthPx;
    targetHeight = p.heightPx;
  } else {
    targetWidth = options.customWidthPx || 330;
    targetHeight = options.customHeightPx || 450;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // Fill background if specified (Merah, Biru, etc.)
  if (options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Crop parameters
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  let sx = 0;
  let sy = 0;
  let sWidth = naturalW;
  let sHeight = naturalH;

  if (cropArea) {
    sx = cropArea.x;
    sy = cropArea.y;
    sWidth = cropArea.width;
    sHeight = cropArea.height;
  } else {
    // Proportional center-fit to target aspect ratio
    const targetAspect = targetWidth / targetHeight;
    const imgAspect = naturalW / naturalH;

    if (imgAspect > targetAspect) {
      sHeight = naturalH;
      sWidth = naturalH * targetAspect;
      sx = (naturalW - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = naturalW;
      sHeight = naturalW / targetAspect;
      sx = 0;
      sy = (naturalH - sHeight) / 2;
    }
  }

  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

  let quality = (options.quality ?? 95) / 100;
  let blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', quality));

  // If user requested a max file size constraint (e.g. < 200KB for CPNS)
  if (options.maxFileSizeKb && options.maxFileSizeKb > 0) {
    const maxBytes = options.maxFileSizeKb * 1024;
    while (blob.size > maxBytes && quality > 0.2) {
      quality -= 0.08;
      blob = await new Promise((res) => canvas.toBlob((b) => res(b || new Blob()), 'image/jpeg', quality));
    }
  }

  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  return {
    blob,
    dataUrl,
    width: targetWidth,
    height: targetHeight,
    size: blob.size,
  };
}

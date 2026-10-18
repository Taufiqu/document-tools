import JSZip from 'jszip';

export type OfficeCompressionLevel = 'extreme' | 'recommended' | 'mild';

export interface OfficeCompressProgress {
  message: string;
  current: number;
  total: number;
  percentage: number;
}

export interface OfficeCompressOptions {
  level?: OfficeCompressionLevel;
  onProgress?: (progress: OfficeCompressProgress) => void;
}

export type OfficeDocType = 'word' | 'powerpoint' | 'excel' | 'office';

export interface OfficeCompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  imageCount: number;
  optimizedImageCount: number;
  docType: OfficeDocType;
  docLabel: string;
  isAlreadyOptimized: boolean;
}

/**
 * Detects document type from filename and MIME type
 */
export function detectOfficeType(filename: string): { type: OfficeDocType; label: string; mime: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (['docx', 'docm', 'dotx'].includes(ext)) {
    return {
      type: 'word',
      label: 'Microsoft Word Document',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  if (['pptx', 'pptm', 'potx'].includes(ext)) {
    return {
      type: 'powerpoint',
      label: 'Microsoft PowerPoint Presentation',
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
  }
  if (['xlsx', 'xlsm', 'xltx'].includes(ext)) {
    return {
      type: 'excel',
      label: 'Microsoft Excel Spreadsheet',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  return {
    type: 'office',
    label: 'Office Document',
    mime: 'application/octet-stream',
  };
}

/**
 * Checks if the file is a legacy binary format (.doc, .ppt, .xls)
 */
export function isLegacyOfficeFormat(filename: string, headerBytes?: Uint8Array): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['doc', 'ppt', 'xls'].includes(ext)) {
    return true;
  }
  if (headerBytes && headerBytes.length >= 8) {
    // Check OLE CFB magic bytes: D0 CF 11 E0 A1 B1 1A E1
    if (
      headerBytes[0] === 0xd0 &&
      headerBytes[1] === 0xcf &&
      headerBytes[2] === 0x11 &&
      headerBytes[3] === 0xe0 &&
      headerBytes[4] === 0xa1 &&
      headerBytes[5] === 0xb1 &&
      headerBytes[6] === 0x1a &&
      headerBytes[7] === 0xe1
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Compresses an image byte buffer in browser memory using HTML5 Canvas.
 * - Downsamples high-resolution photos and screenshots.
 * - Re-encodes JPEG with optimal DCT quality.
 * - Downsamples PNGs while maintaining valid PNG format and transparency.
 * - Strictly ensures compressed output is smaller than original.
 */
async function compressImageBuffer(
  bytes: Uint8Array,
  filename: string,
  level: OfficeCompressionLevel
): Promise<Uint8Array | null> {
  const ext = filename.split('.').pop()?.toLowerCase();
  const isJpeg = ext === 'jpg' || ext === 'jpeg';
  const isPng = ext === 'png';
  const isBmp = ext === 'bmp';
  const isWebp = ext === 'webp';

  if (!isJpeg && !isPng && !isBmp && !isWebp) {
    return null;
  }

  // Presets tuned for maximum document size reduction while preserving clarity
  const maxDim = level === 'extreme' ? 1024 : level === 'recommended' ? 1280 : 1600;
  const jpegQuality = level === 'extreme' ? 0.60 : level === 'recommended' ? 0.72 : 0.82;
  const scaleFallback = level === 'extreme' ? 0.75 : level === 'recommended' ? 0.85 : 0.92;
  const minSizeThreshold = level === 'extreme' ? 40 * 1024 : level === 'recommended' ? 60 * 1024 : 100 * 1024;

  const mimeType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/bmp';
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to load image in canvas'));
      image.src = objectUrl;
    });

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    if (origW === 0 || origH === 0) return null;

    let targetW = origW;
    let targetH = origH;

    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    } else if (bytes.byteLength > minSizeThreshold) {
      // If already within maxDim but heavy in weight, scale gently
      targetW = Math.max(1, Math.round(targetW * scaleFallback));
      targetH = Math.max(1, Math.round(targetH * scaleFallback));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let bestBytes: Uint8Array | null = null;

    if (isJpeg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const jpegBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', jpegQuality);
      });

      if (jpegBlob) {
        const buf = await jpegBlob.arrayBuffer();
        bestBytes = new Uint8Array(buf);
      }
    } else if (isPng) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Export as downsampled PNG (keeps alpha transparency & 100% valid PNG format)
      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (pngBlob) {
        const buf = await pngBlob.arrayBuffer();
        bestBytes = new Uint8Array(buf);
      }
    } else if (isBmp) {
      // Convert raw BMP to PNG
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });

      if (pngBlob) {
        const buf = await pngBlob.arrayBuffer();
        bestBytes = new Uint8Array(buf);
      }
    } else if (isWebp) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const webpBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/webp', jpegQuality);
      });

      if (webpBlob) {
        const buf = await webpBlob.arrayBuffer();
        bestBytes = new Uint8Array(buf);
      }
    }

    // Strictly ensure the optimized version is smaller than original
    if (bestBytes && bestBytes.byteLength < bytes.byteLength) {
      return bestBytes;
    }

    return null;
  } catch {
    // If decoding or canvas fails on an image, retain original intact
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses an Office document (DOCX, PPTX, XLSX) in browser memory.
 * - Extracts media files from the OpenXML zip archive.
 * - Downsamples and re-compresses embedded raster images.
 * - Recompresses all XML, drawings, and structural files with DEFLATE level 9.
 */
export async function compressOfficeDocument(
  file: File,
  options: OfficeCompressOptions = {}
): Promise<OfficeCompressResult> {
  const { level = 'recommended', onProgress } = options;

  const fileBytes = new Uint8Array(await file.arrayBuffer());

  // Check legacy format
  if (isLegacyOfficeFormat(file.name, fileBytes.slice(0, 16))) {
    throw new Error(
      'Format .doc / .ppt / .xls (format biner lama) tidak didukung. Harap buka dan simpan ulang dokumen Anda ke format modern (.docx / .pptx / .xlsx) sebelum mengompresi.'
    );
  }

  onProgress?.({
    message: 'Membaca arsip dokumen...',
    current: 0,
    total: 100,
    percentage: 5,
  });

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fileBytes);
  } catch {
    throw new Error('Gagal membuka berkas: Dokumen bukan arsip OpenXML yang valid atau file rusak.');
  }

  // Find all embedded raster image files
  const imagePaths = Object.keys(zip.files).filter((path) => {
    const entry = zip.files[path];
    if (entry.dir) return false;
    return /\.(jpe?g|png|bmp|webp)$/i.test(path);
  });

  const totalImages = imagePaths.length;
  let optimizedImageCount = 0;

  for (let i = 0; i < totalImages; i++) {
    const imgPath = imagePaths[i];
    const basename = imgPath.split('/').pop() || imgPath;

    const currentPercent = 10 + Math.round(((i + 1) / Math.max(1, totalImages)) * 70);
    onProgress?.({
      message: `Mengoptimalkan gambar ${i + 1} dari ${totalImages} (${basename})...`,
      current: i + 1,
      total: totalImages,
      percentage: currentPercent,
    });

    const entry = zip.file(imgPath);
    if (!entry) continue;

    const originalImgBytes = await entry.async('uint8array');
    const optimizedBytes = await compressImageBuffer(originalImgBytes, imgPath, level);

    if (optimizedBytes) {
      zip.file(imgPath, optimizedBytes, {
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      optimizedImageCount++;
    }
  }

  onProgress?.({
    message: 'Mengemas ulang struktur dokumen dengan kompresi DEFLATE maksimum...',
    current: totalImages,
    total: totalImages,
    percentage: 85,
  });

  // Recompress all non-image files (XMLs, styles, workbook, rels, etc.) with DEFLATE level 9
  for (const path of Object.keys(zip.files)) {
    const entry = zip.files[path];
    if (entry.dir) continue;
    if (!/\.(jpe?g|png|bmp|webp)$/i.test(path)) {
      const data = await entry.async('uint8array');
      zip.file(path, data, {
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
    }
  }

  const { type: docType, label: docLabel, mime: targetMime } = detectOfficeType(file.name);

  // Generate new compressed ZIP with max DEFLATE level 9
  const compressedBlob = await zip.generateAsync(
    {
      type: 'blob',
      mimeType: targetMime,
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
    },
    (meta) => {
      onProgress?.({
        message: `Membangun arsip: ${Math.round(meta.percent)}%...`,
        current: totalImages,
        total: totalImages,
        percentage: 85 + Math.round((meta.percent / 100) * 15),
      });
    }
  );

  const originalSize = file.size;
  let compressedSize = compressedBlob.size;
  let finalBlob = compressedBlob;

  // Never return a file larger than original
  if (compressedSize >= originalSize) {
    compressedSize = originalSize;
    finalBlob = file; // Keep original if already maximally compact
  }

  const reductionPercentage = Math.max(
    0,
    Math.round(((originalSize - compressedSize) / originalSize) * 100)
  );

  return {
    blob: finalBlob,
    originalSize,
    compressedSize,
    reductionPercentage,
    imageCount: totalImages,
    optimizedImageCount,
    docType,
    docLabel,
    isAlreadyOptimized: reductionPercentage === 0,
  };
}

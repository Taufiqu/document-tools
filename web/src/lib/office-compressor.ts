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
 * Maintains format compatibility (JPEG remains JPEG, PNG remains PNG).
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

  // Preset configuration
  const maxDim = level === 'extreme' ? 1280 : level === 'recommended' ? 1920 : 2560;
  const quality = level === 'extreme' ? 0.65 : level === 'recommended' ? 0.78 : 0.88;

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

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width === 0 || height === 0) return null;

    let needResize = false;
    if (width > maxDim || height > maxDim) {
      needResize = true;
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    // For PNG: only compress if it needs resizing or extreme preset,
    // to preserve sharpness for logos/diagrams while shrinking giant photos/screenshots.
    if (isPng && !needResize && level !== 'extreme') {
      return null;
    }

    const outFormat = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (outFormat === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outFormat, quality);
    });

    if (!compressedBlob) return null;

    const compressedArrayBuffer = await compressedBlob.arrayBuffer();
    const compressedBytes = new Uint8Array(compressedArrayBuffer);

    // Only accept if strictly smaller than original
    if (compressedBytes.byteLength < bytes.byteLength) {
      return compressedBytes;
    }

    return null;
  } catch {
    // If decoding or canvas fails, retain original intact
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compresses an Office document (DOCX, PPTX, XLSX) in browser memory.
 * - Extracts media files from the OpenXML zip archive.
 * - Downsamples and re-compresses embedded raster images.
 * - Repacks archive with maximum DEFLATE compression (level 9).
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
  } catch (err) {
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

    const currentPercent = 10 + Math.round(((i + 1) / totalImages) * 70);
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
      zip.file(imgPath, optimizedBytes);
      optimizedImageCount++;
    }
  }

  onProgress?.({
    message: 'Mengemas ulang dokumen dengan kompresi DEFLATE maksimum...',
    current: totalImages,
    total: totalImages,
    percentage: 85,
  });

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
  const compressedSize = compressedBlob.size;
  const reductionPercentage = Math.max(
    0,
    Math.round(((originalSize - compressedSize) / originalSize) * 100)
  );

  return {
    blob: compressedBlob,
    originalSize,
    compressedSize,
    reductionPercentage,
    imageCount: totalImages,
    optimizedImageCount,
    docType,
    docLabel,
  };
}

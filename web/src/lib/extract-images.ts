import JSZip from 'jszip';

export interface ExtractedImage {
  id: string;
  name: string;
  sourceDocName: string;
  pageNumber?: number; // for PDF (1-based)
  width: number;
  height: number;
  format: string; // 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp'
  sizeBytes: number;
  dataUrl: string;
  blob: Blob;
  uint8Array: Uint8Array;
}

// Dynamically load pdfjs-dist
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
 * Converts raw pixel data from pdfjs image object into an RGBA Uint8ClampedArray.
 */
function rawToRgba(data: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const pixelCount = width * height;
  const rgba = new Uint8ClampedArray(pixelCount * 4);

  if (data.length === pixelCount * 4) {
    rgba.set(data);
  } else if (data.length === pixelCount * 3) {
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      rgba[j] = data[i];
      rgba[j + 1] = data[i + 1];
      rgba[j + 2] = data[i + 2];
      rgba[j + 3] = 255;
    }
  } else if (data.length === pixelCount) {
    // 1-channel Grayscale
    for (let i = 0, j = 0; i < data.length; i++, j += 4) {
      const g = data[i];
      rgba[j] = g;
      rgba[j + 1] = g;
      rgba[j + 2] = g;
      rgba[j + 3] = 255;
    }
  } else {
    // Fallback if data size doesn't match expected stride
    for (let i = 0, j = 0; i < pixelCount; i++, j += 4) {
      const val = data[i] ?? 0;
      rgba[j] = val;
      rgba[j + 1] = val;
      rgba[j + 2] = val;
      rgba[j + 3] = 255;
    }
  }

  return rgba;
}

/**
 * Converts a raw pdfjs image object to a PNG Blob & Data URL.
 */
async function pdfImageObjectToBlob(
  imgObj: any
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; bytes: Uint8Array } | null> {
  if (!imgObj) return null;

  const width = imgObj.width;
  const height = imgObj.height;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (imgObj.bitmap && typeof ctx.drawImage === 'function') {
    ctx.drawImage(imgObj.bitmap, 0, 0);
  } else if (imgObj.data) {
    const rgba = rawToRgba(imgObj.data, width, height);
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);
  } else {
    return null;
  }

  const dataUrl = canvas.toDataURL('image/png');
  const blob: Blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), 'image/png');
  });
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return { blob, dataUrl, width, height, bytes };
}

/**
 * Extracts all embedded images from a PDF file using pdfjs-dist.
 */
export async function extractImagesFromPdf(
  file: File,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<ExtractedImage[]> {
  const pdfjs = await getPdfJs();
  if (!pdfjs) throw new Error('PDF.js library is not available');

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdfDoc.numPages;

  const results: ExtractedImage[] = [];
  const processedHashes = new Set<string>();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages, `Mengekstrak gambar dari halaman ${pageNum} dari ${numPages}...`);
    const page = await pdfDoc.getPage(pageNum);
    const operatorList = await page.getOperatorList();

    let imageCounterOnPage = 0;

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const fn = operatorList.fnArray[i];
      const args = operatorList.argsArray[i];

      if (
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject ||
        fn === pdfjs.OPS.paintImageXObjectRepeat
      ) {
        const objName = args[0];
        if (!objName) continue;

        try {
          const imgObj = await new Promise<any>((resolve) => {
            page.objs.get(objName, (data: any) => resolve(data));
          });

          if (!imgObj) continue;

          // Deduplicate if identical dimensions and signature
          const hashKey = `${imgObj.width}x${imgObj.height}_${imgObj.data?.length || 0}`;
          if (processedHashes.has(hashKey)) {
            // Still track it if on different page or keep original unique images
          }
          processedHashes.add(hashKey);

          const converted = await pdfImageObjectToBlob(imgObj);
          if (!converted) continue;

          // Skip tiny 1x1 or 2x2 tracking pixels / masks
          if (converted.width < 10 && converted.height < 10) continue;

          imageCounterOnPage++;
          const imgId = `img-p${pageNum}-${imageCounterOnPage}-${Date.now()}`;
          const filename = `${file.name.replace(/\.[^/.]+$/, '')}_page${pageNum}_img${imageCounterOnPage}.png`;

          results.push({
            id: imgId,
            name: filename,
            sourceDocName: file.name,
            pageNumber: pageNum,
            width: converted.width,
            height: converted.height,
            format: 'png',
            sizeBytes: converted.bytes.length,
            dataUrl: converted.dataUrl,
            blob: converted.blob,
            uint8Array: converted.bytes,
          });
        } catch (err) {
          console.warn(`Could not extract image ${objName} on page ${pageNum}:`, err);
        }
      }
    }
  }

  return results;
}

/**
 * Extracts all embedded images from Office files (.docx, .pptx, .xlsx) via JSZip.
 */
export async function extractImagesFromOffice(
  file: File,
  onProgress?: (message: string) => void
): Promise<ExtractedImage[]> {
  onProgress?.('Membuka struktur arsip berkas Office...');
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const mediaPattern = /(?:word|ppt|xl)\/media\/([^/]+)$/i;
  const imageFiles = Object.keys(zip.files).filter(
    (fileName) => !zip.files[fileName].dir && mediaPattern.test(fileName)
  );

  onProgress?.(`Menemukan ${imageFiles.length} file gambar di dalam dokumen...`);

  const results: ExtractedImage[] = [];
  let index = 0;

  for (const filePath of imageFiles) {
    index++;
    const zipEntry = zip.files[filePath];
    const rawFileName = filePath.split('/').pop() || `image_${index}`;
    const ext = (rawFileName.split('.').pop() || 'png').toLowerCase();

    // Skip obfuscated font files like .odttf or wmf/emf vector files if desired
    if (ext === 'odttf' || ext === 'xml' || ext === 'bin') continue;

    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
        ? 'image/png'
        : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
        ? 'image/gif'
        : 'application/octet-stream';

    const uint8 = await zipEntry.async('uint8array');
    const blob = new Blob([uint8 as unknown as BlobPart], { type: mime });
    const dataUrl = URL.createObjectURL(blob);

    // Measure dimensions using Image element
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = dataUrl;
    });

    const docBaseName = file.name.replace(/\.[^/.]+$/, '');
    const cleanName = `${docBaseName}_${rawFileName}`;

    results.push({
      id: `office-img-${index}-${Date.now()}`,
      name: cleanName,
      sourceDocName: file.name,
      width: dims.width,
      height: dims.height,
      format: ext,
      sizeBytes: uint8.length,
      dataUrl,
      blob,
      uint8Array: uint8,
    });
  }

  return results;
}

/**
 * Compiles an array of extracted images into a single zip archive for download.
 */
export async function createZipFromExtractedImages(
  images: ExtractedImage[],
  zipFilename = 'extracted_images.zip'
): Promise<{ blob: Blob; size: number }> {
  const zip = new JSZip();

  for (const img of images) {
    zip.file(img.name, img.uint8Array);
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { blob, size: blob.size };
}

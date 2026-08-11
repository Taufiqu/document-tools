import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';

export interface PdfFileItem {
  id: string;
  name: string;
  size: number;
  data: Uint8Array;
  pageCount?: number;
}

export interface PageAction {
  id: string;
  pageNumber: number; // 1-based index for UI
  originalIndex: number; // 0-based index
  rotateAngle: number; // 0, 90, 180, 270
  isDeleted: boolean;
  thumbnailUrl?: string;
}

export interface SplitRange {
  id: string;
  start: number;
  end: number;
  name?: string;
}

export interface WatermarkOptions {
  text: string;
  opacity: number; // 0.05 to 1.0
  fontSize?: number;
  angle?: number; // default 45 degrees
  colorRgb?: [number, number, number]; // default [0.5, 0.5, 0.5]
}

export type TargetPaperSize = 'a4' | 'letter' | 'f4' | 'original';

export interface MergePdfOptions {
  paperSize?: TargetPaperSize; // default 'a4'
  orientation?: 'auto' | 'portrait' | 'landscape'; // default 'auto'
  margin?: number; // default 15 points
}

/**
 * Gets the total number of pages in a PDF document.
 */
export async function getPdfPageCount(pdfData: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  return doc.getPageCount();
}

/**
 * Merges multiple PDF Uint8Array buffers into a single unified PDF document.
 * Supports CamScanner-style paper standardization (A4, Letter, F4) with auto-scaling and centering.
 */
export async function mergePdfs(
  pdfList: Array<{ data: Uint8Array; name: string }>,
  options: MergePdfOptions = { paperSize: 'a4', orientation: 'auto', margin: 15 }
): Promise<Uint8Array> {
  if (pdfList.length === 0) {
    throw new Error('No PDF files provided to merge.');
  }

  const mergedDoc = await PDFDocument.create();
  const paperSize = options.paperSize ?? 'a4';
  const margin = options.margin ?? 15;
  const orientationMode = options.orientation ?? 'auto';

  // Standard dimensions in PDF points (1 inch = 72 pt)
  const standardSizes: Record<string, [number, number]> = {
    a4: [595.28, 841.89], // 210 x 297 mm
    letter: [612.0, 792.0], // 8.5 x 11 in
    f4: [595.28, 935.43], // 215 x 330 mm (Folio)
  };

  for (const item of pdfList) {
    const srcDoc = await PDFDocument.load(item.data, { ignoreEncryption: true });
    const pageCount = srcDoc.getPageCount();

    if (paperSize === 'original') {
      // Direct as-is page copy
      const pageIndices = srcDoc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    } else {
      // CamScanner-style Unified Paper Standardization
      const [baseWidth, baseHeight] = standardSizes[paperSize] || standardSizes.a4;

      for (let i = 0; i < pageCount; i++) {
        const srcPage = srcDoc.getPage(i);
        const { width: origWidth, height: origHeight } = srcPage.getSize();
        const rotationAngle = (srcPage.getRotation().angle || 0) % 360;

        // Embed the page as an XObject
        const embeddedPage = await mergedDoc.embedPage(srcPage);

        // Determine if page should be portrait or landscape
        let isLandscape = false;
        if (orientationMode === 'landscape') {
          isLandscape = true;
        } else if (orientationMode === 'portrait') {
          isLandscape = false;
        } else {
          // auto orientation detection
          const isPhysicallyLandscape =
            rotationAngle === 90 || rotationAngle === 270
              ? origHeight > origWidth
              : origWidth > origHeight;
          isLandscape = isPhysicallyLandscape;
        }

        const targetWidth = isLandscape ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
        const targetHeight = isLandscape ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);

        // Effective dimensions of embedded page
        const effWidth = (rotationAngle === 90 || rotationAngle === 270) ? origHeight : origWidth;
        const effHeight = (rotationAngle === 90 || rotationAngle === 270) ? origWidth : origHeight;

        // Calculate scaling factor to fit cleanly inside target page with margin
        const availWidth = Math.max(10, targetWidth - margin * 2);
        const availHeight = Math.max(10, targetHeight - margin * 2);
        const scaleFactor = Math.min(availWidth / effWidth, availHeight / effHeight);

        const scaledWidth = effWidth * scaleFactor;
        const scaledHeight = effHeight * scaleFactor;

        const posX = margin + (availWidth - scaledWidth) / 2;
        const posY = margin + (availHeight - scaledHeight) / 2;

        const newPage = mergedDoc.addPage([targetWidth, targetHeight]);

        // Draw embedded page scaled and centered with white background
        newPage.drawPage(embeddedPage, {
          x: posX,
          y: posY,
          xScale: scaleFactor,
          yScale: scaleFactor,
        });
      }
    }
  }

  return await mergedDoc.save();
}

/**
 * Splits a PDF into individual 1-page PDF documents packaged into a ZIP.
 */
export async function splitPdfIntoSinglePages(
  pdfData: Uint8Array,
  baseName: string
): Promise<Blob> {
  const srcDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const pageCount = srcDoc.getPageCount();
  const cleanBase = baseName.replace(/\.pdf$/i, '');
  const zip = new JSZip();

  for (let i = 0; i < pageCount; i++) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
    singleDoc.addPage(copiedPage);
    const bytes = await singleDoc.save();
    const pageStr = String(i + 1).padStart(String(pageCount).length, '0');
    zip.file(`${cleanBase}_page_${pageStr}.pdf`, bytes);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Splits a PDF by customized page ranges (e.g. ['1-3', '4-5']) packaged into a ZIP.
 */
export async function splitPdfByRanges(
  pdfData: Uint8Array,
  ranges: string[],
  baseName: string
): Promise<Blob> {
  const srcDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const cleanBase = baseName.replace(/\.pdf$/i, '');
  const zip = new JSZip();

  for (let rIdx = 0; rIdx < ranges.length; rIdx++) {
    const rangeStr = ranges[rIdx];
    const parts = rangeStr.split('-').map((s) => parseInt(s.trim()));
    if (parts.length === 0 || isNaN(parts[0])) continue;

    const start = Math.max(1, Math.min(parts[0], totalPages));
    const end = parts.length > 1 && !isNaN(parts[1]) ? Math.max(start, Math.min(parts[1], totalPages)) : start;

    const indicesToCopy: number[] = [];
    for (let p = start; p <= end; p++) {
      indicesToCopy.push(p - 1);
    }

    if (indicesToCopy.length === 0) continue;

    const rangeDoc = await PDFDocument.create();
    const copiedPages = await rangeDoc.copyPages(srcDoc, indicesToCopy);
    for (const page of copiedPages) {
      rangeDoc.addPage(page);
    }

    const bytes = await rangeDoc.save();
    zip.file(`${cleanBase}_pages_${start}-${end}.pdf`, bytes);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Extracts specific pages from a PDF into a single new PDF document.
 */
export async function extractSpecificPages(
  pdfData: Uint8Array,
  pageNumbers: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  const validIndices = pageNumbers
    .filter((p) => p >= 1 && p <= totalPages)
    .map((p) => p - 1);

  if (validIndices.length === 0) {
    throw new Error('No valid page numbers selected for extraction.');
  }

  const outDoc = await PDFDocument.create();
  const copiedPages = await outDoc.copyPages(srcDoc, validIndices);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  return await outDoc.save();
}

/**
 * Reorders, rotates, and deletes pages in a PDF document based on page actions.
 */
export async function organizePdf(
  pdfData: Uint8Array,
  pageActions: PageAction[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const outDoc = await PDFDocument.create();

  const activePages = pageActions.filter((p) => !p.isDeleted);
  if (activePages.length === 0) {
    throw new Error('Cannot save PDF with all pages deleted.');
  }

  for (const action of activePages) {
    const [copiedPage] = await outDoc.copyPages(srcDoc, [action.originalIndex]);
    const currentRotation = copiedPage.getRotation().angle;
    const additionalRotation = (action.rotateAngle || 0) % 360;
    copiedPage.setRotation(degrees((currentRotation + additionalRotation) % 360));
    outDoc.addPage(copiedPage);
  }

  return await outDoc.save();
}

/**
 * Adds customizable watermark text diagonally to every page of a PDF document.
 */
export async function watermarkPdf(
  pdfData: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const fontSize = options.fontSize || 42;
  const opacity = Math.max(0.01, Math.min(1.0, options.opacity));
  const angle = options.angle ?? 45;
  const [cr, cg, cb] = options.colorRgb || [0.4, 0.4, 0.4];

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Center coordinates
    const centerX = width / 2;
    const centerY = height / 2;

    page.drawText(options.text, {
      x: centerX - textWidth / 2,
      y: centerY - textHeight / 2,
      size: fontSize,
      font: font,
      color: rgb(cr, cg, cb),
      opacity: opacity,
      rotate: degrees(angle),
    });
  }

  return await doc.save();
}

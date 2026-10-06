import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  HeadingLevel,
  WidthType,
  BorderStyle,
  ImageRun,
  PageBreak,
  Header,
  Footer,
} from 'docx';

/**
 * Types & Options for PDF to Word conversion.
 */
export type ConversionMode = 'structured' | 'hybrid' | 'visual';

export interface PdfToWordOptions {
  mode?: ConversionMode;
  detectTables?: boolean;
  detectHeadings?: boolean;
  preservePageBreaks?: boolean;
  defaultFont?: string;
  onProgress?: (current: number, total: number, message: string) => void;
}

export interface PdfToWordResult {
  blob: Blob;
  filename: string;
  pageCount: number;
  paragraphCount: number;
  tableCount: number;
  imageCount: number;
  fileSize: number;
  mode: ConversionMode;
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
      console.warn('pdfjs-dist dynamic import notice in pdf-to-word:', e);
    }
  }
  return pdfjsLib;
}

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  fontFamily: string;
}

interface TextLine {
  y: number;
  minX: number;
  maxX: number;
  width: number;
  height: number;
  fontSize: number;
  items: RawTextItem[];
}

interface DetectedTable {
  rows: Array<Array<string>>;
  colWidths: number[];
}

/**
 * Clean font family name by stripping PDF subset prefixes (e.g., 'ABCDEF+Calibri' -> 'Calibri').
 */
function cleanFontFamily(rawName: string, defaultFont = 'Calibri'): string {
  if (!rawName) return defaultFont;
  const name = rawName.replace(/^[A-Z]{6}\+/, '').trim();
  const lower = name.toLowerCase();

  if (lower.includes('calibri')) return 'Calibri';
  if (lower.includes('arial')) return 'Arial';
  if (lower.includes('times')) return 'Times New Roman';
  if (lower.includes('georgia')) return 'Georgia';
  if (lower.includes('cambria')) return 'Cambria';
  if (lower.includes('helvetica')) return 'Helvetica';
  if (lower.includes('courier')) return 'Courier New';
  if (lower.includes('verdana')) return 'Verdana';
  if (lower.includes('tahoma')) return 'Tahoma';
  if (lower.includes('trebuchet')) return 'Trebuchet MS';

  return defaultFont;
}

/**
 * Checks if font identifier implies bold weight.
 */
function isBoldFont(fontName: string, fontFamily: string): boolean {
  const combined = `${fontName} ${fontFamily}`.toLowerCase();
  return /bold|black|heavy|semibold|b\+|medium/i.test(combined);
}

/**
 * Checks if font identifier implies italic slant.
 */
function isItalicFont(fontName: string, fontFamily: string): boolean {
  const combined = `${fontName} ${fontFamily}`.toLowerCase();
  return /italic|oblique|i\+|slanted/i.test(combined);
}

/**
 * Render a page to high-res PNG Uint8Array for visual / hybrid mode.
 */
async function renderPageToPngBytes(page: any, scale = 2.0): Promise<Uint8Array | null> {
  try {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/png', 0.95);
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.warn('Failed to render page image snapshot:', err);
    return null;
  }
}

/**
 * Extract structured lines and words from PDF page text content.
 */
function extractLinesFromPage(
  textContent: any,
  viewport: any,
  defaultFont = 'Calibri',
): { lines: TextLine[]; baseFontSize: number } {
  const rawItems: RawTextItem[] = [];
  const fontSizeCounts = new Map<number, number>();

  for (const item of textContent.items) {
    if (!item.str || item.str.trim() === '') continue;

    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4];
    // Invert PDF coordinates (bottom-left to top-left)
    const y = viewport.height - transform[5];

    const fontSize =
      Math.round(Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1])) ||
      Math.round(item.height) ||
      11;

    const fontStyle = textContent.styles ? textContent.styles[item.fontName] : null;
    const fontFamilyRaw = fontStyle?.fontFamily || item.fontName || '';
    const fontFamily = cleanFontFamily(fontFamilyRaw, defaultFont);
    const isBold = isBoldFont(item.fontName || '', fontFamilyRaw);
    const isItalic = isItalicFont(item.fontName || '', fontFamilyRaw);

    fontSizeCounts.set(fontSize, (fontSizeCounts.get(fontSize) || 0) + item.str.length);

    rawItems.push({
      str: item.str,
      x,
      y,
      width: item.width || fontSize * 0.5 * item.str.length,
      height: item.height || fontSize,
      fontSize,
      isBold,
      isItalic,
      fontFamily,
    });
  }

  // Find median/most frequent body font size
  let baseFontSize = 11;
  let maxCount = 0;
  for (const [size, count] of fontSizeCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      baseFontSize = size;
    }
  }

  // Sort items top-to-bottom, left-to-right
  rawItems.sort((a, b) => {
    if (Math.abs(a.y - b.y) <= 4) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  // Group items into horizontal lines
  const lines: TextLine[] = [];
  for (const item of rawItems) {
    let placed = false;
    for (const line of lines) {
      const lineTolerance = Math.max(3.5, Math.min(line.fontSize, item.fontSize) * 0.4);
      if (Math.abs(line.y - item.y) <= lineTolerance) {
        line.items.push(item);
        line.minX = Math.min(line.minX, item.x);
        line.maxX = Math.max(line.maxX, item.x + item.width);
        line.width = line.maxX - line.minX;
        line.height = Math.max(line.height, item.height);
        line.fontSize = Math.max(line.fontSize, item.fontSize);
        placed = true;
        break;
      }
    }

    if (!placed) {
      lines.push({
        y: item.y,
        minX: item.x,
        maxX: item.x + item.width,
        width: item.width,
        height: item.height,
        fontSize: item.fontSize,
        items: [item],
      });
    }
  }

  // Sort items within each line by horizontal position
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }

  // Sort lines top-to-bottom
  lines.sort((a, b) => a.y - b.y);

  return { lines, baseFontSize };
}

/**
 * Merge adjacent text items on a line into clean coherent words/runs.
 */
function mergeLineItems(line: TextLine): RawTextItem[] {
  if (line.items.length === 0) return [];
  const merged: RawTextItem[] = [];
  let current: RawTextItem = { ...line.items[0] };

  for (let i = 1; i < line.items.length; i++) {
    const next = line.items[i];
    const gap = next.x - (current.x + current.width);
    const sameStyle =
      current.isBold === next.isBold &&
      current.isItalic === next.isItalic &&
      Math.abs(current.fontSize - next.fontSize) <= 1 &&
      current.fontFamily === next.fontFamily;

    // Check if a space separator is needed between items
    const spaceThreshold = Math.max(2.5, current.fontSize * 0.2);
    const needsSpace =
      gap > spaceThreshold &&
      !current.str.endsWith(' ') &&
      !next.str.startsWith(' ');

    if (sameStyle) {
      if (needsSpace) {
        current.str += ' ' + next.str;
      } else {
        current.str += next.str;
      }
      current.width = next.x + next.width - current.x;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Detect tables from lines by finding consecutive rows with aligned column gaps.
 */
function detectTableRows(lines: TextLine[]): DetectedTable | null {
  if (lines.length < 2) return null;

  // Check if every line in this cluster has multiple items separated by significant gaps
  const rowCells: Array<Array<string>> = [];
  const colPositions: number[] = [];

  for (const line of lines) {
    const merged = mergeLineItems(line);
    if (merged.length < 2) return null;

    // Must have at least 2 distinct horizontal segments
    const cells: string[] = [];
    for (const item of merged) {
      cells.push(item.str.trim());
    }
    rowCells.push(cells);
  }

  // Verify column consistency
  const colCount = rowCells[0].length;
  const isConsistent = rowCells.every(
    (row) => Math.abs(row.length - colCount) <= 1 && row.length >= 2,
  );

  if (!isConsistent) return null;

  // Determine standard column count
  const standardCols = Math.max(...rowCells.map((r) => r.length));
  // Equalized width distribution
  const colWidthPct = Math.floor(100 / standardCols);
  const colWidths = Array(standardCols).fill(colWidthPct);

  return {
    rows: rowCells,
    colWidths,
  };
}

/**
 * Convert detected table data into a docx Table element.
 */
function createDocxTable(tableData: DetectedTable, defaultFont: string): Table {
  const tableRows: TableRow[] = tableData.rows.map((row, rowIndex) => {
    const cells: TableCell[] = row.map((cellText) => {
      const isHeader = rowIndex === 0;
      return new TableCell({
        children: [
          new Paragraph({
            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
            children: [
              new TextRun({
                text: cellText,
                bold: isHeader,
                font: defaultFont,
                size: isHeader ? 22 : 20, // 11pt or 10pt (half-points in docx)
              }),
            ],
            spacing: { before: 80, after: 80 },
          }),
        ],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5DD' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D0D5DD' },
          left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
        margins: {
          top: 120,
          bottom: 120,
          left: 140,
          right: 140,
        },
      });
    });

    return new TableRow({
      children: cells,
      tableHeader: rowIndex === 0,
    });
  });

  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

/**
 * Convert a clustered line or paragraph into a docx Paragraph element.
 */
function createDocxParagraph(
  line: TextLine,
  pageWidth: number,
  baseFontSize: number,
  detectHeadings: boolean,
  defaultFont: string,
): Paragraph {
  const items = mergeLineItems(line);
  const textRuns: TextRun[] = [];

  // Determine alignment
  let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
  const marginL = line.minX;
  const marginR = pageWidth - line.maxX;
  const centerDiff = Math.abs(line.minX + line.width / 2 - pageWidth / 2);

  if (centerDiff < 30 && line.width < pageWidth * 0.7) {
    alignment = AlignmentType.CENTER;
  } else if (marginR < 50 && marginL > 100) {
    alignment = AlignmentType.RIGHT;
  }

  // Heading detection
  let headingLevel: any = undefined;
  const fullText = items.map((it) => it.str).join(' ').trim();
  const isShortLine = fullText.length < 120;

  if (detectHeadings && isShortLine) {
    if (line.fontSize >= baseFontSize + 6) {
      headingLevel = HeadingLevel.HEADING_1;
    } else if (line.fontSize >= baseFontSize + 3) {
      headingLevel = HeadingLevel.HEADING_2;
    } else if (line.fontSize >= baseFontSize + 1.5 && items.some((i) => i.isBold)) {
      headingLevel = HeadingLevel.HEADING_3;
    }
  }

  for (const item of items) {
    textRuns.push(
      new TextRun({
        text: item.str,
        bold: item.isBold,
        italics: item.isItalic,
        font: item.fontFamily || defaultFont,
        size: Math.round(item.fontSize * 2), // docx uses half-points (e.g. 24 = 12pt)
      }),
    );
  }

  return new Paragraph({
    alignment,
    heading: headingLevel,
    children: textRuns,
    spacing: {
      before: headingLevel ? 180 : 60,
      after: headingLevel ? 120 : 60,
      line: 276, // 1.15 line spacing
    },
  });
}

/**
 * Main PDF to Word Converter Engine.
 * 100% Client-Side, In-Memory RAM execution.
 */
export async function convertPdfToWord(
  pdfBytes: Uint8Array,
  baseFilename = 'document',
  options: PdfToWordOptions = {},
): Promise<PdfToWordResult> {
  const {
    mode = 'structured',
    detectTables = true,
    detectHeadings = true,
    preservePageBreaks = true,
    defaultFont = 'Calibri',
    onProgress,
  } = options;

  const pdfjs = await getPdfJs();
  if (!pdfjs || !pdfjs.getDocument) {
    throw new Error('PDF processing engine could not be initialized.');
  }

  if (onProgress) onProgress(0, 100, 'Memuat file PDF ke RAM...');

  const copyBuffer = new Uint8Array(pdfBytes).buffer;
  const loadingTask = pdfjs.getDocument({ data: copyBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const docChildren: any[] = [];
  let totalParagraphs = 0;
  let totalTables = 0;
  let totalImages = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (onProgress) {
      const pct = Math.round((pageNum / totalPages) * 85);
      onProgress(
        pageNum,
        totalPages,
        `Menganalisis layout & teks halaman ${pageNum} dari ${totalPages}...`,
      );
    }

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;

    // 1. VISUAL MODE: Render high-fidelity page image snapshot
    if (mode === 'visual' || mode === 'hybrid') {
      const pageImageBytes = await renderPageToPngBytes(page, 2.0);
      if (pageImageBytes) {
        totalImages++;
        // Scale to fit standard Word page margin width (max ~540 pt)
        const maxWidth = Math.min(540, pageWidth);
        const aspect = pageHeight / pageWidth;
        const targetHeight = Math.round(maxWidth * aspect);

        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: pageImageBytes,
                type: 'png',
                transformation: {
                  width: maxWidth,
                  height: targetHeight,
                },
              }),
            ],
            spacing: { before: 100, after: 140 },
          }),
        );
      }
    }

    // 2. STRUCTURED MODE (or Text layer in Hybrid mode): Extract semantic text & tables
    if (mode === 'structured' || mode === 'hybrid') {
      const textContent = await page.getTextContent({ includeMarkedContent: true });
      const { lines, baseFontSize } = extractLinesFromPage(
        textContent,
        viewport,
        defaultFont,
      );

      let lineIndex = 0;
      while (lineIndex < lines.length) {
        // Table clustering candidate detection
        let tableFound = false;
        if (detectTables && lineIndex + 1 < lines.length) {
          // Look ahead for 2 to 12 lines that share column structure
          for (let lookahead = 8; lookahead >= 2; lookahead--) {
            if (lineIndex + lookahead <= lines.length) {
              const candidateLines = lines.slice(lineIndex, lineIndex + lookahead);
              const tableData = detectTableRows(candidateLines);
              if (tableData) {
                const tableDocx = createDocxTable(tableData, defaultFont);
                docChildren.push(tableDocx);
                totalTables++;
                lineIndex += lookahead;
                tableFound = true;
                break;
              }
            }
          }
        }

        if (!tableFound) {
          const currentLine = lines[lineIndex];
          const para = createDocxParagraph(
            currentLine,
            pageWidth,
            baseFontSize,
            detectHeadings,
            defaultFont,
          );
          docChildren.push(para);
          totalParagraphs++;
          lineIndex++;
        }
      }
    }

    // Insert page break between pages
    if (preservePageBreaks && pageNum < totalPages) {
      docChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        }),
      );
    }
  }

  if (onProgress) {
    onProgress(totalPages, totalPages, 'Menyusun dokumen Word (.docx) di memori...');
  }

  // Construct Word Document
  const doc = new Document({
    creator: 'DocuCraft Studio by Taufiqu',
    title: baseFilename,
    description: 'Converted from PDF by DocuCraft Privacy-First Document Studio',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch (720 dxa) for balanced spacing
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: docChildren.length > 0
          ? docChildren
          : [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Dokumen ini tidak mengandung teks yang dapat diekstrak atau merupakan dokumen pindaian (scan murni). Gunakan mode Presisi Visual untuk menyalin tampilan halaman.',
                    italics: true,
                    font: defaultFont,
                    color: '666666',
                  }),
                ],
              }),
            ],
      },
    ],
  });

  // Pack into Blob
  const blob = await Packer.toBlob(doc);
  const outputFilename = `${baseFilename.replace(/\.pdf$/i, '')}.docx`;

  if (onProgress) {
    onProgress(totalPages, totalPages, 'Selesai! Berkas siap diunduh.');
  }

  return {
    blob,
    filename: outputFilename,
    pageCount: totalPages,
    paragraphCount: totalParagraphs,
    tableCount: totalTables,
    imageCount: totalImages,
    fileSize: blob.size,
    mode,
  };
}

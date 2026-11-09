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
  numCols: number;
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
 * Preserves column gaps so items separated by tabular spacing remain distinct items.
 */
function mergeLineItems(line: TextLine): RawTextItem[] {
  if (line.items.length === 0) return [];
  const merged: RawTextItem[] = [];
  let current: RawTextItem = { ...line.items[0] };

  for (let i = 1; i < line.items.length; i++) {
    const next = line.items[i];
    const gap = next.x - (current.x + current.width);
    
    // Column gap threshold: If gap is large, treat as a separate column / cell!
    const colGapThreshold = Math.max(14, current.fontSize * 1.5);
    const isColumnSeparated = gap > colGapThreshold;

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

    if (sameStyle && !isColumnSeparated) {
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
 * Detects whether a contiguous block of lines starting at startIndex forms a multi-column table.
 * Accurately aligns sparse cells and constructs balanced columns even if some cells are empty.
 */
function detectTableBlock(
  lines: TextLine[],
  startIndex: number,
): { tableData: DetectedTable; linesConsumed: number } | null {
  if (startIndex >= lines.length) return null;

  const curMerged = mergeLineItems(lines[startIndex]);
  // A table block candidate typically has multiple items on line, or the following line does
  const nextMerged = startIndex + 1 < lines.length ? mergeLineItems(lines[startIndex + 1]) : [];
  if (curMerged.length < 2 && nextMerged.length < 2) {
    return null;
  }

  // Look ahead for lines belonging to this table
  let candidateEnd = startIndex;
  let multiColCount = 0;

  for (let j = startIndex; j < Math.min(startIndex + 40, lines.length); j++) {
    const m = mergeLineItems(lines[j]);
    if (m.length >= 2) multiColCount++;
    // Break if we hit a long full-width paragraph (e.g. footer notice / article paragraph)
    if (m.length === 1 && m[0].str.length > 90) {
      break;
    }
    candidateEnd = j;
  }

  const linesCount = candidateEnd - startIndex + 1;
  if (multiColCount < 2 || linesCount < 2) {
    return null;
  }

  const tableLines = lines.slice(startIndex, candidateEnd + 1);
  const allMerged = tableLines.map((l) => mergeLineItems(l));

  // Collect all item X positions to find distinct column boundaries
  const xPositions: number[] = [];
  for (const lineItems of allMerged) {
    for (const item of lineItems) {
      xPositions.push(item.x);
    }
  }
  xPositions.sort((a, b) => a - b);

  // Cluster column split boundaries
  const colSplits: number[] = [];
  for (let k = 0; k < xPositions.length - 1; k++) {
    if (xPositions[k + 1] - xPositions[k] > 45) {
      const splitPoint = (xPositions[k] + xPositions[k + 1]) / 2;
      if (!colSplits.some((s) => Math.abs(s - splitPoint) < 40)) {
        colSplits.push(splitPoint);
      }
    }
  }
  colSplits.sort((a, b) => a - b);

  if (colSplits.length < 1) {
    return null;
  }

  const numCols = colSplits.length + 1;
  const rows: Array<Array<string>> = [];

  for (const lineItems of allMerged) {
    const rowCells = Array(numCols).fill('');
    for (const item of lineItems) {
      let colIdx = 0;
      while (colIdx < colSplits.length && item.x >= colSplits[colIdx]) {
        colIdx++;
      }
      if (rowCells[colIdx]) {
        rowCells[colIdx] += ' ' + item.str.trim();
      } else {
        rowCells[colIdx] = item.str.trim();
      }
    }
    rows.push(rowCells);
  }

  // Filter out any completely blank rows
  const validRows = rows.filter((r) => r.some((c) => c.length > 0));
  if (validRows.length < 2) {
    return null;
  }

  // Calculate proportional column widths
  const colWidthPct = Math.floor(100 / numCols);
  const colWidths = Array(numCols).fill(colWidthPct);

  return {
    tableData: {
      rows: validRows,
      colWidths,
      numCols,
    },
    linesConsumed: linesCount,
  };
}

interface VectorGrid {
  uniqueY: number[];
  uniqueX: number[];
  vLines: Array<{ x: number; minY: number; maxY: number }>;
}

/**
 * Extracts horizontal and vertical grid lines from PDF vector operators (constructPath).
 * Detects exact table outlines and cell boundaries from PDF drawings.
 */
async function extractVectorGrid(page: any, viewport: any): Promise<VectorGrid | null> {
  try {
    const ops = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack: number[][] = [];
    const hLines: Array<{ y: number; minX: number; maxX: number }> = [];
    const vLines: Array<{ x: number; minY: number; maxY: number }> = [];

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];

      if (fn === 11 && ctmStack.length > 0) { // restore
        ctm = ctmStack.pop()!;
      } else if (fn === 10) { // save
        ctmStack.push([...ctm]);
      } else if (fn === 12) { // transform
        const [m0, m1, m2, m3, m4, m5] = args;
        const [c0, c1, c2, c3, c4, c5] = ctm;
        ctm = [
          c0 * m0 + c2 * m1,
          c1 * m0 + c3 * m1,
          c0 * m2 + c2 * m3,
          c1 * m2 + c3 * m3,
          c0 * m4 + c2 * m5 + c4,
          c1 * m4 + c3 * m5 + c5,
        ];
      } else if (fn === 91) { // constructPath
        const pOps = args[0];
        const coords = args[1];
        if (!pOps || !coords) continue;
        let cIdx = 0;
        let curX = 0;
        let curY = 0;

        for (const pOp of pOps) {
          if (pOp === 13) { // moveTo
            const rawX = coords[cIdx++];
            const rawY = coords[cIdx++];
            curX = ctm[0] * rawX + ctm[2] * rawY + ctm[4];
            curY = viewport.height - (ctm[1] * rawX + ctm[3] * rawY + ctm[5]);
          } else if (pOp === 14) { // lineTo
            const rawX = coords[cIdx++];
            const rawY = coords[cIdx++];
            const toX = ctm[0] * rawX + ctm[2] * rawY + ctm[4];
            const toY = viewport.height - (ctm[1] * rawX + ctm[3] * rawY + ctm[5]);

            const isH = Math.abs(curY - toY) <= 2 && Math.abs(curX - toX) > 25;
            const isV = Math.abs(curX - toX) <= 2 && Math.abs(curY - toY) > 20;

            if (isH) {
              hLines.push({ y: (curY + toY) / 2, minX: Math.min(curX, toX), maxX: Math.max(curX, toX) });
            } else if (isV) {
              vLines.push({ x: (curX + toX) / 2, minY: Math.min(curY, toY), maxY: Math.max(curY, toY) });
            }
            curX = toX;
            curY = toY;
          }
        }
      }
    }

    const wideH = hLines.filter((l) => l.maxX - l.minX > 180);
    const uniqueY: number[] = [];
    for (const l of wideH) {
      if (!uniqueY.some((y) => Math.abs(y - l.y) < 5)) uniqueY.push(l.y);
    }
    uniqueY.sort((a, b) => a - b);

    const longV = vLines.filter((l) => l.maxY - l.minY > 30);
    const uniqueX: number[] = [];
    for (const l of longV) {
      if (!uniqueX.some((x) => Math.abs(x - l.x) < 5)) uniqueX.push(l.x);
    }
    uniqueX.sort((a, b) => a - b);

    if (uniqueY.length >= 2 && uniqueX.length >= 2) {
      return { uniqueY, uniqueX, vLines };
    }
    return null;
  } catch (err) {
    console.warn('Vector grid extraction notice:', err);
    return null;
  }
}

/**
 * Builds an authentic Word Table from an exact vector grid extracted from the PDF.
 * Correctly preserves empty cells (e.g. section I in SPPD) and column spans using true vector dividers.
 */
function buildTableFromVectorGrid(
  grid: VectorGrid,
  rawItems: RawTextItem[],
  defaultFont: string,
): { table: Table; outsideBefore: RawTextItem[]; outsideAfter: RawTextItem[] } {
  const { uniqueY, uniqueX, vLines } = grid;
  const numRows = uniqueY.length - 1;
  const numCols = uniqueX.length - 1;
  const totalTableWidth = uniqueX[uniqueX.length - 1] - uniqueX[0];

  const colWidthsPct: number[] = [];
  for (let c = 0; c < numCols; c++) {
    const colW = uniqueX[c + 1] - uniqueX[c];
    colWidthsPct.push(Math.round((colW / totalTableWidth) * 100));
  }
  const currentSum = colWidthsPct.reduce((a, b) => a + b, 0);
  if (currentSum !== 100 && colWidthsPct.length > 0) {
    colWidthsPct[colWidthsPct.length - 1] += 100 - currentSum;
  }

  const borders = {
    top: { style: BorderStyle.SINGLE, size: 6, color: '4B5563' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: '4B5563' },
    left: { style: BorderStyle.SINGLE, size: 6, color: '4B5563' },
    right: { style: BorderStyle.SINGLE, size: 6, color: '4B5563' },
  };

  const insideItemIds = new Set<RawTextItem>();
  const tableRows: TableRow[] = [];

  for (let r = 0; r < numRows; r++) {
    const minY = uniqueY[r];
    const maxY = uniqueY[r + 1];
    const midY = (minY + maxY) / 2;

    const rowItems = rawItems.filter(
      (it) => it.y >= minY && it.y < maxY && it.x >= uniqueX[0] - 5 && it.x <= uniqueX[numCols] + 15,
    );
    for (const it of rowItems) insideItemIds.add(it);

    const hasDividerAt = (colIndex: number) => {
      const targetX = uniqueX[colIndex];
      return vLines.some(
        (v) => Math.abs(v.x - targetX) < 5 && v.minY <= midY + 10 && v.maxY >= midY - 10,
      );
    };

    const rowCells: TableCell[] = [];
    let cStart = 0;

    while (cStart < numCols) {
      let cEnd = cStart + 1;
      while (cEnd < numCols && !hasDividerAt(cEnd)) {
        cEnd++;
      }

      const span = cEnd - cStart;
      const cellWidth = colWidthsPct.slice(cStart, cEnd).reduce((sum, w) => sum + w, 0);
      const minX = uniqueX[cStart];
      const maxX = uniqueX[cEnd];

      const cellItems = rowItems.filter(
        (it) =>
          (cStart === 0 ? it.x >= minX - 5 : it.x >= minX) &&
          (cEnd === numCols ? it.x <= maxX + 10 : it.x < maxX),
      );
      cellItems.sort((a, b) => (Math.abs(a.y - b.y) <= 4 ? a.x - b.x : a.y - b.y));

      const cellLines: RawTextItem[][] = [];
      for (const it of cellItems) {
        let placed = false;
        for (const line of cellLines) {
          if (Math.abs(line[0].y - it.y) <= 4) {
            line.push(it);
            placed = true;
            break;
          }
        }
        if (!placed) cellLines.push([it]);
      }

      const paras =
        cellLines.length > 0
          ? cellLines.map(
              (l) =>
                new Paragraph({
                  spacing: { before: 20, after: 20, line: 240 },
                  children: [
                    new TextRun({
                      text: l.map((i) => i.str).join(' '),
                      bold: l.some((i) => i.isBold),
                      font: defaultFont,
                      size: 19,
                    }),
                  ],
                }),
            )
          : [new Paragraph({ children: [new TextRun('')] })];

      rowCells.push(
        new TableCell({
          columnSpan: span > 1 ? span : undefined,
          width: { size: cellWidth, type: WidthType.PERCENTAGE },
          borders,
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: paras,
        }),
      );

      cStart = cEnd;
    }

    tableRows.push(new TableRow({ children: rowCells }));
  }

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });

  const outsideBefore = rawItems.filter((it) => it.y < uniqueY[0] && !insideItemIds.has(it));
  const outsideAfter = rawItems.filter((it) => it.y >= uniqueY[numRows] && !insideItemIds.has(it));

  return { table, outsideBefore, outsideAfter };
}

/**
 * Convert detected table data into a docx Table element with crisp, clean borders.
 */
function createDocxTable(tableData: DetectedTable, defaultFont: string): Table {
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
  };

  const colWidthPct = Math.floor(100 / tableData.numCols);

  const tableRows: TableRow[] = tableData.rows.map((row) => {
    const cells: TableCell[] = row.map((cellText) => {
      return new TableCell({
        width: { size: colWidthPct, type: WidthType.PERCENTAGE },
        borders,
        margins: {
          top: 80,
          bottom: 80,
          left: 100,
          right: 100,
        },
        children: [
          new Paragraph({
            spacing: { before: 20, after: 20, line: 240 },
            children: [
              new TextRun({
                text: cellText,
                font: defaultFont,
                size: 19, // ~9.5pt for clean, crisp table cells
              }),
            ],
          }),
        ],
      });
    });

    return new TableRow({
      children: cells,
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

    // 1. VISUAL MODE (or fallback for scanned pages with zero text): Render high-fidelity image snapshot
    if (mode === 'visual') {
      const pageImageBytes = await renderPageToPngBytes(page, 2.0);
      if (pageImageBytes) {
        totalImages++;
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
    } else {
      // 2. EDITABLE MODES (Structured or Flowing): Extract semantic text & tables
      const textContent = await page.getTextContent({ includeMarkedContent: true });
      const { lines, baseFontSize } = extractLinesFromPage(
        textContent,
        viewport,
        defaultFont,
      );

      // If page is a pure scan with no extractable text layer, fall back to high-res image
      if (lines.length === 0) {
        const pageImageBytes = await renderPageToPngBytes(page, 2.0);
        if (pageImageBytes) {
          totalImages++;
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
      } else {
        // 1. First, check for exact vector grid tables (SPPD, forms, bordered reports)
        let vectorGridHandled = false;
        if (mode === 'structured' && detectTables) {
          const vectorGrid = await extractVectorGrid(page, viewport);
          if (vectorGrid) {
            const rawItems: RawTextItem[] = [];
            for (const item of textContent.items) {
              if (!item.str || item.str.trim() === '') continue;
              const transform = item.transform || [1, 0, 0, 1, 0, 0];
              const x = transform[4];
              const y = viewport.height - transform[5];
              const fontSize =
                Math.round(Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1])) ||
                Math.round(item.height) ||
                11;
              rawItems.push({
                str: item.str,
                x,
                y,
                width: item.width || fontSize * 0.5 * item.str.length,
                height: item.height || fontSize,
                fontSize,
                isBold: isBoldFont(item.fontName || '', ''),
                isItalic: isItalicFont(item.fontName || '', ''),
                fontFamily: cleanFontFamily(item.fontName || '', defaultFont),
              });
            }

            const { table, outsideBefore, outsideAfter } = buildTableFromVectorGrid(
              vectorGrid,
              rawItems,
              defaultFont,
            );

            // Output any content before the table
            if (outsideBefore.length > 0) {
              outsideBefore.sort((a, b) => (Math.abs(a.y - b.y) <= 4 ? a.x - b.x : a.y - b.y));
              docChildren.push(
                new Paragraph({
                  spacing: { before: 80, after: 80 },
                  children: [
                    new TextRun({
                      text: outsideBefore.map((i) => i.str).join(' '),
                      font: defaultFont,
                      size: 22,
                    }),
                  ],
                }),
              );
              totalParagraphs++;
            }

            // Output the authentic Word Table
            docChildren.push(table);
            totalTables++;

            // Output any content after the table
            if (outsideAfter.length > 0) {
              outsideAfter.sort((a, b) => (Math.abs(a.y - b.y) <= 4 ? a.x - b.x : a.y - b.y));
              const afterLines: RawTextItem[][] = [];
              for (const it of outsideAfter) {
                let placed = false;
                for (const line of afterLines) {
                  if (Math.abs(line[0].y - it.y) <= 4) {
                    line.push(it);
                    placed = true;
                    break;
                  }
                }
                if (!placed) afterLines.push([it]);
              }
              for (const line of afterLines) {
                docChildren.push(
                  new Paragraph({
                    spacing: { before: 60, after: 60, line: 240 },
                    children: [
                      new TextRun({
                        text: line.map((i) => i.str).join(' '),
                        font: defaultFont,
                        size: 20,
                      }),
                    ],
                  }),
                );
                totalParagraphs++;
              }
            }

            vectorGridHandled = true;
          }
        }

        // 2. If no vector grid, process through column clustering and standard lines
        if (!vectorGridHandled) {
          let lineIndex = 0;
          while (lineIndex < lines.length) {
            let tableFound = false;

            // Intelligent table detection in structured mode
            if (mode === 'structured' && detectTables) {
              const tableResult = detectTableBlock(lines, lineIndex);
              if (tableResult) {
                const tableDocx = createDocxTable(tableResult.tableData, defaultFont);
                docChildren.push(tableDocx);
                totalTables++;
                lineIndex += tableResult.linesConsumed;
                tableFound = true;
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

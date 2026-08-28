import JSZip from 'jszip';

export type TranslationProviderMode = 'fallback' | 'google' | 'deepl' | 'libretranslate';

export interface TranslationRequestOptions {
  sourceLanguage: string;
  targetLanguage: string;
  providerMode: TranslationProviderMode;
  onProgress?: (completed: number, total: number) => void;
}

export interface TranslationResult {
  provider: string;
  translatedText: string;
}

async function translateBatch(
  texts: string[],
  options: TranslationRequestOptions,
): Promise<{ translatedTexts: string[]; provider: string }> {
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts,
      sourceLanguage: options.sourceLanguage,
      targetLanguage: options.targetLanguage,
      providerMode: options.providerMode,
    }),
  });
  const rawBody = await response.text();
  let result: { translatedTexts?: string[]; provider?: string; error?: string } = {};
  try {
    result = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new Error('Translation service returned an invalid response. Check the Vercel Function logs.');
  }
  if (!response.ok) throw new Error(result.error || 'Translation request failed');
  const translatedTexts = result.translatedTexts;
  const provider = result.provider;
  if (!Array.isArray(translatedTexts) || !provider) {
    throw new Error('Translation service returned an incomplete response. Check provider configuration.');
  }
  return { translatedTexts, provider };
}

export async function translateText(
  text: string,
  options: TranslationRequestOptions,
): Promise<TranslationResult> {
  const { translatedTexts, provider } = await translateBatch([text], options);
  return { translatedText: translatedTexts[0], provider };
}

type XmlPart = { path: string; document: XMLDocument; paragraphs: Element[] };

function getTextNodes(paragraph: Element): Element[] {
  return Array.from(paragraph.getElementsByTagNameNS('*', 't'));
}

function readParagraph(paragraph: Element): string {
  return getTextNodes(paragraph).map((node) => node.textContent || '').join('');
}

function writeParagraph(paragraph: Element, translatedText: string): void {
  const textNodes = getTextNodes(paragraph);
  if (textNodes.length === 0) return;
  textNodes[0].textContent = translatedText;
  textNodes.slice(1).forEach((node) => { node.textContent = ''; });
}

/**
 * Translates WordprocessingML text while retaining document parts, tables, images, page setup, and styles.
 * Text is replaced at paragraph level; a translated paragraph inherits the first text run's character style.
 */
export async function translateDocx(
  file: File,
  options: TranslationRequestOptions,
): Promise<{ blob: Blob; provider: string; translatedSegments: number }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const paths = Object.keys(zip.files).filter((path) => /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(path));
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const parts: XmlPart[] = [];

  for (const path of paths) {
    const xml = await zip.file(path)?.async('string');
    if (!xml) continue;
    const document = parser.parseFromString(xml, 'application/xml');
    if (document.querySelector('parsererror')) throw new Error(`Cannot read DOCX part: ${path}`);
    const paragraphs = Array.from(document.getElementsByTagNameNS('*', 'p'));
    parts.push({ path, document, paragraphs });
  }

  const targets = parts.flatMap((part) => part.paragraphs.map((paragraph) => ({ part, paragraph, text: readParagraph(paragraph) })))
    .filter((target) => target.text.trim().length > 0);
  if (targets.length === 0) throw new Error('No translatable text was found in this DOCX file');

  let provider = '';
  let completed = 0;
  for (let offset = 0; offset < targets.length; offset += 25) {
    const batch = targets.slice(offset, offset + 25);
    const result = await translateBatch(batch.map((target) => target.text), options);
    provider = result.provider;
    result.translatedTexts.forEach((translation, index) => writeParagraph(batch[index].paragraph, translation));
    completed += batch.length;
    options.onProgress?.(completed, targets.length);
  }

  for (const part of parts) zip.file(part.path, serializer.serializeToString(part.document));
  return {
    blob: await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    provider,
    translatedSegments: targets.length,
  };
}

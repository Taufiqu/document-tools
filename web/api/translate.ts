type TranslateRequest = {
  texts?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
  providerMode?: unknown;
};

type Provider = 'google' | 'deepl' | 'libretranslate';

type RequestLike = { method?: string; body?: TranslateRequest };
type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const TIMEOUT_MS = 15_000;

class ProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function requestJson(url: string, init: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new ProviderError(`Provider returned ${response.status}: ${JSON.stringify(body)}`, response.status);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateGoogle(texts: string[], source: string, target: string): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw new Error('Google Translation is not configured');
  const body = new URLSearchParams({ source, target, format: 'text' });
  texts.forEach((text) => body.append('q', text));
  const result = await requestJson('https://translation.googleapis.com/language/translate/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-goog-api-key': key },
    body,
  });
  return result.data.translations.map((item: { translatedText: string }) => item.translatedText);
}

async function translateDeepL(texts: string[], source: string, target: string): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error('DeepL is not configured');
  const endpoint = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate';
  const result = await requestJson(endpoint, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texts, source_lang: source.toUpperCase(), target_lang: target.toUpperCase() }),
  });
  return result.translations.map((item: { text: string }) => item.text);
}

async function translateLibre(texts: string[], source: string, target: string): Promise<string[]> {
  const baseUrl = process.env.LIBRETRANSLATE_URL;
  if (!baseUrl) throw new Error('LibreTranslate is not configured');
  const result = await requestJson(`${baseUrl.replace(/\/$/, '')}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, source, target, format: 'text', api_key: process.env.LIBRETRANSLATE_API_KEY }),
  });
  const translated = result.translatedText;
  return Array.isArray(translated) ? translated : [translated];
}

function getProviderOrder(mode: string): Provider[] {
  if (mode === 'google') return ['google'];
  if (mode === 'deepl') return ['deepl'];
  if (mode === 'libretranslate') return ['libretranslate'];
  return ['google', 'deepl', 'libretranslate'];
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  const { texts, sourceLanguage, targetLanguage, providerMode = 'fallback' } = request.body || {};
  if (!Array.isArray(texts) || !texts.every((text) => typeof text === 'string') || texts.length === 0) {
    return response.status(400).json({ error: 'texts must be a non-empty string array' });
  }
  if (texts.length > 50 || texts.reduce((total, text) => total + text.length, 0) > 40_000) {
    return response.status(400).json({ error: 'Request exceeds the 50 segments / 40,000 character limit' });
  }
  if (typeof sourceLanguage !== 'string' || typeof targetLanguage !== 'string' || sourceLanguage === targetLanguage) {
    return response.status(400).json({ error: 'Choose different source and target languages' });
  }

  const errors: string[] = [];
  for (const provider of getProviderOrder(String(providerMode))) {
    try {
      const translatedTexts = provider === 'google'
        ? await translateGoogle(texts, sourceLanguage, targetLanguage)
        : provider === 'deepl'
          ? await translateDeepL(texts, sourceLanguage, targetLanguage)
          : await translateLibre(texts, sourceLanguage, targetLanguage);

      if (translatedTexts.length !== texts.length) throw new Error('Provider returned an incomplete translation');
      return response.status(200).json({ translatedTexts, provider, fallbackUsed: provider !== 'google' });
    } catch (error) {
      // Invalid credentials and malformed requests must be surfaced, never masked by a fallback.
      if (error instanceof ProviderError && error.status >= 400 && error.status < 500 && error.status !== 429) {
        return response.status(502).json({ error: `${provider} configuration or request error`, details: error.message });
      }
      errors.push(`${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return response.status(503).json({
    error: 'No configured translation provider could complete this request',
    details: errors,
  });
}

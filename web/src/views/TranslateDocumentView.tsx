import React, { useState } from 'react';
import { FileText, Globe2, Languages, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { downloadBlob } from '@/lib/utils';
import { translateDocx, type TranslationProviderMode } from '@/lib/document-translator';

const LANGUAGES = [
  ['id', 'Indonesia'], ['en', 'English'], ['ms', 'Malay'], ['de', 'German'], ['fr', 'French'], ['es', 'Spanish'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'],
];

export function TranslateDocumentView() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState('id');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [providerMode, setProviderMode] = useState<TranslationProviderMode>('fallback');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ provider: string; segments: number; outputName: string } | null>(null);
  const [error, setError] = useState('');

  const translate = async () => {
    if (!file) return;
    if (sourceLanguage === targetLanguage) return setError('Pilih bahasa sumber dan target yang berbeda.');
    setIsTranslating(true); setError(''); setResult(null); setProgress('Reading document structure...');
    try {
      const translated = await translateDocx(file, {
        sourceLanguage,
        targetLanguage,
        providerMode,
        onProgress: (completed, total) => setProgress(`Translating ${completed} of ${total} text blocks...`),
      });
      const outputName = `${file.name.replace(/\.docx$/i, '')}_${targetLanguage}.docx`;
      downloadBlob(translated.blob, outputName);
      setResult({ provider: translated.provider, segments: translated.translatedSegments, outputName });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Translation failed');
    } finally { setIsTranslating(false); setProgress(''); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div><div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1"><Languages className="w-3.5 h-3.5" /><span>MODULE / DOCUMENT TRANSLATE</span></div><h1 className="text-xl sm:text-2xl font-semibold text-white">Translate Document</h1><p className="mt-1 text-xs sm:text-sm text-zinc-400">Translate a DOCX copy while retaining its pages, tables, images, and document structure.</p></div>
      <div className="rounded-xl border border-border bg-surface-200 p-4 sm:p-6 space-y-5">
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-100 p-5 text-center hover:border-zinc-500"><Upload className="w-5 h-5 text-zinc-400" /><span className="text-xs font-medium text-zinc-200">{file ? file.name : 'Select a DOCX document'}</span><span className="text-[11px] text-zinc-500">CV, letter, report, and other Word documents</span><input type="file" accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setResult(null); setError(''); }} /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs text-zinc-400">Source language<select value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} className="w-full rounded-md border border-border bg-surface-100 px-3 py-2 text-sm text-zinc-100">{LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><label className="space-y-1.5 text-xs text-zinc-400">Target language<select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="w-full rounded-md border border-border bg-surface-100 px-3 py-2 text-sm text-zinc-100">{LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label></div>
        <label className="space-y-1.5 text-xs text-zinc-400 block">Translation privacy mode<select value={providerMode} onChange={(event) => setProviderMode(event.target.value as TranslationProviderMode)} className="mt-1.5 w-full rounded-md border border-border bg-surface-100 px-3 py-2 text-sm text-zinc-100"><option value="fallback">Fast & reliable — Google → DeepL → LibreTranslate</option><option value="google">Google Cloud only</option><option value="deepl">DeepL only</option><option value="libretranslate">Private LibreTranslate only</option></select></label>
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] leading-relaxed text-zinc-400"><ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-amber-300" />The file is processed in your browser, but translated text is sent to the provider you choose. A fallback mode may use another configured provider if the first one is unavailable.</div>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}
        {result && <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-200"><p className="font-medium">Translation downloaded</p><p className="mt-1 text-emerald-300/80">{result.outputName} · {result.segments} text blocks · provider: {result.provider}</p></div>}
        <button onClick={() => void translate()} disabled={!file || isTranslating} className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-xs disabled:opacity-50">{isTranslating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{progress || 'Translating...'}</> : <><Globe2 className="h-3.5 w-3.5" />Translate & download DOCX</>}</button>
      </div>
      <div className="flex gap-3 rounded-xl border border-border bg-surface-200 p-4 text-xs text-zinc-400"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" /><p><span className="font-medium text-zinc-200">Current scope: DOCX.</span> Tables, images, headers, footers, and page settings stay in place. The translated text can reflow when a target language is longer; scanned PDFs and visual PDF overlay translation will be added separately.</p></div>
    </div>
  );
}

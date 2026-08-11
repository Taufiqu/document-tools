import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, formatBytes } from '@/lib/utils';
import { generateFaviconBundle, FaviconBundleResult } from '@/lib/image-engine';
import { Sparkles, Code, Check, Copy, Loader2, Download } from 'lucide-react';

export function FaviconView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [bundleResult, setBundleResult] = useState<FaviconBundleResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;
    setIsGenerating(true);

    try {
      const result = await generateFaviconBundle(selectedFile);
      setBundleResult(result);
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal membuat paket favicon: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyHtml = () => {
    if (!bundleResult) return;
    navigator.clipboard.writeText(bundleResult.htmlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setBundleResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <Sparkles className="w-4 h-4" />
          <span>Webmaster & Developer Suite</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Favicon & Web Icon Pack Generator</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Ubah logo/gambar Anda menjadi file favicon.ico multi-resolusi dan paket ikon web lengkap (Apple Touch, Android Chrome, PWA, dan HTML tags).
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="image/*"
          title="Tarik Logo / Gambar Anda ke Sini"
          subtitle="Gunakan gambar beresolusi persegi (misal: 512x512 PNG transparan) untuk hasil terbaik"
        />
      ) : (
        <div className="space-y-6">
          {/* Summary & Preview */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-surface-200 border border-slate-700 overflow-hidden flex items-center justify-center p-2">
                  <img src={previewUrl} alt="Logo preview" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white max-w-sm truncate">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">Ukuran file asli: {formatBytes(selectedFile.size)}</p>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-slate-700 transition cursor-pointer"
              >
                Ganti Logo
              </button>
            </div>

            <div className="p-4 rounded-xl bg-surface-200/60 border border-slate-800 text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-white">Paket yang akan dibuat otomatis:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400">
                <li><code>favicon.ico</code> (Format biner standar browser)</li>
                <li><code>apple-touch-icon.png</code> (180x180 px untuk iPhone & iPad)</li>
                <li><code>android-chrome-192x192.png</code> & <code>android-chrome-512x512.png</code> (PWA)</li>
                <li><code>favicon-32x32.png</code> & <code>favicon-16x16.png</code></li>
                <li><code>site.webmanifest</code> & Snippet Tag HTML</li>
              </ul>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-bold text-sm transition shadow-glow-primary disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat Seluruh Ukuran Favicon...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Paket Lengkap Favicon & Web Ikon (.ZIP)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {bundleResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadBlob(bundleResult.zipBlob, `favicon_pack_${Date.now()}.zip`)}
          onReset={handleReset}
          title="Paket Favicon Berhasil Dibuat!"
          filename={`favicon_pack_${Date.now()}.zip`}
          fileSize={bundleResult.zipBlob.size}
          stats={[
            { label: 'Total File', value: '7 berkas ikon' },
            { label: 'Standar Ikon', value: 'Multi-Res (.ico + PNG)' },
          ]}
          downloadLabel="Unduh Paket Lengkap (.ZIP)"
        >
          {/* HTML Snippet Box */}
          <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-primary-400" />
                <span>HTML Tag untuk &lt;head&gt; Website Anda</span>
              </span>
              <button
                onClick={handleCopyHtml}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 text-[11px] transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Tersalin!' : 'Salin Tag'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto p-2 bg-black/40 rounded border border-slate-800/80 select-all">
              {bundleResult.htmlSnippet}
            </pre>
          </div>
        </ResultModal>
      )}
    </div>
  );
}

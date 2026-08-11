import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, formatBytes } from '@/lib/utils';
import { generateFaviconBundle, FaviconBundleResult } from '@/lib/image-engine';
import { Sparkles, Code, Check, Copy, Loader2 } from 'lucide-react';

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
      alert(`Failed to generate favicon pack: ${err}`);
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>MODULE / FAVICON GENERATOR</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Favicon & Web Icon Pack</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Generate multi-resolution .ico binaries and complete PWA icon bundles with header snippet tags.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="image/*"
          title="Select or drop a logo image"
          subtitle="Square PNG (e.g. 512×512) recommended for optimal icon scaling"
        />
      ) : (
        <div className="space-y-4">
          {/* Summary & Preview */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-surface-100 border border-border overflow-hidden flex items-center justify-center p-1.5">
                  <img src={previewUrl} alt="Logo preview" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white truncate max-w-sm">{selectedFile.name}</p>
                  <p className="text-[11px] font-mono text-zinc-400">Original weight: {formatBytes(selectedFile.size)}</p>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-md btn-secondary cursor-pointer"
              >
                Change Logo
              </button>
            </div>

            <div className="p-3 rounded-lg bg-surface-100 border border-border/80 text-xs space-y-1">
              <p className="font-medium text-white">Included in package:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-zinc-400">
                <li>favicon.ico (Multi-size binary)</li>
                <li>apple-touch-icon.png (180×180 px)</li>
                <li>android-chrome-192x192.png & 512x512.png (PWA)</li>
                <li>favicon-32x32.png & favicon-16x16.png</li>
                <li>site.webmanifest & HTML head snippet</li>
              </ul>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating icons in RAM...</span>
                </>
              ) : (
                <span>Generate Complete Icon Package (.ZIP)</span>
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
          title="Favicon pack generated"
          filename={`favicon_pack_${Date.now()}.zip`}
          fileSize={bundleResult.zipBlob.size}
          stats={[
            { label: 'Files included', value: '7 icons + manifest' },
            { label: 'Format', value: 'Multi-Res (.ico + PNG)' },
          ]}
          downloadLabel="Download Icon Package (.ZIP)"
        >
          {/* HTML Snippet Box */}
          <div className="mt-3 p-3 rounded-lg bg-surface-100 border border-border text-left space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="font-medium flex items-center gap-1.5 text-zinc-200">
                <Code className="w-3.5 h-3.5 text-zinc-400" />
                <span>HTML &lt;head&gt; tags</span>
              </span>
              <button
                onClick={handleCopyHtml}
                className="px-2 py-0.5 rounded bg-surface-50 hover:bg-surface-200 text-zinc-300 flex items-center gap-1 text-[10px] font-mono transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="text-[10px] font-mono text-zinc-300 overflow-x-auto p-2 bg-surface-300 rounded border border-border/80 select-all">
              {bundleResult.htmlSnippet}
            </pre>
          </div>
        </ResultModal>
      )}
    </div>
  );
}

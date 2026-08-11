import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import { getPdfPageCount } from '@/lib/pdf-engine';
import { compressPdf } from '@/lib/pdf-renderer';
import { Minimize, Sliders, Loader2, Zap, ShieldCheck } from 'lucide-react';

export function CompressPdfView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [level, setLevel] = useState<'extreme' | 'recommended' | 'mild'>('recommended');
  const [isCompressing, setIsCompressing] = useState(false);
  const [progressText, setProgressText] = useState('');

  const [compressedBytes, setCompressedBytes] = useState<Uint8Array | null>(null);
  const [resultFilename, setResultFilename] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);

    try {
      const bytes = await fileToUint8Array(file);
      setRawPdfBytes(bytes);
      const count = await getPdfPageCount(bytes);
      setPageCount(count);
    } catch (err) {
      alert(`Failed to load PDF: ${err}`);
    }
  };

  const handleCompress = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsCompressing(true);
    setProgressText('Compressing pages in RAM...');

    try {
      const result = await compressPdf(rawPdfBytes, {
        level,
        onProgress: (current, total) => {
          setProgressText(`Optimizing page ${current} of ${total}...`);
        },
      });

      const filename = selectedFile.name.replace(/\.pdf$/i, '_compressed.pdf');
      setCompressedBytes(result);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to compress PDF: ${err}`);
    } finally {
      setIsCompressing(false);
      setProgressText('');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setCompressedBytes(null);
  };

  const reductionPercent =
    selectedFile && compressedBytes
      ? Math.max(
          0,
          Math.round(
            ((selectedFile.size - compressedBytes.byteLength) / selectedFile.size) * 100
          )
        )
      : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Minimize className="w-3.5 h-3.5" />
          <span>MODULE / PDF COMPRESSOR</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Compress PDF Document</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Downsample high-density scans and compress raster streams directly in RAM to satisfy portal upload limits.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file to compress"
          subtitle="All compression and raster optimization run in browser memory"
        />
      ) : (
        <div className="space-y-4">
          {/* File summary */}
          <div className="p-3.5 rounded-xl bg-surface-200 border border-border flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white truncate max-w-sm">{selectedFile.name}</p>
              <p className="text-[11px] font-mono text-zinc-400">
                {pageCount} pages • Original weight: <strong className="text-zinc-200">{formatBytes(selectedFile.size)}</strong>
              </p>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-md btn-secondary cursor-pointer"
            >
              Change File
            </button>
          </div>

          {/* Preset options */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">Compression Preset Level</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'extreme',
                  title: 'Extreme Compression',
                  desc: 'Smallest size (~70-80% reduction), best for strict < 1MB limits',
                  tag: 'Maximum',
                },
                {
                  id: 'recommended',
                  title: 'Recommended',
                  desc: 'Balanced clarity (~50-65% reduction) with sharp text readability',
                  tag: 'Optimal',
                },
                {
                  id: 'mild',
                  title: 'Mild Compression',
                  desc: 'HD clarity preservation (~25-40% reduction)',
                  tag: 'High Quality',
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLevel(p.id as any)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    level === p.id
                      ? 'bg-zinc-100 border-zinc-100 text-zinc-950 shadow-subtle'
                      : 'bg-surface-100 border-border text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{p.title}</span>
                      <span
                        className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                          level === p.id ? 'bg-zinc-300 text-zinc-950' : 'bg-surface-50 text-zinc-400'
                        }`}
                      >
                        {p.tag}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] leading-relaxed ${
                        level === p.id ? 'text-zinc-700' : 'text-zinc-400'
                      }`}
                    >
                      {p.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleCompress}
              disabled={isCompressing}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progressText || 'Compressing...'}</span>
                </>
              ) : (
                <span>Compress {pageCount} Pages ({level.toUpperCase()})</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {compressedBytes && selectedFile && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(compressedBytes, resultFilename)}
          onReset={handleReset}
          title="PDF successfully compressed"
          filename={resultFilename}
          fileSize={compressedBytes.byteLength}
          stats={[
            { label: 'Original size', value: formatBytes(selectedFile.size) },
            { label: 'Compressed size', value: formatBytes(compressedBytes.byteLength) },
            { label: 'Reduction', value: `-${reductionPercent}%` },
            { label: 'Preset', value: level.toUpperCase() },
          ]}
          downloadLabel="Download Compressed PDF"
        />
      )}
    </div>
  );
}

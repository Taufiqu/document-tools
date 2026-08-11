import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, formatBytes } from '@/lib/utils';
import {
  processPasFoto,
  PAS_FOTO_PRESETS,
  PasFotoPreset,
} from '@/lib/image-engine';
import { Camera, Sliders, Palette, Loader2, Check } from 'lucide-react';

export function PasFotoView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [preset, setPreset] = useState<'2x3' | '3x4' | '4x6' | 'passport'>('3x4');
  const [bgColor, setBgColor] = useState<string>('#db2728'); // Default Merah CPNS
  const [maxKb, setMaxKb] = useState<number>(200); // Default 200KB limit
  const [quality, setQuality] = useState<number>(95);

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    blob: Blob;
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  } | null>(null);
  const [resultFilename, setResultFilename] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    try {
      const res = await processPasFoto(selectedFile, {
        preset,
        backgroundColor: bgColor,
        quality,
        maxFileSizeKb: maxKb,
      });

      const base = selectedFile.name.replace(/\.[^/.]+$/, '');
      const filename = `${base}_pasfoto_${preset}.jpg`;
      setResult(res);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to process photo: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setResult(null);
  };

  const activePreset = PAS_FOTO_PRESETS[preset];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Camera className="w-3.5 h-3.5" />
          <span>MODULE / PAS FOTO STUDIO</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Pas Foto & ID Photo Studio</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Format photo proportions for official administrative standards (2×3, 3×4, 4×6, Paspor) with background replacement and size limits.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="image/*"
          title="Select or drop your photo"
          subtitle="Portrait photo recommended for optimal framing"
        />
      ) : (
        <div className="space-y-4">
          {/* Summary & Live Framing Preview */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-28 rounded-lg overflow-hidden border border-border flex items-center justify-center relative shadow-subtle shrink-0"
                style={{ backgroundColor: bgColor }}
              >
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>

              <div>
                <p className="text-xs font-medium text-white truncate max-w-xs">{selectedFile.name}</p>
                <p className="text-[11px] font-mono text-zinc-400">Weight: {formatBytes(selectedFile.size)}</p>
                <p className="text-[11px] font-mono text-zinc-400 mt-1">
                  Target: {activePreset.label} ({activePreset.widthPx}×{activePreset.heightPx} px @ 300 DPI)
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-md btn-secondary cursor-pointer"
            >
              Change Photo
            </button>
          </div>

          {/* Configuration */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">Size Preset & Background</h3>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-xs text-zinc-400 block">Standard Document Preset</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.values(PAS_FOTO_PRESETS).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPreset(p.id as any)}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      preset === p.id
                        ? 'bg-zinc-100 border-zinc-100 text-zinc-950 shadow-subtle'
                        : 'bg-surface-100 border-border text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <p className="text-xs font-semibold">{p.label}</p>
                    <p className={`text-[10px] font-mono ${preset === p.id ? 'text-zinc-600' : 'text-zinc-500'}`}>
                      {p.widthPx} × {p.heightPx} px
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Color & File Size Constraints */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              {/* Background fill */}
              <div className="space-y-1.5">
                <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-zinc-400" />
                  <span>Background Color Standard</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Merah (CPNS)', color: '#db2728' },
                    { label: 'Biru (KTP)', color: '#2563eb' },
                    { label: 'Putih', color: '#ffffff' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setBgColor(c.color)}
                      className={`px-2 py-1 rounded text-xs border flex items-center gap-1.5 transition cursor-pointer ${
                        bgColor === c.color
                          ? 'bg-zinc-800 border-zinc-400 text-white'
                          : 'bg-surface-100 border-border text-zinc-400'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-[11px]">{c.label}</span>
                    </button>
                  ))}
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 ml-auto"
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Target File Size */}
              <div className="space-y-1.5">
                <span className="text-xs text-zinc-400 block">File Size Limit (Portal Constraint)</span>
                <div className="grid grid-cols-3 gap-1 bg-surface-100 p-1 rounded-lg border border-border text-xs">
                  {[
                    { val: 200, label: '< 200 KB' },
                    { val: 300, label: '< 300 KB' },
                    { val: 500, label: '< 500 KB' },
                  ].map((limit) => (
                    <button
                      key={limit.val}
                      type="button"
                      onClick={() => setMaxKb(limit.val)}
                      className={`py-1 rounded text-xs font-medium transition cursor-pointer ${
                        maxKb === limit.val
                          ? 'bg-zinc-800 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {limit.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={isProcessing}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Pas Foto...</span>
                </>
              ) : (
                <span>Export {activePreset.label} JPG</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {result && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadBlob(result.blob, resultFilename)}
          onReset={handleReset}
          title="Pas Foto ready for download"
          filename={resultFilename}
          fileSize={result.size}
          stats={[
            { label: 'Standard size', value: activePreset.label },
            { label: 'Pixel resolution', value: `${result.width}×${result.height} px (300 DPI)` },
            { label: 'File weight constraint', value: `< ${maxKb} KB (${formatBytes(result.size)})` },
          ]}
          downloadLabel="Download Pas Foto JPG"
        />
      )}
    </div>
  );
}

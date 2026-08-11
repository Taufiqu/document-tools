import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, formatBytes } from '@/lib/utils';
import { compressImage, CompressedImageResult } from '@/lib/image-engine';
import { Minimize2, Sliders, Loader2 } from 'lucide-react';

export function CompressImageView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [quality, setQuality] = useState<number>(75);
  const [maxDimension, setMaxDimension] = useState<number>(1920);
  const [format, setFormat] = useState<string>('image/jpeg');

  const [isCompressing, setIsCompressing] = useState(false);
  const [result, setResult] = useState<CompressedImageResult | null>(null);
  const [resultFilename, setResultFilename] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleCompress = async () => {
    if (!selectedFile) return;
    setIsCompressing(true);

    try {
      const res = await compressImage(selectedFile, quality, maxDimension, format);
      setResult(res);

      const ext = format === 'image/webp' ? 'webp' : format === 'image/png' ? 'png' : 'jpg';
      const base = selectedFile.name.replace(/\.[^/.]+$/, '');
      setResultFilename(`${base}_compressed.${ext}`);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to compress image: ${err}`);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl('');
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Minimize2 className="w-3.5 h-3.5" />
          <span>MODULE / IMAGE COMPRESSOR</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Compress Image File</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Optimize image weights in browser memory with granular quality and dimension controls.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="image/*"
          title="Select or drop an image file"
          subtitle="Supports JPEG, PNG, and WebP compression"
        />
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="p-3.5 rounded-xl bg-surface-200 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface-100 border border-border overflow-hidden flex items-center justify-center">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
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
              Change Image
            </button>
          </div>

          {/* Controls */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">Compression Parameters</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Quality slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Quality</span>
                  <span className="font-mono text-zinc-200">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
              </div>

              {/* Max dimension */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Max Dimension</span>
                  <span className="font-mono text-zinc-200">{maxDimension}px</span>
                </div>
                <select
                  value={maxDimension}
                  onChange={(e) => setMaxDimension(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-100 border border-border text-white text-xs font-mono focus:outline-none cursor-pointer"
                >
                  <option value={3840}>4K (3840px)</option>
                  <option value={1920}>Full HD (1920px)</option>
                  <option value={1280}>HD Ready (1280px)</option>
                  <option value={800}>Web Small (800px)</option>
                </select>
              </div>

              {/* Format */}
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 block">Format</span>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-100 border border-border text-white text-xs font-mono focus:outline-none cursor-pointer"
                >
                  <option value="image/jpeg">JPEG Standard</option>
                  <option value="image/webp">WebP Modern</option>
                  <option value="image/png">PNG</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCompress}
              disabled={isCompressing}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compressing in RAM...</span>
                </>
              ) : (
                <span>Compress Image</span>
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
          title="Image successfully compressed"
          filename={resultFilename}
          fileSize={result.compressedSize}
          stats={[
            { label: 'Original weight', value: formatBytes(result.originalSize) },
            { label: 'Compressed weight', value: formatBytes(result.compressedSize) },
            { label: 'Reduction', value: `-${result.reductionPercentage}%` },
            { label: 'Resolution', value: `${result.width}×${result.height} px` },
          ]}
          downloadLabel="Download Compressed Image"
        />
      )}
    </div>
  );
}

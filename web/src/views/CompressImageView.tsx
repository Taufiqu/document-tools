import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, formatBytes } from '@/lib/utils';
import { compressImage, CompressedImageResult } from '@/lib/image-engine';
import { Minimize2, Sliders, Loader2, Sparkles, ArrowRight } from 'lucide-react';

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
      alert(`Gagal mengompresi gambar: ${err}`);
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <Minimize2 className="w-4 h-4" />
          <span>Lossless & WebP Optimizer</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Image Compressor</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Perkecil ukuran file gambar secara drastis langsung di browser dengan kontrol kualitas dan resolusi fleksibel.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="image/*"
          title="Tarik File Gambar ke Sini"
          subtitle="Mendukung JPG, PNG, WebP untuk kompresi kilat tanpa upload"
        />
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          <div className="p-4 rounded-2xl bg-surface-100 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-200 border border-slate-700 overflow-hidden flex items-center justify-center">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold text-white max-w-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">Ukuran Asli: {formatBytes(selectedFile.size)}</p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-slate-700 transition cursor-pointer"
            >
              Ganti Gambar
            </button>
          </div>

          {/* Controls */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>Pengaturan Kompresi & Format Target</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Quality slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Tingkat Kualitas</span>
                  <span className="text-emerald-400 font-mono font-bold">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Max dimension */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Batas Resolusi Maks</span>
                  <span className="text-emerald-400 font-mono font-bold">{maxDimension} px</span>
                </div>
                <select
                  value={maxDimension}
                  onChange={(e) => setMaxDimension(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-surface-200 border border-slate-700 text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value={3840}>4K Ultra HD (3840px)</option>
                  <option value={1920}>Full HD (1920px)</option>
                  <option value={1280}>HD Ready (1280px)</option>
                  <option value={800}>Web Small (800px)</option>
                </select>
              </div>

              {/* Format */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">Format Output</span>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-200 border border-slate-700 text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="image/jpeg">JPEG (Kompatibel Tinggi)</option>
                  <option value="image/webp">WebP (Ukuran Paling Ringan)</option>
                  <option value="image/png">PNG</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCompress}
              disabled={isCompressing}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90 text-white font-bold text-sm transition shadow-glow-emerald disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengompresi Gambar di RAM...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Kompres Gambar Sekarang</span>
                </>
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
          title="Gambar Berhasil Dikompresi!"
          filename={resultFilename}
          fileSize={result.compressedSize}
          stats={[
            { label: 'Ukuran Awal', value: formatBytes(result.originalSize) },
            { label: 'Ukuran Akhir', value: formatBytes(result.compressedSize) },
            { label: 'Hemat Ukuran', value: `${result.reductionPercentage}% LEBIH RINGAN` },
            { label: 'Dimensi Akhir', value: `${result.width}x${result.height} px` },
          ]}
          downloadLabel="Unduh Gambar Terkompresi"
        />
      )}
    </div>
  );
}

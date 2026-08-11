import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import { watermarkPdf, getPdfPageCount } from '@/lib/pdf-engine';
import { Shield, Type, Sliders, Loader2, Sparkles } from 'lucide-react';

export function WatermarkView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.25);
  const [fontSize, setFontSize] = useState(48);
  const [angle, setAngle] = useState(45);

  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
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
      alert(`Gagal memuat file PDF: ${err}`);
    }
  };

  const handleApplyWatermark = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    if (!watermarkText.trim()) {
      alert('Masukkan teks watermark terlebih dahulu.');
      return;
    }

    setIsProcessing(true);
    try {
      const watermarked = await watermarkPdf(rawPdfBytes, {
        text: watermarkText,
        opacity,
        fontSize,
        angle,
      });

      const filename = selectedFile.name.replace(/\.pdf$/i, '_watermarked.pdf');
      setResultBytes(watermarked);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal memberi watermark: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setResultBytes(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <Shield className="w-4 h-4" />
          <span>Document Security Tool</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">PDF Watermark</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Tambahkan teks cap air / watermark diagonal transparan ke seluruh halaman PDF Anda secara instan dan aman.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Tarik File PDF ke Sini"
          subtitle="Pilih satu file PDF yang ingin ditambahkan cap watermark"
        />
      ) : (
        <div className="space-y-6">
          {/* File summary */}
          <div className="p-4 rounded-2xl bg-surface-100 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white max-w-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">
                  {pageCount} Halaman • {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-slate-700 transition cursor-pointer"
            >
              Ganti File
            </button>
          </div>

          {/* Watermark Settings */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Pengaturan Teks & Tampilan Watermark</span>
            </h3>

            {/* Text Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white block">Teks Watermark</label>
              <div className="relative">
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="Contoh: DOKUMEN RAHASIA / CONFIDENTIAL"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-200 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
                />
                <Type className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Opacity */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Transparansi (Opacity)</span>
                  <span className="text-amber-400 font-mono">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Font Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Ukuran Huruf</span>
                  <span className="text-amber-400 font-mono">{fontSize} pt</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={90}
                  step={2}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Angle */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Sudut Kemiringan</span>
                  <span className="text-amber-400 font-mono">{angle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={angle}
                  onChange={(e) => setAngle(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Preview Box */}
            <div className="p-4 rounded-xl bg-surface-200 border border-slate-800 relative overflow-hidden h-24 flex items-center justify-center select-none">
              <span
                className="font-bold uppercase tracking-widest text-white transition-all pointer-events-none"
                style={{
                  opacity,
                  fontSize: `${fontSize * 0.45}px`,
                  transform: `rotate(-${angle}deg)`,
                }}
              >
                {watermarkText || 'WATERMARK'}
              </span>
            </div>

            <button
              onClick={handleApplyWatermark}
              disabled={isProcessing || !watermarkText.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 hover:opacity-90 text-white font-bold text-sm transition shadow-glow-primary disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menerapkan Watermark ke Seluruh Halaman...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Terapkan Watermark Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultBytes && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(resultBytes, resultFilename)}
          onReset={handleReset}
          title="Watermark Berhasil Diterapkan!"
          filename={resultFilename}
          fileSize={resultBytes.byteLength}
          stats={[
            { label: 'Teks Cap Air', value: watermarkText },
            { label: 'Halaman Terlindungi', value: `${pageCount} halaman` },
          ]}
          downloadLabel="Unduh PDF Ber-Watermark"
        />
      )}
    </div>
  );
}

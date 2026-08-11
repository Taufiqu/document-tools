import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadUint8Array, formatBytes } from '@/lib/utils';
import { imagesToPdf, ImageToPdfOptions } from '@/lib/image-engine';
import { Download, ArrowUp, ArrowDown, Trash2, Loader2, Sparkles, Sliders } from 'lucide-react';

interface SelectedImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export function ImageToPdfView() {
  const [images, setImages] = useState<SelectedImageItem[]>([]);
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState<number>(20);

  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultFilename, setResultFilename] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    const newItems: SelectedImageItem[] = files.map((file) => ({
      id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...newItems]);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= images.length - 1) return;
    setImages((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleRemove = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearAll = () => {
    setImages([]);
  };

  const handleConvert = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);

    try {
      const options: ImageToPdfOptions = {
        pageSize: 'A4',
        orientation,
        margin,
      };

      const pdfBytes = await imagesToPdf(
        images.map((i) => i.file),
        options
      );

      const filename = `images_combined_${Date.now()}.pdf`;
      setResultBytes(pdfBytes);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal membuat PDF dari gambar: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const totalSize = images.reduce((acc, i) => acc + i.size, 0);

  const handleReset = () => {
    setImages([]);
    setResultBytes(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <Download className="w-4 h-4" />
          <span>Image to Document Converter</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Images to PDF</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Satukan banyak file gambar (PNG, JPG, JPEG) menjadi satu berkas PDF rapi dengan orientasi dan margin kustom.
        </p>
      </div>

      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept="image/*"
        title="Tarik File-File Gambar ke Sini"
        subtitle="Pilih satu atau beberapa gambar untuk digabungkan menjadi 1 file PDF"
      />

      {images.length > 0 && (
        <div className="space-y-6">
          {/* Options card */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Pengaturan Tata Letak Dokumen PDF</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Orientation */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-white block">Orientasi Halaman</span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'auto', label: 'Otomatis' },
                    { id: 'portrait', label: 'Portrait' },
                    { id: 'landscape', label: 'Landscape' },
                  ].map((ori) => (
                    <button
                      key={ori.id}
                      type="button"
                      onClick={() => setOrientation(ori.id as any)}
                      className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        orientation === ori.id
                          ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                          : 'bg-surface-200 border border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {ori.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margin */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white font-semibold">Margin Sisi Halaman</span>
                  <span className="text-purple-400 font-mono font-bold">{margin} pt</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Tanpa Margin (0)', val: 0 },
                    { label: 'Normal (20)', val: 20 },
                    { label: 'Besar (40)', val: 40 },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setMargin(m.val)}
                      className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        margin === m.val
                          ? 'bg-purple-600/30 border border-purple-500 text-purple-300'
                          : 'bg-surface-200 border border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Image List */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Urutan Halaman Gambar</h3>
                <p className="text-xs text-slate-400">
                  {images.length} Gambar ({formatBytes(totalSize)})
                </p>
              </div>

              <button
                onClick={handleClearAll}
                className="text-xs text-rose-400 hover:text-rose-300 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            </div>

            <div className="space-y-2">
              {images.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-surface-200 border border-slate-700/60 hover:border-purple-500/40 transition text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-400 font-bold flex items-center justify-center text-xs">
                      {index + 1}
                    </span>
                    <img src={item.previewUrl} alt={item.name} className="w-10 h-10 object-cover rounded-lg border border-slate-700" />
                    <div className="truncate">
                      <p className="font-semibold text-white truncate max-w-xs">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{formatBytes(item.size)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg bg-surface-100 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === images.length - 1}
                      className="p-1.5 rounded-lg bg-surface-100 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleConvert}
              disabled={isProcessing || images.length === 0}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:opacity-90 text-white font-bold text-sm transition shadow-glow-purple disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuat File PDF...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Konversi {images.length} Gambar Menjadi 1 PDF</span>
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
          title="PDF dari Gambar Berhasil Dibuat!"
          filename={resultFilename}
          fileSize={resultBytes.byteLength}
          stats={[
            { label: 'Jumlah Gambar', value: `${images.length} halaman` },
            { label: 'Ukuran Kertas', value: 'A4' },
          ]}
          downloadLabel="Unduh Dokumen PDF"
        />
      )}
    </div>
  );
}

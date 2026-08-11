import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, formatBytes } from '@/lib/utils';
import {
  batchConvertPngToJpg,
  ConvertedImageItem,
} from '@/lib/image-engine';
import {
  Image as ImageIcon,
  Sparkles,
  Loader2,
  Sliders,
  Trash2,
  Palette,
} from 'lucide-react';

interface SelectedPngItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export function PngToJpgView() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedPngItem[]>([]);
  const [quality, setQuality] = useState<number>(92);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

  const [convertedItems, setConvertedItems] = useState<ConvertedImageItem[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    const pngOnly = files.filter(
      (f) => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png')
    );

    if (pngOnly.length === 0) {
      alert('Silakan pilih berkas berekstensi PNG.');
      return;
    }

    const newItems: SelectedPngItem[] = pngOnly.map((file) => ({
      id: `png-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedFiles((prev) => [...prev, ...newItems]);
    setConvertedItems([]);
    setZipBlob(null);
  };

  const handleRemove = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setConvertedItems([]);
    setZipBlob(null);
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setProgressText('Mengonversi format PNG ke JPG...');

    try {
      const { items, zipBlob: generatedZip } = await batchConvertPngToJpg(
        selectedFiles.map((item) => item.file),
        { quality, backgroundColor: bgColor }
      );

      setConvertedItems(items);
      if (generatedZip) {
        setZipBlob(generatedZip);
      }
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal mengonversi gambar: ${err}`);
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const totalOriginalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const totalConvertedSize = convertedItems.reduce((acc, f) => acc + f.convertedSize, 0);

  const handleReset = () => {
    setSelectedFiles([]);
    setConvertedItems([]);
    setZipBlob(null);
  };

  const handleDownloadAll = () => {
    if (convertedItems.length === 1) {
      downloadBlob(convertedItems[0].blob, convertedItems[0].targetName);
    } else if (zipBlob) {
      downloadBlob(zipBlob, `converted_jpg_${Date.now()}.zip`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <ImageIcon className="w-4 h-4" />
          <span>Image Format Converter</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">PNG to JPG / JPEG Converter</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Ubah gambar format PNG menjadi JPG berkualitas tinggi secara instan 100% di browser tanpa upload server. Dilengkapi penanganan latar belakang transparan.
        </p>
      </div>

      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept="image/png"
        title="Tarik File Gambar PNG ke Sini"
        subtitle="Pilih satu atau banyak file PNG sekaligus untuk dikonversi ke JPG"
      />

      {selectedFiles.length > 0 && (
        <div className="space-y-6">
          {/* Settings Card */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-rose-400" />
              <span>Pengaturan Kualitas & Latar Belakang Transparan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quality Slider */}
              <div className="p-4 rounded-xl bg-surface-200 border border-slate-700/60 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">Kualitas Gambar JPG</span>
                  <span className="text-rose-400 font-bold font-mono">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={1}
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Ukuran Ringan (60%)</span>
                  <span>Standar HD (92%)</span>
                  <span>Maksimum (100%)</span>
                </div>
              </div>

              {/* Background Color for Transparency Replacement */}
              <div className="p-4 rounded-xl bg-surface-200 border border-slate-700/60 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-rose-400" />
                    <span>Warna Pengganti Transparan</span>
                  </span>
                  <span className="font-mono text-slate-400 text-[11px]">{bgColor.toUpperCase()}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {[
                    { label: 'Putih', color: '#ffffff' },
                    { label: 'Hitam', color: '#000000' },
                    { label: 'Abu-Abu', color: '#f3f4f6' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setBgColor(c.color)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                        bgColor === c.color
                          ? 'bg-rose-500/20 border-rose-500 text-white'
                          : 'bg-surface-100 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-slate-600 inline-block"
                        style={{ backgroundColor: c.color }}
                      />
                      <span>{c.label}</span>
                    </button>
                  ))}

                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    title="Pilih warna kustom"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Selected File Grid List */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Daftar File PNG Siap Dikonversi ({selectedFiles.length} berkas • {formatBytes(totalOriginalSize)})
              </h3>
              <button
                onClick={handleClearAll}
                className="text-xs text-rose-400 hover:text-rose-300 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {selectedFiles.map((item, index) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-surface-200 border border-slate-700/70 hover:border-rose-500/40 flex flex-col justify-between gap-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-5 h-5 rounded bg-rose-600/30 text-rose-300 font-bold flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    <p className="font-semibold text-white truncate max-w-[170px]">{item.name}</p>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="w-full h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800">
                    <img src={item.previewUrl} alt={item.name} className="max-w-full max-h-full object-contain" />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-slate-400 text-[10px]">
                    <span>{formatBytes(item.size)}</span>
                    <span className="text-rose-400 font-bold">→ .JPG</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Execute Button */}
            <button
              onClick={handleConvert}
              disabled={isProcessing || selectedFiles.length === 0}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:opacity-90 text-white font-bold text-sm transition shadow-glow-primary disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progressText || 'Mengonversi ke JPG...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Konversi {selectedFiles.length} Gambar PNG ke JPG
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {convertedItems.length > 0 && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={handleDownloadAll}
          onReset={handleReset}
          title="Konversi PNG ke JPG Berhasil!"
          filename={
            convertedItems.length === 1
              ? convertedItems[0].targetName
              : `converted_jpg_${Date.now()}.zip`
          }
          fileSize={
            convertedItems.length === 1
              ? convertedItems[0].convertedSize
              : zipBlob?.size
          }
          stats={[
            { label: 'Jumlah Gambar', value: `${convertedItems.length} berkas` },
            { label: 'Format Output', value: 'JPG (JPEG)' },
            { label: 'Kualitas', value: `${quality}%` },
            {
              label: 'Ukuran Total',
              value: formatBytes(
                convertedItems.length === 1
                  ? convertedItems[0].convertedSize
                  : totalConvertedSize
              ),
            },
          ]}
          downloadLabel={
            convertedItems.length === 1
              ? 'Unduh Gambar JPG'
              : 'Unduh Semua JPG (.ZIP)'
          }
        />
      )}
    </div>
  );
}

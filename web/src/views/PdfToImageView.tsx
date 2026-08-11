import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadBlob, formatBytes } from '@/lib/utils';
import { getPdfPageCount } from '@/lib/pdf-engine';
import { renderPdfPagesToImagesZip, ImageExportFormat } from '@/lib/pdf-renderer';
import { Image as ImageIcon, Sliders, Loader2, Sparkles } from 'lucide-react';

export function PdfToImageView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [format, setFormat] = useState<ImageExportFormat>('png');
  const [scale, setScale] = useState<number>(2.0); // 2.0x for HD rendering
  const [isRendering, setIsRendering] = useState(false);
  const [progressText, setProgressText] = useState('');

  const [resultZipBlob, setResultZipBlob] = useState<Blob | null>(null);
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
      alert(`Gagal memuat PDF: ${err}`);
    }
  };

  const handleConvert = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsRendering(true);
    setProgressText('Memulai rendering halaman PDF...');

    try {
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const zipBlob = await renderPdfPagesToImagesZip(
        rawPdfBytes,
        format,
        scale,
        baseName,
        (current, total) => {
          setProgressText(`Me-render halaman ${current} dari ${total}...`);
        }
      );

      const filename = `${baseName}_images_${format.toUpperCase()}.zip`;
      setResultZipBlob(zipBlob);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal merender gambar: ${err}`);
    } finally {
      setIsRendering(false);
      setProgressText('');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setResultZipBlob(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <ImageIcon className="w-4 h-4" />
          <span>High-Definition Rasterizer</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">PDF to Images HD</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Ubah setiap halaman dokumen PDF Anda menjadi gambar beresolusi tinggi (PNG, JPG, WebP) yang dikemas dalam file ZIP.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Tarik File PDF ke Sini"
          subtitle="Pilih satu file PDF untuk diekstrak seluruh halamannya menjadi gambar"
        />
      ) : (
        <div className="space-y-6">
          {/* File summary */}
          <div className="p-4 rounded-2xl bg-surface-100 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                <ImageIcon className="w-5 h-5" />
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

          {/* Settings */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Format & Resolusi Render</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Format selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white block">Format Gambar</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['png', 'jpeg', 'webp'] as ImageExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer ${
                        format === fmt
                          ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-300'
                          : 'bg-surface-200 border border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution / Scale */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Resolusi (Skala Render)</span>
                  <span className="text-cyan-400 font-mono font-bold">{scale}x ({scale === 1 ? 'Standar 72 DPI' : scale === 2 ? 'HD 150 DPI' : 'Ultra HD 300 DPI'})</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '1.0x (Web)', val: 1.0 },
                    { label: '2.0x (HD)', val: 2.0 },
                    { label: '3.0x (Ultra)', val: 3.0 },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setScale(s.val)}
                      className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        scale === s.val
                          ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-300'
                          : 'bg-surface-200 border border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleConvert}
              disabled={isRendering}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 text-white font-bold text-sm transition shadow-glow-cyan disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progressText || 'Me-render halaman PDF...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Konversi {pageCount} Halaman Menjadi Gambar ({format.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultZipBlob && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadBlob(resultZipBlob, resultFilename)}
          onReset={handleReset}
          title="Halaman PDF Berhasil Di-render!"
          filename={resultFilename}
          fileSize={resultZipBlob.size}
          stats={[
            { label: 'Total Gambar', value: `${pageCount} berkas` },
            { label: 'Format Gambar', value: format.toUpperCase() },
            { label: 'Skala Rendering', value: `${scale}x HD` },
          ]}
          downloadLabel="Unduh Paket Gambar (.ZIP)"
        />
      )}
    </div>
  );
}

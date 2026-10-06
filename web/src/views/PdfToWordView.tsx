import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadBlob, formatBytes } from '@/lib/utils';
import { getPdfPageCount } from '@/lib/pdf-engine';
import {
  convertPdfToWord,
  type ConversionMode,
  type PdfToWordResult,
} from '@/lib/pdf-to-word';
import {
  FileText,
  Sliders,
  Loader2,
  Download,
  CheckCircle2,
  ShieldCheck,
  FileEdit,
  Sparkles,
  Layers,
  Table as TableIcon,
  Type,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

export function PdfToWordView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  // Configuration options
  const [mode, setMode] = useState<ConversionMode>('structured');
  const [detectTables, setDetectTables] = useState<boolean>(true);
  const [detectHeadings, setDetectHeadings] = useState<boolean>(true);
  const [preservePageBreaks, setPreservePageBreaks] = useState<boolean>(true);
  const [defaultFont, setDefaultFont] = useState<string>('Calibri');

  // Processing state
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Result state
  const [conversionResult, setConversionResult] = useState<PdfToWordResult | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);

    try {
      const bytes = await fileToUint8Array(file);
      setRawPdfBytes(bytes);
      const count = await getPdfPageCount(bytes);
      setPageCount(count);
      setConversionResult(null);
    } catch (err) {
      alert(`Gagal memuat dokumen PDF: ${err}`);
    }
  };

  const handleConvert = async () => {
    if (!rawPdfBytes || !selectedFile) return;

    setIsConverting(true);
    setProgressText('Mempersiapkan dokumen di RAM...');
    setCurrentProgress({ current: 0, total: pageCount });

    try {
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const result = await convertPdfToWord(rawPdfBytes, baseName, {
        mode,
        detectTables,
        detectHeadings,
        preservePageBreaks,
        defaultFont,
        onProgress: (current, total, message) => {
          setCurrentProgress({ current, total });
          setProgressText(message);
        },
      });

      setConversionResult(result);
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal mengonversi PDF ke Word: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConverting(false);
      setProgressText('');
    }
  };

  const handleDownload = () => {
    if (!conversionResult) return;
    downloadBlob(conversionResult.blob, conversionResult.filename);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setPageCount(0);
    setConversionResult(null);
    setShowResultModal(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <FileText className="w-3.5 h-3.5 text-blue-400" />
          <span>MODUL / PDF TO WORD</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">
          Konversi PDF ke Word (.docx)
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          Ubah dokumen PDF menjadi format Microsoft Word (.docx) yang dapat diedit, mempertahankan
          paragraf, perataan, tabel, dan tata letak secara 100% lokal di browser.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Pilih atau seret berkas PDF di sini"
          subtitle="Diproses 100% di memori browser (RAM) tanpa diunggah ke server"
        />
      ) : (
        <div className="space-y-5">
          {/* File Summary Card */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-white truncate max-w-xs sm:max-w-md">
                  {selectedFile.name}
                </p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  {pageCount} Halaman • {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              disabled={isConverting}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-md btn-secondary cursor-pointer disabled:opacity-50"
            >
              Ganti Berkas
            </button>
          </div>

          {/* Mode Selection */}
          <div className="p-4 sm:p-5 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">Metode Konversi Dokumen</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Mode 1: Structured (Recommended) */}
              <div
                onClick={() => setMode('structured')}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                  mode === 'structured'
                    ? 'border-blue-500 bg-blue-500/10 text-white shadow-subtle'
                    : 'border-border bg-surface-100 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <FileEdit className={`w-4 h-4 ${mode === 'structured' ? 'text-blue-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                    Rekomendasi
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-zinc-100 mb-1">Format Rapi & Editable</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Ekstraksi semantik ke teks mengalir, judul, font, dan tabel Word asli yang siap diedit.
                </p>
              </div>

              {/* Mode 2: Hybrid */}
              <div
                onClick={() => setMode('hybrid')}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                  mode === 'hybrid'
                    ? 'border-blue-500 bg-blue-500/10 text-white shadow-subtle'
                    : 'border-border bg-surface-100 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Layers className={`w-4 h-4 ${mode === 'hybrid' ? 'text-blue-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-300">
                    Hibrida
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-zinc-100 mb-1">Teks + Grafis Halaman</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Menyertakan teks dan tabel yang dapat diedit beserta grafis resolusi tinggi dari PDF.
                </p>
              </div>

              {/* Mode 3: Visual Precision */}
              <div
                onClick={() => setMode('visual')}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                  mode === 'visual'
                    ? 'border-blue-500 bg-blue-500/10 text-white shadow-subtle'
                    : 'border-border bg-surface-100 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Maximize2 className={`w-4 h-4 ${mode === 'visual' ? 'text-blue-400' : 'text-zinc-400'}`} />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-300">
                    Presisi 1:1
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-zinc-100 mb-1">Replika Visual Penuh</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Menjaga 100% tata letak visual halaman (stempel, grafik, tanda tangan, dan sertifikat).
                </p>
              </div>
            </div>

            {/* Fine-Tuning Options */}
            <div className="pt-3 border-t border-border/80 space-y-3">
              <h4 className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                Opsi Ekstraksi Layout
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-100 border border-border cursor-pointer hover:border-zinc-500">
                  <input
                    type="checkbox"
                    checked={detectTables}
                    onChange={(e) => setDetectTables(e.target.checked)}
                    className="rounded border-zinc-600 text-blue-500 focus:ring-0 focus:ring-offset-0 bg-surface-200"
                  />
                  <div>
                    <span className="text-xs font-medium text-zinc-200 block">Deteksi Tabel Otomatis</span>
                    <span className="text-[10px] text-zinc-400 block">
                      Mengonversi kolom sejajar menjadi tabel Word asli
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-100 border border-border cursor-pointer hover:border-zinc-500">
                  <input
                    type="checkbox"
                    checked={detectHeadings}
                    onChange={(e) => setDetectHeadings(e.target.checked)}
                    className="rounded border-zinc-600 text-blue-500 focus:ring-0 focus:ring-offset-0 bg-surface-200"
                  />
                  <div>
                    <span className="text-xs font-medium text-zinc-200 block">Deteksi Judul & Heading</span>
                    <span className="text-[10px] text-zinc-400 block">
                      Menerapkan heading level berdasarkan ukuran teks
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-100 border border-border cursor-pointer hover:border-zinc-500">
                  <input
                    type="checkbox"
                    checked={preservePageBreaks}
                    onChange={(e) => setPreservePageBreaks(e.target.checked)}
                    className="rounded border-zinc-600 text-blue-500 focus:ring-0 focus:ring-offset-0 bg-surface-200"
                  />
                  <div>
                    <span className="text-xs font-medium text-zinc-200 block">Pertahankan Pembatas Halaman</span>
                    <span className="text-[10px] text-zinc-400 block">
                      Menyisipkan page break sesuai nomor halaman PDF
                    </span>
                  </div>
                </label>

                <div className="p-2.5 rounded-lg bg-surface-100 border border-border">
                  <label className="text-xs font-medium text-zinc-200 block mb-1">
                    Font Dokumen Default
                  </label>
                  <select
                    value={defaultFont}
                    onChange={(e) => setDefaultFont(e.target.value)}
                    className="w-full text-xs bg-surface-200 border border-border rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="Calibri">Calibri (Standar Modern)</option>
                    <option value="Arial">Arial (Clean Sans-Serif)</option>
                    <option value="Times New Roman">Times New Roman (Formal / Skripsi)</option>
                    <option value="Georgia">Georgia (Serif Elegan)</option>
                    <option value="Segoe UI">Segoe UI</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action Button & Live Progress */}
            <div className="pt-2">
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="btn-primary w-full py-3 text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle disabled:opacity-50"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{progressText || 'Memproses di RAM...'}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Konversi Sekarang ke Word (.docx)</span>
                  </>
                )}
              </button>

              {isConverting && currentProgress.total > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="w-full bg-surface-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((currentProgress.current / currentProgress.total) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono text-center">
                    {progressText}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Privacy & Technical Guarantee Badge */}
          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300 leading-relaxed">
              <span className="font-semibold text-emerald-300">100% Client-Side Memory Processing: </span>
              File PDF Anda diuraikan dan disusun ulang menjadi berkas Word (.docx) langsung di RAM
              komputer/ponsel Anda melalui WebAssembly. Tidak ada berkas yang pernah dikirim ke
              cloud atau server pihak ketiga mana pun.
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {conversionResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={handleDownload}
          onReset={handleReset}
          title="Konversi Berhasil!"
          filename={conversionResult.filename}
          fileSize={conversionResult.fileSize}
          stats={[
            { label: 'Jumlah Halaman', value: `${conversionResult.pageCount} halaman` },
            { label: 'Paragraf Terformat', value: `${conversionResult.paragraphCount} blok` },
            { label: 'Tabel Terdeteksi', value: `${conversionResult.tableCount} tabel` },
            {
              label: 'Mode Konversi',
              value:
                conversionResult.mode === 'structured'
                  ? 'Format Rapi (Editable)'
                  : conversionResult.mode === 'hybrid'
                  ? 'Hibrida (Teks + Gambar)'
                  : 'Presisi Visual (Replika)',
            },
          ]}
          downloadLabel="Unduh File Word (.docx)"
        />
      )}
    </div>
  );
}

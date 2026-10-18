import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { formatBytes, downloadBlob, stripExtension } from '@/lib/utils';
import {
  compressOfficeDocument,
  detectOfficeType,
  isLegacyOfficeFormat,
  OfficeCompressionLevel,
  OfficeCompressProgress,
  OfficeCompressResult,
} from '@/lib/office-compressor';
import JSZip from 'jszip';
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Sliders,
  Loader2,
  FileArchive,
  Image as ImageIcon,
  AlertTriangle,
  Info,
} from 'lucide-react';

export function CompressOfficeView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docInfo, setDocInfo] = useState<{
    type: 'word' | 'powerpoint' | 'excel' | 'office';
    label: string;
    mime: string;
  } | null>(null);
  const [imageCount, setImageCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [level, setLevel] = useState<OfficeCompressionLevel>('recommended');
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState<OfficeCompressProgress | null>(null);

  const [result, setResult] = useState<OfficeCompressResult | null>(null);
  const [resultFilename, setResultFilename] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setErrorMsg(null);
    setSelectedFile(file);

    const info = detectOfficeType(file.name);
    setDocInfo(info);

    // Check for legacy formats
    if (isLegacyOfficeFormat(file.name)) {
      setErrorMsg(
        'Format berkas .doc / .ppt / .xls (format lawas biner) belum mendukung kompresi OpenXML. Harap simpan ulang berkas ke format modern (.docx / .pptx / .xlsx) di Microsoft Office atau LibreOffice terlebih dahulu.'
      );
      setImageCount(0);
      return;
    }

    try {
      // Quick inspection of embedded images
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);
      const images = Object.keys(zip.files).filter((path) => {
        const entry = zip.files[path];
        return !entry.dir && /\.(jpe?g|png|bmp|webp)$/i.test(path);
      });
      setImageCount(images.length);
    } catch {
      setImageCount(0);
    }
  };

  const handleCompress = async () => {
    if (!selectedFile) return;
    setIsCompressing(true);
    setProgress({
      message: 'Mempersiapkan dokumen...',
      current: 0,
      total: 100,
      percentage: 5,
    });

    try {
      const res = await compressOfficeDocument(selectedFile, {
        level,
        onProgress: (p) => setProgress(p),
      });

      const ext = selectedFile.name.split('.').pop() || '';
      const base = stripExtension(selectedFile.name);
      const filename = `${base}_compressed.${ext}`;

      setResult(res);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err: any) {
      alert(`Gagal mengompresi dokumen: ${err?.message || err}`);
    } finally {
      setIsCompressing(false);
      setProgress(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setDocInfo(null);
    setImageCount(null);
    setErrorMsg(null);
    setResult(null);
  };

  const renderDocIcon = () => {
    if (docInfo?.type === 'word') {
      return <FileText className="w-5 h-5 text-blue-400" />;
    }
    if (docInfo?.type === 'powerpoint') {
      return <Presentation className="w-5 h-5 text-amber-400" />;
    }
    if (docInfo?.type === 'excel') {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
    }
    return <FileArchive className="w-5 h-5 text-zinc-400" />;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <FileArchive className="w-3.5 h-3.5" />
          <span>MODULE / OFFICE COMPRESSOR</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">
          Compress Word, PowerPoint & Excel
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Kecilkan ukuran dokumen Word (.docx), presentasi PowerPoint (.pptx), dan spreadsheet Excel (.xlsx) langsung di browser RAM tanpa kirim berkas ke server.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept=".docx,.pptx,.xlsx,.docm,.pptm,.xlsm,.dotx,.potx,.xltx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          title="Pilih atau drop file Word (.docx), PowerPoint (.pptx), atau Excel (.xlsx)"
          subtitle="Proses kompresi gambar & arsip DEFLATE berjalan 100% lokal di browser Anda"
        />
      ) : (
        <div className="space-y-4">
          {/* File summary card */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-lg bg-surface-100 border border-border/80 shrink-0">
                {renderDocIcon()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate max-w-sm sm:max-w-md">
                  {selectedFile.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400 mt-0.5">
                  <span className="text-zinc-200">{docInfo?.label}</span>
                  <span>•</span>
                  <span>Ukuran: <strong className="text-zinc-200">{formatBytes(selectedFile.size)}</strong></span>
                  {imageCount !== null && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-zinc-300">
                        <ImageIcon className="w-3 h-3 text-zinc-400" />
                        {imageCount} gambar tersemat
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-md btn-secondary cursor-pointer shrink-0"
            >
              Ganti File
            </button>
          </div>

          {/* Info Notice when 0 images detected */}
          {imageCount === 0 && !errorMsg && (
            <div className="p-3.5 rounded-xl bg-surface-200 border border-border/80 flex items-start gap-2.5 text-zinc-300 text-xs">
              <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-200 mb-0.5">Dokumen Berbasis Teks/Data</p>
                <p className="text-zinc-400 leading-relaxed">
                  Tidak ditemukan gambar raster yang tersemat dalam berkas ini. Format OpenXML (.docx/.xlsx/.pptx) sudah otomatis memadatkan teks dan tabel menggunakan kompresi DEFLATE. Optimasi struktur arsip tetap akan dijalankan.
                </p>
              </div>
            </div>
          )}

          {/* Error / Warning Notice for legacy format */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-2.5 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300 mb-0.5">Format Dokumen Lama Terdeteksi</p>
                <p className="text-amber-200/90 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Preset options */}
          {!errorMsg && (
            <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                <h3 className="text-xs font-semibold text-white">Level Kompresi</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'extreme',
                    title: 'Extreme Compression',
                    desc: 'Resolusi gambar maks 1024px & kualitas 60%. Penghematan terbesar (~50-80%), cocok untuk batas email & portal CPNS.',
                    tag: 'Maksimum',
                  },
                  {
                    id: 'recommended',
                    title: 'Recommended',
                    desc: 'Resolusi gambar maks 1280px HD & kualitas 72%. Keseimbangan tajam dan hemat (~35-65%).',
                    tag: 'Optimal',
                  },
                  {
                    id: 'mild',
                    title: 'Mild Compression',
                    desc: 'Resolusi gambar maks 1600px & kualitas 82%. Kualitas visual prima (~15-35%).',
                    tag: 'High Quality',
                  },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLevel(p.id as OfficeCompressionLevel)}
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

              {/* Progress bar when compressing */}
              {isCompressing && progress && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span className="truncate max-w-[80%]">{progress.message}</span>
                    <span>{progress.percentage}%</span>
                  </div>
                  <div className="w-full bg-surface-100 rounded-full h-1.5 overflow-hidden border border-border/60">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleCompress}
                disabled={isCompressing}
                className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
              >
                {isCompressing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{progress?.message || 'Mengompresi di RAM...'}</span>
                  </>
                ) : (
                  <span>
                    Kompres Dokumen ({level.toUpperCase()})
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result Modal */}
      {result && selectedFile && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadBlob(result.blob, resultFilename)}
          onReset={handleReset}
          title={
            result.reductionPercentage > 0
              ? 'Dokumen Office Berhasil Dikompresi'
              : 'Dokumen Sudah Optimal'
          }
          filename={resultFilename}
          fileSize={result.compressedSize}
          stats={[
            { label: 'Tipe Dokumen', value: result.docLabel },
            { label: 'Ukuran Awal', value: formatBytes(result.originalSize) },
            { label: 'Ukuran Baru', value: formatBytes(result.compressedSize) },
            {
              label: 'Penghematan',
              value:
                result.reductionPercentage > 0
                  ? `-${result.reductionPercentage}%`
                  : '0% (Sudah paling optimal)',
            },
            {
              label: 'Gambar Dioptimalkan',
              value: `${result.optimizedImageCount} dari ${result.imageCount}`,
            },
            { label: 'Preset', value: level.toUpperCase() },
          ]}
          downloadLabel="Download Dokumen Terkompresi"
        />
      )}
    </div>
  );
}

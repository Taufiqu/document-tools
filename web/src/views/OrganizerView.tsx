import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { PageThumbnail } from '@/components/PageThumbnail';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array } from '@/lib/utils';
import { getPdfPageCount, organizePdf, PageAction } from '@/lib/pdf-engine';
import { renderPdfPageToDataUrl } from '@/lib/pdf-renderer';
import { FileText, RotateCw, Save, RefreshCw, Loader2, Info } from 'lucide-react';

export function OrganizerView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageAction[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setIsLoadingThumbnails(true);

    try {
      const bytes = await fileToUint8Array(file);
      setRawPdfBytes(bytes);
      const count = await getPdfPageCount(bytes);

      const initialPages: PageAction[] = [];
      for (let i = 0; i < count; i++) {
        initialPages.push({
          id: `p-${i + 1}-${Date.now()}`,
          pageNumber: i + 1,
          originalIndex: i,
          rotateAngle: 0,
          isDeleted: false,
        });
      }
      setPages(initialPages);

      // Render thumbnails asynchronously
      for (let i = 0; i < count; i++) {
        renderPdfPageToDataUrl(bytes, i + 1).then((url) => {
          setPages((prev) =>
            prev.map((p) => (p.originalIndex === i ? { ...p, thumbnailUrl: url } : p))
          );
        });
      }
    } catch (err) {
      alert(`Gagal memuat file PDF: ${err}`);
    } finally {
      setIsLoadingThumbnails(false);
    }
  };

  const handleRotateCw = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotateAngle: (p.rotateAngle + 90) % 360 } : p
      )
    );
  };

  const handleRotateCcw = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotateAngle: (p.rotateAngle + 270) % 360 } : p
      )
    );
  };

  const handleToggleDelete = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const handleRotateAll = (angle: number) => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotateAngle: (p.rotateAngle + angle) % 360 }))
    );
  };

  const handleSaveOrganized = async () => {
    if (!rawPdfBytes) return;
    setIsProcessing(true);

    try {
      const organizedBytes = await organizePdf(rawPdfBytes, pages);
      const filename = selectedFile?.name.replace(/\.pdf$/i, '_organized.pdf') || 'organized.pdf';
      setProcessedResult({ bytes: organizedBytes, filename });
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal mengorganisasi PDF: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setPages([]);
    setProcessedResult(null);
  };

  const activePageCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-primary-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <FileText className="w-4 h-4" />
          <span>Interactive Tool</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Visual PDF Page Organizer</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Lihat pratinjau thumbnail halaman PDF secara visual. Putar rotasi, atur ulang urutan, atau hapus halaman yang tidak diinginkan 100% di browser.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Pilih atau Tarik File PDF ke Sini"
          subtitle="Pratinjau visual semua halaman akan langsung dirender di memori RAM peramban"
        />
      ) : (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="p-4 rounded-2xl bg-surface-100 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white max-w-xs truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">
                  {activePageCount} dari {pages.length} halaman aktif
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRotateAll(90)}
                className="px-3 py-2 rounded-xl bg-surface-200 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Putar Semua (90°)</span>
              </button>

              <button
                onClick={handleReset}
                className="px-3 py-2 rounded-xl bg-surface-200 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Ganti File</span>
              </button>

              <button
                onClick={handleSaveOrganized}
                disabled={isProcessing || activePageCount === 0}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-glow-primary disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyusun...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan PDF Baru</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Thumbnail Grid */}
          <div className="p-6 rounded-2xl bg-surface-200/50 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
              <Info className="w-4 h-4 text-primary-400" />
              <span>Gunakan tombol rotasi atau hapus pada tiap kartu halaman di bawah:</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {pages.map((p, idx) => (
                <PageThumbnail
                  key={p.id}
                  action={p}
                  displayNumber={idx + 1}
                  onRotateCw={handleRotateCw}
                  onRotateCcw={handleRotateCcw}
                  onToggleDelete={handleToggleDelete}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Result Celebration Modal */}
      {processedResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(processedResult.bytes, processedResult.filename)}
          onReset={handleReset}
          title="PDF Berhasil Disusun & Diunduh!"
          filename={processedResult.filename}
          fileSize={processedResult.bytes.byteLength}
          stats={[
            { label: 'Halaman Asli', value: pages.length },
            { label: 'Halaman Disimpan', value: activePageCount },
          ]}
          downloadLabel="Unduh PDF Hasil"
        />
      )}
    </div>
  );
}

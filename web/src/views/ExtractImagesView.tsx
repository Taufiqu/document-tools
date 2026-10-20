import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { PrivacyBadge } from '@/components/PrivacyBadge';
import { ResultModal } from '@/components/ResultModal';
import {
  ExtractedImage,
  extractImagesFromPdf,
  extractImagesFromOffice,
  createZipFromExtractedImages,
} from '@/lib/extract-images';
import { formatBytes, downloadBlob, downloadUint8Array, getTimestampString } from '@/lib/utils';
import {
  FileImage,
  Download,
  Loader2,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  Maximize2,
  X,
  FileArchive,
  RefreshCw,
  Layers,
} from 'lucide-react';

export function ExtractImagesView() {
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<ExtractedImage | null>(null);

  // Zip downloading state
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Result modal state
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [resultZipBlob, setResultZipBlob] = useState<Blob | null>(null);
  const [resultZipSize, setResultZipSize] = useState<number>(0);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const uploaded = files[0];
    setFile(uploaded);
    setIsExtracting(true);
    setProgressMsg('Menganalisis konten dokumen...');

    try {
      const ext = (uploaded.name.split('.').pop() || '').toLowerCase();
      let extracted: ExtractedImage[] = [];

      if (ext === 'pdf') {
        extracted = await extractImagesFromPdf(uploaded, (_curr, _tot, msg) => {
          setProgressMsg(msg);
        });
      } else if (ext === 'docx' || ext === 'pptx' || ext === 'xlsx') {
        extracted = await extractImagesFromOffice(uploaded, (msg) => {
          setProgressMsg(msg);
        });
      } else {
        alert('Format file tidak didukung. Harap masukkan .pdf, .docx, .pptx, atau .xlsx');
        setFile(null);
        setIsExtracting(false);
        return;
      }

      setImages(extracted);
      // Select all by default
      setSelectedIds(new Set(extracted.map((img) => img.id)));
    } catch (err: any) {
      console.error('Extraction error:', err);
      alert('Gagal mengekstrak gambar: ' + (err?.message || 'Unknown error'));
      setFile(null);
    } finally {
      setIsExtracting(false);
      setProgressMsg('');
    }
  };

  const toggleSelectImage = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map((img) => img.id)));
    }
  };

  const handleDownloadSingle = (img: ExtractedImage) => {
    downloadBlob(img.blob, img.name);
  };

  const handleDownloadZip = async (onlySelected = false) => {
    const targetImages = onlySelected
      ? images.filter((img) => selectedIds.has(img.id))
      : images;

    if (targetImages.length === 0) return;

    setIsZipping(true);
    try {
      const baseDocName = file ? file.name.replace(/\.[^/.]+$/, '') : 'document';
      const zipName = `${baseDocName}_images_${getTimestampString()}.zip`;
      const { blob, size } = await createZipFromExtractedImages(targetImages, zipName);

      setResultZipBlob(blob);
      setResultZipSize(size);
      setShowResultModal(true);
    } catch (err: any) {
      console.error('ZIP creation failed:', err);
      alert('Gagal membuat arsip ZIP: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsZipping(false);
    }
  };

  const handleDirectZipDownload = () => {
    if (!resultZipBlob || !file) return;
    const baseDocName = file.name.replace(/\.[^/.]+$/, '');
    const zipName = `${baseDocName}_images_${getTimestampString()}.zip`;
    downloadBlob(resultZipBlob, zipName);
  };

  const handleReset = () => {
    setFile(null);
    setImages([]);
    setSelectedIds(new Set());
    setPreviewImage(null);
    setShowResultModal(false);
    setResultZipBlob(null);
  };

  const totalBytes = images.reduce((acc, curr) => acc + curr.sizeBytes, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-white">Ekstraktor Gambar Dokumen</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
              PDF &amp; Office
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Ekstrak semua foto, bagan, dan aset gambar dari dokumen PDF, Word (.docx), PowerPoint (.pptx), dan Excel (.xlsx) dengan resolusi asli.
          </p>
        </div>
        <PrivacyBadge />
      </div>

      {!file && !isExtracting ? (
        <div className="max-w-2xl mx-auto">
          <Dropzone
            onFilesSelected={handleFilesSelected}
            accept=".pdf,.docx,.pptx,.xlsx"
            title="Upload dokumen untuk mengekstrak seluruh gambar"
            subtitle="Mendukung PDF, Word (.docx), PowerPoint (.pptx), dan Excel (.xlsx)"
            maxFiles={1}
          />
        </div>
      ) : isExtracting ? (
        <div className="bg-surface-200 border border-border rounded-xl p-12 flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto shadow-elevated">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Sedang Mengekstrak Gambar...</h3>
            <p className="text-xs font-mono text-zinc-400">{progressMsg || 'Memindai objek gambar di memori RAM...'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="bg-surface-200 border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-elevated text-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-lg bg-surface-100 border border-border flex items-center justify-center text-amber-400 shrink-0">
                <FileImage className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-white truncate max-w-[240px] sm:max-w-[320px]">
                  {file?.name}
                </p>
                <p className="text-[11px] text-zinc-400">
                  Ditemukan <span className="font-bold text-amber-400">{images.length} gambar</span> ({formatBytes(totalBytes)})
                </p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-lg border border-border bg-surface-100 text-zinc-300 hover:text-white hover:bg-surface-300 transition flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedIds.size === images.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  <span>{selectedIds.size === images.length ? 'Batal Pilih' : 'Pilih Semua'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadZip(true)}
                  disabled={selectedIds.size === 0 || isZipping}
                  className="px-3 py-1.5 rounded-lg border border-border bg-surface-100 text-zinc-300 hover:text-white hover:bg-surface-300 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Terpilih ({selectedIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadZip(false)}
                  disabled={isZipping}
                  className="px-3.5 py-1.5 rounded-lg font-semibold bg-amber-500 hover:bg-amber-600 text-black flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  {isZipping ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileArchive className="w-3.5 h-3.5" />
                  )}
                  <span>Unduh Semua (ZIP)</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg border border-border bg-surface-100 text-zinc-400 hover:text-white hover:bg-surface-300 transition cursor-pointer"
                  title="Ganti Dokumen"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Empty State */}
          {images.length === 0 ? (
            <div className="bg-surface-200 border border-border rounded-xl p-12 text-center max-w-md mx-auto shadow-elevated">
              <div className="w-12 h-12 rounded-full bg-surface-100 border border-border flex items-center justify-center text-zinc-500 mx-auto mb-3">
                <FileImage className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Tidak Ditemukan Gambar</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Dokumen ini tidak mengandung gambar atau foto yang tertanam di dalamnya.
              </p>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-lg bg-surface-100 border border-border text-xs text-white hover:bg-surface-300 transition cursor-pointer"
              >
                Pilih Dokumen Lain
              </button>
            </div>
          ) : (
            /* Images Grid Gallery */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {images.map((img) => {
                const isSelected = selectedIds.has(img.id);
                return (
                  <div
                    key={img.id}
                    onClick={() => toggleSelectImage(img.id)}
                    className={`group relative bg-surface-200 border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col ${
                      isSelected
                        ? 'border-amber-500 shadow-md ring-1 ring-amber-500/50'
                        : 'border-border hover:border-zinc-500'
                    }`}
                  >
                    {/* Checkbox Selector Badge */}
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectImage(img.id);
                      }}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center text-xs transition ${
                          isSelected
                            ? 'bg-amber-500 text-black'
                            : 'bg-black/60 backdrop-blur-xs text-zinc-400 border border-white/20 hover:text-white'
                        }`}
                      >
                        {isSelected && <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </div>
                    </div>

                    {/* Preview Zoom Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(img);
                      }}
                      className="absolute top-2 right-2 z-10 p-1 rounded bg-black/60 backdrop-blur-xs text-zinc-300 hover:text-white hover:bg-black/90 transition opacity-0 group-hover:opacity-100"
                      title="Perbesar Preview"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Image Preview Container */}
                    <div className="w-full aspect-square bg-zinc-950/80 flex items-center justify-center p-2 overflow-hidden">
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="max-w-full max-h-full object-contain transition group-hover:scale-105 duration-300"
                        loading="lazy"
                      />
                    </div>

                    {/* Image Info Footer */}
                    <div className="p-2.5 bg-surface-100 border-t border-border flex flex-col gap-1 text-[11px] mt-auto">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-white text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-200 border border-border">
                          {img.format}
                        </span>
                        <span className="font-mono text-zinc-400 text-[10px]">
                          {img.width > 0 ? `${img.width}×${img.height}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-zinc-500 text-[10px] font-mono">
                          {formatBytes(img.sizeBytes)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSingle(img);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-amber-400 hover:bg-surface-200 transition"
                          title="Unduh gambar ini saja"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Large Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-surface-200 border border-border rounded-xl p-4 flex flex-col items-center gap-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between border-b border-border pb-2 text-xs">
              <span className="text-white font-mono truncate max-w-md">{previewImage.name}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-surface-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-zinc-950/80 rounded p-2">
              <img
                src={previewImage.dataUrl}
                alt={previewImage.name}
                className="max-w-full max-h-[65vh] object-contain"
              />
            </div>

            <div className="w-full flex items-center justify-between text-xs pt-1">
              <span className="text-zinc-400 font-mono">
                {previewImage.width} × {previewImage.height} px • {formatBytes(previewImage.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() => handleDownloadSingle(previewImage)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Gambar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal for ZIP download */}
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        onDownload={handleDirectZipDownload}
        onReset={handleReset}
        title="Arsip ZIP Gambar Siap Diunduh"
        filename={file ? `${file.name.replace(/\.[^/.]+$/, '')}_images.zip` : 'images.zip'}
        fileSize={resultZipSize}
        stats={[
          { label: 'Jumlah Gambar Diekstrak', value: `${images.length} gambar` },
          { label: 'Format Arsip', value: 'ZIP (Deflate)' },
          { label: 'Pemrosesan', value: '100% Client-Side RAM' },
        ]}
        downloadLabel="Unduh File ZIP"
      />
    </div>
  );
}

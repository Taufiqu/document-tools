import React, { useState, useEffect, useRef } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { SignaturePadModal } from '@/components/SignaturePadModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import { getPdfPageCount } from '@/lib/pdf-engine';
import { renderPdfPageToDataUrl } from '@/lib/pdf-renderer';
import {
  PlacedSignItem,
  processImageFile,
  applySignaturesToPdf,
} from '@/lib/pdf-signer';
import {
  PenTool,
  Upload,
  Stamp,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Copy,
  Layers,
  ArrowUp,
  ArrowDown,
  Loader2,
  Sparkles,
  Sliders,
  CheckCircle2,
  Info,
} from 'lucide-react';

export function PdfSignerView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [pageAspectRatio, setPageAspectRatio] = useState<number>(841.89 / 595.28); // default A4 height/width

  // Placed elements across entire document
  const [items, setItems] = useState<PlacedSignItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Modals & inputs
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [signedPdfBytes, setSignedPdfBytes] = useState<Uint8Array | null>(null);
  const [resultFilename, setResultFilename] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);

  // File input refs for uploading signatures & stamps
  const signFileInputRef = useRef<HTMLInputElement>(null);
  const materaiFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

  // Canvas container reference for pointer positioning
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag & resize tracking
  const [dragState, setDragState] = useState<{
    itemId: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    initialXRatio: number;
    initialYRatio: number;
    initialWidthRatio: number;
    initialHeightRatio: number;
  } | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setCurrentPage(1);
    setItems([]);
    setSelectedItemId(null);

    try {
      const bytes = await fileToUint8Array(file);
      setRawPdfBytes(bytes);
      const count = await getPdfPageCount(bytes);
      setPageCount(count);
    } catch (err) {
      alert(`Gagal membaca berkas PDF: ${err}`);
    }
  };

  // Render current page when page or PDF changes
  useEffect(() => {
    if (!rawPdfBytes || pageCount === 0) return;
    let isCancelled = false;

    renderPdfPageToDataUrl(rawPdfBytes, currentPage, 1.2).then((dataUrl) => {
      if (isCancelled) return;
      setPageImageUrl(dataUrl);

      // Measure image natural dimensions to calculate aspect ratio
      const img = new Image();
      img.onload = () => {
        if (!isCancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
          setPageAspectRatio(img.naturalHeight / img.naturalWidth);
        }
      };
      img.src = dataUrl;
    });

    return () => {
      isCancelled = true;
    };
  }, [rawPdfBytes, currentPage, pageCount]);

  const handleAddDrawnSignature = (result: {
    bytes: Uint8Array;
    dataUrl: string;
    width: number;
    height: number;
  }) => {
    const itemAspect = result.height / Math.max(1, result.width);
    const widthRatio = 0.28; // 28% of page width
    const heightRatio = (widthRatio * itemAspect) / pageAspectRatio;

    const newItem: PlacedSignItem = {
      id: `sign-${Date.now()}`,
      type: 'signature',
      pageNumber: currentPage,
      xRatio: 0.36,
      yRatio: 0.65,
      widthRatio,
      heightRatio,
      opacity: 1.0,
      imageBytes: result.bytes,
      dataUrl: result.dataUrl,
      label: 'Tanda Tangan',
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handleUploadSignatureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Automatically clean paper background so signature is transparent!
      const res = await processImageFile(file, true);
      const itemAspect = res.height / Math.max(1, res.width);
      const widthRatio = 0.28;
      const heightRatio = (widthRatio * itemAspect) / pageAspectRatio;

      const newItem: PlacedSignItem = {
        id: `sign-${Date.now()}`,
        type: 'signature',
        pageNumber: currentPage,
        xRatio: 0.36,
        yRatio: 0.65,
        widthRatio,
        heightRatio,
        opacity: 1.0,
        imageBytes: res.bytes,
        dataUrl: res.dataUrl,
        label: 'Tanda Tangan',
      };

      setItems((prev) => [...prev, newItem]);
      setSelectedItemId(newItem.id);
    } catch (err) {
      alert(`Gagal memproses gambar tanda tangan: ${err}`);
    } finally {
      if (signFileInputRef.current) signFileInputRef.current.value = '';
    }
  };

  const handleUploadMateraiFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await processImageFile(file, false);
      const itemAspect = res.height / Math.max(1, res.width);
      const widthRatio = 0.22; // Standard materai stamp size
      const heightRatio = (widthRatio * itemAspect) / pageAspectRatio;

      const newItem: PlacedSignItem = {
        id: `materai-${Date.now()}`,
        type: 'materai',
        pageNumber: currentPage,
        xRatio: 0.2,
        yRatio: 0.65,
        widthRatio,
        heightRatio,
        opacity: 1.0,
        imageBytes: res.bytes,
        dataUrl: res.dataUrl,
        label: 'E-Materai',
      };

      setItems((prev) => [...prev, newItem]);
      setSelectedItemId(newItem.id);
    } catch (err) {
      alert(`Gagal memproses E-Materai: ${err}`);
    } finally {
      if (materaiFileInputRef.current) materaiFileInputRef.current.value = '';
    }
  };

  const handleUploadStampFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await processImageFile(file, false);
      const itemAspect = res.height / Math.max(1, res.width);
      const widthRatio = 0.24;
      const heightRatio = (widthRatio * itemAspect) / pageAspectRatio;

      const newItem: PlacedSignItem = {
        id: `stamp-${Date.now()}`,
        type: 'stamp',
        pageNumber: currentPage,
        xRatio: 0.45,
        yRatio: 0.63,
        widthRatio,
        heightRatio,
        opacity: 0.88, // Stempel slightly transparent
        imageBytes: res.bytes,
        dataUrl: res.dataUrl,
        label: 'Stempel',
      };

      setItems((prev) => [...prev, newItem]);
      setSelectedItemId(newItem.id);
    } catch (err) {
      alert(`Gagal memproses stempel: ${err}`);
    } finally {
      if (stampFileInputRef.current) stampFileInputRef.current.value = '';
    }
  };

  // Move item forward or backward in layer order
  const handleMoveLayer = (id: string, direction: 'front' | 'back') => {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.id === id);
      if (index === -1) return prev;
      const item = prev[index];
      const withoutItem = prev.filter((i) => i.id !== id);
      if (direction === 'front') {
        return [...withoutItem, item];
      }
      return [item, ...withoutItem];
    });
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  const handleDuplicateItem = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;

    const copyItem: PlacedSignItem = {
      ...target,
      id: `${target.type}-${Date.now()}`,
      xRatio: Math.min(0.7, target.xRatio + 0.05),
      yRatio: Math.min(0.7, target.yRatio + 0.05),
    };

    setItems((prev) => [...prev, copyItem]);
    setSelectedItemId(copyItem.id);
  };

  // Pointer drag & resize logic
  const handlePointerDownItem = (
    e: React.PointerEvent,
    item: PlacedSignItem,
    mode: 'move' | 'resize'
  ) => {
    e.stopPropagation();
    setSelectedItemId(item.id);

    setDragState({
      itemId: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialXRatio: item.xRatio,
      initialYRatio: item.yRatio,
      initialWidthRatio: item.widthRatio,
      initialHeightRatio: item.heightRatio,
    });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaX = (e.clientX - dragState.startX) / rect.width;
      const deltaY = (e.clientY - dragState.startY) / rect.height;

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== dragState.itemId) return item;

          if (dragState.mode === 'move') {
            const newX = Math.max(0, Math.min(1 - item.widthRatio, dragState.initialXRatio + deltaX));
            const newY = Math.max(0, Math.min(1 - item.heightRatio, dragState.initialYRatio + deltaY));
            return { ...item, xRatio: newX, yRatio: newY };
          }

          if (dragState.mode === 'resize') {
            // Keep aspect ratio
            const currentAspect = dragState.initialHeightRatio / dragState.initialWidthRatio;
            const newWidth = Math.max(0.08, Math.min(0.9, dragState.initialWidthRatio + deltaX));
            const newHeight = newWidth * currentAspect;

            // Ensure does not exceed container boundary
            if (item.xRatio + newWidth > 1 || item.yRatio + newHeight > 1) {
              return item;
            }

            return {
              ...item,
              widthRatio: newWidth,
              heightRatio: newHeight,
            };
          }

          return item;
        })
      );
    };

    const handlePointerUp = () => {
      if (dragState) {
        setDragState(null);
      }
    };

    if (dragState) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [dragState]);

  const handleExportPdf = async () => {
    if (!rawPdfBytes || items.length === 0) return;
    setIsProcessing(true);

    try {
      const outputBytes = await applySignaturesToPdf(rawPdfBytes, items);
      const filename = selectedFile?.name.replace(/\.pdf$/i, '_signed.pdf') || 'signed_document.pdf';

      setSignedPdfBytes(outputBytes);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err: any) {
      alert(`Gagal membubuhkan tanda tangan: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setItems([]);
    setSelectedItemId(null);
    setSignedPdfBytes(null);
    setCurrentPage(1);
  };

  const currentPageItems = items.filter((i) => i.pageNumber === currentPage);
  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <PenTool className="w-3.5 h-3.5" />
          <span>MODULE / PDF SIGNER &amp; E-MATERAI</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">
          PDF Signer &amp; E-Materai Studio
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Bubuhi tanda tangan digital, pasang E-Materai, dan stempel instansi dengan penempatan visual presisi 100% lokal di browser memory.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Pilih atau drop file PDF yang ingin ditandatangani"
          subtitle="Pemrosesan tanda tangan dan penempatan elemen berjalan 100% di browser RAM"
        />
      ) : (
        <div className="space-y-4">
          {/* Top Document Bar & Add Elements Tools */}
          <div className="p-3.5 rounded-xl bg-surface-200 border border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-white truncate max-w-xs">{selectedFile.name}</p>
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 mt-0.5">
                <span>{pageCount} halaman</span>
                <span>•</span>
                <span>{formatBytes(selectedFile.size)}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{items.length} elemen ditempatkan</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDrawModal(true)}
                className="px-3 py-1.5 rounded-lg btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <PenTool className="w-3.5 h-3.5 text-blue-400" />
                <span>+ Tanda Tangan</span>
              </button>

              <button
                type="button"
                onClick={() => signFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-medium"
                title="Unggah foto tanda tangan di kertas (background otomatis dibersihkan)"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>+ Upload TTD</span>
              </button>

              <button
                type="button"
                onClick={() => materaiFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-medium"
                title="Bubuhi file E-Materai"
              >
                <FileCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>+ E-Materai</span>
              </button>

              <button
                type="button"
                onClick={() => stampFileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-medium"
                title="Bubuhi stempel instansi / cap perusahaan"
              >
                <Stamp className="w-3.5 h-3.5 text-rose-400" />
                <span>+ Stempel</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-surface-100 transition cursor-pointer"
              >
                Ganti File
              </button>
            </div>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={signFileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleUploadSignatureFile}
          />
          <input
            ref={materaiFileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleUploadMateraiFile}
          />
          <input
            ref={stampFileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleUploadStampFile}
          />

          {/* Page Navigation & Element Controls Bar */}
          <div className="p-3 rounded-xl bg-surface-200 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-md btn-secondary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 rounded-md bg-surface-100 border border-border/80 font-mono text-zinc-200">
                Halaman <span className="font-semibold text-white">{currentPage}</span> dari {pageCount}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="p-1.5 rounded-md btn-secondary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {currentPageItems.length > 0 && (
                <span className="text-[11px] text-zinc-400 font-mono ml-2">
                  ({currentPageItems.length} elemen di halaman ini)
                </span>
              )}
            </div>

            {/* Selected Element Quick Controls */}
            {selectedItem && (
              <div className="flex flex-wrap items-center gap-2 bg-surface-100 px-3 py-1.5 rounded-lg border border-border">
                <span className="text-[11px] font-semibold text-white mr-1">
                  {selectedItem.label || 'Elemen'}:
                </span>

                {/* Opacity control */}
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                  <span>Transparansi:</span>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={Math.round(selectedItem.opacity * 100)}
                    onChange={(e) => {
                      const val = Number(e.target.value) / 100;
                      setItems((prev) =>
                        prev.map((i) => (i.id === selectedItem.id ? { ...i, opacity: val } : i))
                      );
                    }}
                    className="w-16 accent-zinc-200 cursor-pointer"
                  />
                  <span>{Math.round(selectedItem.opacity * 100)}%</span>
                </div>

                <div className="h-3 w-px bg-border mx-1" />

                {/* Layer order */}
                <button
                  type="button"
                  onClick={() => handleMoveLayer(selectedItem.id, 'front')}
                  title="Pindah ke Lapisan Terdepan (di atas materai/teks)"
                  className="p-1 rounded hover:bg-surface-200 text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveLayer(selectedItem.id, 'back')}
                  title="Pindah ke Lapisan Belakang"
                  className="p-1 rounded hover:bg-surface-200 text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>

                {/* Duplicate */}
                <button
                  type="button"
                  onClick={() => handleDuplicateItem(selectedItem.id)}
                  title="Duplikat Elemen"
                  className="p-1 rounded hover:bg-surface-200 text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => handleDeleteItem(selectedItem.id)}
                  title="Hapus Elemen"
                  className="p-1 rounded hover:bg-surface-200 text-zinc-300 hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Save / Export Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isProcessing || items.length === 0}
              className="px-4 py-2 rounded-lg btn-primary text-xs flex items-center gap-1.5 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-subtle"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Membubuhkan TTD...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Simpan &amp; Unduh PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Document Canvas Viewport */}
          <div className="p-4 sm:p-6 rounded-2xl bg-surface-300 border border-border flex justify-center overflow-x-auto select-none">
            <div
              ref={containerRef}
              onClick={() => setSelectedItemId(null)}
              className="relative w-full max-w-2xl bg-white shadow-2xl rounded-sm overflow-hidden"
              style={{
                aspectRatio: `${1 / pageAspectRatio}`,
              }}
            >
              {/* Rendered PDF Page Background */}
              {pageImageUrl ? (
                <img
                  src={pageImageUrl}
                  alt={`Halaman ${currentPage}`}
                  className="w-full h-full object-contain pointer-events-none block"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                  <span className="text-xs font-mono">Memuat halaman PDF...</span>
                </div>
              )}

              {/* Placed Elements on this Page */}
              {currentPageItems.map((item) => {
                const isSelected = item.id === selectedItemId;

                return (
                  <div
                    key={item.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItemId(item.id);
                    }}
                    onPointerDown={(e) => handlePointerDownItem(e, item, 'move')}
                    className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-white shadow-md'
                        : 'hover:ring-1 hover:ring-blue-400/70'
                    }`}
                    style={{
                      left: `${item.xRatio * 100}%`,
                      top: `${item.yRatio * 100}%`,
                      width: `${item.widthRatio * 100}%`,
                      height: `${item.heightRatio * 100}%`,
                      opacity: item.opacity,
                    }}
                  >
                    <img
                      src={item.dataUrl}
                      alt={item.label || 'Elemen'}
                      className="w-full h-full object-contain pointer-events-none block"
                      draggable={false}
                    />

                    {/* Corner Resize Handle */}
                    {isSelected && (
                      <div
                        onPointerDown={(e) => handlePointerDownItem(e, item, 'resize')}
                        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-sm cursor-se-resize flex items-center justify-center"
                        title="Tarik untuk mengubah ukuran"
                      />
                    )}
                  </div>
                );
              })}

              {/* Empty Helper Overlay if no elements placed on this page */}
              {currentPageItems.length === 0 && (
                <div className="absolute top-4 left-4 right-4 pointer-events-none opacity-40 hover:opacity-100 transition flex items-center justify-center">
                  <span className="px-3 py-1 rounded-full bg-black/60 text-white text-[11px] font-medium backdrop-blur-sm shadow-sm">
                    Klik tombol + Tanda Tangan / E-Materai di atas untuk membubuhi dokumen
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Signature Draw Modal */}
      <SignaturePadModal
        isOpen={showDrawModal}
        onClose={() => setShowDrawModal(false)}
        onSave={handleAddDrawnSignature}
      />

      {/* Result Modal */}
      {signedPdfBytes && selectedFile && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(signedPdfBytes, resultFilename)}
          onReset={handleReset}
          title="Dokumen PDF Berhasil Ditandatangani"
          filename={resultFilename}
          fileSize={signedPdfBytes.byteLength}
          stats={[
            { label: 'Total Elemen Ditempatkan', value: `${items.length} elemen` },
            { label: 'Halaman Berkas', value: `${pageCount} halaman` },
            { label: 'Ukuran Akhir', value: formatBytes(signedPdfBytes.byteLength) },
          ]}
          downloadLabel="Download Dokumen Bertanda Tangan"
        />
      )}
    </div>
  );
}

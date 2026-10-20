import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { PrivacyBadge } from '@/components/PrivacyBadge';
import {
  ShieldAlert,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Loader2,
  Copy,
  Layers,
  Sparkles,
  Info,
  Check,
  MousePointer,
  Square,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { formatBytes, downloadUint8Array, getTimestampString } from '@/lib/utils';
import { RedactionBox, RedactionStyle, applyRedactionsToPdf } from '@/lib/pdf-redact';

// Dynamically load pdfjs-dist
let pdfjsLib: any = null;
async function getPdfJs() {
  if (typeof window === 'undefined') return null;
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import('pdfjs-dist');
      if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      }
    } catch (e) {
      console.warn('pdfjs-dist dynamic import warning:', e);
    }
  }
  return pdfjsLib;
}

export function PdfRedactView() {
  const [file, setFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageRendering, setPageRendering] = useState<boolean>(false);

  // Redaction boxes stored across document
  const [boxes, setBoxes] = useState<RedactionBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);

  // Settings
  const [currentStyle, setCurrentStyle] = useState<RedactionStyle>('blackout');
  const [customLabel, setCustomLabel] = useState<string>('[DISENSOR]');
  const [secureFlatten, setSecureFlatten] = useState<boolean>(true);
  const [interactionMode, setInteractionMode] = useState<'draw' | 'select'>('draw');

  // Drawing state
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{ x: number; y: number } | null>(null);

  // Dragging / Resizing existing box state
  const [draggingBoxId, setDraggingBoxId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingBoxId, setResizingBoxId] = useState<string | null>(null);

  // Processing & Export State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderedDimensions, setRenderedDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Load PDF when file is selected
  const handleDrop = async (files: File[]) => {
    if (files.length === 0) return;
    const uploadedFile = files[0];
    setFile(uploadedFile);

    const buffer = await uploadedFile.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    setRawPdfBytes(bytes);

    try {
      const pdfjs = await getPdfJs();
      if (!pdfjs) throw new Error('PDF.js unavailable');
      const copyBuffer = new Uint8Array(bytes).buffer;
      const pdfDoc = await pdfjs.getDocument({ data: copyBuffer }).promise;
      setTotalPages(pdfDoc.numPages);
      setCurrentPage(1);
      setBoxes([]);
      setSelectedBoxId(null);
    } catch (err) {
      console.error('Failed to load PDF:', err);
    }
  };

  // Render current page on canvas
  const renderCurrentPage = useCallback(async () => {
    if (!rawPdfBytes || !canvasRef.current) return;
    setPageRendering(true);

    try {
      const pdfjs = await getPdfJs();
      if (!pdfjs) return;

      const copyBuffer = new Uint8Array(rawPdfBytes).buffer;
      const pdfDoc = await pdfjs.getDocument({ data: copyBuffer }).promise;
      const page = await pdfDoc.getPage(currentPage);

      // Desired display width on screen
      const containerWidth = containerRef.current?.clientWidth || 760;
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const targetScale = Math.min(2.0, (containerWidth - 32) / unscaledViewport.width);
      const viewport = page.getViewport({ scale: Math.max(0.6, targetScale) });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      setRenderedDimensions({ width: canvas.width, height: canvas.height });

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;
    } catch (err) {
      console.error('Render page error:', err);
    } finally {
      setPageRendering(false);
    }
  }, [rawPdfBytes, currentPage]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Handle pointer down on page overlay
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || renderedDimensions.width === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (interactionMode === 'draw') {
      setDrawingStart({ x: clientX, y: clientY });
      setDrawingCurrent({ x: clientX, y: clientY });
      setSelectedBoxId(null);
    }
  };

  // Handle pointer move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (drawingStart) {
      setDrawingCurrent({ x: clientX, y: clientY });
    } else if (draggingBoxId) {
      const rw = renderedDimensions.width;
      const rh = renderedDimensions.height;
      if (rw === 0 || rh === 0) return;

      setBoxes((prev) =>
        prev.map((box) => {
          if (box.id !== draggingBoxId) return box;
          const newX = Math.max(0, Math.min(rw - box.widthRatio * rw, clientX - dragOffset.x));
          const newY = Math.max(0, Math.min(rh - box.heightRatio * rh, clientY - dragOffset.y));
          return {
            ...box,
            xRatio: newX / rw,
            yRatio: newY / rh,
          };
        })
      );
    } else if (resizingBoxId) {
      const rw = renderedDimensions.width;
      const rh = renderedDimensions.height;
      if (rw === 0 || rh === 0) return;

      setBoxes((prev) =>
        prev.map((box) => {
          if (box.id !== resizingBoxId) return box;
          const boxLeft = box.xRatio * rw;
          const boxTop = box.yRatio * rh;
          const newWidth = Math.max(20, Math.min(rw - boxLeft, clientX - boxLeft));
          const newHeight = Math.max(14, Math.min(rh - boxTop, clientY - boxTop));

          return {
            ...box,
            widthRatio: newWidth / rw,
            heightRatio: newHeight / rh,
          };
        })
      );
    }
  };

  // Handle pointer up
  const handlePointerUp = () => {
    if (drawingStart && drawingCurrent && renderedDimensions.width > 0) {
      const rw = renderedDimensions.width;
      const rh = renderedDimensions.height;

      const x = Math.min(drawingStart.x, drawingCurrent.x);
      const y = Math.min(drawingStart.y, drawingCurrent.y);
      const width = Math.abs(drawingCurrent.x - drawingStart.x);
      const height = Math.abs(drawingCurrent.y - drawingStart.y);

      // Only create if drag was meaningful (> 10px)
      if (width >= 12 && height >= 10) {
        const newBox: RedactionBox = {
          id: `box-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          pageNumber: currentPage,
          xRatio: Math.max(0, Math.min(1, x / rw)),
          yRatio: Math.max(0, Math.min(1, y / rh)),
          widthRatio: Math.max(0.01, Math.min(1, width / rw)),
          heightRatio: Math.max(0.01, Math.min(1, height / rh)),
          style: currentStyle,
          label: customLabel,
        };

        setBoxes((prev) => [...prev, newBox]);
        setSelectedBoxId(newBox.id);
      }
      setDrawingStart(null);
      setDrawingCurrent(null);
    }

    setDraggingBoxId(null);
    setResizingBoxId(null);
  };

  // Delete selected box
  const handleDeleteBox = (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedBoxId === id) setSelectedBoxId(null);
  };

  // Replicate current box to all pages
  const handleReplicateBoxToAllPages = (box: RedactionBox) => {
    if (totalPages <= 1) return;
    const newBoxes: RedactionBox[] = [];

    for (let p = 1; p <= totalPages; p++) {
      if (p === box.pageNumber) continue;
      newBoxes.push({
        ...box,
        id: `box-${p}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        pageNumber: p,
      });
    }

    setBoxes((prev) => [...prev, ...newBoxes]);
  };

  // Clear all boxes on current page
  const handleClearCurrentPage = () => {
    setBoxes((prev) => prev.filter((b) => b.pageNumber !== currentPage));
    setSelectedBoxId(null);
  };

  // Clear all boxes across entire document
  const handleClearAll = () => {
    if (window.confirm('Hapus semua kotak sensor di seluruh dokumen?')) {
      setBoxes([]);
      setSelectedBoxId(null);
    }
  };

  // Execute Redaction & Export
  const handleExport = async () => {
    if (!rawPdfBytes || boxes.length === 0) return;
    setIsProcessing(true);
    setProgressText('Memulai proses sensor...');

    try {
      const output = await applyRedactionsToPdf(rawPdfBytes, boxes, {
        secureFlatten,
        quality: 0.92,
        onProgress: (_curr, _tot, msg) => setProgressText(msg),
      });

      setResultBytes(output);
      setShowResultModal(true);
    } catch (err: any) {
      console.error('Redaction failed:', err);
      alert('Gagal melakukan sensor PDF: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const handleDownload = () => {
    if (!resultBytes || !file) return;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const outName = `${baseName}_redacted_${getTimestampString()}.pdf`;
    downloadUint8Array(resultBytes, outName, 'application/pdf');
  };

  const handleReset = () => {
    setFile(null);
    setRawPdfBytes(null);
    setTotalPages(0);
    setCurrentPage(1);
    setBoxes([]);
    setSelectedBoxId(null);
    setResultBytes(null);
    setShowResultModal(false);
  };

  // Redaction boxes on the active page
  const currentPageBoxes = boxes.filter((b) => b.pageNumber === currentPage);
  const selectedBox = boxes.find((b) => b.id === selectedBoxId);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-white">PDF Redact &amp; Sensor Data Sensitif</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Privacy Blackout
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Sensor NIK, nomor rekening, alamat, dan data rahasia sebelum berkas dibagikan. Mode anti-leak membakar sensor permanen ke piksel.
          </p>
        </div>
        <PrivacyBadge />
      </div>

      {!rawPdfBytes ? (
        <div className="max-w-2xl mx-auto">
          <Dropzone
            onFilesSelected={handleDrop}
            accept=".pdf"
            title="Upload dokumen PDF untuk disensor"
            subtitle="Tarik dan lepas file PDF di sini (KTP scan, invoice, perjanjian, formulir lamaran)"
            maxFiles={1}
          />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main Visual Studio Area */}
          <div className="flex-1 w-full bg-surface-200 border border-border rounded-xl p-4 sm:p-5 flex flex-col items-center shadow-elevated">
            {/* Top Toolbar: Mode & Pager */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-border text-xs">
              {/* Interaction Mode Selection */}
              <div className="flex items-center gap-1.5 bg-surface-100 p-1 rounded-lg border border-border">
                <button
                  type="button"
                  onClick={() => setInteractionMode('draw')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    interactionMode === 'draw'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Klik & drag di dokumen untuk menggambar kotak sensor"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Gambar Sensor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInteractionMode('select')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition cursor-pointer ${
                    interactionMode === 'select'
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Pilih dan atur posisi kotak sensor yang ada"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>Pilih &amp; Geser</span>
                </button>
              </div>

              {/* Page Navigator */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1 || pageRendering}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    setSelectedBoxId(null);
                  }}
                  className="p-1.5 rounded-lg border border-border bg-surface-100 text-zinc-300 hover:text-white hover:bg-surface-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-medium text-zinc-300 px-2">
                  Halaman <span className="text-white font-bold">{currentPage}</span> / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || pageRendering}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    setSelectedBoxId(null);
                  }}
                  className="p-1.5 rounded-lg border border-border bg-surface-100 text-zinc-300 hover:text-white hover:bg-surface-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document Page Canvas Container */}
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`relative max-w-full rounded border border-zinc-700 shadow-2xl overflow-hidden select-none bg-zinc-900 ${
                interactionMode === 'draw' ? 'cursor-crosshair' : 'cursor-default'
              }`}
              style={{
                width: renderedDimensions.width > 0 ? renderedDimensions.width : 'auto',
                height: renderedDimensions.height > 0 ? renderedDimensions.height : 'auto',
                minHeight: '400px',
              }}
            >
              {/* PDF Canvas */}
              <canvas ref={canvasRef} className="block pointer-events-none" />

              {pageRendering && (
                <div className="absolute inset-0 bg-surface-300/70 backdrop-blur-xs flex items-center justify-center gap-2 text-zinc-300 z-30">
                  <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
                  <span className="text-xs font-mono">Memuat halaman...</span>
                </div>
              )}

              {/* Rendered Redaction Boxes on Current Page */}
              {renderedDimensions.width > 0 &&
                currentPageBoxes.map((box) => {
                  const rw = renderedDimensions.width;
                  const rh = renderedDimensions.height;
                  const left = box.xRatio * rw;
                  const top = box.yRatio * rh;
                  const width = box.widthRatio * rw;
                  const height = box.heightRatio * rh;
                  const isSelected = selectedBoxId === box.id;

                  return (
                    <div
                      key={box.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBoxId(box.id);
                      }}
                      onPointerDown={(e) => {
                        if (interactionMode === 'select') {
                          e.stopPropagation();
                          setSelectedBoxId(box.id);
                          setDraggingBoxId(box.id);
                          const rect = containerRef.current?.getBoundingClientRect();
                          if (rect) {
                            setDragOffset({
                              x: e.clientX - rect.left - left,
                              y: e.clientY - rect.top - top,
                            });
                          }
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                      }}
                      className={`group transition-shadow ${
                        interactionMode === 'select' ? 'cursor-move' : 'cursor-pointer'
                      } ${
                        box.style === 'whiteout'
                          ? 'bg-white border border-zinc-300 shadow-sm'
                          : 'bg-zinc-950 text-white'
                      } ${
                        isSelected
                          ? 'ring-2 ring-rose-500 ring-offset-1 ring-offset-zinc-900 z-20'
                          : 'z-10'
                      }`}
                    >
                      {/* Box Content Label */}
                      {box.style === 'text-redacted' && (
                        <div className="w-full h-full flex items-center justify-center font-mono font-bold text-white text-[10px] tracking-wider px-1 text-center select-none overflow-hidden">
                          {box.label || '[DISENSOR]'}
                        </div>
                      )}

                      {/* Floating Action Menu for Selected Box */}
                      {isSelected && (
                        <div
                          className="absolute -top-10 left-0 flex items-center gap-1 bg-surface-100 border border-border px-2 py-1 rounded-md shadow-lg z-30 animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleReplicateBoxToAllPages(box)}
                            title="Terapkan posisi sensor ini ke seluruh halaman"
                            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-surface-200 text-zinc-300 hover:text-white hover:bg-surface-300 transition"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Semua Hal.</span>
                          </button>
                          <div className="w-[1px] h-3 bg-zinc-700 mx-0.5" />
                          <button
                            type="button"
                            onClick={() => handleDeleteBox(box.id)}
                            title="Hapus kotak sensor ini"
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Resize Handle (Bottom-Right) */}
                      {isSelected && (
                        <div
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setResizingBoxId(box.id);
                          }}
                          className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-rose-500 rounded-full border border-white cursor-se-resize z-30"
                          title="Tarik untuk mengubah ukuran"
                        />
                      )}
                    </div>
                  );
                })}

              {/* Dynamic Drag Guide Rectangle while drawing */}
              {drawingStart && drawingCurrent && (
                <div
                  className="absolute border-2 border-dashed border-rose-500 bg-rose-500/25 pointer-events-none z-30"
                  style={{
                    left: `${Math.min(drawingStart.x, drawingCurrent.x)}px`,
                    top: `${Math.min(drawingStart.y, drawingCurrent.y)}px`,
                    width: `${Math.abs(drawingCurrent.x - drawingStart.x)}px`,
                    height: `${Math.abs(drawingCurrent.y - drawingStart.y)}px`,
                  }}
                />
              )}
            </div>

            {/* Helper tips under canvas */}
            <p className="mt-3 text-[11px] text-zinc-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              <span>
                {interactionMode === 'draw'
                  ? 'Klik & seret mouse/touch di atas area teks untuk menyensor.'
                  : 'Klik kotak sensor untuk memindahkan, mengubah ukuran, atau menghapus.'}
              </span>
            </p>
          </div>

          {/* Right Sidebar: Style & Security Controls */}
          <div className="w-full lg:w-80 flex flex-col gap-4">
            {/* Box Style Selector Card */}
            <div className="bg-surface-200 border border-border rounded-xl p-4 text-xs">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-rose-400" />
                <span>Gaya Sensor (Redaction Style)</span>
              </h3>

              <div className="grid grid-cols-1 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStyle('blackout');
                    if (selectedBox) {
                      setBoxes((prev) =>
                        prev.map((b) => (b.id === selectedBox.id ? { ...b, style: 'blackout' } : b))
                      );
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    currentStyle === 'blackout'
                      ? 'border-rose-500 bg-rose-500/10 text-white font-medium'
                      : 'border-border bg-surface-100 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-zinc-950 border border-zinc-700" />
                    <span>Hitam Pekat (Blackout)</span>
                  </div>
                  {currentStyle === 'blackout' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStyle('text-redacted');
                    if (selectedBox) {
                      setBoxes((prev) =>
                        prev.map((b) =>
                          b.id === selectedBox.id ? { ...b, style: 'text-redacted', label: customLabel } : b
                        )
                      );
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    currentStyle === 'text-redacted'
                      ? 'border-rose-500 bg-rose-500/10 text-white font-medium'
                      : 'border-border bg-surface-100 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center text-[7px] text-zinc-300 font-mono font-bold">
                      X
                    </span>
                    <span>Teks [DISENSOR]</span>
                  </div>
                  {currentStyle === 'text-redacted' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStyle('whiteout');
                    if (selectedBox) {
                      setBoxes((prev) =>
                        prev.map((b) => (b.id === selectedBox.id ? { ...b, style: 'whiteout' } : b))
                      );
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    currentStyle === 'whiteout'
                      ? 'border-rose-500 bg-rose-500/10 text-white font-medium'
                      : 'border-border bg-surface-100 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-white border border-zinc-300" />
                    <span>Putih Bersih (Whiteout)</span>
                  </div>
                  {currentStyle === 'whiteout' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                </button>
              </div>

              {/* Custom Label Input (if text-redacted) */}
              {currentStyle === 'text-redacted' && (
                <div className="mt-3 pt-3 border-t border-border">
                  <label className="text-[11px] text-zinc-400 block mb-1">Label Teks Kotak Sensor</label>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => {
                      setCustomLabel(e.target.value);
                      if (selectedBox) {
                        setBoxes((prev) =>
                          prev.map((b) =>
                            b.id === selectedBox.id ? { ...b, label: e.target.value } : b
                          )
                        );
                      }
                    }}
                    placeholder="[DISENSOR]"
                    className="w-full bg-surface-100 border border-border rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-hidden focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            {/* Anti-Leak Security Card */}
            <div className="bg-surface-200 border border-border rounded-xl p-4 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mode Anti-Leak (Secure)</span>
                </span>
                <input
                  type="checkbox"
                  id="secure-toggle"
                  checked={secureFlatten}
                  onChange={(e) => setSecureFlatten(e.target.checked)}
                  className="rounded border-zinc-700 bg-surface-100 text-rose-500 focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Membakar kotak sensor langsung ke raster piksel. Teks asli di bawahnya dihancurkan total sehingga mustahil di-copy paste atau di-extract dengan tool apapun.
              </p>
            </div>

            {/* Statistics & Page Actions Card */}
            <div className="bg-surface-200 border border-border rounded-xl p-4 text-xs flex flex-col gap-3">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Total Sensor Dokumen:</span>
                <span className="font-mono font-bold text-white bg-surface-100 px-2 py-0.5 rounded border border-border">
                  {boxes.length} area
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Sensor di Halaman Ini:</span>
                <span className="font-mono font-semibold text-rose-400">
                  {currentPageBoxes.length} area
                </span>
              </div>

              <div className="pt-2 border-t border-border flex flex-col gap-2">
                <button
                  type="button"
                  disabled={currentPageBoxes.length === 0}
                  onClick={handleClearCurrentPage}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border bg-surface-100 text-zinc-300 hover:text-white hover:bg-surface-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Halaman Ini</span>
                </button>

                <button
                  type="button"
                  disabled={boxes.length === 0}
                  onClick={handleClearAll}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua Sensor</span>
                </button>
              </div>
            </div>

            {/* Export Action Button */}
            <button
              type="button"
              disabled={isProcessing || boxes.length === 0}
              onClick={handleExport}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs tracking-wide bg-rose-500 hover:bg-rose-600 text-white shadow-elevated flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{progressText || 'Memproses Sensor...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh Dokumen Tersensor</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        onDownload={handleDownload}
        onReset={handleReset}
        title="Dokumen Berhasil Disensor"
        filename={file ? `${file.name.replace(/\.[^/.]+$/, '')}_redacted.pdf` : 'redacted.pdf'}
        fileSize={resultBytes?.byteLength}
        stats={[
          { label: 'Total Area Disensor', value: `${boxes.length} area` },
          { label: 'Metode Proteksi', value: secureFlatten ? 'Secure Raster Flatten' : 'Vector Mask' },
          { label: 'Keamanan Data', value: '100% Anti-Leak (Lokal RAM)' },
        ]}
        downloadLabel="Unduh PDF Tersensor"
      />
    </div>
  );
}

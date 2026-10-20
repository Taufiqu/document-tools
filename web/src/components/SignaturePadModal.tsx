import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, PenTool, Eraser, Undo2 } from 'lucide-react';
import { trimCanvas } from '@/lib/pdf-signer';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (result: { bytes: Uint8Array; dataUrl: string; width: number; height: number }) => void;
}

const INK_COLORS = [
  { id: 'black', label: 'Hitam', value: '#09090b' },
  { id: 'blue', label: 'Biru Dokumen', value: '#1d4ed8' },
  { id: 'darkblue', label: 'Biru Tua', value: '#1e3a8a' },
  { id: 'red', label: 'Merah', value: '#dc2626' },
];

const STROKE_WIDTHS = [
  { id: 'thin', label: 'Tipis', value: 2 },
  { id: 'normal', label: 'Normal', value: 3.5 },
  { id: 'thick', label: 'Tebal', value: 5 },
];

export function SignaturePadModal({ isOpen, onClose, onSave }: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#09090b');
  const [selectedWidth, setSelectedWidth] = useState(3.5);
  const [hasContent, setHasContent] = useState(false);

  // History for undo
  const [history, setHistory] = useState<ImageData[]>([]);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.clearRect(0, 0, rect.width, rect.height);

    setHistory([]);
    setHasContent(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Delay slightly to let modal DOM render and compute getBoundingClientRect accurately
      const timer = setTimeout(() => {
        initCanvas();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initCanvas]);

  const saveStateToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), imgData]);
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    saveStateToHistory();

    const { x, y } = getCanvasCoords(e);
    lastPointRef.current = { x, y };
    setIsDrawing(true);
    setHasContent(true);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = selectedWidth;
    ctx.beginPath();
    ctx.arc(x, y, selectedWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = selectedColor;
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e);
    const last = lastPointRef.current;

    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = selectedWidth;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);

    // Smooth quadratic curve interpolation
    const midX = (last.x + x) / 2;
    const midY = (last.y + y) / 2;
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
    ctx.stroke();

    lastPointRef.current = { x, y };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prevHistory = [...history];
    const previousState = prevHistory.pop();
    setHistory(prevHistory);

    if (previousState) {
      ctx.putImageData(previousState, 0, 0);
      if (prevHistory.length === 0) {
        setHasContent(false);
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveStateToHistory();
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasContent(false);
  };

  const handleConfirmSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;

    // Create a copy canvas with standard dimensions to export trimmed PNG
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    exportCtx.drawImage(canvas, 0, 0);
    const trimmed = trimCanvas(exportCanvas, 8);

    const dataUrl = trimmed.toDataURL('image/png');
    const blob: Blob = await new Promise((resolve) => {
      trimmed.toBlob((b) => resolve(b || new Blob()), 'image/png');
    });

    const arrayBuffer = await blob.arrayBuffer();
    onSave({
      bytes: new Uint8Array(arrayBuffer),
      dataUrl,
      width: trimmed.width,
      height: trimmed.height,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-surface-200 border border-border rounded-2xl p-5 sm:p-6 shadow-elevated text-zinc-200 animate-slide-up flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-surface-100 border border-border flex items-center justify-center text-white">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Gambar Tanda Tangan</h3>
              <p className="text-[11px] text-zinc-400">Gunakan mouse, stylus, atau sentuhan layar</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-surface-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawing Controls (Colors & Width) */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Colors */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400 font-mono mr-1">Tinta:</span>
            {INK_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                className={`w-6 h-6 rounded-full border transition flex items-center justify-center cursor-pointer ${
                  selectedColor === c.value
                    ? 'scale-110 border-white ring-2 ring-white/20'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {selectedColor === c.value && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </button>
            ))}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-400 font-mono mr-1">Ketebalan:</span>
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWidth(w.value)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  selectedWidth === w.value
                    ? 'bg-zinc-100 text-zinc-950 shadow-subtle'
                    : 'bg-surface-100 text-zinc-400 hover:text-white'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Pad */}
        <div className="relative w-full h-56 sm:h-64 rounded-xl border border-dashed border-zinc-600 bg-white shadow-inner overflow-hidden cursor-crosshair touch-none">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          {!hasContent && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-zinc-400 select-none">
              <PenTool className="w-6 h-6 mb-1.5 opacity-40" />
              <span className="text-xs font-medium">Bubuhi tanda tangan Anda di sini</span>
              <span className="text-[10px] opacity-70">Background otomatis transparan</span>
            </div>
          )}

          {/* Quick Clear / Undo Overlay Button */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              title="Undo Goresan"
              className="p-1.5 rounded-md bg-zinc-900/80 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700/80 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasContent}
              title="Hapus Semua"
              className="p-1.5 rounded-md bg-zinc-900/80 hover:bg-zinc-900 text-zinc-300 hover:text-rose-400 border border-zinc-700/80 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-medium btn-secondary cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmSave}
            disabled={!hasContent}
            className="px-4 py-2 rounded-lg text-xs font-medium btn-primary flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-subtle"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Gunakan Tanda Tangan</span>
          </button>
        </div>
      </div>
    </div>
  );
}

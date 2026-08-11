import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadUint8Array, formatBytes } from '@/lib/utils';
import { imagesToPdf, ImageToPdfOptions } from '@/lib/image-engine';
import { Download, ArrowUp, ArrowDown, Trash2, Loader2, Sliders } from 'lucide-react';

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

      const filename = `images_${Date.now()}.pdf`;
      setResultBytes(pdfBytes);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to compile PDF: ${err}`);
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Download className="w-3.5 h-3.5" />
          <span>MODULE / IMAGES TO PDF</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Images to PDF</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Compile multiple raster images into a clean single PDF document with custom margins.
        </p>
      </div>

      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept="image/*"
        title="Select or drop image files"
        subtitle="Compile multiple images into a structured PDF"
      />

      {images.length > 0 && (
        <div className="space-y-4">
          {/* Options card */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">Document Layout</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Orientation */}
              <div className="space-y-1">
                <span className="text-xs text-zinc-400 block">Page Orientation</span>
                <div className="grid grid-cols-3 gap-1 bg-surface-100 p-1 rounded-lg border border-border text-xs">
                  {[
                    { id: 'auto', label: 'Auto' },
                    { id: 'portrait', label: 'Portrait' },
                    { id: 'landscape', label: 'Landscape' },
                  ].map((ori) => (
                    <button
                      key={ori.id}
                      type="button"
                      onClick={() => setOrientation(ori.id as any)}
                      className={`py-1 rounded text-xs font-medium transition cursor-pointer ${
                        orientation === ori.id
                          ? 'bg-zinc-800 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {ori.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margin */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Page Margin</span>
                  <span className="font-mono text-zinc-200">{margin} pt</span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-surface-100 p-1 rounded-lg border border-border text-xs">
                  {[
                    { label: 'None (0)', val: 0 },
                    { label: 'Standard (20)', val: 20 },
                    { label: 'Wide (40)', val: 40 },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setMargin(m.val)}
                      className={`py-1 rounded text-xs font-medium transition cursor-pointer ${
                        margin === m.val
                          ? 'bg-zinc-800 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
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
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-xs font-mono uppercase text-zinc-400">
                  Image Sequence ({images.length} • {formatBytes(totalSize)})
                </h3>
              </div>

              <button
                onClick={handleClearAll}
                className="text-xs text-zinc-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {images.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-surface-100 border border-border text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-4 h-4 rounded bg-surface-50 text-zinc-300 font-mono flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    <img src={item.previewUrl} alt={item.name} className="w-8 h-8 object-cover rounded border border-border" />
                    <div className="truncate">
                      <p className="font-medium text-white truncate max-w-xs">{item.name}</p>
                      <p className="text-[10px] font-mono text-zinc-400">{formatBytes(item.size)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 rounded bg-surface-50 text-zinc-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === images.length - 1}
                      className="p-1 rounded bg-surface-50 text-zinc-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-surface-50 transition cursor-pointer"
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
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling PDF...</span>
                </>
              ) : (
                <span>Compile {images.length} Images into 1 PDF</span>
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
          title="PDF compiled successfully"
          filename={resultFilename}
          fileSize={resultBytes.byteLength}
          stats={[
            { label: 'Images included', value: `${images.length} pages` },
            { label: 'Page size', value: 'A4 Standard' },
          ]}
          downloadLabel="Download Compiled PDF"
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import { mergePdfs, getPdfPageCount, TargetPaperSize } from '@/lib/pdf-engine';
import { Layers, ArrowUp, ArrowDown, Trash2, Loader2, Sliders } from 'lucide-react';

interface MergeFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  data: Uint8Array;
  pageCount: number;
}

export function MergeView() {
  const [items, setItems] = useState<MergeFileItem[]>([]);
  const [paperSize, setPaperSize] = useState<TargetPaperSize>('a4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState<number>(15);

  const [isMerging, setIsMerging] = useState(false);
  const [mergedResult, setMergedResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    const newItems: MergeFileItem[] = [];

    for (const file of files) {
      try {
        const bytes = await fileToUint8Array(file);
        const pageCount = await getPdfPageCount(bytes);
        newItems.push({
          id: `merge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          data: bytes,
          pageCount,
        });
      } catch (err) {
        console.warn(`Could not parse ${file.name}:`, err);
      }
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearAll = () => {
    setItems([]);
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      alert('Select at least 2 PDF files to merge.');
      return;
    }

    setIsMerging(true);
    try {
      const mergedBytes = await mergePdfs(
        items.map((i) => ({ data: i.data, name: i.name })),
        { paperSize, orientation, margin }
      );
      const filename = `merged_${paperSize}_${Date.now()}.pdf`;
      setMergedResult({ bytes: mergedBytes, filename });
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to merge PDF: ${err}`);
    } finally {
      setIsMerging(false);
    }
  };

  const totalPages = items.reduce((acc, i) => acc + i.pageCount, 0);
  const totalInputSize = items.reduce((acc, i) => acc + i.size, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Layers className="w-3.5 h-3.5" />
          <span>MODULE / PDF MERGER</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Merge PDF Documents</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Combine multiple PDF files in RAM with optional uniform paper sizing.
        </p>
      </div>

      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept="application/pdf"
        title="Select or drop PDF files to merge"
        subtitle="Choose multiple files to concatenate into a single document"
      />

      {/* Selected Items Reorder List */}
      {items.length > 0 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-xs font-medium text-white uppercase tracking-wider font-mono">
                  Document Sequence ({items.length})
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  {totalPages} pages total • {formatBytes(totalInputSize)}
                </p>
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
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-100 border border-border text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded bg-surface-50 text-zinc-300 font-mono flex items-center justify-center text-[10px]">
                      {index + 1}
                    </span>
                    <div className="truncate">
                      <p className="font-medium text-white truncate max-w-sm">{item.name}</p>
                      <p className="text-[10px] font-mono text-zinc-400">
                        {item.pageCount} pages • {formatBytes(item.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 rounded bg-surface-50 text-zinc-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1}
                      className="p-1 rounded bg-surface-50 text-zinc-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-surface-50 transition cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paper Standardization Settings */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h4 className="text-xs font-semibold text-white">Paper Size Normalization</h4>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-zinc-400">Target Paper Format:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'a4', label: 'A4 Standard', desc: '210 × 297 mm' },
                  { id: 'f4', label: 'F4 / Folio', desc: '215 × 330 mm' },
                  { id: 'letter', label: 'US Letter', desc: '8.5 × 11 in' },
                  { id: 'original', label: 'Original', desc: 'Keep mixed' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPaperSize(s.id as TargetPaperSize)}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      paperSize === s.id
                        ? 'bg-zinc-100 border-zinc-100 text-zinc-950 shadow-subtle'
                        : 'bg-surface-100 border-border text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <p className="text-xs font-semibold">{s.label}</p>
                    <p className={`text-[10px] font-mono ${paperSize === s.id ? 'text-zinc-600' : 'text-zinc-500'}`}>{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {paperSize !== 'original' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border">
                <div className="space-y-1.5">
                  <span className="text-xs text-zinc-400">Page Orientation:</span>
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

                <div className="space-y-1.5">
                  <span className="text-xs text-zinc-400">Safe Margin:</span>
                  <div className="grid grid-cols-3 gap-1 bg-surface-100 p-1 rounded-lg border border-border text-xs">
                    {[
                      { val: 5, label: 'Tight (5pt)' },
                      { val: 15, label: 'Standard (15pt)' },
                      { val: 30, label: 'Wide (30pt)' },
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
            )}
          </div>

          <button
            onClick={handleMerge}
            disabled={isMerging || items.length < 2}
            className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing in RAM...</span>
              </>
            ) : (
              <span>Merge {items.length} Documents</span>
            )}
          </button>
        </div>
      )}

      {/* Result Modal */}
      {mergedResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(mergedResult.bytes, mergedResult.filename)}
          onReset={() => {
            setItems([]);
            setMergedResult(null);
          }}
          title="PDFs successfully merged"
          filename={mergedResult.filename}
          fileSize={mergedResult.bytes.byteLength}
          stats={[
            { label: 'Files merged', value: items.length },
            { label: 'Total pages', value: totalPages },
            { label: 'Paper standard', value: paperSize.toUpperCase() },
          ]}
          downloadLabel="Download Merged PDF"
        />
      )}
    </div>
  );
}

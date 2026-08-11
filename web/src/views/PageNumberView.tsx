import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import {
  getPdfPageCount,
  addPageNumbersToPdf,
  PageNumberPosition,
} from '@/lib/pdf-engine';
import { Hash, Sliders, Loader2 } from 'lucide-react';

export function PageNumberView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [position, setPosition] = useState<PageNumberPosition>('bottom-center');
  const [formatTemplate, setFormatTemplate] = useState('Page {n} of {total}');
  const [fontSize, setFontSize] = useState(10);
  const [skipCover, setSkipCover] = useState(false);
  const [startNumber, setStartNumber] = useState(1);
  const [marginOffset, setMarginOffset] = useState(25);

  const [isProcessing, setIsProcessing] = useState(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
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
      alert(`Failed to load PDF: ${err}`);
    }
  };

  const handleApplyNumbering = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsProcessing(true);

    try {
      const numberedBytes = await addPageNumbersToPdf(rawPdfBytes, {
        position,
        formatTemplate,
        fontSize,
        skipCover,
        startNumber,
        marginOffset,
      });

      const filename = selectedFile.name.replace(/\.pdf$/i, '_numbered.pdf');
      setResultBytes(numberedBytes);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to apply page numbering: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setResultBytes(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Hash className="w-3.5 h-3.5" />
          <span>MODULE / PDF PAGE NUMBERING</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Add Page Numbers</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Insert customizable page numbers, bates numbering, or header/footer indexes.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file"
          subtitle="Choose one document to apply page numbers"
        />
      ) : (
        <div className="space-y-4">
          {/* File summary */}
          <div className="p-3.5 rounded-xl bg-surface-200 border border-border flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white truncate max-w-sm">{selectedFile.name}</p>
              <p className="text-[11px] font-mono text-zinc-400">
                {pageCount} pages • {formatBytes(selectedFile.size)}
              </p>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-md btn-secondary cursor-pointer"
            >
              Change File
            </button>
          </div>

          {/* Settings */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">Numbering Configuration</h3>
            </div>

            {/* Position Picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 block">Position on Page</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'top-left', label: 'Top Left' },
                  { id: 'top-center', label: 'Top Center' },
                  { id: 'top-right', label: 'Top Right' },
                  { id: 'bottom-left', label: 'Bottom Left' },
                  { id: 'bottom-center', label: 'Bottom Center' },
                  { id: 'bottom-right', label: 'Bottom Right' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setPosition(pos.id as PageNumberPosition)}
                    className={`py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                      position === pos.id
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-subtle'
                        : 'bg-surface-100 border border-border text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Format Preset Picker & Custom Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 block">Format Pattern</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                {[
                  { label: 'Page 1 of 10', tpl: 'Page {n} of {total}' },
                  { label: '1 / 10', tpl: '{n} / {total}' },
                  { label: 'Halaman 1', tpl: 'Halaman {n}' },
                  { label: '- 1 -', tpl: '- {n} -' },
                ].map((p) => (
                  <button
                    key={p.tpl}
                    type="button"
                    onClick={() => setFormatTemplate(p.tpl)}
                    className={`py-1.5 px-2 rounded-md text-xs font-mono transition cursor-pointer truncate ${
                      formatTemplate === p.tpl
                        ? 'bg-zinc-800 text-white border border-zinc-600'
                        : 'bg-surface-100 border border-border text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={formatTemplate}
                onChange={(e) => setFormatTemplate(e.target.value)}
                placeholder="Template: {n} = page number, {total} = total pages"
                className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-white text-xs font-mono focus:outline-none focus:border-zinc-400"
              />
              <p className="text-[10px] font-mono text-zinc-500">
                Use <code className="text-zinc-300">{"{n}"}</code> for current page and <code className="text-zinc-300">{"{total}"}</code> for page count.
              </p>
            </div>

            {/* Advanced Checkboxes & Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border">
              {/* Skip Cover */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-100 border border-border">
                <input
                  type="checkbox"
                  id="skipCover"
                  checked={skipCover}
                  onChange={(e) => setSkipCover(e.target.checked)}
                  className="accent-zinc-200 cursor-pointer w-4 h-4"
                />
                <label htmlFor="skipCover" className="text-xs text-zinc-300 cursor-pointer select-none">
                  Skip Cover (Page 1)
                </label>
              </div>

              {/* Start Number */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Start Number</span>
                  <span className="font-mono text-zinc-200">{startNumber}</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={startNumber}
                  onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1 rounded bg-surface-100 border border-border text-white text-xs font-mono"
                />
              </div>

              {/* Font Size */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Font Size</span>
                  <span className="font-mono text-zinc-200">{fontSize} pt</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={20}
                  step={1}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleApplyNumbering}
              disabled={isProcessing}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Numbering pages in RAM...</span>
                </>
              ) : (
                <span>Add Page Numbers to {pageCount} Pages</span>
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
          title="Page numbers applied"
          filename={resultFilename}
          fileSize={resultBytes.byteLength}
          stats={[
            { label: 'Position', value: position },
            { label: 'Template', value: formatTemplate },
            { label: 'Cover skipped', value: skipCover ? 'Yes' : 'No' },
          ]}
          downloadLabel="Download Numbered PDF"
        />
      )}
    </div>
  );
}

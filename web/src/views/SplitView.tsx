import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadBlob, formatBytes } from '@/lib/utils';
import {
  getPdfPageCount,
  splitPdfIntoSinglePages,
  splitPdfByRanges,
  extractSpecificPages,
} from '@/lib/pdf-engine';
import { Scissors, FileStack, Layers, BookmarkCheck, Loader2 } from 'lucide-react';

type SplitMode = 'single' | 'ranges' | 'extract';

export function SplitView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<SplitMode>('single');

  const [rangesInput, setRangesInput] = useState('1-2, 3-4');
  const [extractInput, setExtractInput] = useState('1, 3');

  const [isSplitting, setIsSplitting] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
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
      alert(`Failed to read PDF: ${err}`);
    }
  };

  const handleSplit = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsSplitting(true);

    const baseName = selectedFile.name.replace(/\.pdf$/i, '');

    try {
      if (splitMode === 'single') {
        const zipBlob = await splitPdfIntoSinglePages(rawPdfBytes, baseName);
        setResultBlob(zipBlob);
        setResultFilename(`${baseName}_single_pages.zip`);
      } else if (splitMode === 'ranges') {
        const ranges = rangesInput
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean);
        if (ranges.length === 0) {
          alert('Please enter at least one valid page range (e.g. 1-3, 4-5).');
          setIsSplitting(false);
          return;
        }
        const zipBlob = await splitPdfByRanges(rawPdfBytes, ranges, baseName);
        setResultBlob(zipBlob);
        setResultFilename(`${baseName}_ranges.zip`);
      } else if (splitMode === 'extract') {
        const pagesToExtract = extractInput
          .split(',')
          .map((p) => parseInt(p.trim()))
          .filter((p) => !isNaN(p));

        if (pagesToExtract.length === 0) {
          alert('Please enter valid page numbers (e.g. 1, 3, 5).');
          setIsSplitting(false);
          return;
        }

        const extractedBytes = await extractSpecificPages(rawPdfBytes, pagesToExtract);
        const blob = new Blob([extractedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        setResultBlob(blob);
        setResultFilename(`${baseName}_extracted.pdf`);
      }

      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to split PDF: ${err}`);
    } finally {
      setIsSplitting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setPageCount(0);
    setResultBlob(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Scissors className="w-3.5 h-3.5" />
          <span>MODULE / PDF SPLITTER</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Split PDF Document</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Separate documents into individual single-page files or extract designated intervals.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file to split"
          subtitle="Choose one document to separate into pages or ranges"
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

          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: 'single',
                title: 'All Single Pages',
                desc: '1 page per PDF (.zip)',
                icon: FileStack,
              },
              {
                id: 'ranges',
                title: 'By Intervals',
                desc: 'e.g. 1-3, 4-6 (.zip)',
                icon: Layers,
              },
              {
                id: 'extract',
                title: 'Extract Pages',
                desc: 'e.g. 1, 3, 5 into 1 PDF',
                icon: BookmarkCheck,
              },
            ].map((mode) => {
              const Icon = mode.icon;
              const isSelected = splitMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSplitMode(mode.id as SplitMode)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-100 border-zinc-100 text-zinc-950 shadow-subtle'
                      : 'bg-surface-200 border-border text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-zinc-950' : 'text-zinc-400'}`} />
                    <span className={`text-xs font-semibold ${isSelected ? 'text-zinc-950' : 'text-white'}`}>{mode.title}</span>
                  </div>
                  <p className={`text-[10px] font-mono ${isSelected ? 'text-zinc-600' : 'text-zinc-500'}`}>{mode.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Mode Form Options */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            {splitMode === 'single' && (
              <p className="text-xs text-zinc-300">
                All <strong className="text-white font-mono">{pageCount}</strong> pages will be exported as individual single-page PDF files and packaged into a ZIP archive.
              </p>
            )}

            {splitMode === 'ranges' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white block">
                  Specify intervals (comma-separated):
                </label>
                <input
                  type="text"
                  value={rangesInput}
                  onChange={(e) => setRangesInput(e.target.value)}
                  placeholder="e.g. 1-3, 4-6, 7-10"
                  className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-white text-xs font-mono focus:outline-none focus:border-zinc-400"
                />
                <p className="text-[10px] font-mono text-zinc-400">Total document page range: 1 to {pageCount}.</p>
              </div>
            )}

            {splitMode === 'extract' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white block">
                  Page numbers to extract (comma-separated):
                </label>
                <input
                  type="text"
                  value={extractInput}
                  onChange={(e) => setExtractInput(e.target.value)}
                  placeholder="e.g. 1, 3, 5, 8"
                  className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-white text-xs font-mono focus:outline-none focus:border-zinc-400"
                />
                <p className="text-[10px] font-mono text-zinc-400">
                  Extracted pages will be merged into a single new document.
                </p>
              </div>
            )}

            <button
              onClick={handleSplit}
              disabled={isSplitting}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isSplitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Execute Split</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultBlob && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadBlob(resultBlob, resultFilename)}
          onReset={handleReset}
          title="Document successfully split"
          filename={resultFilename}
          fileSize={resultBlob.size}
          stats={[
            { label: 'Mode', value: splitMode.toUpperCase() },
            { label: 'Original pages', value: pageCount },
          ]}
          downloadLabel="Download Result"
        />
      )}
    </div>
  );
}

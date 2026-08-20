import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadBlob, downloadUint8Array, formatBytes, getTimestampString } from '@/lib/utils';
import {
  getPdfPageCount,
  splitPdfIntoSinglePages,
  splitPdfByRanges,
  extractSpecificPages,
  SplitSinglePagesResult,
  SplitRangesResult,
} from '@/lib/pdf-engine';
import { Scissors, FileStack, Layers, BookmarkCheck, Loader2, Download, FileArchive } from 'lucide-react';

type SplitMode = 'single' | 'ranges' | 'extract';

export function SplitView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [splitMode, setSplitMode] = useState<SplitMode>('single');

  const [rangesInput, setRangesInput] = useState('1-2, 3-4');
  const [extractInput, setExtractInput] = useState('1, 3');

  const [isSplitting, setIsSplitting] = useState(false);

  // Results
  const [singlePagesResult, setSinglePagesResult] = useState<SplitSinglePagesResult | null>(null);
  const [rangesResult, setRangesResult] = useState<SplitRangesResult | null>(null);
  const [extractResult, setExtractResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);

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
      handleResetResults();
    } catch (err) {
      alert(`Failed to read PDF: ${err}`);
    }
  };

  const handleResetResults = () => {
    setSinglePagesResult(null);
    setRangesResult(null);
    setExtractResult(null);
    setResultBlob(null);
  };

  const handleSplit = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsSplitting(true);
    handleResetResults();

    const baseName = selectedFile.name.replace(/\.pdf$/i, '');

    try {
      if (splitMode === 'single') {
        const res = await splitPdfIntoSinglePages(rawPdfBytes, baseName);
        setSinglePagesResult(res);

        if (res.isSinglePage && res.pages.length > 0) {
          const singleBlob = new Blob([res.pages[0].bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
          setResultBlob(singleBlob);
          setResultFilename(res.pages[0].filename);
        } else {
          setResultBlob(res.zipBlob);
          setResultFilename(`${baseName}_single_pages_${getTimestampString()}.zip`);
        }
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

        const res = await splitPdfByRanges(rawPdfBytes, ranges, baseName);
        setRangesResult(res);

        if (res.isSingleRange && res.ranges.length > 0) {
          const singleBlob = new Blob([res.ranges[0].bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
          setResultBlob(singleBlob);
          setResultFilename(res.ranges[0].filename);
        } else {
          setResultBlob(res.zipBlob);
          setResultFilename(`${baseName}_ranges_${getTimestampString()}.zip`);
        }
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
        const filename = `${baseName}_extracted_${getTimestampString()}.pdf`;
        const blob = new Blob([extractedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        setExtractResult({ bytes: extractedBytes, filename });
        setResultBlob(blob);
        setResultFilename(filename);
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
    handleResetResults();
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
          Separate documents into individual single-page files or extract designated intervals directly in browser memory.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file to split"
          subtitle="All operations executed locally in client RAM"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              {
                id: 'single',
                title: 'Extract Every Page',
                desc: 'Burst into individual single-page PDFs',
                icon: FileStack,
              },
              {
                id: 'ranges',
                title: 'Split by Ranges',
                desc: 'e.g. 1-3, 4-6, 7-10 into separate PDFs',
                icon: Layers,
              },
              {
                id: 'extract',
                title: 'Extract Pages',
                desc: 'Merge specific pages into 1 new PDF',
                icon: BookmarkCheck,
              },
            ].map((m) => {
              const Icon = m.icon;
              const active = splitMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSplitMode(m.id as SplitMode)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                    active
                      ? 'bg-surface-100 border-zinc-400 shadow-subtle'
                      : 'bg-surface-200 border-border hover:border-zinc-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-zinc-400'}`} />
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{m.title}</p>
                    <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{m.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mode Parameters */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            {splitMode === 'single' && (
              <p className="text-xs text-zinc-400">
                {pageCount === 1 ? (
                  <span>
                    This document has <strong className="text-white font-mono">1</strong> page. It will be downloaded directly as a single <strong className="text-white font-mono">.pdf</strong> file (no ZIP).
                  </span>
                ) : (
                  <span>
                    All <strong className="text-white font-mono">{pageCount}</strong> pages will be prepared as separate individual single-page PDF files.
                  </span>
                )}
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
                <p className="text-[10px] font-mono text-zinc-400">
                  Total document page range: 1 to {pageCount}. (Single range will export directly as a single .pdf without ZIP).
                </p>
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

          {/* Multi-item individual download list (for multi-page single burst or multi-range) */}
          {singlePagesResult && !singlePagesResult.isSinglePage && (
            <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Individual Pages ({singlePagesResult.pages.length})
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Download individual PDF pages or package all into a single ZIP
                  </p>
                </div>

                <button
                  onClick={() => downloadBlob(singlePagesResult.zipBlob, resultFilename)}
                  className="px-3 py-1.5 btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-subtle"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  <span>Download All (ZIP)</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
                {singlePagesResult.pages.map((p) => (
                  <div
                    key={p.pageNumber}
                    className="p-2 rounded-lg bg-surface-100 border border-border flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-1">
                      <span className="font-mono text-white text-[11px] font-medium block truncate">
                        Page {p.pageNumber}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {formatBytes(p.bytes.byteLength)}
                      </span>
                    </div>

                    <button
                      onClick={() => downloadUint8Array(p.bytes, p.filename)}
                      title={`Download ${p.filename}`}
                      className="p-1.5 rounded bg-surface-50 border border-border hover:border-zinc-400 text-zinc-200 hover:text-white transition cursor-pointer flex-shrink-0"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rangesResult && !rangesResult.isSingleRange && (
            <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Extracted Ranges ({rangesResult.ranges.length})
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Download individual range PDFs or package all into a single ZIP
                  </p>
                </div>

                <button
                  onClick={() => downloadBlob(rangesResult.zipBlob, resultFilename)}
                  className="px-3 py-1.5 btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-subtle"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  <span>Download All (ZIP)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                {rangesResult.ranges.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-surface-100 border border-border flex items-center justify-between text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-mono text-white text-[11px] font-medium block truncate">
                        Range: {r.range}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {formatBytes(r.bytes.byteLength)}
                      </span>
                    </div>

                    <button
                      onClick={() => downloadUint8Array(r.bytes, r.filename)}
                      title={`Download ${r.filename}`}
                      className="px-2 py-1 rounded bg-surface-50 border border-border hover:border-zinc-400 text-zinc-200 hover:text-white text-[11px] font-medium flex items-center gap-1 transition cursor-pointer flex-shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Modal */}
      {resultBlob && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadBlob(resultBlob, resultFilename)}
          onReset={handleReset}
          title={
            (singlePagesResult?.isSinglePage || rangesResult?.isSingleRange || extractResult)
              ? 'Document ready for download'
              : 'Document successfully split'
          }
          filename={resultFilename}
          fileSize={resultBlob.size}
          stats={[
            { label: 'Mode', value: splitMode.toUpperCase() },
            {
              label: 'Output format',
              value: resultFilename.endsWith('.zip') ? 'Archive (.ZIP)' : 'Direct PDF (.pdf)',
            },
            { label: 'Original pages', value: pageCount },
          ]}
          downloadLabel={
            resultFilename.endsWith('.zip')
              ? 'Download All as ZIP'
              : 'Download PDF Document'
          }
        />
      )}
    </div>
  );
}

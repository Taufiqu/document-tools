import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import { getPdfPageCount } from '@/lib/pdf-engine';
import { renderPdfToGrayscalePdf } from '@/lib/pdf-renderer';
import { Printer, Sliders, Loader2 } from 'lucide-react';

export function GrayscalePdfView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [contrast, setContrast] = useState<number>(1.2);
  const [brightness, setBrightness] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

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

  const handleConvertGrayscale = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsProcessing(true);
    setProgressText('Converting pages to Grayscale...');

    try {
      const bAndWBytes = await renderPdfToGrayscalePdf(
        rawPdfBytes,
        contrast,
        brightness,
        2.0,
        (current, total) => {
          setProgressText(`Converting page ${current} of ${total}...`);
        }
      );

      const filename = selectedFile.name.replace(/\.pdf$/i, '_grayscale.pdf');
      setResultBytes(bAndWBytes);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to convert PDF: ${err}`);
    } finally {
      setIsProcessing(false);
      setProgressText('');
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
          <Printer className="w-3.5 h-3.5" />
          <span>MODULE / PDF GRAYSCALE & PRINT OPTIMIZER</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">PDF Grayscale & Print Optimizer</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Transform color documents into high-contrast monochrome PDF to save printer ink and clean up scanned pages.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file"
          subtitle="All pages will be converted to monochrome grayscale in RAM"
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
              <h3 className="text-xs font-semibold text-white">Luminance & Contrast Adjustments</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Contrast Boost</span>
                  <span className="font-mono text-zinc-200">{contrast.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={2.0}
                  step={0.1}
                  value={contrast}
                  onChange={(e) => setContrast(parseFloat(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
                <p className="text-[10px] font-mono text-zinc-500">
                  Higher contrast makes background artifacts whiter and text crisper.
                </p>
              </div>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Brightness Offset</span>
                  <span className="font-mono text-zinc-200">{brightness > 0 ? `+${brightness}` : brightness}</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={40}
                  step={5}
                  value={brightness}
                  onChange={(e) => setBrightness(parseInt(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
                <p className="text-[10px] font-mono text-zinc-500">
                  Adjust overall document brightness.
                </p>
              </div>
            </div>

            <button
              onClick={handleConvertGrayscale}
              disabled={isProcessing}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progressText || 'Processing pages...'}</span>
                </>
              ) : (
                <span>Convert {pageCount} Pages to B&W Grayscale</span>
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
          title="Document converted to Grayscale"
          filename={resultFilename}
          fileSize={resultBytes.byteLength}
          stats={[
            { label: 'Color space', value: 'Monochrome Grayscale' },
            { label: 'Pages converted', value: `${pageCount} pages` },
            { label: 'Contrast', value: `${contrast.toFixed(1)}x` },
          ]}
          downloadLabel="Download Grayscale PDF"
        />
      )}
    </div>
  );
}

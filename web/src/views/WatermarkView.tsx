import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import { watermarkPdf, getPdfPageCount } from '@/lib/pdf-engine';
import { Shield, Type, Sliders, Loader2 } from 'lucide-react';

export function WatermarkView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.2);
  const [fontSize, setFontSize] = useState(48);
  const [angle, setAngle] = useState(45);

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

  const handleApplyWatermark = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    if (!watermarkText.trim()) {
      alert('Please enter watermark text.');
      return;
    }

    setIsProcessing(true);
    try {
      const watermarked = await watermarkPdf(rawPdfBytes, {
        text: watermarkText,
        opacity,
        fontSize,
        angle,
      });

      const filename = selectedFile.name.replace(/\.pdf$/i, '_watermarked.pdf');
      setResultBytes(watermarked);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to apply watermark: ${err}`);
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
          <Shield className="w-3.5 h-3.5" />
          <span>MODULE / PDF WATERMARK</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Apply PDF Watermark</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Stamp diagonal text overlays across all pages with custom angle and opacity.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file"
          subtitle="Choose one document to stamp with watermark"
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

          {/* Watermark Settings */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h4 className="text-xs font-semibold text-white">Watermark Configuration</h4>
            </div>

            {/* Text Input */}
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 block">Stamp Text</label>
              <div className="relative">
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL / INTERNAL ONLY"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface-100 border border-border text-white text-xs font-medium focus:outline-none focus:border-zinc-400"
                />
                <Type className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Opacity */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Opacity</span>
                  <span className="font-mono text-zinc-200">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
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
                  min={20}
                  max={90}
                  step={2}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
              </div>

              {/* Angle */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Angle</span>
                  <span className="font-mono text-zinc-200">{angle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={angle}
                  onChange={(e) => setAngle(parseInt(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
              </div>
            </div>

            {/* Preview Box */}
            <div className="p-4 rounded-lg bg-surface-100 border border-border/80 relative overflow-hidden h-20 flex items-center justify-center select-none">
              <span
                className="font-bold uppercase tracking-widest text-zinc-300 pointer-events-none"
                style={{
                  opacity,
                  fontSize: `${fontSize * 0.4}px`,
                  transform: `rotate(-${angle}deg)`,
                }}
              >
                {watermarkText || 'WATERMARK'}
              </span>
            </div>

            <button
              onClick={handleApplyWatermark}
              disabled={isProcessing || !watermarkText.trim()}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Stamping in RAM...</span>
                </>
              ) : (
                <span>Apply Watermark</span>
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
          title="Watermark successfully applied"
          filename={resultFilename}
          fileSize={resultBytes.byteLength}
          stats={[
            { label: 'Watermark text', value: watermarkText },
            { label: 'Pages stamped', value: `${pageCount} pages` },
          ]}
          downloadLabel="Download Watermarked PDF"
        />
      )}
    </div>
  );
}

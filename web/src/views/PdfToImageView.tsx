import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadBlob, formatBytes } from '@/lib/utils';
import { getPdfPageCount } from '@/lib/pdf-engine';
import { renderPdfPagesToImagesZip, ImageExportFormat } from '@/lib/pdf-renderer';
import { Image as ImageIcon, Sliders, Loader2 } from 'lucide-react';

export function PdfToImageView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [format, setFormat] = useState<ImageExportFormat>('png');
  const [scale, setScale] = useState<number>(2.0);
  const [isRendering, setIsRendering] = useState(false);
  const [progressText, setProgressText] = useState('');

  const [resultZipBlob, setResultZipBlob] = useState<Blob | null>(null);
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

  const handleConvert = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsRendering(true);
    setProgressText('Rendering pages...');

    try {
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const zipBlob = await renderPdfPagesToImagesZip(
        rawPdfBytes,
        format,
        scale,
        baseName,
        (current: number, total: number) => {
          setProgressText(`Rendering page ${current} of ${total}...`);
        }
      );

      const filename = `${baseName}_images_${format.toUpperCase()}.zip`;
      setResultZipBlob(zipBlob);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to render images: ${err}`);
    } finally {
      setIsRendering(false);
      setProgressText('');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setResultZipBlob(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>MODULE / PDF TO IMAGES</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">PDF to Images</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Render PDF pages into high-resolution raster images packaged into a ZIP archive.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file"
          subtitle="All pages will be rendered locally to images in memory"
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
              <h3 className="text-xs font-semibold text-white">Export Configuration</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Format selection */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 block">Image Format</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['png', 'jpeg', 'webp'] as ImageExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setFormat(fmt)}
                      className={`py-1.5 rounded-md text-xs font-mono uppercase transition cursor-pointer ${
                        format === fmt
                          ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-subtle'
                          : 'bg-surface-100 border border-border text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution / Scale */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Resolution Scale</span>
                  <span className="font-mono text-zinc-200">{scale}x</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '1.0x (Web)', val: 1.0 },
                    { label: '2.0x (HD)', val: 2.0 },
                    { label: '3.0x (UHD)', val: 3.0 },
                  ].map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => setScale(s.val)}
                      className={`py-1.5 rounded-md text-xs font-mono transition cursor-pointer ${
                        scale === s.val
                          ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-subtle'
                          : 'bg-surface-100 border border-border text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleConvert}
              disabled={isRendering}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progressText || 'Rendering pages...'}</span>
                </>
              ) : (
                <span>Export {pageCount} Pages as Images ({format.toUpperCase()})</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultZipBlob && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadBlob(resultZipBlob, resultFilename)}
          onReset={handleReset}
          title="Pages successfully rendered"
          filename={resultFilename}
          fileSize={resultZipBlob.size}
          stats={[
            { label: 'Images rendered', value: `${pageCount} files` },
            { label: 'Format', value: format.toUpperCase() },
            { label: 'Scale', value: `${scale}x` },
          ]}
          downloadLabel="Download Images ZIP"
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadBlob, formatBytes } from '@/lib/utils';
import { getPdfPageCount } from '@/lib/pdf-engine';
import {
  renderPdfPagesToImages,
  RenderPdfToImagesResult,
  RenderedPdfImage,
  ImageExportFormat,
} from '@/lib/pdf-renderer';
import {
  Image as ImageIcon,
  Sliders,
  Loader2,
  Download,
  FileArchive,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export function PdfToImageView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  const [format, setFormat] = useState<ImageExportFormat>('png');
  const [scale, setScale] = useState<number>(2.0);
  const [autoTrimMargins, setAutoTrimMargins] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [progressText, setProgressText] = useState('');

  // Results
  const [renderResult, setRenderResult] = useState<RenderPdfToImagesResult | null>(null);
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
      setRenderResult(null);
    } catch (err) {
      alert(`Failed to load PDF: ${err}`);
    }
  };

  const handleConvert = async () => {
    if (!rawPdfBytes || !selectedFile) return;
    setIsRendering(true);
    setProgressText(autoTrimMargins ? 'Loading Smart Crop engine...' : 'Rendering pages...');

    try {
      const baseName = selectedFile.name.replace(/\.pdf$/i, '');
      const result = await renderPdfPagesToImages(
        rawPdfBytes,
        format,
        scale,
        baseName,
        (current: number, total: number) => {
          setProgressText(`Rendering page ${current} of ${total}...`);
        },
        { autoTrimMargins, trimPadding: 16 },
      );

      setRenderResult(result);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to render images: ${err}`);
    } finally {
      setIsRendering(false);
      setProgressText('');
    }
  };

  const handleDownloadSingleImage = (img: RenderedPdfImage) => {
    downloadBlob(img.blob, img.filename);
  };

  const handleDownloadZip = () => {
    if (!renderResult) return;
    downloadBlob(renderResult.zipBlob, renderResult.zipFilename);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setRenderResult(null);
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
          Render PDF pages into crisp raster images with 1-click single image download or full ZIP package.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file"
          subtitle="Direct single PNG download for 1-page PDFs, or complete image gallery for multi-page"
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

            <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-100 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoTrimMargins}
                onChange={(event) => setAutoTrimMargins(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-white"
              />
              <span>
                <span className="block text-xs font-medium text-zinc-200">Smart Crop — trim white margins</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">Detect content on every rendered page and keep a small safe border. Best for scanned documents with excess white space.</span>
              </span>
            </label>

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
                <span>
                  {pageCount === 1
                    ? `Render & Download Direct ${format.toUpperCase()}`
                    : `Export ${pageCount} Pages as Images (${format.toUpperCase()})`}
                </span>
              )}
            </button>
          </div>

          {/* Rendered Gallery & Direct Downloads (for Multi-Page & Single Page) */}
          {renderResult && (
            <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Rendered Pages ({renderResult.images.length})
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    {pageCount === 1 ? 'Single image ready' : 'Download individual images or all-in-one ZIP'}
                  </p>
                </div>

                {!renderResult.isSinglePage && (
                  <button
                    onClick={handleDownloadZip}
                    className="px-3 py-1.5 btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-subtle"
                  >
                    <FileArchive className="w-3.5 h-3.5" />
                    <span>Download All (ZIP)</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
                {renderResult.images.map((img) => (
                  <div
                    key={img.pageNumber}
                    className="p-2 rounded-lg bg-surface-100 border border-border flex flex-col justify-between space-y-2 text-xs"
                  >
                    <div className="aspect-[3/4] bg-black/40 rounded overflow-hidden relative flex items-center justify-center">
                      <img
                        src={img.dataUrl}
                        alt={`Page ${img.pageNumber}`}
                        className="max-h-full max-w-full object-contain"
                      />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[10px]">
                        P. {img.pageNumber}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-mono text-zinc-400 truncate" title={img.filename}>
                        {img.filename}
                      </p>
                      <button
                        onClick={() => handleDownloadSingleImage(img)}
                        className="w-full py-1.5 px-2 rounded bg-surface-50 border border-border hover:border-zinc-400 text-zinc-200 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download {format.toUpperCase()}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Modal for 1-Page or Quick ZIP */}
      {renderResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => {
            if (renderResult.isSinglePage && renderResult.singleImageBlob) {
              downloadBlob(renderResult.singleImageBlob, renderResult.singleImageFilename || `image.${format}`);
            } else {
              handleDownloadZip();
            }
          }}
          onReset={handleReset}
          title={renderResult.isSinglePage ? 'Image rendered successfully' : 'Pages successfully rendered'}
          filename={
            renderResult.isSinglePage && renderResult.singleImageFilename
              ? renderResult.singleImageFilename
              : renderResult.zipFilename
          }
          fileSize={
            renderResult.isSinglePage && renderResult.singleImageBlob
              ? renderResult.singleImageBlob.size
              : renderResult.zipBlob.size
          }
          stats={[
            {
              label: 'Output',
              value: renderResult.isSinglePage ? `Direct ${format.toUpperCase()}` : `${renderResult.images.length} images (ZIP)`,
            },
            { label: 'Format', value: format.toUpperCase() },
            { label: 'Scale', value: `${scale}x` },
            { label: 'Smart Crop', value: autoTrimMargins ? 'Enabled' : 'Off' },
          ]}
          downloadLabel={
            renderResult.isSinglePage
              ? `Download ${format.toUpperCase()} Image`
              : 'Download All Pages as ZIP'
          }
        />
      )}
    </div>
  );
}

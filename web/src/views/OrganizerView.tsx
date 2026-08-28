import React, { useRef, useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { PageThumbnail } from '@/components/PageThumbnail';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array } from '@/lib/utils';
import { getPdfPageCount, organizePdf, PageAction } from '@/lib/pdf-engine';
import { renderPdfPageToDataUrl } from '@/lib/pdf-renderer';
import { FileText, ImagePlus, RotateCw, Save, RefreshCw, Loader2 } from 'lucide-react';

export function OrganizerView() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawPdfBytes, setRawPdfBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedResult, setProcessedResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);

    try {
      const bytes = await fileToUint8Array(file);
      setRawPdfBytes(bytes);
      const count = await getPdfPageCount(bytes);

      const initialPages: PageAction[] = [];
      for (let i = 0; i < count; i++) {
        initialPages.push({
          id: `p-${i + 1}-${Date.now()}`,
          pageNumber: i + 1,
          originalIndex: i,
          rotateAngle: 0,
          isDeleted: false,
        });
      }
      setPages(initialPages);

      // Render thumbnails asynchronously
      for (let i = 0; i < count; i++) {
        renderPdfPageToDataUrl(bytes, i + 1).then((url) => {
          setPages((prev) =>
            prev.map((p) => (p.originalIndex === i ? { ...p, thumbnailUrl: url } : p))
          );
        });
      }
    } catch (err) {
      alert(`Failed to load PDF: ${err}`);
    }
  };

  const handleRotateCw = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotateAngle: (p.rotateAngle + 90) % 360 } : p
      )
    );
  };

  const handleRotateCcw = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotateAngle: (p.rotateAngle + 270) % 360 } : p
      )
    );
  };

  const handleToggleDelete = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isDeleted: !p.isDeleted } : p))
    );
  };

  const handleRotateAll = (angle: number) => {
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotateAngle: (p.rotateAngle + angle) % 360 }))
    );
  };

  const handleMovePage = (id: string, direction: -1 | 1) => {
    setPages((prev) => {
      const index = prev.findIndex((page) => page.id === id);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleImagesSelected = async (files: FileList | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((file) => file.type === 'image/jpeg' || file.type === 'image/png');
    if (imageFiles.length !== files.length) {
      alert('Only JPG and PNG can be inserted as PDF pages for now.');
    }

    try {
      const imagePages = await Promise.all(imageFiles.map(async (file, index): Promise<PageAction> => ({
        id: `image-${Date.now()}-${index}`,
        pageNumber: 0,
        originalIndex: -1,
        rotateAngle: 0,
        isDeleted: false,
        sourceType: 'image',
        imageData: await fileToUint8Array(file),
        imageMimeType: file.type as 'image/jpeg' | 'image/png',
        thumbnailUrl: URL.createObjectURL(file),
      })));
      setPages((prev) => [...prev, ...imagePages]);
    } catch (err) {
      alert(`Failed to insert image: ${err}`);
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleSaveOrganized = async () => {
    if (!rawPdfBytes) return;
    setIsProcessing(true);

    try {
      const organizedBytes = await organizePdf(rawPdfBytes, pages);
      const filename = selectedFile?.name.replace(/\.pdf$/i, '_organized.pdf') || 'organized.pdf';
      setProcessedResult({ bytes: organizedBytes, filename });
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to organize PDF: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setRawPdfBytes(null);
    setPages([]);
    setProcessedResult(null);
  };

  const activePageCount = pages.filter((p) => !p.isDeleted).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <FileText className="w-3.5 h-3.5" />
          <span>MODULE / PAGE ORGANIZER</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Visual Page Organizer</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Reorder, rotate, remove, and insert JPG/PNG pages. Everything stays in browser memory.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Select or drop a PDF file"
          subtitle="Page thumbnails will be generated locally in memory"
        />
      ) : (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="p-3.5 rounded-xl bg-surface-200 border border-border flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-white truncate max-w-xs">{selectedFile.name}</p>
              <p className="text-[11px] font-mono text-zinc-400">
                {activePageCount} of {pages.length} pages active
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(event) => void handleImagesSelected(event.target.files)}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-md btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ImagePlus className="w-3 h-3" />
                <span>Insert Images</span>
              </button>

              <button
                onClick={() => handleRotateAll(90)}
                className="px-2.5 py-1.5 rounded-md btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                <span>Rotate All (90°)</span>
              </button>

              <button
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-md btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Change File</span>
              </button>

              <button
                onClick={handleSaveOrganized}
                disabled={isProcessing || activePageCount === 0}
                className="px-3.5 py-1.5 rounded-md btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-subtle"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    <span>Export PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Thumbnail Grid */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {pages.map((p, idx) => (
                <PageThumbnail
                  key={p.id}
                  action={p}
                  displayNumber={idx + 1}
                  onRotateCw={handleRotateCw}
                  onRotateCcw={handleRotateCcw}
                  onToggleDelete={handleToggleDelete}
                  onMove={handleMovePage}
                  canMovePrevious={idx > 0}
                  canMoveNext={idx < pages.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {processedResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(processedResult.bytes, processedResult.filename)}
          onReset={handleReset}
          title="Document successfully organized"
          filename={processedResult.filename}
          fileSize={processedResult.bytes.byteLength}
          stats={[
            { label: 'Original pages', value: pages.length },
            { label: 'Retained pages', value: activePageCount },
          ]}
          downloadLabel="Download Organized PDF"
        />
      )}
    </div>
  );
}

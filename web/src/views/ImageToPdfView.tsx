import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadUint8Array, formatBytes } from '@/lib/utils';
import { imagesToPdf, ImageToPdfOptions } from '@/lib/image-engine';
import {
  ScanFilterType,
  SCAN_FILTER_PRESETS,
  ScanFilterOptions,
} from '@/lib/scan-engine';
import { naturalSortFiles } from '@/lib/folder-scanner';
import {
  Download,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  Sliders,
  Sparkles,
  ArrowDownAZ,
  Maximize2,
  Sun,
} from 'lucide-react';

interface SelectedImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export function ImageToPdfView() {
  const [images, setImages] = useState<SelectedImageItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'F4' | 'Letter' | 'Fit'>('A4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState<number>(20);

  // Realistic Scan Filter States
  const [scanFilter, setScanFilter] = useState<ScanFilterType>('magic-color');
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState<boolean>(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
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

    setImages((prev) => naturalSortFiles([...prev, ...newItems]));
  };

  const handleSortAZ = () => {
    setImages((prev) => naturalSortFiles(prev));
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
    setProgressMsg('Applying realistic scan filters and rendering PDF...');

    try {
      const filterOptions: ScanFilterOptions = {
        brightness,
        contrast,
      };

      const options: ImageToPdfOptions = {
        pageSize,
        orientation,
        margin,
        scanFilter,
        filterOptions,
      };

      const pdfBytes = await imagesToPdf(
        images.map((i) => i.file),
        options
      );

      const filename = `scanned_document_${scanFilter}_${Date.now()}.pdf`;
      setResultBytes(pdfBytes);
      setResultFilename(filename);
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to compile scanned PDF: ${err}`);
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
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
          <span>MODULE / IMAGES TO PDF SCANNER</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Images to PDF with Scan Filters</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Compile photo shots into clean PDF documents with CamScanner-style realistic scan filters (Magic Color, B&W Photocopy, Monochrome).
        </p>
      </div>

      {/* Upload Zone */}
      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept="image/*"
        title="Select or drop photo/document images"
        subtitle="Choose multiple image files or an entire folder from local storage or Google Drive"
        enableFolderUpload={true}
        enableGoogleDrive={true}
      />

      {/* Settings & Selected Items */}
      {images.length > 0 && (
        <div className="space-y-4">
          {/* Scan Filter Presets Section */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                  Realistic Scan Filter Preset
                </h4>
              </div>

              <button
                onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
              >
                <Sun className="w-3 h-3" />
                <span>{showAdvancedFilter ? 'Hide Sliders' : 'Fine-Tune'}</span>
              </button>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {SCAN_FILTER_PRESETS.map((preset) => {
                const isSelected = scanFilter === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setScanFilter(preset.id)}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-zinc-100 border-zinc-100 text-zinc-950 shadow-subtle'
                        : 'bg-surface-100 border-border text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[9px] font-mono px-1 rounded ${
                            isSelected ? 'bg-zinc-950 text-white' : 'bg-surface-50 text-zinc-400'
                          }`}
                        >
                          {preset.tag}
                        </span>
                      </div>
                      <p className="text-xs font-semibold">{preset.label}</p>
                    </div>
                    <p
                      className={`text-[10px] mt-1 line-clamp-2 ${
                        isSelected ? 'text-zinc-700' : 'text-zinc-500'
                      }`}
                    >
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Optional Sliders */}
            {showAdvancedFilter && (
              <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Brightness Adjustment</span>
                    <span className="font-mono">{brightness > 0 ? `+${brightness}` : brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-surface-100 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>Contrast Adjustment</span>
                    <span className="font-mono">{contrast > 0 ? `+${contrast}` : contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-surface-100 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Page Layout Settings */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h4 className="text-xs font-semibold text-white">PDF Paper & Layout Standardization</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Paper Format */}
              <div className="space-y-1.5">
                <span className="text-xs text-zinc-400">Paper Format:</span>
                <div className="grid grid-cols-2 gap-1 bg-surface-100 p-1 rounded-lg border border-border text-xs">
                  {[
                    { id: 'A4', label: 'A4 Standard' },
                    { id: 'F4', label: 'F4 Folio' },
                    { id: 'Letter', label: 'US Letter' },
                    { id: 'Fit', label: 'Fit to Image' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setPageSize(s.id as any)}
                      className={`py-1 rounded text-xs font-medium transition cursor-pointer ${
                        pageSize === s.id
                          ? 'bg-zinc-800 text-white shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation */}
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

              {/* Margins */}
              <div className="space-y-1.5">
                <span className="text-xs text-zinc-400">Page Margin:</span>
                <div className="grid grid-cols-3 gap-1 bg-surface-100 p-1 rounded-lg border border-border text-xs">
                  {[
                    { val: 0, label: 'Zero (0pt)' },
                    { val: 15, label: 'Compact' },
                    { val: 30, label: 'Standard' },
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

          {/* Selected Items Tray */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <h3 className="text-xs font-medium text-white uppercase tracking-wider font-mono">
                  Document Sequence ({images.length} pages)
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  {formatBytes(totalSize)} total source weight
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSortAZ}
                  className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-surface-100 border border-border flex items-center gap-1.5 transition cursor-pointer"
                  title="Sort naturally by file name (1.jpg, 2.jpg, 10.jpg)"
                >
                  <ArrowDownAZ className="w-3.5 h-3.5" />
                  <span>Sort A-Z</span>
                </button>

                <button
                  onClick={handleClearAll}
                  className="text-xs text-zinc-400 hover:text-rose-400 px-2 py-1 transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {images.map((item, index) => (
                <div
                  key={item.id}
                  className="relative group p-2 rounded-lg bg-surface-100 border border-border text-xs flex flex-col justify-between"
                >
                  <div className="aspect-[3/4] rounded bg-black/40 overflow-hidden mb-1.5 flex items-center justify-center relative">
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                    <span className="absolute top-1 left-1 w-5 h-5 rounded bg-black/70 text-white font-mono text-[10px] flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>

                  <p className="font-medium text-white truncate text-[11px] mb-0.5">{item.name}</p>
                  <p className="text-[10px] font-mono text-zinc-500 mb-2">{formatBytes(item.size)}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 rounded bg-surface-50 text-zinc-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                        title="Move page earlier"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={index === images.length - 1}
                        className="p-1 rounded bg-surface-50 text-zinc-400 hover:text-white disabled:opacity-20 transition cursor-pointer"
                        title="Move page later"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-surface-50 transition cursor-pointer"
                      title="Remove image"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleConvert}
            disabled={isProcessing || images.length === 0}
            className="w-full py-3 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progressMsg || 'Processing in RAM...'}</span>
              </>
            ) : (
              <span>Compile {images.length} Images to PDF ({scanFilter.toUpperCase()})</span>
            )}
          </button>
        </div>
      )}

      {/* Result Modal */}
      {resultBytes && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(resultBytes, resultFilename)}
          onReset={handleReset}
          title="Scanned PDF generated successfully"
          filename={resultFilename}
          fileSize={resultBytes.byteLength}
          stats={[
            { label: 'Pages compiled', value: images.length },
            { label: 'Scan Filter', value: scanFilter.toUpperCase() },
            { label: 'Paper format', value: pageSize },
          ]}
          downloadLabel="Download Scanned PDF"
        />
      )}
    </div>
  );
}

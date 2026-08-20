import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, downloadUint8Array, formatBytes, getTimestampString } from '@/lib/utils';
import {
  batchConvertPngToJpg,
  ConvertedImageItem,
  imagesToPdf,
} from '@/lib/image-engine';
import {
  Image as ImageIcon,
  Sliders,
  Palette,
  Trash2,
  Loader2,
  FileArchive,
  FileText,
  Download,
} from 'lucide-react';
import { naturalSortFiles } from '@/lib/folder-scanner';

interface InputFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export function PngToJpgView() {
  const [selectedFiles, setSelectedFiles] = useState<InputFileItem[]>([]);
  const [quality, setQuality] = useState<number>(90);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [convertedItems, setConvertedItems] = useState<ConvertedImageItem[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Uint8Array | null>(null);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    const sorted = naturalSortFiles(files);
    const mapped: InputFileItem[] = sorted.map((f) => ({
      id: `png-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      name: f.name,
      size: f.size,
      previewUrl: URL.createObjectURL(f),
    }));
    setSelectedFiles((prev) => [...prev, ...mapped]);
    setConvertedItems([]);
    setZipBlob(null);
    setPdfBlob(null);
  };

  const handleRemove = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setConvertedItems([]);
    setZipBlob(null);
    setPdfBlob(null);
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setProgressText('Converting PNG to JPG...');

    try {
      const { items, zipBlob: generatedZip } = await batchConvertPngToJpg(
        selectedFiles.map((s) => s.file),
        {
          quality,
          backgroundColor,
          onProgress: (current, total) => {
            setProgressText(`Processing ${current} of ${total}...`);
          },
        }
      );

      setConvertedItems(items);
      if (generatedZip) {
        setZipBlob(generatedZip);
      }
      setShowResultModal(true);
    } catch (err) {
      alert(`Failed to convert image: ${err}`);
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  const totalOriginalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const totalConvertedSize = convertedItems.reduce((acc, f) => acc + f.convertedSize, 0);

  const handleReset = () => {
    setSelectedFiles([]);
    setConvertedItems([]);
    setZipBlob(null);
    setPdfBlob(null);
  };

  const handleDownloadAll = () => {
    if (convertedItems.length === 1) {
      downloadBlob(convertedItems[0].blob, convertedItems[0].targetName);
    } else if (zipBlob) {
      downloadBlob(zipBlob, `converted_jpg_${getTimestampString()}.zip`);
    }
  };

  const handleDownloadCombinedPdf = async () => {
    if (convertedItems.length === 0) return;
    setIsCompilingPdf(true);

    try {
      const jpgFiles = convertedItems.map(
        (c) => new File([c.blob], c.targetName, { type: 'image/jpeg' })
      );
      const pdfBytes = await imagesToPdf(jpgFiles, {
        pageSize: 'A4',
        margin: 0,
        orientation: 'auto',
      });
      const filename = `converted_images_${convertedItems.length}p_${getTimestampString()}.pdf`;
      downloadUint8Array(pdfBytes, filename);
    } catch (err) {
      alert(`Failed to compile PDF: ${err}`);
    } finally {
      setIsCompilingPdf(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>MODULE / PNG TO JPG</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">PNG to JPG Converter</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Transform PNG images to JPEG format with custom background fill for transparent channels.
        </p>
      </div>

      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept="image/png"
        title="Select or drop PNG images"
        subtitle="Batch conversion with alpha channel background replacement"
      />

      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          {/* Settings Card */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <h3 className="text-xs font-semibold text-white">Compression & Transparency</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quality Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>JPEG Quality</span>
                  <span className="font-mono text-zinc-200">{quality}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-surface-100 rounded-lg appearance-none cursor-pointer accent-zinc-100"
                />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>50% (Compact)</span>
                  <span>90% (Recommended)</span>
                  <span>100% (Lossless)</span>
                </div>
              </div>

              {/* Background Color Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Palette className="w-3 h-3" />
                  <span>Alpha Fill Color</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: 'White', color: '#ffffff' },
                      { label: 'Black', color: '#000000' },
                      { label: 'Red', color: '#dc2626' },
                      { label: 'Blue', color: '#2563eb' },
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setBackgroundColor(preset.color)}
                        title={preset.label}
                        className={`w-6 h-6 rounded-md border transition cursor-pointer ${
                          backgroundColor === preset.color
                            ? 'border-white scale-110 shadow-sm'
                            : 'border-border opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: preset.color }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 bg-surface-100 px-2 py-1 rounded-md border border-border flex-1">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="font-mono text-xs text-zinc-300">{backgroundColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Files Tray */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Queued Images ({selectedFiles.length})
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 font-mono">{formatBytes(totalOriginalSize)}</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {selectedFiles.map((item, index) => (
                <div
                  key={item.id}
                  className="p-2 rounded-lg bg-surface-100 border border-border flex flex-col justify-between gap-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-400">#{index + 1}</span>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-0.5 rounded text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="w-full h-24 bg-surface-300 rounded overflow-hidden flex items-center justify-center border border-border/60">
                    <img src={item.previewUrl} alt={item.name} className="max-w-full max-h-full object-contain" />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono text-zinc-400">
                    <span className="truncate max-w-[90px]">{item.name}</span>
                    <span>{formatBytes(item.size)}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleConvert}
              disabled={isProcessing || selectedFiles.length === 0}
              className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle mt-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{progressText || 'Converting...'}</span>
                </>
              ) : (
                <span>Convert {selectedFiles.length} Images to JPG</span>
              )}
            </button>
          </div>

          {/* Converted Gallery & Export Choices (for Multi-File) */}
          {convertedItems.length > 1 && (
            <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                <div>
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Converted JPG Images ({convertedItems.length})
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Choose export format: Archive (.ZIP) or single combined PDF document
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadAll}
                    className="px-3 py-1.5 btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-subtle"
                  >
                    <FileArchive className="w-3.5 h-3.5" />
                    <span>Download All (ZIP)</span>
                  </button>

                  <button
                    onClick={handleDownloadCombinedPdf}
                    disabled={isCompilingPdf}
                    className="px-3 py-1.5 rounded-lg bg-surface-100 border border-border hover:border-zinc-400 text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-subtle"
                  >
                    {isCompilingPdf ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    <span>Combine as PDF</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {convertedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-surface-100 border border-border flex flex-col justify-between space-y-2 text-xs"
                  >
                    <div className="w-full h-20 bg-surface-300 rounded overflow-hidden flex items-center justify-center border border-border/60">
                      <img src={item.dataUrl} alt={item.targetName} className="max-w-full max-h-full object-contain" />
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-zinc-300 truncate" title={item.targetName}>
                        {item.targetName}
                      </p>
                      <button
                        onClick={() => downloadBlob(item.blob, item.targetName)}
                        className="w-full py-1 px-2 rounded bg-surface-50 border border-border hover:border-zinc-400 text-zinc-200 hover:text-white text-[10px] font-medium flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download JPG</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Modal */}
      {convertedItems.length > 0 && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={handleDownloadAll}
          onReset={handleReset}
          title={convertedItems.length === 1 ? 'JPG ready for download' : 'Images converted successfully'}
          filename={
            convertedItems.length === 1
              ? convertedItems[0].targetName
              : `converted_jpg_${getTimestampString()}.zip`
          }
          fileSize={
            convertedItems.length === 1
              ? convertedItems[0].convertedSize
              : zipBlob?.size
          }
          stats={[
            { label: 'Images processed', value: `${convertedItems.length} files` },
            {
              label: 'Output format',
              value: convertedItems.length === 1 ? 'Direct JPG (.jpg)' : 'Archive (.ZIP) / PDF',
            },
            { label: 'Quality', value: `${quality}%` },
            {
              label: 'Total output size',
              value: formatBytes(
                convertedItems.length === 1
                  ? convertedItems[0].convertedSize
                  : totalConvertedSize
              ),
            },
          ]}
          downloadLabel={
            convertedItems.length === 1
              ? 'Download JPG File'
              : 'Download All as ZIP'
          }
        />
      )}
    </div>
  );
}

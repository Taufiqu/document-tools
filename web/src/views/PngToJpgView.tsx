import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { downloadBlob, formatBytes } from '@/lib/utils';
import {
  batchConvertPngToJpg,
  ConvertedImageItem,
} from '@/lib/image-engine';
import {
  Image as ImageIcon,
  Loader2,
  Sliders,
  Trash2,
  Palette,
} from 'lucide-react';

interface SelectedPngItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

export function PngToJpgView() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedPngItem[]>([]);
  const [quality, setQuality] = useState<number>(92);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

  const [convertedItems, setConvertedItems] = useState<ConvertedImageItem[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    const pngOnly = files.filter(
      (f) => f.type === 'image/png' || f.name.toLowerCase().endsWith('.png')
    );

    if (pngOnly.length === 0) {
      alert('Please select valid PNG image files.');
      return;
    }

    const newItems: SelectedPngItem[] = pngOnly.map((file) => ({
      id: `png-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }));

    setSelectedFiles((prev) => [...prev, ...newItems]);
    setConvertedItems([]);
    setZipBlob(null);
  };

  const handleRemove = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setConvertedItems([]);
    setZipBlob(null);
  };

  const handleConvert = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setProgressText('Converting PNG to JPEG...');

    try {
      const { items, zipBlob: generatedZip } = await batchConvertPngToJpg(
        selectedFiles.map((item) => item.file),
        { quality, backgroundColor: bgColor }
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
  };

  const handleDownloadAll = () => {
    if (convertedItems.length === 1) {
      downloadBlob(convertedItems[0].blob, convertedItems[0].targetName);
    } else if (zipBlob) {
      downloadBlob(zipBlob, `converted_jpg_${Date.now()}.zip`);
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Quality Slider */}
              <div className="p-3 rounded-lg bg-surface-100 border border-border space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>JPEG Quality</span>
                  <span className="font-mono text-zinc-200">{quality}%</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={1}
                  value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full accent-zinc-200 cursor-pointer"
                />
              </div>

              {/* Background Color */}
              <div className="p-3 rounded-lg bg-surface-100 border border-border space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3 h-3 text-zinc-400" />
                    <span>Alpha Background Fill</span>
                  </span>
                  <span className="font-mono text-zinc-300 text-[10px]">{bgColor.toUpperCase()}</span>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  {[
                    { label: 'White', color: '#ffffff' },
                    { label: 'Black', color: '#000000' },
                    { label: 'Gray', color: '#f3f4f6' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setBgColor(c.color)}
                      className={`px-2 py-0.5 rounded text-xs border flex items-center gap-1.5 transition cursor-pointer ${
                        bgColor === c.color
                          ? 'bg-zinc-800 border-zinc-500 text-white'
                          : 'bg-surface-50 border-border text-zinc-400'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-border inline-block"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-[11px]">{c.label}</span>
                    </button>
                  ))}

                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 ml-auto"
                    title="Custom color"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Selected File Grid List */}
          <div className="p-4 rounded-xl bg-surface-200 border border-border space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-mono uppercase text-zinc-400">
                Selected Images ({selectedFiles.length} • {formatBytes(totalOriginalSize)})
              </h3>
              <button
                onClick={handleClearAll}
                className="text-xs text-zinc-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
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
        </div>
      )}

      {/* Result Modal */}
      {convertedItems.length > 0 && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={handleDownloadAll}
          onReset={handleReset}
          title="Conversion complete"
          filename={
            convertedItems.length === 1
              ? convertedItems[0].targetName
              : `converted_jpg_${Date.now()}.zip`
          }
          fileSize={
            convertedItems.length === 1
              ? convertedItems[0].convertedSize
              : zipBlob?.size
          }
          stats={[
            { label: 'Images processed', value: `${convertedItems.length} files` },
            { label: 'Target format', value: 'JPG (JPEG)' },
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
              : 'Download All (.ZIP)'
          }
        />
      )}
    </div>
  );
}

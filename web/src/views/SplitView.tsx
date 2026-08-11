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
import { Scissors, FileStack, Layers, BookmarkCheck, Loader2, Sparkles } from 'lucide-react';

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
      alert(`Gagal membaca file PDF: ${err}`);
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
          alert('Masukkan setidaknya satu rentang halaman (contoh: 1-3, 4-5).');
          setIsSplitting(false);
          return;
        }
        const zipBlob = await splitPdfByRanges(rawPdfBytes, ranges, baseName);
        setResultBlob(zipBlob);
        setResultFilename(`${baseName}_split_ranges.zip`);
      } else if (splitMode === 'extract') {
        const pagesToExtract = extractInput
          .split(',')
          .map((p) => parseInt(p.trim()))
          .filter((p) => !isNaN(p));

        if (pagesToExtract.length === 0) {
          alert('Masukkan nomor halaman yang valid (contoh: 1, 3, 5).');
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
      alert(`Gagal memecah PDF: ${err}`);
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
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <Scissors className="w-4 h-4" />
          <span>Document Precision Tool</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">PDF Splitter</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Pecah dokumen PDF menjadi halaman satuan (.zip), pisahkan berdasarkan rentang khusus, atau ekstrak halaman tertentu.
        </p>
      </div>

      {!selectedFile ? (
        <Dropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="application/pdf"
          title="Tarik File PDF ke Sini"
          subtitle="Pilih satu file PDF yang ingin dipecah halamannya"
        />
      ) : (
        <div className="space-y-6">
          {/* File summary */}
          <div className="p-4 rounded-2xl bg-surface-100 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white max-w-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">
                  {pageCount} Halaman • {formatBytes(selectedFile.size)}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-slate-700 transition cursor-pointer"
            >
              Ganti File
            </button>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'single',
                title: 'Semua Halaman Terpisah',
                desc: 'Tiap 1 halaman menjadi 1 PDF (.zip)',
                icon: FileStack,
              },
              {
                id: 'ranges',
                title: 'Bagi Menurut Rentang',
                desc: 'Contoh: 1-3, 4-6 menjadi file terpisah (.zip)',
                icon: Layers,
              },
              {
                id: 'extract',
                title: 'Ekstrak Halaman Tertentu',
                desc: 'Ambil halaman tertentu (contoh: 1, 4, 7)',
                icon: BookmarkCheck,
              },
            ].map((mode) => {
              const Icon = mode.icon;
              const isSelected = splitMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSplitMode(mode.id as SplitMode)}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-glow-emerald'
                      : 'bg-surface-100 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-white">{mode.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{mode.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Mode Form Options */}
          <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-4">
            {splitMode === 'single' && (
              <div className="text-xs text-slate-300">
                Semua <strong>{pageCount}</strong> halaman akan diekspor menjadi <strong>{pageCount}</strong> file PDF individual dan dikemas dalam satu file ZIP yang rapi.
              </div>
            )}

            {splitMode === 'ranges' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white block">
                  Tentukan Rentang Halaman (Pisahkan dengan tanda koma)
                </label>
                <input
                  type="text"
                  value={rangesInput}
                  onChange={(e) => setRangesInput(e.target.value)}
                  placeholder="Contoh: 1-3, 4-6, 7-10"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-200 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400">Total halaman dokumen ini: 1 sampai {pageCount}.</p>
              </div>
            )}

            {splitMode === 'extract' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-white block">
                  Nomor Halaman yang Ingin Diambil (Pisahkan dengan tanda koma)
                </label>
                <input
                  type="text"
                  value={extractInput}
                  onChange={(e) => setExtractInput(e.target.value)}
                  placeholder="Contoh: 1, 3, 5, 8"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-200 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400">
                  Halaman yang diekstrak akan digabungkan menjadi 1 file PDF baru.
                </p>
              </div>
            )}

            <button
              onClick={handleSplit}
              disabled={isSplitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-90 text-white font-bold text-sm transition shadow-glow-emerald disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSplitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memecah PDF di RAM...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Proses & Pecah PDF Sekarang</span>
                </>
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
          title="PDF Berhasil Dipecah!"
          filename={resultFilename}
          fileSize={resultBlob.size}
          stats={[
            { label: 'Mode Pemisahan', value: splitMode.toUpperCase() },
            { label: 'Halaman Asli', value: pageCount },
          ]}
          downloadLabel="Unduh File Hasil"
        />
      )}
    </div>
  );
}

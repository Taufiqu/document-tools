import React, { useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultModal } from '@/components/ResultModal';
import { fileToUint8Array, downloadUint8Array, formatBytes } from '@/lib/utils';
import { mergePdfs, getPdfPageCount, TargetPaperSize } from '@/lib/pdf-engine';
import { Layers, ArrowUp, ArrowDown, Trash2, Loader2, Sparkles, Sliders } from 'lucide-react';

interface MergeFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  data: Uint8Array;
  pageCount: number;
}

export function MergeView() {
  const [items, setItems] = useState<MergeFileItem[]>([]);
  const [paperSize, setPaperSize] = useState<TargetPaperSize>('a4');
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [margin, setMargin] = useState<number>(15);

  const [isMerging, setIsMerging] = useState(false);
  const [mergedResult, setMergedResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleFilesSelected = async (files: File[]) => {
    const newItems: MergeFileItem[] = [];

    for (const file of files) {
      try {
        const bytes = await fileToUint8Array(file);
        const pageCount = await getPdfPageCount(bytes);
        newItems.push({
          id: `merge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          data: bytes,
          pageCount,
        });
      } catch (err) {
        console.warn(`Could not parse ${file.name}:`, err);
      }
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearAll = () => {
    setItems([]);
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      alert('Pilih setidaknya 2 file PDF untuk digabungkan.');
      return;
    }

    setIsMerging(true);
    try {
      const mergedBytes = await mergePdfs(
        items.map((i) => ({ data: i.data, name: i.name })),
        { paperSize, orientation, margin }
      );
      const filename = `merged_document_${paperSize.toUpperCase()}_${Date.now()}.pdf`;
      setMergedResult({ bytes: mergedBytes, filename });
      setShowResultModal(true);
    } catch (err) {
      alert(`Gagal menggabungkan PDF: ${err}`);
    } finally {
      setIsMerging(false);
    }
  };

  const totalPages = items.reduce((acc, i) => acc + i.pageCount, 0);
  const totalInputSize = items.reduce((acc, i) => acc + i.size, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-1">
          <Layers className="w-4 h-4" />
          <span>Core Document Tool</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">PDF Merger</h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Gabungkan beberapa file PDF secara aman 100% di browser tanpa batas ukuran atau upload server. Dilengkapi standarisasi skala otomatis.
        </p>
      </div>

      <Dropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        accept="application/pdf"
        title="Tarik & Lepas File-File PDF ke Sini"
        subtitle="Pilih beberapa file sekaligus untuk digabungkan menjadi 1 dokumen"
      />

      {/* Selected Items Reorder List */}
      {items.length > 0 && (
        <div className="p-6 rounded-2xl bg-surface-100 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Urutan File yang Digabungkan</h3>
              <p className="text-xs text-slate-400">
                {items.length} file • Total {totalPages} halaman ({formatBytes(totalInputSize)})
              </p>
            </div>

            <button
              onClick={handleClearAll}
              className="text-xs text-rose-400 hover:text-rose-300 transition flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua</span>
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-200 border border-slate-700/60 hover:border-indigo-500/40 transition text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  <div className="truncate">
                    <p className="font-semibold text-white truncate max-w-sm sm:max-w-md">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.pageCount} halaman • {formatBytes(item.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg bg-surface-100 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition cursor-pointer"
                    title="Pindahkan ke atas"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    className="p-1.5 rounded-lg bg-surface-100 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition cursor-pointer"
                    title="Pindahkan ke bawah"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                    title="Hapus file ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* CamScanner Style Standardization Settings */}
          <div className="p-5 rounded-2xl bg-surface-200/80 border border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Standarisasi Skala & Ukuran Kertas (CamScanner Style)
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Ukuran Seragam & Rapi
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Otomatis menyamakan semua halaman ke format kertas standar, menskalakan konten secara proporsional di tengah halaman (*fit & centered*), sehingga ukuran halaman tidak belang-belang.
            </p>

            {/* Paper Size Selector Grid */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-300">Pilih Ukuran Kertas Target:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'a4', label: 'A4 (Standar)', desc: '210 x 297 mm' },
                  { id: 'f4', label: 'F4 / Folio', desc: '215 x 330 mm' },
                  { id: 'letter', label: 'US Letter', desc: '8.5 x 11 in' },
                  { id: 'original', label: 'Ukuran Asli', desc: 'Tanpa Skala (Campuran)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPaperSize(s.id as TargetPaperSize)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      paperSize === s.id
                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-glow-primary'
                        : 'bg-surface-100 border-slate-700/70 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <p className="text-xs font-bold">{s.label}</p>
                    <p className="text-[10px] text-slate-400">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {paperSize !== 'original' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                {/* Orientation Mode */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300">Orientasi Halaman:</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-surface-100 p-1 rounded-xl border border-slate-700">
                    {[
                      { id: 'auto', label: 'Otomatis' },
                      { id: 'portrait', label: 'Portrait' },
                      { id: 'landscape', label: 'Landscape' },
                    ].map((ori) => (
                      <button
                        key={ori.id}
                        type="button"
                        onClick={() => setOrientation(ori.id as 'auto' | 'portrait' | 'landscape')}
                        className={`py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                          orientation === ori.id
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {ori.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Margin Setting */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300">Margin Pengaman:</span>
                  <div className="grid grid-cols-3 gap-1.5 bg-surface-100 p-1 rounded-xl border border-slate-700">
                    {[
                      { val: 5, label: 'Rapat (5pt)' },
                      { val: 15, label: 'Normal (15pt)' },
                      { val: 30, label: 'Luas (30pt)' },
                    ].map((m) => (
                      <button
                        key={m.val}
                        type="button"
                        onClick={() => setMargin(m.val)}
                        className={`py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                          margin === m.val
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleMerge}
            disabled={isMerging || items.length < 2}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-primary-600 to-accent-cyan hover:opacity-90 text-white font-bold text-sm transition shadow-glow-purple disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menggabungkan & Menstandarisasi Dokumen...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  Gabungkan {items.length} File PDF ({paperSize.toUpperCase()})
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Result Modal */}
      {mergedResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(mergedResult.bytes, mergedResult.filename)}
          onReset={() => {
            setItems([]);
            setMergedResult(null);
          }}
          title="PDF Berhasil Digabungkan!"
          filename={mergedResult.filename}
          fileSize={mergedResult.bytes.byteLength}
          stats={[
            { label: 'Total File Digabung', value: items.length },
            { label: 'Total Halaman', value: totalPages },
            { label: 'Standar Kertas', value: paperSize.toUpperCase() },
            {
              label: 'Skala & Fit',
              value: paperSize === 'original' ? 'As-Is' : 'Proporsional (Centered)',
            },
          ]}
          downloadLabel="Unduh File PDF Gabungan"
        />
      )}
    </div>
  );
}

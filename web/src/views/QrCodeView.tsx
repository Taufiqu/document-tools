import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { BrowserQRCodeReader } from '@zxing/browser';
import {
  Camera,
  Check,
  Clipboard,
  Download,
  Image as ImageIcon,
  Link as LinkIcon,
  QrCode,
  ScanLine,
  Square,
  Upload,
} from 'lucide-react';
import { downloadBlob } from '../lib/utils';

type Tab = 'generate' | 'decode';
type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

const DEFAULT_TEXT = 'https://toolsdoc.vercel.app';

export function QrCodeView() {
  const [activeTab, setActiveTab] = useState<Tab>('generate');
  const [text, setText] = useState(DEFAULT_TEXT);
  const [size, setSize] = useState(768);
  const [errorCorrection, setErrorCorrection] = useState<ErrorCorrection>('M');
  const [foreground, setForeground] = useState('#18181b');
  const [background, setBackground] = useState('#ffffff');
  const [pngDataUrl, setPngDataUrl] = useState('');
  const [svgMarkup, setSvgMarkup] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [decodeResult, setDecodeResult] = useState('');
  const [decodeError, setDecodeError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scanControlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let isCurrent = true;

    const generate = async () => {
      if (!text.trim()) {
        setPngDataUrl('');
        setSvgMarkup('');
        setGenerationError('Masukkan teks atau URL untuk membuat QR code.');
        return;
      }

      try {
        const options = {
          errorCorrectionLevel: errorCorrection,
          width: size,
          margin: 2,
          color: { dark: foreground, light: background },
        };
        const [dataUrl, svg] = await Promise.all([
          QRCode.toDataURL(text, options),
          QRCode.toString(text, { ...options, type: 'svg' }),
        ]);

        if (isCurrent) {
          setPngDataUrl(dataUrl);
          setSvgMarkup(svg);
          setGenerationError('');
        }
      } catch {
        if (isCurrent) setGenerationError('QR code tidak bisa dibuat dari input ini.');
      }
    };

    void generate();
    return () => {
      isCurrent = false;
    };
  }, [text, size, errorCorrection, foreground, background]);

  useEffect(() => () => stopScanner(), []);

  const stopScanner = () => {
    scanControlsRef.current?.stop();
    scanControlsRef.current = null;
    setIsScanning(false);
  };

  const startScanner = async () => {
    if (!videoRef.current) return;

    setDecodeError('');
    setDecodeResult('');
    stopScanner();

    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result) => {
          if (result) {
            setDecodeResult(result.getText());
            setDecodeError('');
            controls.stop();
            scanControlsRef.current = null;
            setIsScanning(false);
          }
        },
      );
      scanControlsRef.current = controls;
      setIsScanning(true);
    } catch {
      setDecodeError('Kamera tidak dapat diakses. Izinkan akses kamera, lalu coba lagi lewat HTTPS atau localhost.');
    }
  };

  const decodeImage = async (file: File) => {
    setIsDecoding(true);
    setDecodeError('');
    setDecodeResult('');
    stopScanner();

    const url = URL.createObjectURL(file);
    try {
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromImageUrl(url);
      setDecodeResult(result.getText());
    } catch {
      setDecodeError('QR code tidak ditemukan. Gunakan gambar yang lebih tajam atau coba scan dari kamera.');
    } finally {
      URL.revokeObjectURL(url);
      setIsDecoding(false);
    }
  };

  const copyResult = async () => {
    if (!decodeResult) return;
    await navigator.clipboard.writeText(decodeResult);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1800);
  };

  const downloadPng = () => {
    if (!pngDataUrl) return;
    const link = document.createElement('a');
    link.href = pngDataUrl;
    link.download = 'docucraft-qr-code.png';
    link.click();
  };

  const downloadSvg = () => {
    if (!svgMarkup) return;
    downloadBlob(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }), 'docucraft-qr-code.svg');
  };

  const isUrl = /^https?:\/\//i.test(decodeResult);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
          <span>WEB ASSETS</span><span>/</span><span>QR STUDIO</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">QR Code Studio</h1>
        <p className="max-w-2xl text-sm text-zinc-400 leading-relaxed">
          Generate QR code, decode gambar, atau scan langsung dari kamera. Semua diproses lokal di perangkatmu.
        </p>
      </section>

      <div className="inline-flex rounded-lg border border-border bg-surface-100 p-1">
        {[
          { id: 'generate' as const, label: 'Generate', icon: QrCode },
          { id: 'decode' as const, label: 'Decode & Scan', icon: ScanLine },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'decode') stopScanner();
              }}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition ${
                activeTab === tab.id ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'generate' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className="studio-card p-5 sm:p-6 space-y-5">
            <div>
              <label htmlFor="qr-content" className="block text-sm font-medium text-white mb-2">Content</label>
              <textarea
                id="qr-content"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={6}
                placeholder="URL, teks, WiFi config, atau data lainnya..."
                className="w-full resize-y rounded-lg border border-border bg-surface-100 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
              />
              <p className="mt-2 text-[11px] text-zinc-500">QR statis — data tidak disimpan atau dikirim ke server.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-xs text-zinc-300">
                <span>Ukuran output: {size}px</span>
                <input type="range" min="256" max="2048" step="64" value={size} onChange={(event) => setSize(Number(event.target.value))} className="w-full accent-zinc-100" />
              </label>
              <label className="space-y-2 text-xs text-zinc-300">
                <span>Error correction</span>
                <select value={errorCorrection} onChange={(event) => setErrorCorrection(event.target.value as ErrorCorrection)} className="w-full rounded-md border border-border bg-surface-100 px-3 py-2 text-sm text-zinc-100 outline-none">
                  <option value="L">Low (7%)</option><option value="M">Medium (15%)</option><option value="Q">Quartile (25%)</option><option value="H">High (30%)</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border bg-surface-100 px-3 py-2 text-xs text-zinc-300">
                Foreground <input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-border bg-surface-100 px-3 py-2 text-xs text-zinc-300">
                Background <input type="color" value={background} onChange={(event) => setBackground(event.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" />
              </label>
            </div>
          </section>

          <aside className="studio-card p-5 sm:p-6 flex flex-col items-center justify-center gap-4">
            {pngDataUrl ? <img src={pngDataUrl} alt="Generated QR code" className="w-full max-w-[280px] rounded-lg bg-white p-3 image-rendering-pixelated" /> : <div className="aspect-square w-full max-w-[280px] rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-zinc-500">Preview unavailable</div>}
            {generationError && <p className="text-center text-xs text-red-400">{generationError}</p>}
            <div className="grid w-full grid-cols-2 gap-2">
              <button onClick={downloadPng} disabled={!pngDataUrl} className="btn-primary flex items-center justify-center gap-2 py-2 text-xs disabled:opacity-50"><Download className="w-3.5 h-3.5" />PNG</button>
              <button onClick={downloadSvg} disabled={!svgMarkup} className="btn-secondary flex items-center justify-center gap-2 py-2 text-xs disabled:opacity-50"><Download className="w-3.5 h-3.5" />SVG</button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="studio-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Scan dari kamera</h2><p className="mt-1 text-xs text-zinc-500">Arahkan kamera ke QR code.</p></div><Camera className="w-5 h-5 text-zinc-400" /></div>
            <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black"><video ref={videoRef} className="h-full w-full object-cover" muted playsInline /><div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/75 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" /></div>
            <button onClick={isScanning ? stopScanner : startScanner} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-xs">{isScanning ? <><Square className="w-3.5 h-3.5" />Stop camera</> : <><Camera className="w-3.5 h-3.5" />Start camera</>}</button>
          </section>

          <section className="studio-card p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-white">Decode dari gambar</h2><p className="mt-1 text-xs text-zinc-500">Upload PNG, JPG, atau WebP yang berisi QR code.</p></div><ImageIcon className="w-5 h-5 text-zinc-400" /></div>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-100 px-4 text-center transition hover:border-zinc-500"><Upload className="w-5 h-5 text-zinc-400" /><span className="text-xs font-medium text-zinc-300">{isDecoding ? 'Membaca QR code...' : 'Pilih gambar QR code'}</span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={isDecoding} onChange={(event) => { const file = event.target.files?.[0]; if (file) void decodeImage(file); event.target.value = ''; }} /></label>
            {decodeError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">{decodeError}</p>}
            {decodeResult && <div className="space-y-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3.5"><div className="flex items-center gap-2 text-xs font-medium text-emerald-300"><Check className="w-3.5 h-3.5" />QR code ditemukan</div><p className="break-words rounded-md bg-black/20 p-2.5 font-mono text-xs text-zinc-100">{decodeResult}</p><div className="flex gap-2"><button onClick={() => void copyResult()} className="btn-secondary flex flex-1 items-center justify-center gap-2 py-2 text-xs"><Clipboard className="w-3.5 h-3.5" />{isCopied ? 'Copied' : 'Copy'}</button>{isUrl && <a href={decodeResult} target="_blank" rel="noreferrer" className="btn-primary flex flex-1 items-center justify-center gap-2 py-2 text-xs"><LinkIcon className="w-3.5 h-3.5" />Open URL</a>}</div></div>}
          </section>
        </div>
      )}
    </div>
  );
}

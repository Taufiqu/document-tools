import React from 'react';
import {
  Layers,
  Scissors,
  FileText,
  Shield,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Cpu,
  Download,
  Minimize2,
} from 'lucide-react';

interface OverviewViewProps {
  onSelectTool: (toolId: string) => void;
}

export function OverviewView({ onSelectTool }: OverviewViewProps) {
  const tools = [
    {
      id: 'organizer',
      title: 'Visual PDF Organizer',
      description: 'Pratinjau thumbnail visual tiap halaman, putar sudut 90°, hapus, atau atur ulang urutan halaman.',
      icon: FileText,
      badge: 'Featured',
      color: 'from-blue-600 to-cyan-500',
      shadow: 'shadow-glow-primary',
    },
    {
      id: 'merge',
      title: 'PDF Merger (CamScanner Style)',
      description: 'Gabungkan beberapa PDF menjadi satu dengan standarisasi ukuran & skala kertas otomatis (A4/F4).',
      icon: Layers,
      badge: 'CamScanner Scale',
      color: 'from-indigo-600 to-purple-600',
      shadow: 'shadow-glow-purple',
    },
    {
      id: 'split',
      title: 'PDF Splitter',
      description: 'Pecah PDF menjadi halaman satuan (.zip) atau ekstrak rentang halaman tertentu (misal 1-3, 4-6).',
      icon: Scissors,
      badge: 'Fast',
      color: 'from-emerald-600 to-teal-500',
      shadow: 'shadow-glow-emerald',
    },
    {
      id: 'watermark',
      title: 'PDF Watermark',
      description: 'Tambahkan teks watermark diagonal transparan dengan kontrol sudut, opacity, dan ukuran font.',
      icon: Shield,
      badge: 'Security',
      color: 'from-amber-600 to-orange-500',
      shadow: 'shadow-glow-primary',
    },
    {
      id: 'png-to-jpg',
      title: 'PNG to JPG Converter',
      description: 'Ubah gambar PNG ke format JPG berkualitas tinggi dengan penanganan latar transparan secara instan.',
      icon: ImageIcon,
      badge: 'New Tool',
      color: 'from-pink-600 to-rose-500',
      shadow: 'shadow-glow-primary',
    },
    {
      id: 'pdf-to-image',
      title: 'PDF to Images',
      description: 'Ekspor setiap halaman PDF menjadi gambar resolusi tinggi (PNG, JPG, WebP) dalam 1-klik.',
      icon: ImageIcon,
      badge: 'HD Render',
      color: 'from-cyan-600 to-blue-500',
      shadow: 'shadow-glow-cyan',
    },
    {
      id: 'image-to-pdf',
      title: 'Images to PDF',
      description: 'Satukan banyak gambar (PNG, JPG, WebP) ke dalam satu PDF rapi dengan margin kustom.',
      icon: Download,
      badge: 'Multi-Format',
      color: 'from-purple-600 to-pink-500',
      shadow: 'shadow-glow-purple',
    },
    {
      id: 'compress-image',
      title: 'Image Compressor',
      description: 'Kompres ukuran file gambar di browser dengan slider kualitas & perbandingan ukuran real-time.',
      icon: Minimize2,
      badge: 'Lossless & WebP',
      color: 'from-emerald-600 to-cyan-500',
      shadow: 'shadow-glow-emerald',
    },
    {
      id: 'favicon',
      title: 'Favicon & Web Pack',
      description: 'Buat file favicon.ico multi-resolusi dan paket web icon lengkap (Apple Touch, Android Chrome, HTML tags).',
      icon: Sparkles,
      badge: 'Dev Tool',
      color: 'from-rose-600 to-amber-500',
      shadow: 'shadow-glow-primary',
    },
  ];

  return (
    <div className="space-y-12 pb-12 animate-fade-in">
      {/* Hero Section */}
      <section className="relative pt-4 pb-2 text-center space-y-4 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/30 text-primary-300 text-xs font-semibold shadow-glow-primary">
          <Zap className="w-3.5 h-3.5 text-primary-400" />
          <span>Pure SPA Engine: Ultra-Fast & Ready for Desktop .exe</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Tools Dokumen Modern, Cepat, &{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-primary-400 to-accent-cyan">
            100% Privacy-First
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Semua manipulasi PDF, konversi, kompresi, dan pembuatan favicon diproses langsung di{' '}
          <strong className="text-white">memori lokal browser/komputer Anda</strong> tanpa ada file yang diunggah ke server.
        </p>

        {/* Feature Highlights Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 max-w-3xl mx-auto text-left">
          <div className="p-3 rounded-xl bg-surface-100/70 border border-slate-800 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-white leading-none">0 Bytes Uploaded</p>
              <p className="text-[10px] text-slate-400">100% Client-Side RAM</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-100/70 border border-slate-800 flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-primary-400 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-white leading-none">WebAssembly Engine</p>
              <p className="text-[10px] text-slate-400">Performa Cepat</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-100/70 border border-slate-800 flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-accent-cyan shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-white leading-none">Full Offline Mode</p>
              <p className="text-[10px] text-slate-400">Tanpa Internet</p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-100/70 border border-slate-800 flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-white leading-none">Pure SPA State</p>
              <p className="text-[10px] text-slate-400">Navigasi Instan 0ms</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Koleksi Alat Dokumen & Gambar</h2>
          <p className="text-xs text-slate-400">Pilih alat yang Anda butuhkan untuk memulai pemrosesan secara instan.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id)}
                className="group relative p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between text-left overflow-hidden cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${tool.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-200`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-primary-400 transition mb-1.5">
                    {tool.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {tool.description}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-primary-400 group-hover:text-primary-300 transition w-full">
                  <span>Buka Tool</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-150" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

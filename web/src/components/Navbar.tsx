import React, { useState } from 'react';
import {
  FileText,
  Layers,
  Scissors,
  Grid,
  Shield,
  Image as ImageIcon,
  Sparkles,
  Download,
  Minimize2,
  X,
  Laptop,
  Check,
} from 'lucide-react';
import { PrivacyBadge } from './PrivacyBadge';

interface NavbarProps {
  currentTool: string;
  onSelectTool: (toolId: string) => void;
}

export function Navbar({ currentTool, onSelectTool }: NavbarProps) {
  const [showDesktopModal, setShowDesktopModal] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Grid },
    { id: 'organizer', label: 'Visual Organizer', icon: FileText, highlight: true },
    { id: 'merge', label: 'Merge PDF', icon: Layers },
    { id: 'split', label: 'Split PDF', icon: Scissors },
    { id: 'watermark', label: 'Watermark', icon: Shield },
    { id: 'png-to-jpg', label: 'PNG to JPG', icon: ImageIcon, highlight: true },
    { id: 'pdf-to-image', label: 'PDF to Image', icon: ImageIcon },
    { id: 'image-to-pdf', label: 'Image to PDF', icon: Download },
    { id: 'compress-image', label: 'Compress Image', icon: Minimize2 },
    { id: 'favicon', label: 'Favicon Pack', icon: Sparkles },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => onSelectTool('overview')}
            className="flex items-center gap-3 group text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 via-indigo-500 to-accent-cyan flex items-center justify-center shadow-glow-primary group-hover:scale-105 transition-transform duration-200">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  DocuCraft
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary-500/20 text-primary-400 border border-primary-500/30">
                  Pure SPA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal leading-none hidden sm:block">
                Dual-Deployment Document & Image Studio
              </p>
            </div>
          </button>

          {/* Privacy & Desktop Buttons */}
          <div className="flex items-center gap-3">
            <PrivacyBadge />

            <button
              onClick={() => setShowDesktopModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-slate-700 hover:border-primary-500/50 hover:bg-surface-50 text-slate-300 hover:text-white transition text-xs font-medium cursor-pointer"
            >
              <Laptop className="w-3.5 h-3.5 text-primary-400" />
              <span className="hidden md:inline">Desktop App Info</span>
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Sub-bar with Instant 0ms SPA Switching */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/40 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTool(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-150 font-medium cursor-pointer ${
                  isActive
                    ? 'bg-primary-600/25 text-primary-300 border border-primary-500/50 shadow-glow-primary'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-100 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.highlight && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Desktop App & SmartScreen Mitigation Modal */}
      {showDesktopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl bg-surface-200 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-200 animate-slide-up">
            <button
              onClick={() => setShowDesktopModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary-600/20 border border-primary-500/30 text-primary-400">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Dual-Deployment & Desktop Standalone</h3>
                <p className="text-xs text-primary-400 font-medium">Solusi 100% Gratis Tanpa Unknown Publisher Warning</p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300 mb-6">
              <div className="p-3.5 rounded-xl bg-surface-100 border border-slate-800">
                <div className="flex items-center gap-2 font-semibold text-white mb-1">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Opsi 1: PWA Desktop App (1-Click Install — Paling Mudah & 0 Biaya)</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Pada browser Chrome/Edge di komputer Anda, klik ikon <strong>Install App</strong> pada bilah URL browser (atau menu titik tiga $\rightarrow$ <em>Install DocuCraft</em>).
                  Aplikasi akan langsung menjadi program desktop mandiri dengan jendela khusus tanpa peringatan SmartScreen sama sekali.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-100 border border-slate-800">
                <div className="flex items-center gap-2 font-semibold text-white mb-1">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Opsi 2: Self-Signed Local Certificate Script (Bypass Mandiri)</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Jika mengkompilasi file <code className="text-primary-300 bg-slate-800 px-1 py-0.5 rounded">.exe</code> via Tauri, jalankan script <code className="text-primary-300 bg-slate-800 px-1 py-0.5 rounded">scripts/trust-cert.ps1</code> sekali saja di Windows untuk mendaftarkan sertifikat lokal ke Trusted Root secara gratis.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-100 border border-slate-800">
                <div className="flex items-center gap-2 font-semibold text-white mb-1">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Opsi 3: Windows SmartScreen "Run Anyway"</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Saat membuka file executable mandiri pertama kali: Klik <strong>"More info"</strong> $\rightarrow$ Klik <strong>"Run anyway"</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowDesktopModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium text-xs transition shadow-glow-primary cursor-pointer"
            >
              Tutup Panduan
            </button>
          </div>
        </div>
      )}
    </>
  );
}

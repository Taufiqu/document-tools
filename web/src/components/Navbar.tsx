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
  Minimize,
  X,
  Laptop,
  Check,
  Hash,
  Printer,
  Camera,
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
    { id: 'organizer', label: 'Organizer', icon: FileText },
    { id: 'merge', label: 'Merge', icon: Layers },
    { id: 'split', label: 'Split', icon: Scissors },
    { id: 'compress-pdf', label: 'Compress PDF', icon: Minimize },
    { id: 'page-number', label: 'Page Numbers', icon: Hash },
    { id: 'grayscale', label: 'Grayscale B&W', icon: Printer },
    { id: 'watermark', label: 'Watermark', icon: Shield },
    { id: 'pas-foto', label: 'Pas Foto', icon: Camera },
    { id: 'png-to-jpg', label: 'PNG to JPG', icon: ImageIcon },
    { id: 'pdf-to-image', label: 'PDF to Images', icon: ImageIcon },
    { id: 'image-to-pdf', label: 'Images to PDF', icon: Download },
    { id: 'compress-image', label: 'Compress Image', icon: Minimize2 },
    { id: 'favicon', label: 'Favicon Pack', icon: Sparkles },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => onSelectTool('overview')}
            className="flex items-center gap-2.5 group text-left cursor-pointer"
          >
            <div className="w-7 h-7 rounded-md bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-xs">
              D
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm tracking-tight text-white">
                  DocuCraft
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  v1.2
                </span>
              </div>
            </div>
          </button>

          {/* Privacy & Desktop Buttons */}
          <div className="flex items-center gap-2">
            <PrivacyBadge />

            <button
              onClick={() => setShowDesktopModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-100 border border-border hover:border-border-strong text-zinc-400 hover:text-zinc-200 transition text-xs cursor-pointer"
            >
              <Laptop className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline text-[11px]">Desktop</span>
            </button>
          </div>
        </div>

        {/* Minimal Segmented Navigation Bar */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none border-t border-border/50 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTool(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap transition text-xs font-medium cursor-pointer ${
                  isActive
                    ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-subtle'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Desktop App Information Modal */}
      {showDesktopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-surface-200 border border-border rounded-xl p-6 shadow-elevated text-zinc-200">
            <button
              onClick={() => setShowDesktopModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-surface-100 border border-border text-zinc-100">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Desktop Deployment Guide</h3>
                <p className="text-xs text-zinc-400">Zero-cost standalone desktop options</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 mb-5">
              <div className="p-3 rounded-lg bg-surface-100 border border-border">
                <div className="flex items-center gap-2 font-medium text-white mb-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Option 1: PWA Desktop Install (1-Click)</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  In Chrome or Edge, click the <strong>Install</strong> icon in the address bar to run DocuCraft as a standalone desktop window without browser chrome or warning prompts.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-100 border border-border">
                <div className="flex items-center gap-2 font-medium text-white mb-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Option 2: Local Certificate Script (Tauri .exe)</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  If compiling to a native binary, run <code className="text-zinc-300 bg-surface-50 px-1 py-0.5 rounded font-mono text-[10px]">scripts/trust-cert.ps1</code> once to register your local certificate to Windows Trusted Root.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowDesktopModal(false)}
              className="w-full py-2 rounded-lg btn-secondary text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState } from 'react';
import {
  FileText,
  Layers,
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
  ChevronDown,
  QrCode,
  Languages,
  BookOpen,
  FileEdit,
} from 'lucide-react';
import { PrivacyBadge } from './PrivacyBadge';

interface NavbarProps {
  currentTool: string;
  onSelectTool: (toolId: string) => void;
}

export function Navbar({ currentTool, onSelectTool }: NavbarProps) {
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const toolGroups = [
    {
      id: 'pdf',
      label: 'PDF',
      icon: FileText,
      items: [
        { id: 'organizer', label: 'PDF Organizer', icon: FileText },
        { id: 'merge', label: 'Merge PDF', icon: Layers },
        { id: 'compress-pdf', label: 'Compress PDF', icon: Minimize },
        { id: 'page-number', label: 'Page Numbers', icon: Hash },
        { id: 'grayscale', label: 'Grayscale B&W', icon: Printer },
        { id: 'watermark', label: 'Watermark', icon: Shield },
      ],
    },
    {
      id: 'image',
      label: 'Foto & Gambar',
      icon: ImageIcon,
      items: [
        { id: 'scanner', label: 'Cam Scanner', icon: Camera },
        { id: 'pas-foto', label: 'Pas Foto', icon: Camera },
        { id: 'png-to-jpg', label: 'PNG to JPG', icon: ImageIcon },
        { id: 'compress-image', label: 'Compress Image', icon: Minimize2 },
      ],
    },
    {
      id: 'convert',
      label: 'Konversi',
      icon: Download,
      items: [
        { id: 'pdf-to-word', label: 'PDF to Word', icon: FileEdit },
        { id: 'pdf-to-image', label: 'PDF to Images', icon: ImageIcon },
        { id: 'image-to-pdf', label: 'Images to PDF', icon: Download },
        { id: 'translate', label: 'Translate Document', icon: Languages },
        { id: 'scribd', label: 'Scribd to PDF', icon: BookOpen },
      ],
    },
    {
      id: 'web',
      label: 'Web Assets',
      icon: Sparkles,
      items: [
        { id: 'favicon', label: 'Favicon Pack', icon: Sparkles },
        { id: 'qr-code', label: 'QR Studio', icon: QrCode },
      ],
    },
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

          {/* Privacy, Creator & Desktop Buttons */}
          <div className="flex items-center gap-2">
            <a
              href="https://taufiqu.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-100 border border-border hover:border-border-strong text-zinc-300 hover:text-white transition text-xs font-medium"
              title="Visit Taufiqu's Portfolio"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>by Taufiqu</span>
            </a>

            <a
              href="https://github.com/Taufiqu/document-tools"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-100 border border-border hover:border-border-strong text-zinc-400 hover:text-zinc-200 transition text-xs font-medium"
              title="View on GitHub"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="hidden sm:inline text-[11px]">GitHub</span>
            </a>

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

        {/* Tool navigation grouped by document type */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center gap-1 py-1.5 border-t border-border/50 text-xs">
          <button
            onClick={() => {
              setOpenGroup(null);
              onSelectTool('overview');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap transition text-xs font-medium cursor-pointer ${
              currentTool === 'overview'
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-subtle'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-100'
            }`}
          >
            <Grid className={`w-3.5 h-3.5 ${currentTool === 'overview' ? 'text-zinc-950' : 'text-zinc-500'}`} />
            <span>Overview</span>
          </button>

          {toolGroups.map((group) => {
            const Icon = group.icon;
            const isActive = group.items.some((item) => item.id === currentTool);
            const isOpen = openGroup === group.id;

            return (
              <div key={group.id} className="relative">
                <button
                  onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md whitespace-nowrap transition text-xs font-medium cursor-pointer ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-subtle'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-100'
                  }`}
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-950' : 'text-zinc-500'}`} />
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full mt-2 z-50 min-w-48 rounded-lg border border-border bg-surface-200 p-1.5 shadow-elevated"
                  >
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const itemIsActive = currentTool === item.id;
                      return (
                        <button
                          key={item.id}
                          role="menuitem"
                          onClick={() => {
                            setOpenGroup(null);
                            onSelectTool(item.id);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition ${
                            itemIsActive
                              ? 'bg-zinc-100 font-semibold text-zinc-950'
                              : 'text-zinc-300 hover:bg-surface-100 hover:text-white'
                          }`}
                        >
                          <ItemIcon className="w-3.5 h-3.5" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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

import React, { useState } from 'react';
import { Shield, X, Cpu, HardDrive, WifiOff } from 'lucide-react';

export function PrivacyBadge() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-100 border border-border hover:border-border-strong text-zinc-300 hover:text-white transition text-xs font-medium cursor-pointer"
        title="Privacy & processing architecture"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span className="text-[11px]">Local Processing</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-surface-200 border border-border rounded-xl p-6 shadow-elevated text-zinc-200">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-lg bg-surface-100 border border-border text-zinc-100">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Local Memory Architecture</h3>
                <p className="text-xs text-zinc-400">Zero server data transmission</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
              Every document manipulation (merging, splitting, page reordering, compression, formatting) executes entirely inside your browser's RAM via WebAssembly and Canvas.
            </p>

            <div className="space-y-2 mb-5 text-xs">
              <div className="p-3 rounded-lg bg-surface-100 border border-border/80 flex items-start gap-2.5">
                <Cpu className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Client-side execution</p>
                  <p className="text-zinc-400 text-[11px] mt-0.5">Files are read into memory and processed locally on your machine.</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-100 border border-border/80 flex items-start gap-2.5">
                <WifiOff className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Works offline</p>
                  <p className="text-zinc-400 text-[11px] mt-0.5">Once loaded, you can disconnect from the internet and continue working.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
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

'use client';

import React, { useState } from 'react';
import { ShieldCheck, Lock, Cpu, WifiOff, X, CheckCircle2 } from 'lucide-react';

export function PrivacyBadge() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all duration-200 text-xs font-medium cursor-pointer shadow-sm hover:shadow-glow-emerald"
        title="Click to view client-side privacy guarantee"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>100% Client-Side • Zero Server Upload</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-surface-200 border border-slate-700/60 rounded-2xl p-6 shadow-2xl text-slate-200 animate-slide-up">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Privacy-First Architecture</h3>
                <p className="text-xs text-emerald-400 font-medium">Zero-Server Data Guarantee</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-5 leading-relaxed">
              Semua operasi manipulasi dokumen (merge, split, kompresi, organizer, watermark) dieksekusi{' '}
              <strong className="text-white font-semibold">100% di memori (RAM) peramban Anda</strong> via WebAssembly & JavaScript murni.
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-slate-800">
                <Cpu className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-white">Local CPU & RAM Processing</span>
                  <p className="text-slate-400 mt-0.5">Dokumen Anda tidak pernah diunggah ke cloud atau server backend mana pun.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-slate-800">
                <WifiOff className="w-5 h-5 text-accent-cyan shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-white">Bekerja Sepenuhnya Offline</span>
                  <p className="text-slate-400 mt-0.5">Anda dapat mematikan koneksi internet setelah membuka web dan aplikasi tetap berfungsi normal.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-slate-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-white">Verifikasi Langsung</span>
                  <p className="text-slate-400 mt-0.5">Buka Developer Tools (F12) $\rightarrow$ Tab Network. Anda akan melihat 0 byte data berkas yang dikirimkan.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-medium text-sm transition shadow-glow-primary"
            >
              Mengerti & Lanjutkan
            </button>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Download, RefreshCw, X, Sparkles } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  onReset: () => void;
  title?: string;
  filename?: string;
  fileSize?: number;
  stats?: Array<{ label: string; value: string | number }>;
  downloadLabel?: string;
  children?: React.ReactNode;
}

export function ResultModal({
  isOpen,
  onClose,
  onDownload,
  onReset,
  title = 'Operation Completed Successfully!',
  filename,
  fileSize,
  stats = [],
  downloadLabel = 'Download Processed File',
  children,
}: ResultModalProps) {
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#06b6d4', '#a855f7'],
        });
      } catch (e) {
        // Confetti optional
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-surface-200 border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-200 animate-slide-up text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Glow Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-primary-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-glow-emerald">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-extrabold text-white tracking-tight mb-1">{title}</h3>
        <p className="text-xs text-slate-400 mb-5">
          Semua file diproses 100% di memori lokal peramban Anda.
        </p>

        {/* File information box */}
        {(filename || fileSize || stats.length > 0) && (
          <div className="p-4 rounded-xl bg-surface-100 border border-slate-800 mb-6 text-left space-y-2 text-xs">
            {filename && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">File Output:</span>
                <span className="font-semibold text-white font-mono truncate max-w-[200px]">{filename}</span>
              </div>
            )}
            {fileSize !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Ukuran:</span>
                <span className="font-semibold text-primary-300 font-mono">{formatBytes(fileSize)}</span>
              </div>
            )}
            {stats.map((s, i) => (
              <div key={i} className="flex justify-between items-center border-t border-slate-800/60 pt-1.5">
                <span className="text-slate-400">{s.label}:</span>
                <span className="font-semibold text-emerald-400 font-mono">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {children}

        {/* Buttons */}
        <div className="space-y-2">
          <button
            onClick={onDownload}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-bold text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-glow-primary cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{downloadLabel}</span>
          </button>

          <button
            onClick={() => {
              onReset();
              onClose();
            }}
            className="w-full py-2.5 rounded-xl bg-surface-100 hover:bg-surface-50 border border-slate-700/60 text-slate-300 font-medium text-xs transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Proses Dokumen Lain</span>
          </button>
        </div>
      </div>
    </div>
  );
}

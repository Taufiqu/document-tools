import React from 'react';
import { Check, Download, RefreshCw, X } from 'lucide-react';
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
  title = 'Processing complete',
  filename,
  fileSize,
  stats = [],
  downloadLabel = 'Download file',
  children,
}: ResultModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-surface-200 border border-border rounded-xl p-6 shadow-elevated text-zinc-200 animate-slide-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-100 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-surface-100 border border-border flex items-center justify-center text-emerald-400">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {filename && (
              <p className="text-xs text-zinc-400 font-mono truncate max-w-[260px]">{filename}</p>
            )}
          </div>
        </div>

        {/* Metadata stats list */}
        {(fileSize !== undefined || stats.length > 0) && (
          <div className="p-3.5 rounded-lg bg-surface-100 border border-border/80 mb-5 space-y-1.5 text-xs">
            {fileSize !== undefined && (
              <div className="flex justify-between items-center text-zinc-400">
                <span>Output size:</span>
                <span className="font-mono text-zinc-200">{formatBytes(fileSize)}</span>
              </div>
            )}
            {stats.map((s, i) => (
              <div key={i} className="flex justify-between items-center text-zinc-400 border-t border-border/40 pt-1.5">
                <span>{s.label}:</span>
                <span className="font-mono text-zinc-200">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {children}

        {/* Actions */}
        <div className="space-y-2 mt-4">
          <button
            onClick={onDownload}
            className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadLabel}</span>
          </button>

          <button
            onClick={() => {
              onReset();
              onClose();
            }}
            className="w-full py-2 btn-secondary text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 text-zinc-400" />
            <span>Process another</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { RotateCw, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { PageAction } from '@/lib/pdf-engine';

interface PageThumbnailProps {
  action: PageAction;
  displayNumber: number;
  onRotateCw: (id: string) => void;
  onRotateCcw: (id: string) => void;
  onToggleDelete: (id: string) => void;
}

export function PageThumbnail({
  action,
  displayNumber,
  onRotateCw,
  onRotateCcw,
  onToggleDelete,
}: PageThumbnailProps) {
  const isDeleted = action.isDeleted;
  const rotation = action.rotateAngle || 0;

  return (
    <div
      className={`relative rounded-lg p-2.5 border transition flex flex-col items-center select-none ${
        isDeleted
          ? 'bg-surface-300 border-rose-950/60 opacity-40 grayscale'
          : 'bg-surface-100 border-border hover:border-zinc-500'
      }`}
    >
      {/* Top Header */}
      <div className="w-full flex items-center justify-between mb-1.5 text-xs">
        <span
          className={`font-mono text-[10px] ${
            isDeleted ? 'text-rose-400' : 'text-zinc-400'
          }`}
        >
          #{displayNumber}
        </span>

        {rotation !== 0 && !isDeleted && (
          <span className="text-[10px] font-mono text-zinc-400">
            {rotation}°
          </span>
        )}
      </div>

      {/* Thumbnail Area */}
      <div className="w-32 h-44 bg-surface-300 rounded overflow-hidden border border-border flex items-center justify-center relative">
        {action.thumbnailUrl ? (
          <img
            src={action.thumbnailUrl}
            alt={`Page ${displayNumber}`}
            style={{ transform: `rotate(${rotation}deg)` }}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-zinc-600 font-mono text-xs">P{displayNumber}</div>
        )}

        {isDeleted && (
          <div className="absolute inset-0 bg-surface-300/90 flex items-center justify-center p-2 text-center">
            <span className="text-rose-400 text-[10px] font-mono uppercase">
              Removed
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons Bar */}
      <div className="w-full flex items-center justify-center gap-1 mt-2 pt-1.5 border-t border-border/60">
        <button
          onClick={() => onRotateCcw(action.id)}
          disabled={isDeleted}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-surface-50 disabled:opacity-20 transition cursor-pointer"
          title="Rotate -90°"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onRotateCw(action.id)}
          disabled={isDeleted}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-surface-50 disabled:opacity-20 transition cursor-pointer"
          title="Rotate +90°"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onToggleDelete(action.id)}
          className={`p-1 rounded transition cursor-pointer ${
            isDeleted
              ? 'text-emerald-400 hover:bg-surface-50'
              : 'text-zinc-400 hover:text-rose-400 hover:bg-surface-50'
          }`}
          title={isDeleted ? 'Restore' : 'Delete'}
        >
          {isDeleted ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

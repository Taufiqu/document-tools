'use client';

import React from 'react';
import { RotateCw, RotateCcw, Trash2, Undo2, GripVertical } from 'lucide-react';
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
      className={`relative group rounded-xl p-3 border transition-all duration-200 flex flex-col items-center select-none ${
        isDeleted
          ? 'bg-rose-950/20 border-rose-800/50 opacity-50 grayscale'
          : 'bg-surface-100 border-slate-700/80 hover:border-primary-500/50 hover:shadow-glow-primary'
      }`}
    >
      {/* Top Header with Page Tag & Controls */}
      <div className="w-full flex items-center justify-between gap-1 mb-2 text-xs">
        <div className="flex items-center gap-1">
          <GripVertical className="w-3.5 h-3.5 text-slate-500 cursor-grab" />
          <span
            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
              isDeleted
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-primary-500/20 text-primary-300'
            }`}
          >
            Page {displayNumber}
          </span>
        </div>

        {rotation !== 0 && !isDeleted && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-accent-indigo/20 text-accent-indigo font-mono">
            {rotation}°
          </span>
        )}
      </div>

      {/* Thumbnail Preview Area with CSS Rotation */}
      <div className="w-36 h-48 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center relative shadow-inner">
        {action.thumbnailUrl ? (
          <img
            src={action.thumbnailUrl}
            alt={`Page ${displayNumber}`}
            style={{ transform: `rotate(${rotation}deg)` }}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
          />
        ) : (
          <div className="text-slate-600 text-xs flex flex-col items-center">
            <span className="font-mono">P{displayNumber}</span>
          </div>
        )}

        {/* Deleted overlay banner */}
        {isDeleted && (
          <div className="absolute inset-0 bg-rose-950/80 flex items-center justify-center p-2 text-center">
            <span className="text-rose-300 text-xs font-bold uppercase tracking-wider">
              Marked for Removal
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons Bar */}
      <div className="w-full flex items-center justify-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
        <button
          onClick={() => onRotateCcw(action.id)}
          disabled={isDeleted}
          className="p-1.5 rounded-lg bg-surface-200 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 transition"
          title="Rotate 90° counter-clockwise"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onRotateCw(action.id)}
          disabled={isDeleted}
          className="p-1.5 rounded-lg bg-surface-200 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-30 transition"
          title="Rotate 90° clockwise"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onToggleDelete(action.id)}
          className={`p-1.5 rounded-lg transition ${
            isDeleted
              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
          }`}
          title={isDeleted ? 'Restore page' : 'Delete page'}
        >
          {isDeleted ? <Undo2 className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

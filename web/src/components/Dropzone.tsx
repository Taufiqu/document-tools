'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Trash2, X, Plus, Image as ImageIcon } from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
}

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  title?: string;
  subtitle?: string;
  selectedFiles?: FileItem[];
  onRemoveFile?: (id: string) => void;
  onClearAll?: () => void;
  icon?: React.ElementType;
}

export function Dropzone({
  onFilesSelected,
  accept = 'application/pdf',
  multiple = true,
  maxFiles = 50,
  title = 'Drag & Drop your files here',
  subtitle = 'or click to browse from your device (100% processed locally in RAM)',
  selectedFiles = [],
  onRemoveFile,
  onClearAll,
  icon: Icon = UploadCloud,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onFilesSelected(droppedFiles.slice(0, maxFiles));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      onFilesSelected(selected.slice(0, maxFiles));
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Upload Drag Target */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group ${
          isDragOver
            ? 'border-primary-400 bg-primary-500/10 shadow-glow-primary scale-[1.01]'
            : 'border-slate-700/80 bg-surface-100/50 hover:bg-surface-100 hover:border-primary-500/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600/30 to-accent-cyan/20 border border-primary-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200 shadow-glow-primary">
          <Icon className="w-7 h-7 text-primary-400" />
        </div>

        <h4 className="text-base sm:text-lg font-bold text-white mb-1 tracking-tight">
          {title}
        </h4>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-3">{subtitle}</p>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-200 border border-slate-700 text-[11px] text-slate-300 font-medium">
          <Plus className="w-3.5 h-3.5 text-primary-400" />
          <span>Supports {accept.replace(/application\/|image\//g, '').toUpperCase()}</span>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="p-4 rounded-xl bg-surface-100 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-400" />
              <span>{selectedFiles.length} file(s) ready to process</span>
            </span>

            {onClearAll && (
              <button
                onClick={onClearAll}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {selectedFiles.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-center justify-between p-2.5 rounded-lg bg-surface-200 border border-slate-700/60 hover:border-slate-600 transition text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold text-[10px]">
                    {index + 1}
                  </span>
                  <div className="truncate">
                    <p className="font-medium text-white truncate max-w-xs sm:max-w-md">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{formatBytes(item.size)}</p>
                  </div>
                </div>

                {onRemoveFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

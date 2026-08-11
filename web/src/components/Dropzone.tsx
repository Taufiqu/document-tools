import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Trash2, X, Plus } from 'lucide-react';
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
  title = 'Select or drop files',
  subtitle = 'Processed locally in browser memory',
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
    <div className="w-full space-y-3">
      {/* Upload Drag Target */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border border-dashed rounded-xl p-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition ${
          isDragOver
            ? 'border-zinc-300 bg-surface-100'
            : 'border-border bg-surface-200 hover:bg-surface-100 hover:border-zinc-500'
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

        <div className="w-10 h-10 rounded-lg bg-surface-100 border border-border flex items-center justify-center mb-3 text-zinc-300">
          <Icon className="w-5 h-5" />
        </div>

        <h4 className="text-sm font-semibold text-white mb-0.5">
          {title}
        </h4>
        <p className="text-xs text-zinc-400 max-w-sm mb-3">{subtitle}</p>

        <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-surface-100 border border-border">
          {accept.replace(/application\/|image\//g, '').toUpperCase()}
        </span>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="p-3.5 rounded-xl bg-surface-200 border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span>{selectedFiles.length} file(s) selected</span>
            </span>

            {onClearAll && (
              <button
                onClick={onClearAll}
                className="text-xs text-zinc-400 hover:text-rose-400 flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {selectedFiles.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-center justify-between p-2 rounded-lg bg-surface-100 border border-border text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-4 h-4 rounded bg-surface-50 text-zinc-300 font-mono flex items-center justify-center text-[10px]">
                    {index + 1}
                  </span>
                  <div className="truncate">
                    <p className="font-medium text-white truncate max-w-xs">{item.name}</p>
                    <p className="text-[10px] font-mono text-zinc-400">{formatBytes(item.size)}</p>
                  </div>
                </div>

                {onRemoveFile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(item.id);
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-surface-50 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
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

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  X,
  FolderOpen,
  HardDrive,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { scanDroppedEntries, processDirectoryFileList, naturalSortFiles } from '@/lib/folder-scanner';
import { GoogleDriveModal } from './GoogleDriveModal';

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
  enableFolderUpload?: boolean;
  enableGoogleDrive?: boolean;
}

export function Dropzone({
  onFilesSelected,
  accept = 'application/pdf',
  multiple = true,
  maxFiles = 100,
  title = 'Select or drop files',
  subtitle = 'Processed locally in browser memory',
  selectedFiles = [],
  onRemoveFile,
  onClearAll,
  icon: Icon = UploadCloud,
  enableFolderUpload = true,
  enableGoogleDrive = true,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const scannedFiles = await scanDroppedEntries(e.dataTransfer.items, accept);
      if (scannedFiles.length > 0) {
        onFilesSelected(scannedFiles.slice(0, maxFiles));
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      const sorted = naturalSortFiles(droppedFiles);
      onFilesSelected(sorted.slice(0, maxFiles));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      const sorted = naturalSortFiles(selected);
      onFilesSelected(sorted.slice(0, maxFiles));
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const scanned = processDirectoryFileList(e.target.files, accept);
      if (scanned.length > 0) {
        onFilesSelected(scanned.slice(0, maxFiles));
      } else {
        alert('No matching files found inside the selected folder.');
      }
    }
  };

  const handleDriveImport = (importedFiles: File[]) => {
    const sorted = naturalSortFiles(importedFiles);
    onFilesSelected(sorted.slice(0, maxFiles));
  };

  return (
    <div className="w-full space-y-3">
      {/* Hidden File & Folder Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileInputChange}
        className="hidden"
      />

      <input
        ref={folderInputRef}
        type="file"
        /* @ts-ignore */
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderInputChange}
        className="hidden"
      />

      {/* Upload Drag Target */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border border-dashed rounded-xl p-7 sm:p-9 flex flex-col items-center justify-center text-center cursor-pointer transition ${
          isDragOver
            ? 'border-zinc-300 bg-surface-100'
            : 'border-border bg-surface-200 hover:bg-surface-100 hover:border-zinc-500'
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-surface-100 border border-border flex items-center justify-center mb-3 text-zinc-300">
          <Icon className="w-5 h-5" />
        </div>

        <h4 className="text-sm font-semibold text-white mb-0.5">{title}</h4>
        <p className="text-xs text-zinc-400 max-w-sm mb-3.5">{subtitle}</p>

        {/* Secondary Import Buttons inside Dropzone */}
        <div className="flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 rounded-md bg-surface-100 border border-border hover:border-border-strong text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
          >
            Select Files
          </button>

          {enableFolderUpload && multiple && (
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-2.5 py-1 rounded-md bg-surface-100 border border-border hover:border-border-strong text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Upload an entire local folder"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Upload Folder</span>
            </button>
          )}

          {enableGoogleDrive && (
            <button
              type="button"
              onClick={() => setShowDriveModal(true)}
              className="px-2.5 py-1 rounded-md bg-surface-100 border border-border hover:border-border-strong text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Import files or folder from Google Drive"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              <span>Google Drive</span>
            </button>
          )}
        </div>

        <div className="mt-3">
          <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-surface-100 border border-border">
            {accept.replace(/application\/|image\//g, '').toUpperCase()} • DRAG FOLDER SUPPORTED
          </span>
        </div>
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

      {/* Google Drive Import Modal */}
      <GoogleDriveModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        onFilesImported={handleDriveImport}
        acceptMimeType={accept}
      />
    </div>
  );
}

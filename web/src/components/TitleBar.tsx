import React from 'react';
import { Minus, Square, X } from 'lucide-react';

/**
 * Custom dark titlebar for the Tauri desktop window.
 * Rendered only in desktop mode (isTauri() === true).
 * Uses data-tauri-drag-region for window dragging.
 */
export function TitleBar() {
  const handleMinimize = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  };

  const handleMaximize = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().toggleMaximize();
  };

  const handleClose = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  };

  return (
    <div
      data-tauri-drag-region
      className="h-9 flex-shrink-0 flex items-center justify-between bg-[#09090b] border-b border-zinc-800/60 select-none px-3 z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Logo + App Name */}
      <div
        className="flex items-center gap-2 pointer-events-none"
        data-tauri-drag-region
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5 flex-shrink-0"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="text-[11px] font-semibold text-zinc-400 font-mono tracking-widest uppercase">
          DocuCraft Studio
        </span>
      </div>

      {/* Right: Window Controls */}
      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="w-8 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={handleMaximize}
          title="Maximize"
          className="w-8 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <Square className="w-3 h-3" />
        </button>

        {/* Close */}
        <button
          onClick={handleClose}
          title="Close"
          className="w-8 h-8 flex items-center justify-center rounded text-zinc-500 hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

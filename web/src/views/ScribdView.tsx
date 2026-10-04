import React, { useState, useRef } from 'react';
import {
  BookOpen,
  Link2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
  Info,
} from 'lucide-react';
import { downloadUint8Array } from '@/lib/utils';
import {
  scribdInspect,
  scribdDownload,
  type ScribdInspectResult,
} from '@/lib/scribd-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'inspecting'
  | 'ready'       // metadata loaded, awaiting user confirmation
  | 'downloading'
  | 'merging'
  | 'done'
  | 'error';

interface ProgressState {
  completedPages: number;
  totalPages: number;
  percent: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ScribdView() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [inspect, setInspect] = useState<ScribdInspectResult | null>(null);
  const [progress, setProgress] = useState<ProgressState>({ completedPages: 0, totalPages: 0, percent: 0 });
  const [error, setError] = useState('');
  const abortRef = useRef(false);

  // ── Step 1: Inspect ────────────────────────────────────────────────────────

  const handleInspect = async () => {
    if (!url.trim()) return;
    setPhase('inspecting');
    setError('');
    setInspect(null);
    abortRef.current = false;

    try {
      const meta = await scribdInspect(url.trim());
      setInspect(meta);
      setPhase('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to inspect document');
      setPhase('error');
    }
  };

  // ── Step 2: Download ───────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!inspect) return;
    setPhase('downloading');
    setProgress({ completedPages: 0, totalPages: inspect.pageCount, percent: 0 });

    try {
      const result = await scribdDownload(inspect, {
        onProgress: (completed, total, percent) => {
          if (percent >= 92) setPhase('merging');
          setProgress({ completedPages: completed, totalPages: total, percent });
        },
      });

      const safeName = inspect.title.replace(/[<>:"/\\|?*]+/g, '_').slice(0, 120);
      downloadUint8Array(result.pdfBytes, `${safeName}.pdf`);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      setPhase('error');
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setUrl('');
    setInspect(null);
    setError('');
    setProgress({ completedPages: 0, totalPages: 0, percent: 0 });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isWorking = phase === 'inspecting' || phase === 'downloading' || phase === 'merging';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <BookOpen className="w-3.5 h-3.5" />
          <span>MODULE / SCRIBD DOWNLOADER</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Scribd to PDF</h1>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          Download any public Scribd document as a searchable PDF. Short documents use a
          single-pass vector render; long documents are processed in batches and merged
          locally in your browser.
        </p>
      </div>

      {/* URL Input card */}
      <div className="rounded-xl border border-border bg-surface-200 p-4 sm:p-6 space-y-4">

        <div className="space-y-2">
          <label className="text-xs text-zinc-400 font-medium">Scribd Document URL</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); if (phase !== 'idle') handleReset(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isWorking) void handleInspect(); }}
                placeholder="https://www.scribd.com/document/123456789/Document-Title"
                disabled={isWorking}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-surface-100
                           text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none
                           focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => void handleInspect()}
              disabled={!url.trim() || isWorking}
              className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50 whitespace-nowrap"
            >
              {phase === 'inspecting' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Inspecting...</>
              ) : (
                <><FileText className="w-3.5 h-3.5" /> Check</>
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-600">
            Supports <span className="font-mono">scribd.com/document/…</span> and{' '}
            <span className="font-mono">scribd.com/doc/…</span> formats.
          </p>
        </div>

        {/* ── Inspect result card ── */}
        {inspect && (phase === 'ready' || phase === 'downloading' || phase === 'merging' || phase === 'done') && (
          <div className="rounded-lg border border-border bg-surface-100 p-4 space-y-3">

            {/* Doc metadata */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-md border border-border bg-surface-50 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{inspect.title}</p>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {inspect.pageCount} pages · Doc ID {inspect.docId}
                </p>
              </div>
            </div>

            {/* Strategy badge */}
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs
              ${inspect.strategy === 'vector'
                ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border border-sky-500/25 bg-sky-500/10 text-sky-300'}`}
            >
              {inspect.strategy === 'vector' ? (
                <><FileText className="w-3.5 h-3.5 shrink-0" />
                  <span><strong>Fast Vector Mode</strong> — single-pass serverless render ({inspect.pageCount} pages ≤ {inspect.chunkThreshold}). Searchable PDF.</span>
                </>
              ) : (
                <><Layers className="w-3.5 h-3.5 shrink-0" />
                  <span><strong>Chunked Batch Mode</strong> — {Math.ceil(inspect.pageCount / 8)} batches × ~8 pages, merged locally. Large document ({inspect.pageCount} pages).</span>
                </>
              )}
            </div>

            {/* Download button */}
            {phase === 'ready' && (
              <button
                onClick={() => void handleDownload()}
                className="btn-primary flex items-center justify-center gap-2 w-full py-2.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download as PDF
              </button>
            )}

            {/* Progress bar */}
            {(phase === 'downloading' || phase === 'merging') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {phase === 'merging'
                      ? 'Merging chunks in browser…'
                      : inspect.strategy === 'vector'
                        ? 'Rendering document…'
                        : `Rendering pages ${progress.completedPages} / ${progress.totalPages}…`}
                  </span>
                  <span>{progress.percent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                {inspect.strategy === 'chunked' && phase === 'downloading' && (
                  <p className="text-[10px] text-zinc-600 font-mono">
                    Batch {Math.ceil(progress.completedPages / 8)} / {Math.ceil(inspect.pageCount / 8)}
                  </p>
                )}
              </div>
            )}

            {/* Done */}
            {phase === 'done' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>PDF downloaded — {inspect.pageCount} pages</span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-[11px] text-zinc-400 hover:text-white transition underline underline-offset-2"
                >
                  Download another
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Error</p>
              <p className="mt-0.5 text-red-300/80">{error}</p>
              <button
                onClick={handleReset}
                className="mt-2 underline underline-offset-2 hover:text-red-200 transition"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info footer */}
      <div className="flex gap-3 rounded-xl border border-border bg-surface-200 p-4 text-xs text-zinc-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
        <div className="space-y-1 leading-relaxed">
          <p>
            <span className="font-medium text-zinc-300">How it works: </span>
            A lightweight pre-flight check reads page count from the public embed
            URL. Short docs (≤ {inspect?.chunkThreshold ?? 15} pages) render in one pass;
            long docs are batched server-side and merged locally via{' '}
            <span className="font-mono">pdf-lib</span>. No files are stored on any server.
          </p>
          <p className="text-zinc-600">
            Only public Scribd documents are supported. Private or members-only documents
            will return an error.
          </p>
        </div>
      </div>
    </div>
  );
}

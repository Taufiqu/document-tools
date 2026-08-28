import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar';
import { TitleBar } from './components/TitleBar';
import { Loader2 } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';

// Lazy load view components for optimal bundle splitting and performance
const OverviewView = lazy(() => import('./views/OverviewView').then((m) => ({ default: m.OverviewView })));
const CamScannerView = lazy(() => import('./views/CamScannerView').then((m) => ({ default: m.CamScannerView })));
const OrganizerView = lazy(() => import('./views/OrganizerView').then((m) => ({ default: m.OrganizerView })));
const MergeView = lazy(() => import('./views/MergeView').then((m) => ({ default: m.MergeView })));
const SplitView = lazy(() => import('./views/SplitView').then((m) => ({ default: m.SplitView })));
const CompressPdfView = lazy(() => import('./views/CompressPdfView').then((m) => ({ default: m.CompressPdfView })));
const PageNumberView = lazy(() => import('./views/PageNumberView').then((m) => ({ default: m.PageNumberView })));
const GrayscalePdfView = lazy(() => import('./views/GrayscalePdfView').then((m) => ({ default: m.GrayscalePdfView })));
const WatermarkView = lazy(() => import('./views/WatermarkView').then((m) => ({ default: m.WatermarkView })));
const PasFotoView = lazy(() => import('./views/PasFotoView').then((m) => ({ default: m.PasFotoView })));
const PngToJpgView = lazy(() => import('./views/PngToJpgView').then((m) => ({ default: m.PngToJpgView })));
const PdfToImageView = lazy(() => import('./views/PdfToImageView').then((m) => ({ default: m.PdfToImageView })));
const ImageToPdfView = lazy(() => import('./views/ImageToPdfView').then((m) => ({ default: m.ImageToPdfView })));
const CompressImageView = lazy(() => import('./views/CompressImageView').then((m) => ({ default: m.CompressImageView })));
const FaviconView = lazy(() => import('./views/FaviconView').then((m) => ({ default: m.FaviconView })));
const QrCodeView = lazy(() => import('./views/QrCodeView').then((m) => ({ default: m.QrCodeView })));

function ViewFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-2.5 text-zinc-500">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      <p className="text-xs font-mono">Loading module...</p>
    </div>
  );
}

const TOOL_METADATA: Record<string, { title: string; desc: string }> = {
  overview: {
    title: 'DocuCraft — Privacy-First Document & Image Studio by Taufiqu',
    desc: 'Fast, private, and local document & image tools engineered by Taufiqu. Zero server uploads, processed 100% in browser memory.',
  },
  scanner: {
    title: 'CamScanner Web — Document Camera & Perspective Scan | DocuCraft',
    desc: 'Capture document photos, auto-detect corners, perspective warp, and compile clean scanned PDFs locally in browser RAM.',
  },
  organizer: {
    title: 'Visual PDF Page Organizer & Reorder | DocuCraft',
    desc: 'Visually rearrange, delete, and rotate PDF pages directly in your browser without uploading files.',
  },
  merge: {
    title: 'Merge PDF Online Gratis — Standardize A4/F4 Folio | DocuCraft',
    desc: 'Combine multiple PDF files into one standardized document (A4, F4, Letter) processed 100% locally in browser memory.',
  },
  split: {
    title: 'Split PDF Online — Extract Pages & Burst ZIP | DocuCraft',
    desc: 'Split PDF files by page ranges or extract specific pages into individual PDFs without server uploads.',
  },
  'compress-pdf': {
    title: 'Compress PDF Online — Downsample in Browser RAM | DocuCraft',
    desc: 'Reduce PDF file sizes locally to satisfy upload limits on CPNS, BUMN, and job portals without quality loss.',
  },
  'page-number': {
    title: 'Add Page Numbers to PDF Online | DocuCraft',
    desc: 'Stamp Arabic and Roman page numbers on PDFs with custom positions and margins in client-side RAM.',
  },
  grayscale: {
    title: 'Grayscale & B&W PDF Converter | DocuCraft',
    desc: 'Convert color PDFs to crisp black and white with contrast and brightness fine-tuning for print economy.',
  },
  watermark: {
    title: 'PDF Watermark Studio — Diagonal & Horizontal Text | DocuCraft',
    desc: 'Add confidential or draft text watermarks to your PDF documents with opacity and angle controls.',
  },
  'pas-foto': {
    title: 'Pas Foto & ID Studio (2x3, 3x4, 4x6, Paspor) | DocuCraft',
    desc: 'Format official ID photos with red/blue background replacement and file size limits for administrative portals.',
  },
  'png-to-jpg': {
    title: 'PNG to JPG Batch Converter with Background Fill | DocuCraft',
    desc: 'Convert transparent PNG images to JPEG format with customizable solid background colors.',
  },
  'pdf-to-image': {
    title: 'PDF to Image Converter (Direct PNG / JPG) | DocuCraft',
    desc: 'Render PDF pages into high-resolution PNG or JPG images with 1-click single-page downloads.',
  },
  'image-to-pdf': {
    title: 'Convert Images to PDF with Magic Color Scan Filter | DocuCraft',
    desc: 'Transform photos into realistic scanned PDF documents with Magic Color and B&W photocopy filters.',
  },
  'compress-image': {
    title: 'Compress Images (JPEG, PNG, WebP) Locally | DocuCraft',
    desc: 'Optimize image dimensions and weights directly in browser memory without sending data to third parties.',
  },
  favicon: {
    title: 'Favicon & App Icon Pack Generator | DocuCraft',
    desc: 'Generate complete multi-resolution .ico and PNG favicon packages with manifest files for web developers.',
  },
  'qr-code': {
    title: 'QR Code Generator & Scanner | DocuCraft',
    desc: 'Generate, download, and decode QR codes locally in your browser. Scan QR codes from your camera or image without uploads.',
  },
};

export function App() {
  // Detect if running inside Tauri desktop environment
  const [isDesktop, setIsDesktop] = useState(false);

  // Sync route with URL hash for bookmarking and back/forward navigation
  const [currentTool, setCurrentTool] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) return hash;
    }
    return 'overview';
  });

  useEffect(() => {
    // Detect Tauri environment (desktop app)
    import('@tauri-apps/api/core')
      .then(({ isTauri }) => setIsDesktop(isTauri()))
      .catch(() => setIsDesktop(false));
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) {
        setCurrentTool(hash);
      } else {
        setCurrentTool('overview');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update dynamic SEO title and meta description per tool
  useEffect(() => {
    const meta = TOOL_METADATA[currentTool] || TOOL_METADATA.overview;
    document.title = meta.title;

    const descTag = document.querySelector('meta[name="description"]');
    if (descTag) {
      descTag.setAttribute('content', meta.desc);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', meta.title);
    }
  }, [currentTool]);

  const handleSelectTool = (toolId: string) => {
    setCurrentTool(toolId);
    if (toolId === 'overview') {
      window.history.pushState(null, '', window.location.pathname);
    } else {
      window.location.hash = toolId;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`flex flex-col bg-background text-zinc-100 selection:bg-zinc-800 selection:text-white ${isDesktop ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Custom titlebar — only rendered inside Tauri desktop window */}
      {isDesktop && <TitleBar />}

      <div className={isDesktop ? 'flex-1 overflow-y-auto' : 'contents'}>
        <Navbar currentTool={currentTool} onSelectTool={handleSelectTool} />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Suspense fallback={<ViewFallback />}>
            {currentTool === 'overview' && <OverviewView onSelectTool={handleSelectTool} />}
            {currentTool === 'scanner' && <CamScannerView />}
            {currentTool === 'organizer' && <OrganizerView />}
            {currentTool === 'merge' && <MergeView />}
            {currentTool === 'split' && <SplitView />}
            {currentTool === 'compress-pdf' && <CompressPdfView />}
            {currentTool === 'page-number' && <PageNumberView />}
            {currentTool === 'grayscale' && <GrayscalePdfView />}
            {currentTool === 'watermark' && <WatermarkView />}
            {currentTool === 'pas-foto' && <PasFotoView />}
            {currentTool === 'png-to-jpg' && <PngToJpgView />}
            {currentTool === 'pdf-to-image' && <PdfToImageView />}
            {currentTool === 'image-to-pdf' && <ImageToPdfView />}
            {currentTool === 'compress-image' && <CompressImageView />}
            {currentTool === 'favicon' && <FaviconView />}
            {currentTool === 'qr-code' && <QrCodeView />}
          </Suspense>
        </main>

        {/* Editorial Minimal Footer with Creator Credit */}
        <footer className="border-t border-border py-6 text-xs text-zinc-500 bg-surface-200/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
              <span className="font-mono text-white text-[11px] font-medium">DocuCraft Studio</span>
              <span className="hidden sm:inline text-zinc-600">•</span>
              <p className="text-[11px] text-zinc-400">
                Designed &amp; Engineered by{' '}
                <a
                  href="https://taufiqu.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white hover:text-emerald-400 font-medium underline underline-offset-2 transition"
                >
                  Taufiqu
                </a>
              </p>
            </div>

            <div className="flex items-center gap-4 text-[11px] font-mono">
              <a
                href="https://taufiqu.vercel.app/"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white transition"
              >
                Portfolio
              </a>
              <span className="text-zinc-700">/</span>
              <a
                href="https://github.com/Taufiqu"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white transition"
              >
                GitHub
              </a>
              <span className="text-zinc-700">/</span>
              <a
                href="https://github.com/Taufiqu/document-tools"
                target="_blank"
                rel="noreferrer"
                className="text-zinc-400 hover:text-white transition"
              >
                Source
              </a>
            </div>
          </div>
        </footer>

        {/* Vercel Web Analytics — disabled in Tauri desktop mode */}
        {!isDesktop && <Analytics />}
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Navbar } from './components/Navbar';
import { Loader2 } from 'lucide-react';

// Lazy load view components for optimal bundle splitting and performance
const OverviewView = lazy(() => import('./views/OverviewView').then((m) => ({ default: m.OverviewView })));
const OrganizerView = lazy(() => import('./views/OrganizerView').then((m) => ({ default: m.OrganizerView })));
const MergeView = lazy(() => import('./views/MergeView').then((m) => ({ default: m.MergeView })));
const SplitView = lazy(() => import('./views/SplitView').then((m) => ({ default: m.SplitView })));
const WatermarkView = lazy(() => import('./views/WatermarkView').then((m) => ({ default: m.WatermarkView })));
const PngToJpgView = lazy(() => import('./views/PngToJpgView').then((m) => ({ default: m.PngToJpgView })));
const PdfToImageView = lazy(() => import('./views/PdfToImageView').then((m) => ({ default: m.PdfToImageView })));
const ImageToPdfView = lazy(() => import('./views/ImageToPdfView').then((m) => ({ default: m.ImageToPdfView })));
const CompressImageView = lazy(() => import('./views/CompressImageView').then((m) => ({ default: m.CompressImageView })));
const FaviconView = lazy(() => import('./views/FaviconView').then((m) => ({ default: m.FaviconView })));

function ViewFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-2.5 text-zinc-500">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      <p className="text-xs font-mono">Loading module...</p>
    </div>
  );
}

export function App() {
  // Sync route with URL hash for bookmarking and back/forward navigation
  const [currentTool, setCurrentTool] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash) return hash;
    }
    return 'overview';
  });

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
    <div className="min-h-screen flex flex-col bg-background text-zinc-100 selection:bg-zinc-800 selection:text-white">
      <Navbar currentTool={currentTool} onSelectTool={handleSelectTool} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Suspense fallback={<ViewFallback />}>
          {currentTool === 'overview' && <OverviewView onSelectTool={handleSelectTool} />}
          {currentTool === 'organizer' && <OrganizerView />}
          {currentTool === 'merge' && <MergeView />}
          {currentTool === 'split' && <SplitView />}
          {currentTool === 'watermark' && <WatermarkView />}
          {currentTool === 'png-to-jpg' && <PngToJpgView />}
          {currentTool === 'pdf-to-image' && <PdfToImageView />}
          {currentTool === 'image-to-pdf' && <ImageToPdfView />}
          {currentTool === 'compress-image' && <CompressImageView />}
          {currentTool === 'favicon' && <FaviconView />}
        </Suspense>
      </main>

      {/* Editorial Minimal Footer */}
      <footer className="border-t border-border py-5 text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-mono text-[11px]">DocuCraft — Client-Side Studio</p>
          <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
            <span>RAM-Based</span>
            <span>/</span>
            <span>Zero-Upload</span>
            <span>/</span>
            <span>Dual-Deployment</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

import React from 'react';
import {
  Layers,
  Scissors,
  FileText,
  Shield,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  Download,
  Minimize2,
} from 'lucide-react';

interface OverviewViewProps {
  onSelectTool: (toolId: string) => void;
}

export function OverviewView({ onSelectTool }: OverviewViewProps) {
  const tools = [
    {
      id: 'organizer',
      title: 'Page Organizer',
      description: 'Reorder, rotate degrees, and remove unwanted pages with visual canvas previews.',
      icon: FileText,
      tag: 'Visual',
    },
    {
      id: 'merge',
      title: 'PDF Merger',
      description: 'Combine multiple PDF documents into one with standardized paper scales (A4, F4, Letter).',
      icon: Layers,
      tag: 'Standardized',
    },
    {
      id: 'split',
      title: 'PDF Splitter',
      description: 'Extract individual pages into single PDFs or split documents by custom page intervals.',
      icon: Scissors,
      tag: 'Precision',
    },
    {
      id: 'watermark',
      title: 'PDF Watermark',
      description: 'Apply semi-transparent diagonal text stamps with angle, opacity, and size controls.',
      icon: Shield,
      tag: 'Security',
    },
    {
      id: 'png-to-jpg',
      title: 'PNG to JPG Converter',
      description: 'Convert PNG images to high-quality JPEG with clean solid background handling for transparency.',
      icon: ImageIcon,
      tag: 'Conversion',
    },
    {
      id: 'pdf-to-image',
      title: 'PDF to Images',
      description: 'Export PDF pages into high-resolution PNG, JPG, or WebP raster images.',
      icon: ImageIcon,
      tag: 'Rasterizer',
    },
    {
      id: 'image-to-pdf',
      title: 'Images to PDF',
      description: 'Compile multiple image files into a structured PDF document with custom margins.',
      icon: Download,
      tag: 'Compilation',
    },
    {
      id: 'compress-image',
      title: 'Image Compressor',
      description: 'Reduce image file weights directly in browser memory with quality and dimension constraints.',
      icon: Minimize2,
      tag: 'Optimization',
    },
    {
      id: 'favicon',
      title: 'Favicon & Web Pack',
      description: 'Generate multi-size .ico files and complete PWA web icon sets with ready-to-use HTML tags.',
      icon: Sparkles,
      tag: 'Web Suite',
    },
  ];

  return (
    <div className="space-y-10 pb-12">
      {/* Editorial Headline */}
      <section className="pt-4 pb-2 space-y-3 max-w-3xl">
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
          <span>WORKSPACE</span>
          <span>/</span>
          <span>DOCUMENT & IMAGE TOOLS</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
          Engineered tools for documents and images.
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
          Fast, local, and private by design. Operations execute entirely in your browser's RAM without cloud uploads.
        </p>
      </section>

      {/* Tools Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400 font-mono">
            Available Modules ({tools.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id)}
                className="studio-card studio-card-hover p-4 sm:p-5 flex flex-col justify-between text-left cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-md bg-surface-50 border border-border flex items-center justify-center text-zinc-200">
                      <Icon className="w-4 h-4" />
                    </div>

                    <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-surface-50 border border-border/80">
                      {tool.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-zinc-200 transition mb-1">
                    {tool.title}
                  </h3>

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="pt-3 mt-4 border-t border-border/60 flex items-center justify-between text-xs font-medium text-zinc-400 group-hover:text-white transition">
                  <span>Open module</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

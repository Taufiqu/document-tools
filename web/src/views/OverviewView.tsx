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
  Minimize,
  Hash,
  Printer,
  Camera,
} from 'lucide-react';

interface OverviewViewProps {
  onSelectTool: (toolId: string) => void;
}

export function OverviewView({ onSelectTool }: OverviewViewProps) {
  const toolGroups = [
    {
      id: 'pdf',
      title: 'PDF Tools',
      description: 'Atur, optimalkan, dan amankan dokumen PDF.',
      tools: [
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
          id: 'compress-pdf',
          title: 'PDF Compressor',
          description: 'Reduce PDF file weights directly in RAM with Extreme, Recommended, or Mild presets.',
          icon: Minimize,
          tag: 'Optimizer',
        },
        {
          id: 'page-number',
          title: 'Page Numbering',
          description: 'Insert header & footer page indices with custom templates, offsets, and cover skip options.',
          icon: Hash,
          tag: 'Essential',
        },
        {
          id: 'grayscale',
          title: 'Grayscale & B&W',
          description: 'Convert color PDFs to crisp monochrome documents to save printer ink and clean up scans.',
          icon: Printer,
          tag: 'Print-Ready',
        },
        {
          id: 'watermark',
          title: 'PDF Watermark',
          description: 'Apply semi-transparent diagonal text stamps with angle, opacity, and size controls.',
          icon: Shield,
          tag: 'Security',
        },
      ],
    },
    {
      id: 'image',
      title: 'Foto & Gambar',
      description: 'Siapkan foto, hasil scan, dan gambar untuk kebutuhan dokumen.',
      tools: [
        {
      id: 'scanner',
      title: 'Cam Scanner',
      description: 'Capture documents with your camera, auto-detect corners, warp perspective, and apply scan filters.',
      icon: Camera,
      tag: 'Camera AI',
    },
        {
          id: 'pas-foto',
          title: 'Pas Foto Studio',
          description: 'Format photos for official ID standards (2×3, 3×4, 4×6, Paspor) with Red/Blue backgrounds.',
          icon: Camera,
          tag: 'Official',
        },
        {
          id: 'png-to-jpg',
          title: 'PNG to JPG Converter',
          description: 'Convert PNG images to high-quality JPEG with clean solid background handling for transparency.',
          icon: ImageIcon,
          tag: 'Conversion',
        },
        {
          id: 'compress-image',
          title: 'Image Compressor',
          description: 'Reduce image file weights directly in browser memory with quality and dimension constraints.',
          icon: Minimize2,
          tag: 'Optimization',
        },
      ],
    },
    {
      id: 'convert',
      title: 'Konversi',
      description: 'Ubah dokumen PDF dan gambar ke format yang dibutuhkan.',
      tools: [
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
      ],
    },
    {
      id: 'web',
      title: 'Web Assets',
      description: 'Buat aset ikon siap pakai untuk website dan PWA.',
      tools: [
        {
          id: 'favicon',
          title: 'Favicon & Web Pack',
          description: 'Generate multi-size .ico files and complete PWA web icon sets with ready-to-use HTML tags.',
          icon: Sparkles,
          tag: 'Web Suite',
        },
      ],
    },
  ];

  const toolCount = toolGroups.reduce((total, group) => total + group.tools.length, 0);

  return (
    <div className="space-y-10 pb-12">
      {/* Editorial Headline */}
      <section className="pt-4 pb-2 space-y-3 max-w-3xl">
        <div className="flex flex-wrap items-center gap-2 text-zinc-400 text-xs font-mono">
          <span>WORKSPACE</span>
          <span>/</span>
          <span>DOCUMENT & IMAGE TOOLS</span>
          <span>/</span>
          <a
            href="https://taufiqu.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-300 hover:text-emerald-400 transition"
          >
            BY TAUFIQU
          </a>
        </div>

        <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
          Engineered tools for documents and images.
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
          Fast, local, and private by design. Operations execute entirely in your browser's RAM without cloud uploads.
        </p>
      </section>

      {/* Tools grouped by workflow */}
      <section className="space-y-8">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400 font-mono">
            Available Modules ({toolCount})
          </h2>
        </div>

        {toolGroups.map((group) => (
          <div key={group.id} className="space-y-3.5">
            <div>
              <h3 className="text-sm font-semibold text-white">{group.title}</h3>
              <p className="mt-0.5 text-xs text-zinc-500">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {group.tools.map((tool) => {
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

                      <h4 className="text-sm font-semibold text-white group-hover:text-zinc-200 transition mb-1">
                        {tool.title}
                      </h4>

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
          </div>
        ))}
      </section>
    </div>
  );
}

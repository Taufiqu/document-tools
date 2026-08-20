import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  RotateCcw,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Download,
  Loader2,
  Maximize2,
  RefreshCw,
  Sun,
  Sliders,
  FileText,
  Upload,
  ArrowLeft,
  Crop,
  Layers,
} from 'lucide-react';
import { ResultModal } from '@/components/ResultModal';
import { downloadUint8Array, formatBytes, getTimestampString } from '@/lib/utils';
import {
  QuadCorners,
  Point,
  detectDocumentCorners,
  warpPerspective,
} from '@/lib/perspective-crop';
import {
  ScanFilterType,
  SCAN_FILTER_PRESETS,
  ScanFilterOptions,
  applyScanFilterToCanvas,
} from '@/lib/scan-engine';
import { imagesToPdf } from '@/lib/image-engine';
import JSZip from 'jszip';

interface ScannedPageItem {
  id: string;
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  filter: ScanFilterType;
}

type ScanStep = 'camera' | 'crop' | 'filter' | 'tray';

export function CamScannerView() {
  const [step, setStep] = useState<ScanStep>('camera');

  // Camera States
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string>('');

  // Current Working Image
  const [capturedImage, setCapturedImage] = useState<HTMLImageElement | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);

  // 4-Point Crop States
  const [corners, setCorners] = useState<QuadCorners>({
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
    bl: { x: 0, y: 0 },
  });
  const [activeCorner, setActiveCorner] = useState<keyof QuadCorners | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const [displayScale, setDisplayScale] = useState<number>(1);

  // Filter States
  const [selectedFilter, setSelectedFilter] = useState<ScanFilterType>('magic-color');
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [filteredPreviewUrl, setFilteredPreviewUrl] = useState<string>('');
  const [warpedCanvas, setWarpedCanvas] = useState<HTMLCanvasElement | null>(null);

  // Multi-Page Tray
  const [pages, setPages] = useState<ScannedPageItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'F4' | 'Letter' | 'Fit'>('A4');

  // Export Results
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<{ bytes: Uint8Array; filename: string } | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Camera Lifecycle
  useEffect(() => {
    if (step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, facingMode]);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError(
        'Could not access camera. Please check camera permissions or upload an image file instead.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // 2. Capture Snapshot
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    const img = new Image();
    img.onload = () => {
      setCapturedImage(img);
      setRotationAngle(0);
      initCorners(img);
      setStep('crop');
    };
    img.src = dataUrl;
  };

  // Handle File Upload Fallback
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setCapturedImage(img);
        setRotationAngle(0);
        initCorners(img);
        setStep('crop');
      };
      img.src = url;
    }
  };

  const initCorners = (img: HTMLImageElement) => {
    const detected = detectDocumentCorners(img);
    setCorners(detected);
  };

  // 3. Crop & Corner Dragging
  useEffect(() => {
    if (step === 'crop' && cropContainerRef.current && capturedImage) {
      const containerWidth = cropContainerRef.current.clientWidth;
      const scale = containerWidth / capturedImage.naturalWidth;
      setDisplayScale(scale);
    }
  }, [step, capturedImage]);

  const handlePointerDownCorner = (cornerKey: keyof QuadCorners, e: React.PointerEvent) => {
    e.preventDefault();
    setActiveCorner(cornerKey);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCorner || !cropContainerRef.current || !capturedImage) return;

    const rect = cropContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const naturalX = Math.max(0, Math.min(capturedImage.naturalWidth, clientX / displayScale));
    const naturalY = Math.max(0, Math.min(capturedImage.naturalHeight, clientY / displayScale));

    setCorners((prev) => ({
      ...prev,
      [activeCorner]: { x: naturalX, y: naturalY },
    }));
  };

  const handlePointerUp = () => {
    setActiveCorner(null);
  };

  const handleRotateImage = () => {
    if (!capturedImage) return;
    const canvas = document.createElement('canvas');
    canvas.width = capturedImage.naturalHeight;
    canvas.height = capturedImage.naturalWidth;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(capturedImage, -capturedImage.naturalWidth / 2, -capturedImage.naturalHeight / 2);

    const rotatedImg = new Image();
    rotatedImg.onload = () => {
      setCapturedImage(rotatedImg);
      initCorners(rotatedImg);
    };
    rotatedImg.src = canvas.toDataURL('image/jpeg', 0.95);
  };

  // 4. Warp Perspective & Move to Filter
  const handleProceedToFilter = () => {
    if (!capturedImage) return;
    const warped = warpPerspective(capturedImage, corners);
    setWarpedCanvas(warped);
    renderFilteredPreview(warped, selectedFilter, brightness, contrast);
    setStep('filter');
  };

  const renderFilteredPreview = (
    canvas: HTMLCanvasElement,
    filter: ScanFilterType,
    b: number,
    c: number
  ) => {
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(canvas, 0, 0);
    applyScanFilterToCanvas(copy, filter, { brightness: b, contrast: c });
    setFilteredPreviewUrl(copy.toDataURL('image/jpeg', 0.92));
  };

  const handleChangeFilter = (filter: ScanFilterType) => {
    setSelectedFilter(filter);
    if (warpedCanvas) {
      renderFilteredPreview(warpedCanvas, filter, brightness, contrast);
    }
  };

  const handleSliderChange = (b: number, c: number) => {
    setBrightness(b);
    setContrast(c);
    if (warpedCanvas) {
      renderFilteredPreview(warpedCanvas, selectedFilter, b, c);
    }
  };

  // 5. Save Page to Multi-Page Tray
  const handleSavePageToTray = async () => {
    if (!warpedCanvas) return;

    const copy = document.createElement('canvas');
    copy.width = warpedCanvas.width;
    copy.height = warpedCanvas.height;
    const ctx = copy.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(warpedCanvas, 0, 0);
    applyScanFilterToCanvas(copy, selectedFilter, { brightness, contrast });

    const blob: Blob = await new Promise((resolve) =>
      copy.toBlob((b) => resolve(b || new Blob()), 'image/jpeg', 0.92)
    );
    const dataUrl = copy.toDataURL('image/jpeg', 0.92);

    const newPage: ScannedPageItem = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      blob,
      dataUrl,
      width: copy.width,
      height: copy.height,
      filter: selectedFilter,
    };

    setPages((prev) => [...prev, newPage]);
    setStep('tray');
  };

  // 6. Multi-Page Document Export (PDF / ZIP)
  const handleExportPdf = async () => {
    if (pages.length === 0) return;
    setIsExporting(true);

    try {
      const files = pages.map(
        (p, idx) => new File([p.blob], `page_${idx + 1}.jpg`, { type: 'image/jpeg' })
      );
      const pdfBytes = await imagesToPdf(files, {
        pageSize,
        margin: 0,
        orientation: 'auto',
      });

      const filename = `docucraft_scan_${pages.length}p_${getTimestampString()}.pdf`;
      setExportResult({ bytes: pdfBytes, filename });
      setShowResultModal(true);
    } catch (err) {
      alert(`Export PDF error: ${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZip = async () => {
    if (pages.length === 0) return;
    setIsExporting(true);

    try {
      const zip = new JSZip();
      pages.forEach((p, idx) => {
        zip.file(`scanned_page_${idx + 1}.jpg`, p.blob);
      });
      const zipBlob = await zip.generateAsync({ type: 'uint8array' });
      const filename = `scanned_images_${getTimestampString()}.zip`;
      setExportResult({ bytes: zipBlob, filename });
      setShowResultModal(true);
    } catch (err) {
      alert(`Export ZIP error: ${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-1">
          <Camera className="w-3.5 h-3.5" />
          <span>MODULE / DOCUMENT CAMERA SCANNER</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white">Camera Document Scanner</h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Capture documents directly, auto-detect corners, warp perspective, and apply realistic flatbed scan filters in RAM.
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadImage}
        className="hidden"
      />

      {/* ========================================================
          STEP 1: LIVE CAMERA VIEW / UPLOAD
          ======================================================== */}
      {step === 'camera' && (
        <div className="p-4 sm:p-6 rounded-xl bg-surface-200 border border-border space-y-4">
          <div className="relative aspect-[3/4] sm:aspect-[4/3] max-h-[500px] w-full bg-black rounded-lg overflow-hidden flex items-center justify-center border border-border">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Viewfinder Guide Overlay */}
                <div className="absolute inset-6 sm:inset-10 border border-white/40 rounded-lg pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-t-2 border-l-2 border-emerald-400"></span>
                    <span className="w-4 h-4 border-t-2 border-r-2 border-emerald-400"></span>
                  </div>
                  <p className="text-center text-[11px] font-mono text-white/70 bg-black/50 px-2 py-0.5 rounded self-center">
                    Align document inside frame
                  </p>
                  <div className="flex justify-between">
                    <span className="w-4 h-4 border-b-2 border-l-2 border-emerald-400"></span>
                    <span className="w-4 h-4 border-b-2 border-r-2 border-emerald-400"></span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 text-zinc-400">
                <Camera className="w-10 h-10 text-zinc-500" />
                <p className="text-xs max-w-sm leading-relaxed">
                  {cameraError || 'Camera inactive. Click Start Camera or Upload an image from your device.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={startCamera}
                    className="px-3 py-2 btn-primary text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Start Camera</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Camera Action Bar */}
          {cameraActive && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={toggleCameraFacing}
                className="px-3 py-2 rounded-lg bg-surface-100 border border-border text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 cursor-pointer"
                title="Switch between front and rear camera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Flip Camera</span>
              </button>

              {/* Shutter Button */}
              <button
                onClick={handleCaptureSnapshot}
                className="w-14 h-14 rounded-full bg-white text-zinc-950 border-4 border-zinc-800 hover:scale-105 transition flex items-center justify-center cursor-pointer shadow-elevated"
                title="Capture Document"
              >
                <div className="w-10 h-10 rounded-full border-2 border-zinc-950 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-zinc-950"></div>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-surface-100 border border-border text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">From Gallery</span>
              </button>
            </div>
          )}

          {pages.length > 0 && (
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-mono">{pages.length} page(s) in tray</span>
              <button
                onClick={() => setStep('tray')}
                className="text-xs text-white underline cursor-pointer"
              >
                View Document Tray →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          STEP 2: 4-CORNER PERSPECTIVE CROP
          ======================================================== */}
      {step === 'crop' && capturedImage && (
        <div className="p-4 sm:p-6 rounded-xl bg-surface-200 border border-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Crop className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Adjust 4 Document Corners
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRotateImage}
                className="p-1.5 rounded bg-surface-100 border border-border text-zinc-300 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
                title="Rotate 90 degrees"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Rotate</span>
              </button>

              <button
                onClick={() => initCorners(capturedImage)}
                className="px-2 py-1 rounded bg-surface-100 border border-border text-zinc-300 hover:text-white text-xs cursor-pointer"
                title="Re-detect edges"
              >
                Auto Detect
              </button>
            </div>
          </div>

          {/* Interactive Crop Surface */}
          <div
            ref={cropContainerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative w-full bg-black rounded-lg overflow-hidden select-none touch-none border border-border flex items-center justify-center"
            style={{
              aspectRatio: `${capturedImage.naturalWidth} / ${capturedImage.naturalHeight}`,
            }}
          >
            <img
              src={capturedImage.src}
              alt="Crop Source"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* SVG Polygon Overlay */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <polygon
                points={`${corners.tl.x * displayScale},${corners.tl.y * displayScale} ${
                  corners.tr.x * displayScale
                },${corners.tr.y * displayScale} ${corners.br.x * displayScale},${
                  corners.br.y * displayScale
                } ${corners.bl.x * displayScale},${corners.bl.y * displayScale}`}
                fill="rgba(16, 185, 129, 0.15)"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
            </svg>

            {/* 4 Draggable Corner Handles */}
            {(['tl', 'tr', 'br', 'bl'] as const).map((key) => {
              const pt = corners[key];
              const isActive = activeCorner === key;
              return (
                <div
                  key={key}
                  onPointerDown={(e) => handlePointerDownCorner(key, e)}
                  style={{
                    left: `${pt.x * displayScale}px`,
                    top: `${pt.y * displayScale}px`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform ${
                    isActive ? 'scale-125 bg-emerald-400 ring-4 ring-emerald-400/40 z-30' : 'bg-white z-20 shadow-md'
                  }`}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-950"></div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setStep('camera')}
              className="px-4 py-2.5 btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retake</span>
            </button>

            <button
              onClick={handleProceedToFilter}
              className="flex-1 py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
            >
              <span>Warp & Next: Filters</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 3: SCAN FILTERS & ADJUSTMENTS
          ======================================================== */}
      {step === 'filter' && (
        <div className="p-4 sm:p-6 rounded-xl bg-surface-200 border border-border space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Select Scan Filter
              </h3>
            </div>
          </div>

          {/* Flattened Document Preview */}
          <div className="aspect-[3/4] max-h-80 w-full bg-black/60 rounded-lg overflow-hidden border border-border flex items-center justify-center p-2">
            {filteredPreviewUrl ? (
              <img
                src={filteredPreviewUrl}
                alt="Warped Filtered Preview"
                className="max-h-full max-w-full object-contain rounded shadow-md"
              />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            )}
          </div>

          {/* Filter Presets Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {SCAN_FILTER_PRESETS.map((preset) => {
              const isSelected = selectedFilter === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleChangeFilter(preset.id)}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-zinc-100 border-zinc-100 text-zinc-950 shadow-subtle'
                      : 'bg-surface-100 border-border text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  <p className="text-xs font-semibold">{preset.label}</p>
                  <span
                    className={`text-[9px] font-mono mt-1 ${
                      isSelected ? 'text-zinc-700' : 'text-zinc-500'
                    }`}
                  >
                    {preset.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Fine Tuning Sliders */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Brightness</span>
                <span className="font-mono">{brightness}</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                value={brightness}
                onChange={(e) => handleSliderChange(parseInt(e.target.value, 10), contrast)}
                className="w-full h-1.5 bg-surface-100 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Contrast</span>
                <span className="font-mono">{contrast}</span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                value={contrast}
                onChange={(e) => handleSliderChange(brightness, parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-surface-100 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setStep('crop')}
              className="px-4 py-2.5 btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={handleSavePageToTray}
              className="flex-1 py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Page to Document Tray</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 4: MULTI-PAGE TRAY & EXPORT
          ======================================================== */}
      {step === 'tray' && (
        <div className="p-4 sm:p-6 rounded-xl bg-surface-200 border border-border space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Document Tray ({pages.length} Scanned Pages)
              </h3>
              <p className="text-xs text-zinc-400 font-mono">
                {pages.reduce((acc, p) => acc + p.blob.size, 0) > 0 &&
                  formatBytes(pages.reduce((acc, p) => acc + p.blob.size, 0))}
              </p>
            </div>

            <button
              onClick={() => setStep('camera')}
              className="px-3 py-1.5 btn-primary text-xs flex items-center gap-1.5 cursor-pointer shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Scan Next Page</span>
            </button>
          </div>

          {/* Pages Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className="p-2 rounded-lg bg-surface-100 border border-border text-xs flex flex-col justify-between"
              >
                <div className="aspect-[3/4] bg-black/40 rounded overflow-hidden relative mb-1.5">
                  <img
                    src={p.dataUrl}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[10px]">
                    Page {idx + 1}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border text-[11px]">
                  <span className="font-mono text-zinc-400">{p.filter}</span>
                  <button
                    onClick={() => setPages((prev) => prev.filter((item) => item.id !== p.id))}
                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-surface-50 transition cursor-pointer"
                    title="Delete page"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Export Settings */}
          <div className="p-3.5 rounded-lg bg-surface-100 border border-border space-y-3 text-xs">
            <span className="font-semibold text-white block">Paper Format Standard:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'A4', label: 'A4 Standard' },
                { id: 'F4', label: 'F4 Folio' },
                { id: 'Letter', label: 'US Letter' },
                { id: 'Fit', label: 'Fit to Size' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setPageSize(s.id as any)}
                  className={`py-1.5 rounded border font-medium transition cursor-pointer ${
                    pageSize === s.id
                      ? 'bg-zinc-800 border-zinc-500 text-white shadow-sm'
                      : 'bg-surface-50 border-border text-zinc-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={handleExportPdf}
              disabled={isExporting || pages.length === 0}
              className="py-3 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>Export {pages.length} Pages as PDF</span>
            </button>

            <button
              onClick={handleExportZip}
              disabled={isExporting || pages.length === 0}
              className="py-3 btn-secondary text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export as Images (ZIP)</span>
            </button>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {exportResult && (
        <ResultModal
          isOpen={showResultModal}
          onClose={() => setShowResultModal(false)}
          onDownload={() => downloadUint8Array(exportResult.bytes, exportResult.filename)}
          onReset={() => {
            setPages([]);
            setExportResult(null);
            setStep('camera');
          }}
          title="Document exported successfully"
          filename={exportResult.filename}
          fileSize={exportResult.bytes.byteLength}
          stats={[
            { label: 'Scanned Pages', value: pages.length },
            { label: 'Format', value: pageSize },
            { label: 'Filter Style', value: selectedFilter.toUpperCase() },
          ]}
          downloadLabel="Download Scanned Document"
        />
      )}
    </div>
  );
}

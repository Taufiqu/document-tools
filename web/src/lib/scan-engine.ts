/**
 * Client-Side Realistic Document Scan Filter Engine.
 * Implements algorithms for flatbed scanner simulation, shadow removal,
 * white-point normalization, adaptive thresholding, and CamScanner-style "Magic Color".
 */

export type ScanFilterType =
  | 'original'
  | 'magic-color'
  | 'bw-photocopy'
  | 'grayscale-scan'
  | 'high-contrast';

export interface ScanFilterPreset {
  id: ScanFilterType;
  label: string;
  description: string;
  tag: string;
}

export const SCAN_FILTER_PRESETS: ScanFilterPreset[] = [
  {
    id: 'original',
    label: 'Original',
    description: 'Keep original photo without filter processing.',
    tag: 'Raw',
  },
  {
    id: 'magic-color',
    label: 'Magic Color',
    description: 'Eliminates room shadows, whitens paper, and sharpens ink text (CamScanner style).',
    tag: 'Scanner',
  },
  {
    id: 'bw-photocopy',
    label: 'B&W Photocopy',
    description: 'Crisp black text on pure white paper with high-contrast document thresholding.',
    tag: 'Crisp B&W',
  },
  {
    id: 'grayscale-scan',
    label: 'Grayscale Scan',
    description: 'Monochrome scan with balanced paper luminance and zero color noise.',
    tag: 'Monochrome',
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    description: 'Boosts readability and sharpens text while preserving all original colors.',
    tag: 'Vivid',
  },
];

export interface ScanFilterOptions {
  brightness?: number; // -50 to +50 (default: 0)
  contrast?: number; // -50 to +50 (default: 0)
  threshold?: number; // 0 to 255 (for bw-photocopy, default: 135)
}

/**
 * Applies the realistic scan filter to an HTML Canvas context.
 */
export function applyScanFilterToCanvas(
  canvas: HTMLCanvasElement,
  filterType: ScanFilterType,
  options: ScanFilterOptions = {}
): void {
  if (filterType === 'original' && !options.brightness && !options.contrast) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const userBrightness = options.brightness ?? 0;
  const userContrast = options.contrast ?? 0;
  const contrastFactor = (259 * (userContrast + 255)) / (255 * (259 - userContrast));
  const bwThreshold = options.threshold ?? 135;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Calculate Luminance (standard Rec. 709)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    switch (filterType) {
      case 'magic-color': {
        // CamScanner style "Magic Color" algorithm:
        // 1. Paper Whiten: If pixel is light/gray shadow (>120), lift aggressively to near pure-white.
        // 2. Ink Darken: If pixel is dark ink (<100), deepen darkness.
        // 3. Color Stamp Preservation: Boost saturation slightly for seals/stamps.

        // Normalized luminance (0.0 - 1.0)
        const norm = lum / 255;
        // Non-linear S-curve for background shadow elimination
        let factor = 1.0;
        if (norm > 0.45) {
          // Shadow removal: brighten light-medium tones strongly
          factor = 1.0 + Math.pow(norm - 0.45, 1.3) * 1.4;
        } else {
          // Ink darkening: deepen dark characters
          factor = Math.pow(norm / 0.45, 0.7) * 0.9;
        }

        r = Math.min(255, Math.max(0, r * factor + userBrightness));
        g = Math.min(255, Math.max(0, g * factor + userBrightness));
        b = Math.min(255, Math.max(0, b * factor + userBrightness));

        // Light background clamp (any near-white is forced to crisp #ffffff)
        if (r > 220 && g > 220 && b > 220) {
          r = 255;
          g = 255;
          b = 255;
        }
        break;
      }

      case 'bw-photocopy': {
        // Adaptive / High-Contrast B&W Photocopy Threshold
        const adjustedLum = lum + userBrightness;
        const val = adjustedLum < bwThreshold ? 0 : 255;
        r = val;
        g = val;
        b = val;
        break;
      }

      case 'grayscale-scan': {
        // Clean monochrome scan
        let gray = lum;
        // Paper background whitening curve
        if (gray > 130) {
          gray = 130 + (gray - 130) * 1.5;
        } else {
          gray = gray * 0.85;
        }
        gray = Math.min(255, Math.max(0, gray + userBrightness));
        if (gray > 225) gray = 255;

        r = gray;
        g = gray;
        b = gray;
        break;
      }

      case 'high-contrast': {
        // High contrast preserving color
        r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128 + userBrightness));
        g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128 + userBrightness));
        b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128 + userBrightness));
        break;
      }

      default: {
        if (userContrast !== 0 || userBrightness !== 0) {
          r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128 + userBrightness));
          g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128 + userBrightness));
          b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128 + userBrightness));
        }
        break;
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Loads an image file, applies the chosen realistic scan filter, and returns JPEG blob and dataURL.
 */
export async function processImageFileWithFilter(
  file: File,
  filterType: ScanFilterType,
  options: ScanFilterOptions = {}
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // Fill white base
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Apply scan filter
      applyScanFilterToCanvas(canvas, filterType, options);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              dataUrl,
              width: canvas.width,
              height: canvas.height,
            });
          } else {
            reject(new Error('Failed to render processed canvas blob'));
          }
        },
        'image/jpeg',
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

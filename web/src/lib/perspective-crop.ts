/**
 * Client-Side Document Corner Detection and Perspective Warping Engine.
 * Enables 4-point quadrilateral detection and mathematical perspective transformation
 * directly onto HTML5 2D Canvas contexts.
 */

export interface Point {
  x: number;
  y: number;
}

export interface QuadCorners {
  tl: Point; // Top-Left
  tr: Point; // Top-Right
  br: Point; // Bottom-Right
  bl: Point; // Bottom-Left
}

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Automatically detects 4 document corners in an image using edge gradient analysis.
 * Falls back to an inset rectangular frame if high-contrast edges are not distinct.
 */
export function detectDocumentCorners(
  source: HTMLImageElement | HTMLCanvasElement
): QuadCorners {
  const srcW = 'naturalWidth' in source ? source.naturalWidth || source.width : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight || source.height : source.height;

  // Default inset fallback (8% margin)
  const defaultQuad: QuadCorners = {
    tl: { x: srcW * 0.08, y: srcH * 0.08 },
    tr: { x: srcW * 0.92, y: srcH * 0.08 },
    br: { x: srcW * 0.92, y: srcH * 0.92 },
    bl: { x: srcW * 0.08, y: srcH * 0.92 },
  };

  try {
    // Process on small thumbnail canvas for real-time speed (<10ms)
    const targetW = 320;
    const scale = targetW / srcW;
    const targetH = Math.round(srcH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return defaultQuad;

    ctx.drawImage(source, 0, 0, targetW, targetH);
    const imgData = ctx.getImageData(0, 0, targetW, targetH);
    const data = imgData.data;

    // Convert to grayscale
    const gray = new Uint8Array(targetW * targetH);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Sobel gradient magnitude calculation
    const edges = new Uint8Array(targetW * targetH);
    for (let y = 1; y < targetH - 1; y++) {
      for (let x = 1; x < targetW - 1; x++) {
        const idx = y * targetW + x;
        const gx =
          -gray[idx - targetW - 1] +
          gray[idx - targetW + 1] -
          2 * gray[idx - 1] +
          2 * gray[idx + 1] -
          gray[idx + targetW - 1] +
          gray[idx + targetW + 1];

        const gy =
          -gray[idx - targetW - 1] -
          2 * gray[idx - targetW] -
          gray[idx - targetW + 1] +
          gray[idx + targetW - 1] +
          2 * gray[idx + targetW] +
          gray[idx + targetW + 1];

        edges[idx] = Math.min(255, Math.hypot(gx, gy));
      }
    }

    // Find extreme edge points in 4 quadrants
    let bestTl = { x: targetW * 0.1, y: targetH * 0.1, score: -1 };
    let bestTr = { x: targetW * 0.9, y: targetH * 0.1, score: -1 };
    let bestBr = { x: targetW * 0.9, y: targetH * 0.9, score: -1 };
    let bestBl = { x: targetW * 0.1, y: targetH * 0.9, score: -1 };

    const halfW = targetW / 2;
    const halfH = targetH / 2;

    for (let y = 10; y < targetH - 10; y += 2) {
      for (let x = 10; x < targetW - 10; x += 2) {
        const idx = y * targetW + x;
        const edgeVal = edges[idx];
        if (edgeVal < 60) continue;

        // Top-Left quadrant
        if (x < halfW && y < halfH) {
          const distToCorner = Math.hypot(x, y);
          const score = edgeVal - distToCorner * 0.4;
          if (score > bestTl.score) bestTl = { x, y, score };
        }
        // Top-Right quadrant
        else if (x >= halfW && y < halfH) {
          const distToCorner = Math.hypot(targetW - x, y);
          const score = edgeVal - distToCorner * 0.4;
          if (score > bestTr.score) bestTr = { x, y, score };
        }
        // Bottom-Right quadrant
        else if (x >= halfW && y >= halfH) {
          const distToCorner = Math.hypot(targetW - x, targetH - y);
          const score = edgeVal - distToCorner * 0.4;
          if (score > bestBr.score) bestBr = { x, y, score };
        }
        // Bottom-Left quadrant
        else {
          const distToCorner = Math.hypot(x, targetH - y);
          const score = edgeVal - distToCorner * 0.4;
          if (score > bestBl.score) bestBl = { x, y, score };
        }
      }
    }

    if (
      bestTl.score > 0 &&
      bestTr.score > 0 &&
      bestBr.score > 0 &&
      bestBl.score > 0
    ) {
      return {
        tl: { x: bestTl.x / scale, y: bestTl.y / scale },
        tr: { x: bestTr.x / scale, y: bestTr.y / scale },
        br: { x: bestBr.x / scale, y: bestBr.y / scale },
        bl: { x: bestBl.x / scale, y: bestBl.y / scale },
      };
    }
  } catch (err) {
    console.warn('Corner detection error, using fallback:', err);
  }

  return defaultQuad;
}

/**
 * Warps a 4-point quadrilateral perspective into a flat rectangular document canvas.
 * Implemented using triangular affine texture interpolation on HTML5 2D Canvas.
 */
export function warpPerspective(
  source: HTMLImageElement | HTMLCanvasElement,
  corners: QuadCorners,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  // Calculate destination dimensions based on average edge lengths or standard A4 ratio
  const topW = distance(corners.tl, corners.tr);
  const botW = distance(corners.bl, corners.br);
  const leftH = distance(corners.tl, corners.bl);
  const rightH = distance(corners.tr, corners.br);

  const avgW = Math.round((topW + botW) / 2);
  const avgH = Math.round((leftH + rightH) / 2);

  const dstWidth = targetWidth || Math.max(100, avgW);
  const dstHeight = targetHeight || Math.max(100, avgH);

  const canvas = document.createElement('canvas');
  canvas.width = dstWidth;
  canvas.height = dstHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Split quadrilateral into two triangles and render with affine transform
  // Triangle 1: TL, TR, BL -> Dst (0,0), (W,0), (0,H)
  drawTriangleAffine(
    ctx,
    source,
    corners.tl,
    corners.tr,
    corners.bl,
    { x: 0, y: 0 },
    { x: dstWidth, y: 0 },
    { x: 0, y: dstHeight }
  );

  // Triangle 2: TR, BR, BL -> Dst (W,0), (W,H), (0,H)
  drawTriangleAffine(
    ctx,
    source,
    corners.tr,
    corners.br,
    corners.bl,
    { x: dstWidth, y: 0 },
    { x: dstWidth, y: dstHeight },
    { x: 0, y: dstHeight }
  );

  return canvas;
}

/**
 * Maps a single source triangle to a destination triangle via 2D affine matrix.
 */
function drawTriangleAffine(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLCanvasElement,
  s0: Point,
  s1: Point,
  s2: Point,
  d0: Point,
  d1: Point,
  d2: Point
): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  // Compute affine matrix (denom = s0.x*(s1.y-s2.y) - s1.x*(s0.y-s2.y) + s2.x*(s0.y-s1.y))
  const denom = s0.x * (s1.y - s2.y) - s1.x * (s0.y - s2.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denom) < 1e-7) {
    ctx.restore();
    return;
  }

  const m11 = -(s0.y * (d1.x - d2.x) - s1.y * (d0.x - d2.x) + s2.y * (d0.x - d1.x)) / denom;
  const m12 = (s0.y * (d1.y - d2.y) - s1.y * (d0.y - d2.y) + s2.y * (d0.y - d1.y)) / denom;
  const m21 = (s0.x * (d1.x - d2.x) - s1.x * (d0.x - d2.x) + s2.x * (d0.x - d1.x)) / denom;
  const m22 = -(s0.x * (d1.y - d2.y) - s1.x * (d0.y - d2.y) + s2.x * (d0.y - d1.y)) / denom;
  const dx =
    (s0.x * (s1.y * d2.x - s2.y * d1.x) -
      s1.x * (s0.y * d2.x - s2.y * d0.x) +
      s2.x * (s0.y * d1.x - s1.y * d0.x)) /
    denom;
  const dy =
    (s0.x * (s1.y * d2.y - s2.y * d1.y) -
      s1.x * (s0.y * d2.y - s2.y * d0.y) +
      s2.x * (s0.y * d1.y - s1.y * d0.y)) /
    denom;

  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}

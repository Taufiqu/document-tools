import type { QuadCorners, Point } from './perspective-crop';

type OpenCv = any;

let openCvPromise: Promise<OpenCv> | null = null;

async function getOpenCv(): Promise<OpenCv> {
  if (!openCvPromise) {
    openCvPromise = import('@techstark/opencv-js').then(async (module) => {
      const candidate = (module as { default?: OpenCv }).default ?? module;
      return candidate instanceof Promise ? await candidate : candidate;
    });
  }

  return openCvPromise;
}

function orderCorners(points: Point[]): QuadCorners {
  const sum = (point: Point) => point.x + point.y;
  const diff = (point: Point) => point.x - point.y;

  return {
    tl: points.reduce((best, point) => (sum(point) < sum(best) ? point : best)),
    tr: points.reduce((best, point) => (diff(point) > diff(best) ? point : best)),
    br: points.reduce((best, point) => (sum(point) > sum(best) ? point : best)),
    bl: points.reduce((best, point) => (diff(point) < diff(best) ? point : best)),
  };
}

/**
 * Finds the largest convex four-corner contour in a document photo.
 * OpenCV is loaded only on demand and every WASM object is disposed before return.
 */
export async function detectDocumentWithOpenCv(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<QuadCorners | null> {
  const cv = await getOpenCv();
  const sourceWidth = 'naturalWidth' in source ? source.naturalWidth || source.width : source.width;
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight || source.height : source.height;
  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const closed = new cv.Mat();
  const hierarchy = new cv.Mat();
  const contours = new cv.MatVector();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 150);
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
    cv.findContours(closed, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const minArea = width * height * 0.12;
    let bestArea = 0;
    let bestPoints: Point[] | null = null;

    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      const approximation = new cv.Mat();
      try {
        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approximation, perimeter * 0.02, true);
        const area = Math.abs(cv.contourArea(contour));

        if (
          approximation.rows === 4 &&
          area > minArea &&
          area > bestArea &&
          cv.isContourConvex(approximation)
        ) {
          const values = approximation.data32S as Int32Array;
          bestPoints = Array.from({ length: 4 }, (_, pointIndex) => ({
            x: values[pointIndex * 2] / scale,
            y: values[pointIndex * 2 + 1] / scale,
          }));
          bestArea = area;
        }
      } finally {
        approximation.delete();
        contour.delete();
      }
    }

    return bestPoints ? orderCorners(bestPoints) : null;
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    closed.delete();
    hierarchy.delete();
    contours.delete();
    kernel.delete();
  }
}

/** Trims near-white page margins while preserving a small, configurable safe border. */
export async function trimCanvasMarginsWithOpenCv(
  source: HTMLCanvasElement,
  padding = 16,
): Promise<HTMLCanvasElement> {
  const cv = await getOpenCv();
  const src = cv.imread(source);
  const gray = new cv.Mat();
  const foreground = new cv.Mat();
  const points = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, foreground, 245, 255, cv.THRESH_BINARY_INV);
    cv.findNonZero(foreground, points);

    if (points.rows === 0) return source;

    const rect = cv.boundingRect(points);
    const left = Math.max(0, rect.x - padding);
    const top = Math.max(0, rect.y - padding);
    const right = Math.min(source.width, rect.x + rect.width + padding);
    const bottom = Math.min(source.height, rect.y + rect.height + padding);

    if (right - left < 24 || bottom - top < 24) return source;

    const cropped = document.createElement('canvas');
    cropped.width = right - left;
    cropped.height = bottom - top;
    const context = cropped.getContext('2d');
    if (!context) return source;
    context.drawImage(source, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    return cropped;
  } finally {
    src.delete();
    gray.delete();
    foreground.delete();
    points.delete();
  }
}

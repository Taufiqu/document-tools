import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import saveAs from 'file-saver';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function downloadBlob(blob: Blob, filename: string): void {
  saveAs(blob, filename);
}

export function downloadUint8Array(data: Uint8Array, filename: string, mimeType = 'application/pdf'): void {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  saveAs(blob, filename);
}

export async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export function stripExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Returns clean human-readable date-time timestamp: YYYY-MM-DD_HHmmss
 * Example: 2026-08-14_193905
 */
export function getTimestampString(date = new Date()): string {
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}_${HH}${mm}${ss}`;
}

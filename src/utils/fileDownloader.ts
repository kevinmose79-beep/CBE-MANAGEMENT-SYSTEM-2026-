import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import fileSaver from 'file-saver';
const saveAs = (fileSaver as any)?.saveAs || (fileSaver as any)?.default?.saveAs || fileSaver;
import type { jsPDF } from 'jspdf';

export interface FileDownloadOptions {
  dialogTitle?: string;
  mimeType?: string;
}

/**
 * Converts a Blob to a base64 string without data-URI header.
 * Uses native FileReader.readAsDataURL() where available for maximum performance in WebView/browser,
 * with a resilient fallback to ArrayBuffer conversion.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    try {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (!result) {
            resolve('');
            return;
          }
          const commaIdx = result.indexOf(',');
          resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Failed to read Blob as base64'));
        reader.readAsDataURL(blob);
      });
    } catch {
      // Fallback to arrayBuffer if FileReader encounters an error
    }
  }

  if (typeof blob.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    return binaryToBase64(buffer);
  }

  throw new Error('No Blob reader available in environment');
}

/**
 * Converts an ArrayBuffer or Uint8Array to a base64 string.
 * Optimized with Node.js Buffer when available, and chunked 32KB processing
 * with btoa in browser runtimes to avoid call-stack overflows and excessive allocations.
 */
export function binaryToBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }

  const len = bytes.byteLength;
  const CHUNK_SIZE = 0x8000; // 32KB safe batch size
  let binary = '';
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  throw new Error('No base64 encoder available in environment');
}

/**
 * Universal platform-aware file saver.
 * 
 * - Web Browser: Uses standard browser download mechanisms (file-saver / Blob URL).
 * - Capacitor Android: Writes file to native app cache and presents native Android Share / View dialog.
 */
export async function saveFile(
  data: Blob | ArrayBuffer | Uint8Array | string,
  fileName: string,
  options?: FileDownloadOptions
): Promise<void> {
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

  if (!isNative) {
    // --- Web Browser Path ---
    if (typeof data === 'string') {
      const mime = options?.mimeType || 'text/plain;charset=utf-8';
      const blob = new Blob([data], { type: mime });
      saveAs(blob, fileName);
    } else if (data instanceof Blob) {
      saveAs(data, fileName);
    } else {
      const mime = options?.mimeType || 'application/octet-stream';
      const blob = new Blob([data], { type: mime });
      saveAs(blob, fileName);
    }
    return;
  }

  // --- Capacitor Android / Native Path ---
  let base64Data: string;

  if (typeof data === 'string') {
    // If it's a string, convert to UTF-8 encoded base64
    const encoder = new TextEncoder();
    base64Data = binaryToBase64(encoder.encode(data));
  } else if (data instanceof Blob) {
    base64Data = await blobToBase64(data);
  } else {
    base64Data = binaryToBase64(data);
  }

  // Sanitize filename to avoid invalid filesystem paths
  const safeName = fileName.replace(/[/\\?%*:|"<>]/g, '_');

  try {
    const writeResult = await Filesystem.writeFile({
      path: safeName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    if (writeResult && writeResult.uri) {
      try {
        await Share.share({
          title: fileName,
          url: writeResult.uri,
          dialogTitle: options?.dialogTitle || `Open or Share ${fileName}`,
        });
      } catch (shareErr: any) {
        // User cancelling the share sheet is normal and should not trigger a fatal error
        if (shareErr?.message && !shareErr.message.includes('canceled') && !shareErr.message.includes('dismissed')) {
          console.warn('[fileDownloader] Share presentation notice:', shareErr);
        }
      }
    }
  } catch (fsErr) {
    console.error('[fileDownloader] Failed to write file to native filesystem:', fsErr);
    throw fsErr;
  }
}

/**
 * Universal platform-aware jsPDF document saver.
 * 
 * - Web Browser: Directly calls doc.save(fileName) preserving 100% existing browser download behavior.
 * - Capacitor Android: Extracts document as binary Blob, writes to native cache, and presents native Android Share / View dialog.
 */
export async function savePdf(
  doc: jsPDF,
  fileName: string,
  options?: FileDownloadOptions
): Promise<void> {
  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();

  if (!isNative) {
    // Web Browser: Exact existing jsPDF save
    doc.save(fileName);
    return;
  }

  // Native Android: Export blob and save via native filesystem + share
  const blob = doc.output('blob');
  await saveFile(blob, fileName, {
    ...options,
    mimeType: 'application/pdf',
    dialogTitle: options?.dialogTitle || `Open or Share ${fileName}`,
  });
}

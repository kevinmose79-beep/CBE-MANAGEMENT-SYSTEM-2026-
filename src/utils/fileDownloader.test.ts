import { describe, it, expect, vi, beforeEach } from 'vitest';
import { binaryToBase64, blobToBase64, saveFile, savePdf } from './fileDownloader';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import * as fileSaver from 'file-saver';

// Mock dependencies
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn().mockResolvedValue({ uri: 'file:///data/user/0/com.cbe.system/cache/test_file.pdf' }),
  },
  Directory: {
    Cache: 'CACHE',
    Documents: 'DOCUMENTS',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('file-saver', () => {
  const saveAs = vi.fn();
  return {
    default: { saveAs },
    saveAs,
  };
});

describe('fileDownloader Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('binaryToBase64 & blobToBase64 conversion', () => {
    it('accurately encodes Uint8Array to base64', () => {
      const text = 'Hello CBE System 2026';
      const encoder = new TextEncoder();
      const uint8 = encoder.encode(text);
      const base64 = binaryToBase64(uint8);
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded).toBe(text);
    });

    it('accurately encodes ArrayBuffer to base64', () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 255, 254, 128]).buffer;
      const base64 = binaryToBase64(buffer);
      const decoded = Buffer.from(base64, 'base64');
      expect(Array.from(decoded)).toEqual([0, 1, 2, 3, 255, 254, 128]);
    });

    it('accurately encodes binary Blob without corruption', async () => {
      const binaryData = new Uint8Array([67, 66, 69, 32, 50, 48, 50, 54]); // 'CBE 2026'
      const blob = new Blob([binaryData], { type: 'application/octet-stream' });
      const base64 = await blobToBase64(blob);
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      expect(decoded).toBe('CBE 2026');
    });

    it('accurately encodes large binary data (1MB+) without stack overflow or data corruption', async () => {
      const size = 1024 * 1024; // 1MB
      const uint8 = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        uint8[i] = (i * 17) % 256;
      }
      const base64 = binaryToBase64(uint8);
      const decoded = Buffer.from(base64, 'base64');
      expect(decoded.length).toBe(size);
      expect(decoded[0]).toBe(uint8[0]);
      expect(decoded[500000]).toBe(uint8[500000]);
      expect(decoded[size - 1]).toBe(uint8[size - 1]);
    });

    it('uses FileReader when available and extracts clean base64 data without URI header', async () => {
      const originalFileReader = (globalThis as any).FileReader;
      try {
        const mockBase64 = 'JVBERi0xLjQKJcTl8uXr...';
        class MockFileReader {
          result: string | null = null;
          onloadend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          readAsDataURL(_blob: Blob) {
            this.result = `data:application/pdf;base64,${mockBase64}`;
            if (this.onloadend) this.onloadend();
          }
        }
        (globalThis as any).FileReader = MockFileReader;

        const blob = new Blob(['mock-pdf'], { type: 'application/pdf' });
        const result = await blobToBase64(blob);
        expect(result).toBe(mockBase64);
      } finally {
        (globalThis as any).FileReader = originalFileReader;
      }
    });

    it('falls back cleanly to arrayBuffer if FileReader throws or is unavailable', async () => {
      const originalFileReader = (globalThis as any).FileReader;
      try {
        class FaultyFileReader {
          onloadend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          readAsDataURL() {
            if (this.onerror) this.onerror();
          }
        }
        (globalThis as any).FileReader = FaultyFileReader;

        const binary = new Uint8Array([72, 101, 108, 108, 111]); // 'Hello'
        const blob = new Blob([binary]);
        const result = await blobToBase64(blob);
        expect(Buffer.from(result, 'base64').toString('utf-8')).toBe('Hello');
      } finally {
        (globalThis as any).FileReader = originalFileReader;
      }
    });
  });

  describe('saveFile — Web Platform Mode', () => {
    beforeEach(() => {
      (Capacitor.isNativePlatform as any).mockReturnValue(false);
    });

    it('routes string data to browser fileSaver.saveAs with specified filename', async () => {
      const csvData = 'AdmNo,Name,Score\nADM01,John Doe,85';
      const fileName = 'Merit_List_Grade_8.csv';

      await saveFile(csvData, fileName, { mimeType: 'text/csv' });

      expect(fileSaver.saveAs).toHaveBeenCalledTimes(1);
      const [savedBlob, savedName] = (fileSaver.saveAs as any).mock.calls[0];
      expect(savedName).toBe(fileName);
      expect(savedBlob).toBeInstanceOf(Blob);
      expect(savedBlob.type).toBe('text/csv');
    });

    it('routes Blob data to browser fileSaver.saveAs', async () => {
      const blob = new Blob(['zip-content-mock'], { type: 'application/zip' });
      const fileName = 'Reports_Batch.zip';

      await saveFile(blob, fileName);

      expect(fileSaver.saveAs).toHaveBeenCalledWith(blob, fileName);
      expect(Filesystem.writeFile).not.toHaveBeenCalled();
      expect(Share.share).not.toHaveBeenCalled();
    });
  });

  describe('saveFile — Capacitor Android Native Mode', () => {
    beforeEach(() => {
      (Capacitor.isNativePlatform as any).mockReturnValue(true);
    });

    it('writes file to Cache directory and invokes Share.share with native file URI', async () => {
      const csvData = 'AdmNo,Name,Score\nADM02,Mary Jane,92';
      const fileName = 'Learners_Export.csv';

      await saveFile(csvData, fileName, { mimeType: 'text/csv' });

      expect(fileSaver.saveAs).not.toHaveBeenCalled();
      expect(Filesystem.writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'Learners_Export.csv',
          directory: Directory.Cache,
          recursive: true,
        })
      );
      expect(Share.share).toHaveBeenCalledWith(
        expect.objectContaining({
          title: fileName,
          url: 'file:///data/user/0/com.cbe.system/cache/test_file.pdf',
        })
      );
    });

    it('sanitizes filename to prevent invalid filesystem path characters', async () => {
      const data = 'report data';
      const dirtyName = 'Report/Form:Grade*8?West.csv';

      await saveFile(data, dirtyName);

      expect(Filesystem.writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'Report_Form_Grade_8_West.csv',
        })
      );
    });
  });

  describe('savePdf — Platform Differentiation', () => {
    it('calls doc.save on web platform without filesystem writing', async () => {
      (Capacitor.isNativePlatform as any).mockReturnValue(false);

      const mockDoc: any = {
        save: vi.fn(),
        output: vi.fn(),
      };

      await savePdf(mockDoc, 'Report_Card_ADM001.pdf');

      expect(mockDoc.save).toHaveBeenCalledWith('Report_Card_ADM001.pdf');
      expect(mockDoc.output).not.toHaveBeenCalled();
      expect(Filesystem.writeFile).not.toHaveBeenCalled();
    });

    it('extracts blob and writes to native filesystem on Android platform', async () => {
      (Capacitor.isNativePlatform as any).mockReturnValue(true);

      const mockPdfBlob = new Blob(['%PDF-1.4 mock content'], { type: 'application/pdf' });
      const mockDoc: any = {
        save: vi.fn(),
        output: vi.fn().mockReturnValue(mockPdfBlob),
      };

      await savePdf(mockDoc, 'Report_Card_ADM002.pdf');

      expect(mockDoc.save).not.toHaveBeenCalled();
      expect(mockDoc.output).toHaveBeenCalledWith('blob');
      expect(Filesystem.writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: 'Report_Card_ADM002.pdf',
          directory: Directory.Cache,
        })
      );
      expect(Share.share).toHaveBeenCalled();
    });
  });
});

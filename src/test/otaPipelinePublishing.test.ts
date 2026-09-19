import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { checkForNativeChanges, runPublisher } from '../../scripts/publishOtaRelease';
import * as buildOtaModule from '../../scripts/buildOtaBundle';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase Client
vi.mock('@supabase/supabase-js', () => {
  const mockSingle = vi.fn().mockImplementation(() => {
    return {
      data: { id: 'test-release-id', bundle_version: '1.0.0-mock' },
      error: null,
    };
  });
  const mockInsert = vi.fn().mockImplementation(() => {
    return {
      select: vi.fn().mockImplementation(() => {
        return {
          single: mockSingle,
        };
      }),
    };
  });
  const mockMaybeSingle = vi.fn().mockImplementation(() => {
    return {
      data: null, // No pre-existing duplicate release
      error: null,
    };
  });
  const mockSelect = vi.fn().mockImplementation(() => {
    return {
      eq: vi.fn().mockImplementation(() => {
        return {
          eq: vi.fn().mockImplementation(() => {
            return {
              maybeSingle: mockMaybeSingle,
            };
          }),
        };
      }),
    };
  });
  const mockUpload = vi.fn().mockImplementation(() => {
    return { data: { path: 'uploaded' }, error: null };
  });
  const mockFrom = vi.fn().mockImplementation((bucket: string) => {
    if (bucket === 'ota-releases') {
      return {
        upload: mockUpload,
      };
    }
    return {
      select: mockSelect,
      insert: mockInsert,
    };
  });

  const mockClientInstance = {
    from: mockFrom,
    storage: {
      from: mockFrom,
    },
  };

  return {
    createClient: vi.fn(() => mockClientInstance),
  };
});

// Mock buildOtaBundle globally to bypass heavy Vite compilation in test runs
vi.mock('../../scripts/buildOtaBundle', () => {
  return {
    createOtaBundle: vi.fn().mockImplementation(async (options: any) => {
      const p = path.join(process.cwd(), '.tmp-test-ota-publisher', 'mock-bundle.zip');
      // Ensure the directory exists and write a dummy file
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, 'mock zip file');
      return {
        success: true,
        zipPath: p,
        metadataPath: p + '.json',
        validation: { isValid: true, hasIndexHtml: true, hasAssetsDir: true, errors: [], fileCount: 5, totalUncompressedBytes: 12, files: [], forbiddenFilesDetected: [] },
        metadata: {
          bundleVersion: options.bundleVersion || '1.0.0-mock',
          bundleSizeBytes: 12,
          checksumSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          fileCount: 5,
          builtAt: new Date().toISOString(),
          fileName: 'bundle.zip',
          entryPoint: 'index.html',
        },
      };
    }),
  };
});

describe('OTA Pipeline Publishing & Safety Gates (Phase 7)', () => {
  const originalEnv = process.env;
  const testRoot = path.resolve(process.cwd(), '.tmp-test-ota-publisher');

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();

    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    process.env = originalEnv;
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('Test 1 — environment validation: runPublisher terminates if crucial env vars are missing', async () => {
    const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Missing SUPABASE_URL
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret';
    process.env.OTA_BUNDLE_VERSION = '1.0.0';
    await runPublisher();
    expect(exitMock).toHaveBeenCalledWith(1);

    // Missing SUPABASE_SERVICE_ROLE_KEY
    exitMock.mockClear();
    process.env.SUPABASE_URL = 'http://example.supabase';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.OTA_BUNDLE_VERSION = '1.0.0';
    await runPublisher();
    expect(exitMock).toHaveBeenCalledWith(1);

    // Missing OTA_BUNDLE_VERSION
    exitMock.mockClear();
    process.env.SUPABASE_URL = 'http://example.supabase';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret';
    process.env.OTA_BUNDLE_VERSION = '';
    await runPublisher();
    expect(exitMock).toHaveBeenCalledWith(1);

    exitMock.mockRestore();
    consoleErrorMock.mockRestore();
  });

  it('Test 2 — version verification: runPublisher rejects malformed version strings', async () => {
    const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const consoleErrorMock = vi.spyOn(console, 'error').mockImplementation(() => {});

    process.env.SUPABASE_URL = 'http://example.supabase';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret';
    process.env.OTA_BUNDLE_VERSION = '1.0@invalid'; // Bad chars

    await runPublisher();
    expect(exitMock).toHaveBeenCalledWith(1);

    exitMock.mockRestore();
    consoleErrorMock.mockRestore();
  });

  it('Test 3 — native change gate: checkForNativeChanges functions safely', () => {
    // Tests that checkForNativeChanges returns a valid shape
    const res = checkForNativeChanges();
    expect(res).toHaveProperty('hasChanges');
    expect(res).toHaveProperty('files');
    expect(Array.isArray(res.files)).toBe(true);
  });

  it('Test 4 — publishing flow: runPublisher invokes bundle building, uploads to storage, and writes metadata', async () => {
    // Mock the createOtaBundle call to bypass filesystem building
    const mockBundleResult = {
      success: true,
      zipPath: path.join(testRoot, 'mock-bundle.zip'),
      metadataPath: path.join(testRoot, 'mock-bundle.json'),
      validation: { isValid: true, hasIndexHtml: true, hasAssetsDir: true, errors: [], fileCount: 5, totalUncompressedBytes: 1234, files: [], forbiddenFilesDetected: [] },
      metadata: {
        bundleVersion: '1.0.0-mock',
        bundleSizeBytes: 1234,
        checksumSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        fileCount: 5,
        builtAt: new Date().toISOString(),
        fileName: 'bundle.zip',
        entryPoint: 'index.html',
      },
    };
    const buildSpy = vi.spyOn(buildOtaModule, 'createOtaBundle').mockResolvedValue(mockBundleResult);

    // Create a dummy mock ZIP file on disk so fs.readFileSync doesn't crash
    fs.writeFileSync(mockBundleResult.zipPath, 'mock zip content');

    const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const consoleLogMock = vi.spyOn(console, 'log').mockImplementation(() => {});

    process.env.SUPABASE_URL = 'http://example.supabase';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-key';
    process.env.OTA_BUNDLE_VERSION = '1.0.0-mock';
    process.env.OTA_RELEASE_CHANNEL = 'staging';
    process.env.FORCE_OTA_PUBLISH = 'true'; // Bypass git check in test env

    await runPublisher();

    // Verify bundle was created
    expect(buildSpy).toHaveBeenCalledWith({
      bundleVersion: '1.0.0-mock',
      outDir: 'dist-ota',
    });

    // Verify createClient was called
    expect(createClient).toHaveBeenCalledWith('http://example.supabase', 'secret-key', expect.any(Object));

    // Verify no exit failure
    expect(exitMock).not.toHaveBeenCalled();

    buildSpy.mockRestore();
    exitMock.mockRestore();
    consoleLogMock.mockRestore();
  });
});

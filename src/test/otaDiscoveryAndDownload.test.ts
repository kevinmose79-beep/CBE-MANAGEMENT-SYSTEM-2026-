/**
 * OTA Discovery & Verified Download Test Suite (Phase 4)
 *
 * Exhaustively tests:
 * 1. Semantic versioning comparison (1.0.9 vs 1.0.10, prerelease, etc.)
 * 2. Native container version compatibility (min/max native versionCode bounds)
 * 3. Candidate release discovery & filtering (channel, status, semver order)
 * 4. Release metadata validation before download
 * 5. Ephemeral signed URL handling without secret leakage
 * 6. Download and checksum integrity verification via Capgo downloader
 * 7. Failure resilience and offline graceful degradation
 * 8. Strict Phase 4 safety boundaries (ZERO calls to next(), set(), reload(), or polling timers)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseSemanticVersion,
  compareSemanticVersions,
  isVersionNewer,
  isReleaseNativeCompatible,
  selectNewestCompatibleRelease,
  OtaReleaseRepository,
} from '../services/otaReleaseService';
import {
  otaUpdateService,
  getRuntimeNativeVersionCode,
  getRuntimeBundleVersion,
} from '../services/otaUpdateService';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { AppRelease, ReleaseChannel } from '../types';

// Mock Capacitor Core & App
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    getInfo: vi.fn().mockResolvedValue({
      name: 'CBE Management System',
      id: 'ke.ac.school.cbe',
      build: '10', // native versionCode = 10
      version: '1.0',
    }),
  },
}));

vi.mock('@capgo/capacitor-updater', () => ({
  CapacitorUpdater: {
    notifyAppReady: vi.fn().mockResolvedValue({
      bundle: { id: 'builtin', version: '1.0.0', downloaded: '1970-01-01', checksum: '', status: 'success' },
    }),
    download: vi.fn().mockImplementation(async (options) => ({
      id: `bundle-${options.version}`,
      version: options.version,
      downloaded: new Date().toISOString(),
      checksum: options.checksum || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'success',
    })),
    next: vi.fn(),
    set: vi.fn(),
    reload: vi.fn(),
    current: vi.fn().mockResolvedValue({
      bundle: { id: 'builtin', version: '1.0.0', downloaded: '1970-01-01', checksum: '', status: 'success' },
      native: '1.0.0',
    }),
    getNextBundle: vi.fn().mockResolvedValue(null),
  },
}));

const VALID_CHECKSUM_1 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const VALID_CHECKSUM_2 = 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e';

function createMockRelease(overrides: Partial<AppRelease> = {}): AppRelease {
  return {
    id: 'rel-' + Math.random().toString(36).substring(2, 9),
    bundle_version: '1.0.1',
    channel: 'production',
    status: 'PUBLISHED',
    storage_bucket: 'ota-releases',
    storage_path: 'ota/production/1.0.1/bundle.zip',
    checksum_sha256: VALID_CHECKSUM_1,
    bundle_size_bytes: 5242880,
    min_native_version_code: 1,
    max_native_version_code: null,
    is_mandatory: false,
    release_notes: 'Standard update notes',
    published_at: new Date().toISOString(),
    created_by: 'admin-uuid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('OTA Discovery & Verified Download (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // SECTION 1: Semantic Version Comparison (Anti-Lexical Sorting)
  // ==========================================================================
  describe('1. Semantic Version Comparison', () => {
    it('1.1 parses standard semver versions', () => {
      const p = parseSemanticVersion('1.2.3');
      expect(p).not.toBeNull();
      expect(p?.major).toBe(1);
      expect(p?.minor).toBe(2);
      expect(p?.patch).toBe(3);
      expect(p?.prerelease).toEqual([]);
    });

    it('1.2 handles "v" prefixes and build metadata cleanly', () => {
      const p = parseSemanticVersion('v2.0.1+build.42');
      expect(p?.major).toBe(2);
      expect(p?.minor).toBe(0);
      expect(p?.patch).toBe(1);
    });

    it('1.3 parses prerelease versions correctly', () => {
      const p = parseSemanticVersion('1.0.0-rc.1');
      expect(p?.major).toBe(1);
      expect(p?.prerelease).toEqual(['rc', '1']);
    });

    it('1.4 CRITICAL: correctly orders 1.0.10 > 1.0.9 (avoiding lexical pitfall)', () => {
      // In lexical sort, "1.0.10" < "1.0.9" (WRONG). Semver must order 1.0.10 > 1.0.9!
      expect(compareSemanticVersions('1.0.10', '1.0.9')).toBe(1);
      expect(compareSemanticVersions('1.0.9', '1.0.10')).toBe(-1);
      expect(isVersionNewer('1.0.10', '1.0.9')).toBe(true);
      expect(isVersionNewer('1.0.9', '1.0.10')).toBe(false);
    });

    it('1.5 correctly compares minor and major version increments', () => {
      expect(compareSemanticVersions('1.1.0', '1.0.10')).toBe(1);
      expect(compareSemanticVersions('2.0.0', '1.9.99')).toBe(1);
      expect(compareSemanticVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('1.6 handles equal versions as not newer', () => {
      expect(compareSemanticVersions('1.0.0', '1.0.0')).toBe(0);
      expect(isVersionNewer('1.0.0', '1.0.0')).toBe(false);
    });

    it('1.7 normal release has higher precedence than prerelease with identical major.minor.patch', () => {
      expect(compareSemanticVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
      expect(compareSemanticVersions('1.0.0-rc.1', '1.0.0')).toBe(-1);
    });
  });

  // ==========================================================================
  // SECTION 2: Native Container Compatibility Rules
  // ==========================================================================
  describe('2. Native Container Compatibility Rules', () => {
    it('2.1 current >= min and max = null is compatible', () => {
      const release = createMockRelease({ min_native_version_code: 8, max_native_version_code: null });
      expect(isReleaseNativeCompatible(release, 10)).toBe(true);
    });

    it('2.2 current == min and current == max is compatible', () => {
      const release = createMockRelease({ min_native_version_code: 8, max_native_version_code: 10 });
      expect(isReleaseNativeCompatible(release, 10)).toBe(true);
      expect(isReleaseNativeCompatible(release, 8)).toBe(true);
      expect(isReleaseNativeCompatible(release, 9)).toBe(true);
    });

    it('2.3 current < min is incompatible', () => {
      const release = createMockRelease({ min_native_version_code: 8, max_native_version_code: null });
      expect(isReleaseNativeCompatible(release, 7)).toBe(false);
    });

    it('2.4 current > max is incompatible', () => {
      const release = createMockRelease({ min_native_version_code: 8, max_native_version_code: 10 });
      expect(isReleaseNativeCompatible(release, 11)).toBe(false);
    });

    it('2.5 rejects invalid or non-numeric current native version codes', () => {
      const release = createMockRelease({ min_native_version_code: 1 });
      expect(isReleaseNativeCompatible(release, NaN)).toBe(false);
      expect(isReleaseNativeCompatible(release, undefined as any)).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 3: Candidate Selection & Sorting
  // ==========================================================================
  describe('3. Candidate Selection & Sorting', () => {
    it('3.1 selects the newest compatible release among multiple candidates', () => {
      const candidates: AppRelease[] = [
        createMockRelease({ bundle_version: '1.0.8', min_native_version_code: 1 }),
        createMockRelease({ bundle_version: '1.0.9', min_native_version_code: 1 }),
        createMockRelease({ bundle_version: '1.0.10', min_native_version_code: 1 }),
        createMockRelease({ bundle_version: '1.1.0', min_native_version_code: 1 }),
      ];

      const selected = selectNewestCompatibleRelease(candidates, 10, '1.0.0');
      expect(selected).not.toBeNull();
      expect(selected?.bundle_version).toBe('1.1.0');
    });

    it('3.2 ignores candidates that require higher native container versions', () => {
      const candidates: AppRelease[] = [
        createMockRelease({ bundle_version: '1.0.9', min_native_version_code: 1 }),
        createMockRelease({ bundle_version: '1.2.0', min_native_version_code: 20 }), // incompatible (current is 10)
      ];

      const selected = selectNewestCompatibleRelease(candidates, 10, '1.0.0');
      expect(selected?.bundle_version).toBe('1.0.9');
    });

    it('3.3 ignores candidates with non-PUBLISHED status', () => {
      const candidates: AppRelease[] = [
        createMockRelease({ bundle_version: '1.0.9', status: 'DRAFT' }),
        createMockRelease({ bundle_version: '1.0.8', status: 'PUBLISHED' }),
      ];

      const selected = selectNewestCompatibleRelease(candidates, 10, '1.0.0');
      expect(selected?.bundle_version).toBe('1.0.8');
    });

    it('3.4 returns null if no candidate is newer than current bundle version (no downgrading)', () => {
      const candidates: AppRelease[] = [
        createMockRelease({ bundle_version: '1.0.8' }),
        createMockRelease({ bundle_version: '1.0.9' }),
      ];

      const selected = selectNewestCompatibleRelease(candidates, 10, '1.0.9');
      expect(selected).toBeNull();
    });
  });

  // ==========================================================================
  // SECTION 4: Repository Discovery Integration
  // ==========================================================================
  describe('4. OtaReleaseRepository Discovery', () => {
    it('4.1 returns NO_UPDATE when database has no published releases', async () => {
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      };

      const repo = new OtaReleaseRepository(mockSupabase);
      const result = await repo.discoverNewestRelease('production', 10, '1.0.0');

      expect(result.status).toBe('NO_UPDATE');
      expect(result.currentBundleVersion).toBe('1.0.0');
      expect(result.nativeVersionCode).toBe(10);
    });

    it('4.2 returns UPDATE_AVAILABLE when valid newer release is published', async () => {
      const release101 = createMockRelease({ bundle_version: '1.0.1' });
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [release101], error: null }),
              }),
            }),
          }),
        }),
      };

      const repo = new OtaReleaseRepository(mockSupabase);
      const result = await repo.discoverNewestRelease('production', 10, '1.0.0');

      expect(result.status).toBe('UPDATE_AVAILABLE');
      expect(result.releaseId).toBe(release101.id);
      expect(result.bundleVersion).toBe('1.0.1');
      expect(result.expectedChecksum).toBe(release101.checksum_sha256);
    });

    it('4.3 returns INCOMPATIBLE when newer release exceeds native container capabilities', async () => {
      const releaseNew = createMockRelease({
        bundle_version: '2.0.0',
        min_native_version_code: 50, // current is 10 -> incompatible
      });
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [releaseNew], error: null }),
              }),
            }),
          }),
        }),
      };

      const repo = new OtaReleaseRepository(mockSupabase);
      const result = await repo.discoverNewestRelease('production', 10, '1.0.0');

      expect(result.status).toBe('INCOMPATIBLE');
      expect(result.nativeVersionCompatible).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 5: Native App & Bundle Runtime Version Sources
  // ==========================================================================
  describe('5. Native App and Bundle Runtime Sources', () => {
    it('5.1 queries native versionCode from App.getInfo()', async () => {
      const code = await getRuntimeNativeVersionCode();
      expect(code).toBe(10);
      expect(App.getInfo).toHaveBeenCalled();
    });

    it('5.2 returns bundle version from CapacitorUpdater.current()', async () => {
      const version = await getRuntimeBundleVersion();
      expect(version).toBe('1.0.0');
    });
  });

  // ==========================================================================
  // SECTION 6: OtaUpdateService Discovery & Verified Download Flow
  // ==========================================================================
  describe('6. OtaUpdateService Discovery and Download Flow', () => {
    it('6.1 discoverUpdate delegates to repository with runtime container version', async () => {
      const release105 = createMockRelease({ bundle_version: '1.0.5' });
      const mockSupabase: any = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [release105], error: null }),
              }),
            }),
          }),
        }),
      };

      const result = await otaUpdateService.discoverUpdate({
        channel: 'production',
        client: mockSupabase,
        currentBundleVersion: '1.0.0',
      });

      expect(result.status).toBe('UPDATE_AVAILABLE');
      expect(result.bundleVersion).toBe('1.0.5');
      expect(result.nativeVersionCode).toBe(10);
    });

    it('6.2 downloadAndVerifyUpdate executes Capgo download with signed URL and checksum', async () => {
      const release = createMockRelease({
        bundle_version: '1.0.5',
        checksum_sha256: VALID_CHECKSUM_2,
        storage_bucket: 'ota-releases',
        storage_path: 'ota/production/1.0.5/bundle.zip',
      });

      const mockSupabase: any = {
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: 'https://example-supabase.co/storage/v1/object/sign/ota-releases/bundle.zip?token=xyz' },
              error: null,
            }),
          }),
        },
      };

      const result = await otaUpdateService.downloadAndVerifyUpdate(release, {
        client: mockSupabase,
        nativeVersionCode: 10,
      });

      expect(result.status).toBe('DOWNLOADED_VERIFIED');
      expect(result.downloaded).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.bundleVersion).toBe('1.0.5');
      expect(result.bundleId).toBe('bundle-1.0.5');

      // Verify Capgo download was called with expected checksum
      expect(CapacitorUpdater.download).toHaveBeenCalledWith({
        url: expect.stringContaining('https://example-supabase.co'),
        version: '1.0.5',
        checksum: VALID_CHECKSUM_2,
      });

      // CRITICAL: Verify Phase 4 did NOT call stage or reload!
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
    });

    it('6.3 returns DOWNLOAD_FAILED when signed URL generation fails', async () => {
      const release = createMockRelease({ bundle_version: '1.0.5' });
      const mockSupabase: any = {
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Object not found in storage bucket' },
            }),
          }),
        },
      };

      const result = await otaUpdateService.downloadAndVerifyUpdate(release, {
        client: mockSupabase,
        nativeVersionCode: 10,
      });

      expect(result.status).toBe('DOWNLOAD_FAILED');
      expect(result.downloaded).toBeFalsy();
      expect(result.error).toContain('Object not found');
    });

    it('6.4 returns CHECKSUM_FAILED when Capgo or verification detects mismatch', async () => {
      const release = createMockRelease({
        bundle_version: '1.0.5',
        checksum_sha256: VALID_CHECKSUM_1,
      });

      const mockSupabase: any = {
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: 'https://example-supabase.co/bundle.zip' },
              error: null,
            }),
          }),
        },
      };

      // Mock Capgo throwing a checksum mismatch exception
      (CapacitorUpdater.download as any).mockRejectedValueOnce(
        new Error('Checksum mismatch: verification failed')
      );

      const result = await otaUpdateService.downloadAndVerifyUpdate(release, {
        client: mockSupabase,
        nativeVersionCode: 10,
      });

      expect(result.status).toBe('CHECKSUM_FAILED');
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Checksum mismatch');
    });

    it('6.5 returns INCOMPATIBLE and aborts download when release requires newer container', async () => {
      const release = createMockRelease({
        bundle_version: '2.0.0',
        min_native_version_code: 50, // current is 10
      });

      const result = await otaUpdateService.downloadAndVerifyUpdate(release, {
        nativeVersionCode: 10,
      });

      expect(result.status).toBe('INCOMPATIBLE');
      expect(result.nativeVersionCompatible).toBe(false);
      expect(CapacitorUpdater.download).not.toHaveBeenCalled();
    });

    it('6.6 graceful fallback when offline or Supabase client unavailable', async () => {
      const result = await otaUpdateService.discoverUpdate({
        client: null,
      });

      expect(result.status).toBe('NO_UPDATE');
      expect(result.error).toContain('unavailable');
    });
  });

  // ==========================================================================
  // SECTION 7: Strict Phase Boundary & Architectural Invariants
  // ==========================================================================
  describe('7. Strict Phase Boundary & Architectural Invariants', () => {
    it('7.1 Phase 4 downloadAndVerifyUpdate does NOT stage the bundle via next()', async () => {
      const release = createMockRelease({ bundle_version: '1.0.6' });
      const mockSupabase: any = {
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi.fn().mockResolvedValue({
              data: { signedUrl: 'https://example-supabase.co/bundle.zip' },
              error: null,
            }),
          }),
        },
      };

      await otaUpdateService.downloadAndVerifyUpdate(release, {
        client: mockSupabase,
        nativeVersionCode: 10,
      });

      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
    });

    it('7.2 Static source audit confirms no prohibited reloads in downloadAndVerifyUpdate', () => {
      const serviceFile = readFileSync(
        resolve(__dirname, '../services/otaUpdateService.ts'),
        'utf-8'
      );

      // Verify downloadAndVerifyUpdate implementation block
      const methodIndex = serviceFile.indexOf('async downloadAndVerifyUpdate');
      expect(methodIndex).toBeGreaterThan(-1);

      const methodBody = serviceFile.substring(methodIndex, methodIndex + 3500);

      // Must NOT contain calls to set(), reload(), next(), window.location.reload()
      expect(methodBody).not.toMatch(/CapacitorUpdater\.set\(/);
      expect(methodBody).not.toMatch(/CapacitorUpdater\.reload\(/);
      expect(methodBody).not.toMatch(/CapacitorUpdater\.next\(/);
      expect(methodBody).not.toMatch(/window\.location\.reload/);
      expect(methodBody).not.toMatch(/stageUpdate\(/);
    });

    it('7.3 Static source audit confirms no background polling loops or timers', () => {
      const serviceFile = readFileSync(
        resolve(__dirname, '../services/otaUpdateService.ts'),
        'utf-8'
      );

      // Must NOT contain setInterval or polling timers
      expect(serviceFile).not.toContain('setInterval');
      expect(serviceFile).not.toContain('periodCheckDelay');
    });
  });
});

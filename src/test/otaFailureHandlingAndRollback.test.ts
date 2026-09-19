/**
 * OTA Failure Handling and Rollback Cooperation Test Suite (Phase 6)
 *
 * Exhaustively tests:
 * 1. Blacklisted / failed bundle versions registry (get/set/clear/check).
 * 2. Self-healing state cleaning when a staged bundle is blacklisted.
 * 3. Proactive suppression of blacklisted versions during Discovery.
 * 4. Safe blockage of blacklisted versions during verified download initiation.
 * 5. Automatic blacklisting on checksum mismatch.
 * 6. Rollback listener registration and reaction to native 'updateFailed' events.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  otaUpdateService,
  OtaUpdateService,
} from '../services/otaUpdateService';
import { OtaReleaseRepository } from '../services/otaReleaseService';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import type { AppRelease } from '../types';

// Mock localStorage for Node environment in vitest
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((key) => delete store[key]);
  }),
  length: 0,
  key: vi.fn((index: number) => Object.keys(store)[index] || null),
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock Capacitor Core
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}));

vi.mock('@capgo/capacitor-updater', () => {
  const listeners: Record<string, Function[]> = {};
  return {
    CapacitorUpdater: {
      notifyAppReady: vi.fn().mockResolvedValue({
        bundle: { id: 'builtin', version: '1.0.0', status: 'success' },
      }),
      download: vi.fn().mockImplementation(async (options) => ({
        id: `bundle-${options.version}`,
        version: options.version,
        checksum: options.checksum || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        status: 'success',
      })),
      next: vi.fn(),
      set: vi.fn(),
      reload: vi.fn(),
      current: vi.fn().mockResolvedValue({
        bundle: { id: 'builtin', version: '1.0.0', status: 'success' },
        native: '1.0.0',
      }),
      addListener: vi.fn().mockImplementation((event, callback) => {
        if (!listeners[event]) {
          listeners[event] = [];
        }
        listeners[event].push(callback);
        return {
          remove: () => {
            listeners[event] = listeners[event].filter(cb => cb !== callback);
          }
        };
      }),
      // Helper for testing native event dispatching
      _triggerEvent: (event: string, payload: any) => {
        if (listeners[event]) {
          listeners[event].forEach(cb => cb(payload));
        }
      }
    },
  };
});

const VALID_CHECKSUM = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function createMockRelease(overrides: Partial<AppRelease> = {}): AppRelease {
  return {
    id: 'rel-test-123',
    bundle_version: '1.1.0',
    channel: 'production',
    status: 'PUBLISHED',
    storage_bucket: 'ota-releases',
    storage_path: 'ota/production/1.1.0/bundle.zip',
    checksum_sha256: VALID_CHECKSUM,
    bundle_size_bytes: 1024,
    min_native_version_code: 1,
    max_native_version_code: null,
    is_mandatory: false,
    release_notes: 'Standard updates',
    published_at: new Date().toISOString(),
    created_by: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('OTA Failure Handling & Rollback (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    otaUpdateService.destroy();

    // Mock getReleaseSignedDownloadUrl on repository prototype
    vi.spyOn(OtaReleaseRepository.prototype, 'getReleaseSignedDownloadUrl').mockResolvedValue({
      signedUrl: 'https://example.com/mock-bundle.zip',
      error: null,
    });
  });

  describe('1. Failed Bundle Version Registry', () => {
    it('1.1 starts with empty failed bundle versions list', () => {
      expect(otaUpdateService.getFailedBundleVersions()).toEqual([]);
      expect(otaUpdateService.isBundleVersionFailed('1.1.0')).toBe(false);
    });

    it('1.2 can mark version as failed and read it back', () => {
      otaUpdateService.markBundleVersionFailed('1.1.0');
      expect(otaUpdateService.getFailedBundleVersions()).toContain('1.1.0');
      expect(otaUpdateService.isBundleVersionFailed('1.1.0')).toBe(true);
      expect(otaUpdateService.isBundleVersionFailed('1.2.0')).toBe(false);
    });

    it('1.3 persists failed versions across service reloads via localStorage', () => {
      otaUpdateService.markBundleVersionFailed('1.2.5');
      
      const newService = new OtaUpdateService();
      expect(newService.getFailedBundleVersions()).toContain('1.2.5');
      expect(newService.isBundleVersionFailed('1.2.5')).toBe(true);
    });

    it('1.4 allows clearing failed bundles list', () => {
      otaUpdateService.markBundleVersionFailed('1.1.0');
      otaUpdateService.markBundleVersionFailed('1.2.0');
      expect(otaUpdateService.getFailedBundleVersions().length).toBe(2);

      otaUpdateService.clearFailedBundles();
      expect(otaUpdateService.getFailedBundleVersions()).toEqual([]);
    });
  });

  describe('2. Self-Healing Staging Purge', () => {
    it('2.1 automatically clears staged bundle if it gets blacklisted', async () => {
      // Setup a staged bundle
      otaUpdateService.setStagedBundle({
        bundleVersion: '1.2.0',
        bundleId: 'bundle-1.2.0',
        releaseId: 'rel-1.2.0',
        channel: 'production',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        checksumSha256: VALID_CHECKSUM,
        stagedAt: new Date().toISOString()
      });

      expect(otaUpdateService.getStagedBundle()?.bundleVersion).toBe('1.2.0');

      // Mark the same version as failed
      otaUpdateService.markBundleVersionFailed('1.2.0');

      // The staged bundle record must be automatically purged
      expect(otaUpdateService.getStagedBundle()).toBeNull();
    });

    it('2.2 clears staged bundle during startup initialization if already blacklisted', async () => {
      // Simulate persisted staged bundle 1.3.0 and blacklisted 1.3.0 in localStorage
      localStorage.setItem('cbe_ota_staged_bundle', JSON.stringify({
        bundleVersion: '1.3.0',
        bundleId: 'bundle-1.3.0',
        releaseId: 'rel-1.3.0',
        channel: 'production',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        checksumSha256: VALID_CHECKSUM,
        stagedAt: new Date().toISOString()
      }));
      localStorage.setItem('cbe_ota_failed_bundles', JSON.stringify(['1.3.0']));

      // Initialize service
      await otaUpdateService.initialize();

      // The service should purge the blacklisted staged bundle on boot
      expect(otaUpdateService.getStagedBundle()).toBeNull();
    });
  });

  describe('3. Discovery Suppression', () => {
    it('3.1 suppresses update availability if discovered newest version is blacklisted', async () => {
      // Setup a published release in Mock Repository
      const release = createMockRelease({ bundle_version: '1.4.0' });
      vi.spyOn(OtaReleaseRepository.prototype, 'getPublishedReleases').mockResolvedValue({
        data: [release],
        error: null,
      });

      // Mark 1.4.0 as blacklisted
      otaUpdateService.markBundleVersionFailed('1.4.0');

      // Attempt discovery
      const result = await otaUpdateService.discoverUpdate({
        channel: 'production',
        nativeVersionCode: 1,
        currentBundleVersion: '1.0.0',
      });

      // Discovery should return NO_UPDATE instead of UPDATE_AVAILABLE
      expect(result.status).toBe('NO_UPDATE');
      expect(result.error).toContain('is blacklisted');
    });
  });

  describe('4. Safe Download Pre-Check', () => {
    it('4.1 blocks initiating download for blacklisted bundle version', async () => {
      const release = createMockRelease({ bundle_version: '1.5.0' });
      
      // Blacklist it
      otaUpdateService.markBundleVersionFailed('1.5.0');

      // Attempt download and verify
      const result = await otaUpdateService.downloadAndVerifyUpdate(release);

      expect(result.status).toBe('DOWNLOAD_FAILED');
      expect(result.error).toContain('is blacklisted');
      expect(CapacitorUpdater.download).not.toHaveBeenCalled();
    });

    it('4.2 automatically blacklists version if checksum validation fails during verification', async () => {
      const release = createMockRelease({ bundle_version: '1.6.0', checksum_sha256: VALID_CHECKSUM });
      
      // Force download to succeed but return a different checksum, resulting in verification error
      vi.spyOn(CapacitorUpdater, 'download').mockResolvedValueOnce({
        id: 'bundle-1.6.0',
        version: '1.6.0',
        downloaded: new Date().toISOString(),
        checksum: 'mismatched-sha256-hash-value-here-000000000000000000000000000000',
        status: 'success',
      });

      const result = await otaUpdateService.downloadAndVerifyUpdate(release);

      expect(result.status).toBe('CHECKSUM_FAILED');
      
      // Should automatically register 1.6.0 in the failed registry
      expect(otaUpdateService.isBundleVersionFailed('1.6.0')).toBe(true);
    });
  });

  describe('5. Native Rollback Listener integration', () => {
    it('5.1 registers updateFailed listener and blacklists version when event fires', async () => {
      await otaUpdateService.initialize();

      // Trigger the native updateFailed event
      const updaterMock = (CapacitorUpdater as any);
      updaterMock._triggerEvent('updateFailed', {
        bundle: {
          id: 'bundle-1.7.0',
          version: '1.7.0',
          downloaded: new Date().toISOString(),
          checksum: 'abc',
          status: 'failed',
        }
      });

      // The service should automatically detect the failed bundle and blacklist it
      expect(otaUpdateService.isBundleVersionFailed('1.7.0')).toBe(true);
    });
  });
});

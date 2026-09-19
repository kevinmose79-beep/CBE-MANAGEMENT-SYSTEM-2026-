import { describe, it, expect, beforeEach, vi } from 'vitest';
import { otaUpdateService, OtaUpdateService } from './otaUpdateService';
import { sessionUpdateLock } from '../utils/sessionUpdateLock';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import type { ReleaseChannel } from '../types';

const PRODUCTION_CHANNEL: ReleaseChannel = 'production';

// High-fidelity in-memory localStorage mock for node.js test environment
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true, configurable: true });

// Mock @capacitor/core and @capgo/capacitor-updater
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
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
      checksum: options.checksum || 'test-checksum-sha256',
      status: 'success',
    })),
    next: vi.fn().mockImplementation(async (options) => ({
      id: options.id,
      version: '1.0.1',
      downloaded: new Date().toISOString(),
      checksum: 'test-checksum',
      status: 'pending',
    })),
    current: vi.fn().mockResolvedValue({
      bundle: { id: 'builtin', version: '1.0.0', downloaded: '1970-01-01', checksum: '', status: 'success' },
      native: '1.0.0',
    }),
    getNextBundle: vi.fn().mockResolvedValue(null),
    reload: vi.fn(),
    set: vi.fn(),
  },
}));

describe('OTA Update Service - Phase 1 Foundation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUpdateLock.reset();
    otaUpdateService.destroy();
    try {
      localStorage.clear();
    } catch {
      // Ignore
    }
  });

  describe('App Startup & notifyAppReady', () => {
    it('calls CapacitorUpdater.notifyAppReady on initialize', async () => {
      await otaUpdateService.initialize();

      expect(CapacitorUpdater.notifyAppReady).toHaveBeenCalledTimes(1);
      const status = otaUpdateService.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.currentBundleId).toBe('builtin');
    });

    it('does not re-notify if already initialized', async () => {
      await otaUpdateService.initialize();
      await otaUpdateService.initialize();

      expect(CapacitorUpdater.notifyAppReady).toHaveBeenCalledTimes(1);
    });
  });

  describe('SessionUpdateLock Safety Invariants', () => {
    it('reports canSafelyReload true when lock is IDLE_SAFE', async () => {
      await otaUpdateService.initialize();
      expect(otaUpdateService.canSafelyReload()).toBe(true);
      expect(otaUpdateService.getLockState()).toBe('IDLE_SAFE');
    });

    it('reports canSafelyReload false when lock is BUSY_DIRTY', async () => {
      await otaUpdateService.initialize();
      sessionUpdateLock.acquire('editor-1');
      sessionUpdateLock.setStatus('editor-1', { hasDirtyMarks: true });

      expect(otaUpdateService.canSafelyReload()).toBe(false);
      expect(otaUpdateService.getLockState()).toBe('BUSY_DIRTY');
      expect(otaUpdateService.getStatus().canSafelyReload).toBe(false);
    });

    it('reports canSafelyReload false when lock is BUSY_DEBOUNCING', async () => {
      await otaUpdateService.initialize();
      sessionUpdateLock.acquire('editor-1');
      sessionUpdateLock.setStatus('editor-1', { isDebouncing: true });

      expect(otaUpdateService.canSafelyReload()).toBe(false);
      expect(otaUpdateService.getLockState()).toBe('BUSY_DEBOUNCING');
    });

    it('reports canSafelyReload false when lock is BUSY_SAVING', async () => {
      await otaUpdateService.initialize();
      sessionUpdateLock.acquire('editor-1');
      sessionUpdateLock.setStatus('editor-1', { isSaving: true });

      expect(otaUpdateService.canSafelyReload()).toBe(false);
      expect(otaUpdateService.getLockState()).toBe('BUSY_SAVING');
    });

    it('notifies subscribers when lock state changes', async () => {
      await otaUpdateService.initialize();
      const statusStates: string[] = [];

      const unsubscribe = otaUpdateService.subscribe((status) => {
        statusStates.push(status.lockState);
      });

      const release = sessionUpdateLock.acquire('editor-test', { hasDirtyMarks: true });
      expect(statusStates).toContain('BUSY_DIRTY');

      release();
      expect(statusStates[statusStates.length - 1]).toBe('IDLE_SAFE');
      unsubscribe();
    });
  });

  describe('Passive Download & Staging Record Mechanics', () => {
    it('downloads bundle using CapacitorUpdater.download passively', async () => {
      await otaUpdateService.initialize();

      const bundle = await otaUpdateService.downloadUpdate({
        url: 'https://example.com/dist.zip',
        version: '1.0.1',
        checksum: 'sha256-mock-hash',
      });

      expect(CapacitorUpdater.download).toHaveBeenCalledWith({
        url: 'https://example.com/dist.zip',
        version: '1.0.1',
        checksum: 'sha256-mock-hash',
        manifest: undefined,
      });
      expect(bundle.id).toBe('bundle-1.0.1');

      // CRITICAL: next, reload, and set must NEVER be called during passive download
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
    });

    it('sets and retrieves staged bundle record in memory and localStorage', async () => {
      await otaUpdateService.initialize();

      otaUpdateService.setStagedBundle({
        bundleId: 'bundle-1.0.1',
        bundleVersion: '1.0.1',
        releaseId: 'rel-101',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      const staged = otaUpdateService.getStagedBundle();
      expect(staged).not.toBeNull();
      expect(staged?.bundleId).toBe('bundle-1.0.1');
      expect(staged?.bundleVersion).toBe('1.0.1');

      // CRITICAL: setting staged bundle does NOT invoke native reload or set or next
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
    });

    it('activates staged bundle using CapacitorUpdater.set when lock is IDLE_SAFE', async () => {
      await otaUpdateService.initialize();

      otaUpdateService.setStagedBundle({
        bundleId: 'bundle-1.0.1',
        bundleVersion: '1.0.1',
        releaseId: 'rel-101',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      const result = await otaUpdateService.activateStagedUpdate('bundle-1.0.1');

      expect(result.status).toBe('ACTIVATED');
      expect(CapacitorUpdater.set).toHaveBeenCalledWith({ id: 'bundle-1.0.1' });
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
    });

    it('blocks activation when lock is VIEWING_CLEAN (active editor registered)', async () => {
      await otaUpdateService.initialize();
      // Register clean marks entry
      sessionUpdateLock.acquire('marks-entry', { hasDirtyMarks: false, isSaving: false, isDebouncing: false });

      expect(otaUpdateService.getLockState()).toBe('VIEWING_CLEAN');

      otaUpdateService.setStagedBundle({
        bundleId: 'bundle-1.0.1',
        bundleVersion: '1.0.1',
        releaseId: 'rel-101',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      const result = await otaUpdateService.activateStagedUpdate('bundle-1.0.1');
      expect(result.status).toBe('BLOCKED_BY_LOCK');
      expect(result.activated).toBe(false);
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
    });

    it('refuses to activate staged bundle when dirty marks exist (BUSY_DIRTY)', async () => {
      await otaUpdateService.initialize();
      sessionUpdateLock.acquire('marks-entry', { hasDirtyMarks: true });

      otaUpdateService.setStagedBundle({
        bundleId: 'bundle-1.0.1',
        bundleVersion: '1.0.1',
        releaseId: 'rel-101',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      const result = await otaUpdateService.activateStagedUpdate('bundle-1.0.1');
      expect(result.status).toBe('BLOCKED_BY_LOCK');
      expect(result.activated).toBe(false);
      expect(result.error).toContain('BUSY_DIRTY');
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
    });

    it('refuses to activate staged bundle when autosave is debouncing (BUSY_DEBOUNCING)', async () => {
      await otaUpdateService.initialize();
      sessionUpdateLock.acquire('marks-entry', { isDebouncing: true });

      otaUpdateService.setStagedBundle({
        bundleId: 'bundle-1.0.1',
        bundleVersion: '1.0.1',
        releaseId: 'rel-101',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      const result = await otaUpdateService.activateStagedUpdate('bundle-1.0.1');
      expect(result.status).toBe('BLOCKED_BY_LOCK');
      expect(result.activated).toBe(false);
      expect(result.error).toContain('BUSY_DEBOUNCING');
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
    });

    it('refuses to activate staged bundle when save is in flight (BUSY_SAVING)', async () => {
      await otaUpdateService.initialize();
      sessionUpdateLock.acquire('marks-entry', { isSaving: true });

      otaUpdateService.setStagedBundle({
        bundleId: 'bundle-1.0.1',
        bundleVersion: '1.0.1',
        releaseId: 'rel-101',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      const result = await otaUpdateService.activateStagedUpdate('bundle-1.0.1');
      expect(result.status).toBe('BLOCKED_BY_LOCK');
      expect(result.activated).toBe(false);
      expect(result.error).toContain('BUSY_SAVING');
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();
      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
    });
  });

  describe('Strict Safety Invariants', () => {
    it('blocks activation when session is busy with dirty marks', async () => {
      const service = new OtaUpdateService();
      await service.initialize();

      // Acquire lock with active dirty marks entry
      sessionUpdateLock.acquire('marks-entry', { hasDirtyMarks: true, isSaving: true });

      service.setStagedBundle({
        bundleId: 'bundle-1.1.0',
        bundleVersion: '1.1.0',
        releaseId: 'rel-110',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      const result = await service.activateStagedUpdate('bundle-1.1.0');
      expect(result.status).toBe('BLOCKED_BY_LOCK');
      expect(result.activated).toBe(false);

      expect(CapacitorUpdater.reload).not.toHaveBeenCalled();
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();
      expect(CapacitorUpdater.next).not.toHaveBeenCalled();

      service.destroy();
    });
  });

  describe('CBE Management System - OTA Phase 5 Deep Validation', () => {
    it('A & B. Passive Staging & Persistence across service recreation', async () => {
      const service1 = new OtaUpdateService();
      await service1.initialize();

      const record = {
        bundleId: 'bundle-2.0.0',
        bundleVersion: '2.0.0',
        releaseId: 'rel-200',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-200',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      };

      service1.setStagedBundle(record);
      expect(service1.getStagedBundle()?.bundleVersion).toBe('2.0.0');

      // Re-create the service (simulate process destruction / reload)
      service1.destroy();

      const service2 = new OtaUpdateService();
      await service2.initialize();

      // State must survive and restore from localStorage
      const stagedRestored = service2.getStagedBundle();
      expect(stagedRestored).not.toBeNull();
      expect(stagedRestored?.bundleId).toBe('bundle-2.0.0');
      expect(stagedRestored?.bundleVersion).toBe('2.0.0');

      service2.destroy();
    });

    it('C. Restart does NOT automatically activate the staged update', async () => {
      const service = new OtaUpdateService();
      
      // Store in localStorage directly to simulate cold start
      localStorage.setItem('cbe_ota_staged_bundle', JSON.stringify({
        bundleId: 'bundle-2.0.0',
        bundleVersion: '2.0.0',
        releaseId: 'rel-200',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-200',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      }));

      // Initialize - should restore but NOT call CapacitorUpdater.set
      await service.initialize();

      expect(service.getStagedBundle()?.bundleVersion).toBe('2.0.0');
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();

      service.destroy();
    });

    it('D, E & F. Invalid persisted/staged version check (equal, older, native incompatibility)', async () => {
      const service = new OtaUpdateService();
      await service.initialize();

      // Equal version -> stale -> cleared
      service.setStagedBundle({
        bundleId: 'bundle-1.0.0',
        bundleVersion: '1.0.0', // running version is 1.0.0
        releaseId: 'rel-100',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });
      // Should be cleared during load
      service.destroy();
      
      const service2 = new OtaUpdateService();
      await service2.initialize();
      expect(service2.getStagedBundle()).toBeNull();
      service2.destroy();

      // Native Incompatibility
      localStorage.setItem('cbe_ota_staged_bundle', JSON.stringify({
        bundleId: 'bundle-2.0.0',
        bundleVersion: '2.0.0',
        releaseId: 'rel-200',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock',
        minNativeVersionCode: 100, // exceeds running 1
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      }));

      const service3 = new OtaUpdateService();
      await service3.initialize();
      expect(service3.getStagedBundle()).toBeNull();
      service3.destroy();
    });

    it('M. Race transition (safety state becomes invalid during async activation checks)', async () => {
      const service = new OtaUpdateService();
      await service.initialize();

      service.setStagedBundle({
        bundleId: 'bundle-1.0.5',
        bundleVersion: '1.0.5',
        releaseId: 'rel-105',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      // Start activation (it will perform async getRuntimeNativeVersionCode checks)
      const activationPromise = service.activateStagedUpdate('bundle-1.0.5');

      // IMMEDIATELY acquire lock and make it busy during the async gap
      sessionUpdateLock.acquire('marks-entry', { hasDirtyMarks: true });

      const result = await activationPromise;
      expect(result.status).toBe('BLOCKED_BY_LOCK');
      expect(result.activated).toBe(false);
      expect(CapacitorUpdater.set).not.toHaveBeenCalled();

      service.destroy();
    });

    it('N. Concurrent activation requests mutex guard', async () => {
      const service = new OtaUpdateService();
      await service.initialize();

      service.setStagedBundle({
        bundleId: 'bundle-1.0.5',
        bundleVersion: '1.0.5',
        releaseId: 'rel-105',
        channel: PRODUCTION_CHANNEL,
        checksumSha256: 'sha256-mock-hash',
        minNativeVersionCode: 1,
        maxNativeVersionCode: null,
        stagedAt: new Date().toISOString(),
      });

      // Issue two parallel activation requests
      const [res1, res2] = await Promise.all([
        service.activateStagedUpdate('bundle-1.0.5'),
        service.activateStagedUpdate('bundle-1.0.5'),
      ]);

      // Exactly one should succeed, and the other must be blocked as ACTIVATION_IN_PROGRESS
      const statuses = [res1.status, res2.status];
      expect(statuses).toContain('ACTIVATED');
      expect(statuses).toContain('ACTIVATION_IN_PROGRESS');
      expect(CapacitorUpdater.set).toHaveBeenCalledTimes(1);

      service.destroy();
    });
  });
});

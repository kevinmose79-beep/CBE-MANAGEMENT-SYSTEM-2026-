/**
 * OTA Update Service (Phase 5 - Safe Staging & Controlled Activation)
 *
 * Manages manual/controlled OTA updates using @capgo/capacitor-updater (Capacitor 8).
 *
 * Strict Invariants:
 * 1. ZERO automatic, uncontrolled WebView reloads.
 * 2. CapacitorUpdater.next() is STRICTLY FORBIDDEN to avoid native background reloads.
 * 3. Passive staging stores verified bundles on disk via CapacitorUpdater.download().
 * 4. Staged bundle metadata is persisted in localStorage as StagedBundleRecord.
 * 5. Activation occurs EXCLUSIVELY through activateStagedUpdate() via CapacitorUpdater.set({ id }).
 * 6. Controlled activation requires:
 *    - Native platform (Android)
 *    - Non-null staged bundle
 *    - SessionUpdateLock.canSafelyReload() === true
 *    - SessionUpdateLock.isMarksEntryActive() === false
 *    - Aggregate lock state === 'IDLE_SAFE'
 * 7. Calls CapacitorUpdater.notifyAppReady() on boot to confirm the bundle is valid.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater, BundleInfo, DownloadOptions, ManifestEntry } from '@capgo/capacitor-updater';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sessionUpdateLock, UpdateLockState } from '../utils/sessionUpdateLock';
import type {
  AppRelease,
  ReleaseChannel,
  OtaDiscoveryResult,
  StagedBundleRecord,
  OtaActivationResult,
  OtaActivationStatus,
} from '../types';
import {
  OtaReleaseRepository,
  validateReleaseMetadata,
  isReleaseNativeCompatible,
  isVersionNewer,
} from './otaReleaseService';

const STAGED_BUNDLE_STORAGE_KEY = 'cbe_ota_staged_bundle';
const FAILED_BUNDLES_STORAGE_KEY = 'cbe_ota_failed_bundles';

/**
 * Returns the current runtime native container versionCode.
 * On Android, this uses @capacitor/app's App.getInfo().build.
 * Defaults to 1 if on web or unresolvable.
 */
export async function getRuntimeNativeVersionCode(): Promise<number> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      const code = parseInt(info?.build, 10);
      if (!Number.isNaN(code) && code >= 1) {
        return code;
      }
    } catch (err: any) {
      console.warn('[OTA] Could not read native versionCode via App.getInfo():', err?.message || err);
    }
  }
  return 1;
}

/**
 * Returns the current runtime web/OTA bundle version.
 */
export async function getRuntimeBundleVersion(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version) return current.bundle.version;
      if (current?.native) return current.native;
    } catch {
      // Fallback
    }
  }
  return '1.0.0';
}

export interface CheckUpdatePayload {
  url: string;
  version: string;
  checksum?: string;
  manifest?: ManifestEntry[];
}

export interface OtaServiceStatus {
  isSupported: boolean;
  isInitialized: boolean;
  currentBundleId: string;
  currentVersion: string;
  isDownloading: boolean;
  downloadProgress: number;
  pendingBundleId: string | null;
  pendingVersion: string | null;
  stagedBundle: StagedBundleRecord | null;
  lastError: string | null;
  lockState: UpdateLockState;
  canSafelyReload: boolean;
  isMarksEntryActive: boolean;
  failedVersions?: string[];
}

export type OtaStatusListener = (status: OtaServiceStatus) => void;

export class OtaUpdateService {
  private isInitialized = false;
  private isDownloading = false;
  private isActivating = false;
  private downloadProgress = 0;
  private currentBundleId = 'builtin';
  private currentVersion = '1.0.0';
  private pendingBundleId: string | null = null;
  private pendingVersion: string | null = null;
  private stagedBundle: StagedBundleRecord | null = null;
  private lastError: string | null = null;
  private listeners = new Set<OtaStatusListener>();
  private removeLockSubscription: (() => void) | null = null;
  private failedVersions: string[] = [];

  /**
   * Initializes OTA runtime foundation:
   * 1. Subscribes to SessionUpdateLock state changes
   * 2. Calls notifyAppReady() to signal native layer that bundle is valid
   * 3. Queries current bundle status
   * 4. Loads any persisted staged bundle record from storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Subscribe to SessionUpdateLock to keep status updated
    this.removeLockSubscription = sessionUpdateLock.subscribe(() => {
      this.notifyListeners();
    });

    // Load blacklisted/failed versions
    this.failedVersions = this.getFailedBundleVersions();

    // Register updateFailed event listener on native platforms
    if (Capacitor.isNativePlatform()) {
      try {
        CapacitorUpdater.addListener('updateFailed', (event) => {
          console.warn('[OTA] Native update failed event received for bundle:', event.bundle);
          if (event?.bundle?.version) {
            this.markBundleVersionFailed(event.bundle.version);
          }
        });
      } catch (err) {
        console.error('[OTA] Failed to register updateFailed listener:', err);
      }
    }

    // Notify native layer that app booted successfully (prevents rollback)
    await this.notifyAppReady();

    // Query initial bundle info
    await this.refreshBundleInfo();

    // Load persisted staged bundle
    this.loadPersistedStagedBundle();

    // Perform proactive validation of the staged bundle on startup
    if (this.stagedBundle) {
      const targetVersion = this.stagedBundle.bundleVersion;
      // 0. Blacklist check
      if (this.isBundleVersionFailed(targetVersion)) {
        console.warn(`[OTA] Persisted staged update version ${targetVersion} is blacklisted due to previous failures. Clearing stale staging record.`);
        this.clearStagedBundle();
      } else if (!this.isUpdateAvailable(targetVersion)) {
        console.warn(`[OTA] Persisted staged update version ${targetVersion} is not newer than current ${this.currentVersion}. Clearing stale staging record.`);
        this.clearStagedBundle();
      } else {
        // 2. Native compatibility check
        try {
          const nativeCode = await getRuntimeNativeVersionCode();
          if (this.stagedBundle.minNativeVersionCode !== null && nativeCode < this.stagedBundle.minNativeVersionCode) {
            console.warn(`[OTA] Persisted staged update ${targetVersion} requires newer native version ${this.stagedBundle.minNativeVersionCode} (have ${nativeCode}). Clearing stale staging record.`);
            this.clearStagedBundle();
          } else if (this.stagedBundle.maxNativeVersionCode !== null && nativeCode > this.stagedBundle.maxNativeVersionCode) {
            console.warn(`[OTA] Persisted staged update ${targetVersion} is incompatible with newer native version ${this.stagedBundle.maxNativeVersionCode} (have ${nativeCode}). Clearing stale staging record.`);
            this.clearStagedBundle();
          }
        } catch (err) {
          console.warn('[OTA] Native compatibility validation skipped during startup:', err);
        }
      }
    }

    this.isInitialized = true;
    this.notifyListeners();
  }

  /**
   * Notifies the Capgo native plugin that the JavaScript bundle loaded and rendered successfully.
   * Required on every launch to prevent automatic bundle rollback.
   */
  async notifyAppReady(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        await CapacitorUpdater.notifyAppReady();
      }
      return true;
    } catch (err: any) {
      console.warn('[OTA] notifyAppReady warning:', err?.message || err);
      return false;
    }
  }

  /**
   * Refreshes in-memory cache of current bundle state from the native plugin.
   */
  async refreshBundleInfo(): Promise<void> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      const currentRes = await CapacitorUpdater.current().catch(() => null);

      if (currentRes?.bundle) {
        this.currentBundleId = currentRes.bundle.id;
        this.currentVersion = currentRes.bundle.version || currentRes.native || '1.0.0';
      } else if (currentRes?.native) {
        this.currentVersion = currentRes.native;
      }

      // Check if active bundle is the staged bundle, in which case clear staging
      if (this.stagedBundle && this.currentVersion === this.stagedBundle.bundleVersion) {
        this.clearStagedBundle();
      }
    } catch (err: any) {
      console.warn('[OTA] Failed to refresh bundle info:', err?.message || err);
    }
  }

  /**
   * Checks if an update payload is semantically newer than the current bundle version.
   * Enforces semantic version ordering (preventing lexical pitfalls like 1.0.10 < 1.0.9).
   */
  isUpdateAvailable(targetVersion: string): boolean {
    if (!targetVersion) return false;
    return isVersionNewer(targetVersion, this.currentVersion);
  }

  /**
   * Queries Supabase for compatible candidate releases.
   *
   * @param options.channel Release channel ('production' | 'staging' | 'beta')
   * @param options.nativeVersionCode Optional native container build number override
   * @param options.client Optional authenticated Supabase client override
   */
  async discoverUpdate(options?: {
    channel?: ReleaseChannel;
    nativeVersionCode?: number;
    client?: SupabaseClient;
    currentBundleVersion?: string;
  }): Promise<OtaDiscoveryResult> {
    const channel: ReleaseChannel = options?.channel || 'production';
    const nativeVersionCode = options?.nativeVersionCode ?? (await getRuntimeNativeVersionCode());
    const currentVersion = options?.currentBundleVersion || this.currentVersion;

    console.info(
      `[OTA] Discovery started for channel: ${channel}, nativeVersionCode: ${nativeVersionCode}, currentVersion: ${currentVersion}`
    );

    const repo = new OtaReleaseRepository(options?.client);
    const result = await repo.discoverNewestRelease(channel, nativeVersionCode, currentVersion);

    // Filter out blacklisted/failed versions to prevent loops
    if (result.status === 'UPDATE_AVAILABLE' && result.bundleVersion) {
      if (this.isBundleVersionFailed(result.bundleVersion)) {
        console.warn(`[OTA] Discovered update version ${result.bundleVersion} is blacklisted due to previous failures. Suppressing update.`);
        return {
          status: 'NO_UPDATE',
          currentBundleVersion: currentVersion,
          channel,
          nativeVersionCode,
          nativeVersionCompatible: true,
          error: `Discovered version ${result.bundleVersion} is blacklisted`,
        };
      }
    }

    return result;
  }

  /**
   * Downloads and cryptographically verifies an OTA release bundle without staging it.
   *
   * Strict Safety Boundary:
   * 1. Acquires signed URL from Supabase Storage without leaking permanent credentials.
   * 2. Delegates download & SHA-256 verification to Capgo plugin.
   * 3. Leaves the bundle INACTIVE on disk.
   * 4. Does NOT call next(), set(), reload(), or window.location.reload().
   *
   * @param release The verified AppRelease record from Supabase.
   * @param options.client Supabase client instance.
   * @param options.nativeVersionCode Optional container version override.
   */
  async downloadAndVerifyUpdate(
    release: AppRelease,
    options?: {
      client?: SupabaseClient;
      nativeVersionCode?: number;
    }
  ): Promise<OtaDiscoveryResult> {
    const channel: ReleaseChannel = release.channel;
    const nativeVersionCode = options?.nativeVersionCode ?? (await getRuntimeNativeVersionCode());

    // Abort if the bundle version has failed/is blacklisted
    if (this.isBundleVersionFailed(release.bundle_version)) {
      console.warn(`[OTA] Aborting download: version ${release.bundle_version} is blacklisted.`);
      return {
        status: 'DOWNLOAD_FAILED',
        releaseId: release.id,
        bundleVersion: release.bundle_version,
        currentBundleVersion: this.currentVersion,
        channel,
        nativeVersionCode,
        nativeVersionCompatible: true,
        error: `Version ${release.bundle_version} is blacklisted`,
      };
    }

    // Validate metadata before initiating download
    const validation = validateReleaseMetadata(release);
    if (!validation.isValid) {
      console.error(`[OTA] Cannot download invalid release ${release.bundle_version}:`, validation.errors);
      return {
        status: 'INVALID_RELEASE',
        releaseId: release.id,
        bundleVersion: release.bundle_version,
        currentBundleVersion: this.currentVersion,
        channel,
        nativeVersionCode,
        nativeVersionCompatible: true,
        error: `Invalid release: ${validation.errors.join(', ')}`,
      };
    }

    // Verify native container version compatibility
    if (!isReleaseNativeCompatible(release, nativeVersionCode)) {
      console.warn(`[OTA] Release ${release.bundle_version} is incompatible with native version ${nativeVersionCode}`);
      return {
        status: 'INCOMPATIBLE',
        releaseId: release.id,
        bundleVersion: release.bundle_version,
        currentBundleVersion: this.currentVersion,
        channel,
        nativeVersionCode,
        nativeVersionCompatible: false,
        error: `Native container version ${nativeVersionCode} is incompatible with release ${release.bundle_version}`,
      };
    }

    // Acquire short-lived signed URL for the bundle package
    const repo = new OtaReleaseRepository(options?.client);
    const { signedUrl, error: urlError } = await repo.getReleaseSignedDownloadUrl(
      release.storage_bucket,
      release.storage_path,
      300
    );

    if (urlError || !signedUrl) {
      console.error(`[OTA] Failed to generate signed URL for release ${release.bundle_version}`);
      return {
        status: 'DOWNLOAD_FAILED',
        releaseId: release.id,
        bundleVersion: release.bundle_version,
        currentBundleVersion: this.currentVersion,
        channel,
        nativeVersionCode,
        nativeVersionCompatible: true,
        error: urlError || 'Failed to generate signed download URL',
      };
    }

    if (this.isDownloading) {
      return {
        status: 'DOWNLOAD_FAILED',
        releaseId: release.id,
        bundleVersion: release.bundle_version,
        currentBundleVersion: this.currentVersion,
        channel,
        nativeVersionCode,
        nativeVersionCompatible: true,
        error: 'Another download is already in progress',
      };
    }

    this.isDownloading = true;
    this.downloadProgress = 0;
    this.lastError = null;
    this.notifyListeners();

    try {
      console.info(`[OTA] Downloading release bundle: ${release.bundle_version}`);
      const downloadOpts: DownloadOptions = {
        url: signedUrl,
        version: release.bundle_version,
        checksum: release.checksum_sha256,
      };

      const bundle = await CapacitorUpdater.download(downloadOpts);

      // Verify returned bundle checksum if provided by the plugin
      if (
        bundle?.checksum &&
        bundle.checksum.trim().toLowerCase() !== release.checksum_sha256.trim().toLowerCase()
      ) {
        console.error(`[OTA] Checksum mismatch for release ${release.bundle_version}`);
        throw new Error(
          `Checksum verification failed: expected ${release.checksum_sha256} but got ${bundle.checksum}`
        );
      }

      this.downloadProgress = 100;
      console.info(`[OTA] Release bundle verified: ${release.bundle_version} (bundleId: ${bundle.id})`);

      return {
        status: 'DOWNLOADED_VERIFIED',
        releaseId: release.id,
        bundleVersion: release.bundle_version,
        bundleId: bundle.id,
        currentBundleVersion: this.currentVersion,
        channel,
        nativeVersionCode,
        nativeVersionCompatible: true,
        isMandatory: release.is_mandatory,
        releaseNotes: release.release_notes,
        bundleSizeBytes: release.bundle_size_bytes,
        expectedChecksum: release.checksum_sha256,
        downloaded: true,
        verified: true,
      };
    } catch (err: any) {
      const msg = err?.message || 'Download failed';
      this.lastError = msg;
      const lower = msg.toLowerCase();
      const isChecksumError =
        lower.includes('checksum') ||
        lower.includes('hash') ||
        lower.includes('integrity') ||
        lower.includes('mismatch');

      if (isChecksumError) {
        console.error(`[OTA] Checksum verification failed for release ${release.bundle_version}`);
        this.markBundleVersionFailed(release.bundle_version);
      } else {
        console.error(`[OTA] Download failed for release ${release.bundle_version}:`, msg);
      }

      return {
        status: isChecksumError ? 'CHECKSUM_FAILED' : 'DOWNLOAD_FAILED',
        releaseId: release.id,
        bundleVersion: release.bundle_version,
        currentBundleVersion: this.currentVersion,
        channel,
        nativeVersionCode,
        nativeVersionCompatible: true,
        downloaded: false,
        verified: false,
        error: msg,
      };
    } finally {
      this.isDownloading = false;
      this.notifyListeners();
    }
  }

  /**
   * Downloads an OTA bundle package directly via URL payload.
   * Supports sha256 checksum verification through Capgo's native downloader.
   */
  async downloadUpdate(payload: CheckUpdatePayload): Promise<BundleInfo> {
    if (this.isDownloading) {
      throw new Error('An update download is already in progress');
    }

    if (!payload.url || !payload.version) {
      throw new Error('Download URL and version are required');
    }

    this.isDownloading = true;
    this.downloadProgress = 0;
    this.lastError = null;
    this.notifyListeners();

    try {
      const downloadOpts: DownloadOptions = {
        url: payload.url,
        version: payload.version,
        checksum: payload.checksum,
        manifest: payload.manifest,
      };

      const bundle = await CapacitorUpdater.download(downloadOpts);

      this.downloadProgress = 100;
      return bundle;
    } catch (err: any) {
      const message = err?.message || 'Download failed';
      this.lastError = message;
      throw new Error(`OTA download failed: ${message}`);
    } finally {
      this.isDownloading = false;
      this.notifyListeners();
    }
  }

  // ==========================================================================
  // PHASE 5: SAFE STAGING & CONTROLLED ACTIVATION GATEWAY
  // ==========================================================================

  /**
   * Stores a downloaded and verified bundle in the staged state.
   * Persists metadata to localStorage so it survives process destruction.
   *
   * Strict Safety Rule:
   * DOES NOT CALL CapacitorUpdater.next() (forbidden to prevent uncontrolled background reloads).
   * Bundle remains passive on disk until safe activation boundary.
   */
  setStagedBundle(record: StagedBundleRecord): void {
    if (!record || !record.bundleId || !record.bundleVersion) {
      throw new Error('Invalid staged bundle record: bundleId and bundleVersion are required');
    }

    this.stagedBundle = { ...record };
    this.pendingBundleId = record.bundleId;
    this.pendingVersion = record.bundleVersion;

    try {
      localStorage.setItem(STAGED_BUNDLE_STORAGE_KEY, JSON.stringify(record));
    } catch (err) {
      console.warn('[OTA] Failed to persist staged bundle to localStorage:', err);
    }

    this.notifyListeners();
  }

  /**
   * Returns current in-memory staged bundle record.
   */
  getStagedBundle(): StagedBundleRecord | null {
    return this.stagedBundle ? { ...this.stagedBundle } : null;
  }

  /**
   * Clears staged bundle from memory and persistent storage.
   */
  clearStagedBundle(): void {
    this.stagedBundle = null;
    this.pendingBundleId = null;
    this.pendingVersion = null;

    try {
      localStorage.removeItem(STAGED_BUNDLE_STORAGE_KEY);
    } catch (err) {
      console.warn('[OTA] Failed to clear staged bundle from localStorage:', err);
    }

    this.notifyListeners();
  }

  /**
   * Loads persisted staged bundle record from localStorage if present.
   */
  private loadPersistedStagedBundle(): StagedBundleRecord | null {
    try {
      const raw = localStorage.getItem(STAGED_BUNDLE_STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (parsed && parsed.bundleId && parsed.bundleVersion) {
        this.stagedBundle = parsed;
        this.pendingBundleId = parsed.bundleId;
        this.pendingVersion = parsed.bundleVersion;
        return this.stagedBundle;
      }
    } catch (err) {
      console.warn('[OTA] Could not load persisted staged bundle:', err);
      this.clearStagedBundle();
    }
    return null;
  }

  /**
   * Controlled Activation Gateway.
   *
   * Sole authorized gateway in the entire CBE application for invoking `CapacitorUpdater.set()`.
   *
   * Enforces 5-point safety gate:
   * 1. Supported platform: Native Android only (no-op on web).
   * 2. Staged update exists: Must have a staged bundle record.
   * 3. Native container compatibility: Native container versionCode must be within bounds.
   * 4. Version ordering: Staged bundle version must be strictly newer than current.
   * 5. SessionUpdateLock strict clearance:
   *    - lockState === 'IDLE_SAFE'
   *    - canSafelyReload() === true
   *    - isMarksEntryActive() === false
   *
   * @param bundleId Optional explicit bundle ID (defaults to currently staged bundle ID).
   */
  async activateStagedUpdate(bundleId?: string): Promise<OtaActivationResult> {
    const currentVersion = this.currentVersion;

    if (this.isActivating) {
      return {
        status: 'ACTIVATION_IN_PROGRESS',
        activated: false,
        currentVersion,
        error: 'Activation is already in progress',
      };
    }

    // Synchronously acquire the activation mutex to guard against concurrent entry during async validation gates
    this.isActivating = true;
    this.lastError = null;
    this.notifyListeners();

    let targetBundle: StagedBundleRecord | null = null;
    let targetId: string | undefined = undefined;

    try {
      // 1. Verify staged bundle exists
      targetBundle = this.stagedBundle;
      targetId = bundleId || targetBundle?.bundleId;

      if (!targetId || !targetBundle) {
        return {
          status: 'NO_STAGED_UPDATE',
          activated: false,
          currentVersion,
          error: 'No staged update found to activate',
        };
      }

      // 2. Platform support check
      if (!Capacitor.isNativePlatform()) {
        return {
          status: 'INCOMPATIBLE',
          activated: false,
          bundleId: targetId,
          bundleVersion: targetBundle.bundleVersion,
          currentVersion,
          error: 'OTA activation is only supported on native platforms',
        };
      }

      // 3. Native version compatibility check
      const nativeCode = await getRuntimeNativeVersionCode();
      if (nativeCode < targetBundle.minNativeVersionCode) {
        return {
          status: 'INCOMPATIBLE',
          activated: false,
          bundleId: targetId,
          bundleVersion: targetBundle.bundleVersion,
          currentVersion,
          error: `Native container version ${nativeCode} is below required minimum ${targetBundle.minNativeVersionCode}`,
        };
      }

      if (targetBundle.maxNativeVersionCode !== null && nativeCode > targetBundle.maxNativeVersionCode) {
        return {
          status: 'INCOMPATIBLE',
          activated: false,
          bundleId: targetId,
          bundleVersion: targetBundle.bundleVersion,
          currentVersion,
          error: `Native container version ${nativeCode} exceeds maximum supported ${targetBundle.maxNativeVersionCode}`,
        };
      }

      // 4. Semantic version check
      if (!isVersionNewer(targetBundle.bundleVersion, currentVersion)) {
        return {
          status: 'NOT_NEWER',
          activated: false,
          bundleId: targetId,
          bundleVersion: targetBundle.bundleVersion,
          currentVersion,
          error: `Staged version ${targetBundle.bundleVersion} is not newer than current ${currentVersion}`,
        };
      }

      // 5. CRITICAL SAFETY GATE: SessionUpdateLock clearance
      // Gate 5A: Navigation context check (Marks Entry tab is forbidden)
      if (sessionUpdateLock.isMarksEntryActive()) {
        console.warn('[OTA] Activation BLOCKED: user is currently inside Marks Entry navigation tab');
        return {
          status: 'BLOCKED_BY_NAVIGATION',
          activated: false,
          bundleId: targetId,
          bundleVersion: targetBundle.bundleVersion,
          currentVersion,
          error: 'Activation blocked: teacher is currently on Marks Entry screen',
        };
      }

      // Gate 5B: Marks editing/saving lock state check
      if (!sessionUpdateLock.canSafelyReload() || sessionUpdateLock.getAggregateState() !== 'IDLE_SAFE') {
        const lockState = sessionUpdateLock.getAggregateState();
        console.warn(`[OTA] Activation BLOCKED by SessionUpdateLock (aggregate state: ${lockState})`);
        return {
          status: 'BLOCKED_BY_LOCK',
          activated: false,
          bundleId: targetId,
          bundleVersion: targetBundle.bundleVersion,
          currentVersion,
          error: `Activation blocked by SessionUpdateLock: lock state is ${lockState}`,
        };
      }

      console.info(`[OTA] All safety checks passed. Activating staged bundle: ${targetId} (${targetBundle.bundleVersion})`);

      // Gated call to Capgo set()
      await CapacitorUpdater.set({ id: targetId });

      return {
        status: 'ACTIVATED',
        activated: true,
        bundleId: targetId,
        bundleVersion: targetBundle.bundleVersion,
        currentVersion,
      };
    } catch (err: any) {
      const msg = err?.message || 'Failed to activate bundle';
      this.lastError = msg;
      console.error(`[OTA] Activation failed for bundle ${targetId || 'unknown'}:`, msg);

      const lower = msg.toLowerCase();
      const notFound = lower.includes('not found') || lower.includes('exist');

      return {
        status: notFound ? 'BUNDLE_NOT_FOUND' : 'ACTIVATION_FAILED',
        activated: false,
        bundleId: targetId || 'unknown',
        bundleVersion: targetBundle?.bundleVersion || 'unknown',
        currentVersion,
        error: msg,
      };
    } finally {
      this.isActivating = false;
      this.notifyListeners();
    }
  }

  /**
   * Queries whether an application reload is currently safe according to SessionUpdateLock.
   */
  canSafelyReload(): boolean {
    return sessionUpdateLock.canSafelyReload() && !sessionUpdateLock.isMarksEntryActive();
  }

  /**
   * Gets current aggregate lock state from SessionUpdateLock.
   */
  getLockState(): UpdateLockState {
    return sessionUpdateLock.getAggregateState();
  }

  /**
   * Returns a snapshot of current OTA service status.
   */
  getStatus(): OtaServiceStatus {
    return {
      isSupported: Capacitor.isNativePlatform(),
      isInitialized: this.isInitialized,
      currentBundleId: this.currentBundleId,
      currentVersion: this.currentVersion,
      isDownloading: this.isDownloading,
      downloadProgress: this.downloadProgress,
      pendingBundleId: this.pendingBundleId,
      pendingVersion: this.pendingVersion,
      stagedBundle: this.getStagedBundle(),
      lastError: this.lastError,
      lockState: sessionUpdateLock.getAggregateState(),
      canSafelyReload: sessionUpdateLock.canSafelyReload(),
      isMarksEntryActive: sessionUpdateLock.isMarksEntryActive(),
      failedVersions: [...this.failedVersions],
    };
  }

  /**
   * Subscribes to OTA status updates (downloads, staging, lock state changes).
   */
  subscribe(listener: OtaStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[OTA] Status listener error:', err);
      }
    });
  }

  /**
   * Loads the list of failed/blacklisted bundle versions from localStorage.
   */
  getFailedBundleVersions(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(FAILED_BUNDLES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string');
        }
      }
    } catch (err) {
      console.warn('[OTA] Failed to load blacklisted versions:', err);
    }
    return [];
  }

  /**
   * Adds a bundle version to the failed/blacklisted versions registry.
   * Clears the staged bundle if it matches the blacklisted version.
   */
  markBundleVersionFailed(version: string): void {
    if (!version) return;
    const cleanVersion = version.trim();
    const current = this.getFailedBundleVersions();
    if (!current.includes(cleanVersion)) {
      current.push(cleanVersion);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(FAILED_BUNDLES_STORAGE_KEY, JSON.stringify(current));
        } catch (err) {
          console.warn('[OTA] Failed to save blacklisted versions:', err);
        }
      }
    }
    this.failedVersions = current;

    // Self-healing: if the blacklisted version matches the currently staged bundle, clear it!
    if (this.stagedBundle && this.stagedBundle.bundleVersion === cleanVersion) {
      console.warn(`[OTA] Currently staged bundle ${cleanVersion} is now blacklisted. Clearing staging.`);
      this.clearStagedBundle();
    }

    this.notifyListeners();
  }

  /**
   * Checks if a bundle version is currently blacklisted/failed.
   */
  isBundleVersionFailed(version: string): boolean {
    if (!version) return false;
    const clean = version.trim();
    if (this.failedVersions.length > 0) {
      return this.failedVersions.includes(clean);
    }
    return this.getFailedBundleVersions().includes(clean);
  }

  /**
   * Resets the blacklisted/failed bundle versions registry.
   */
  clearFailedBundles(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(FAILED_BUNDLES_STORAGE_KEY);
      } catch (err) {
        console.warn('[OTA] Failed to clear blacklisted versions:', err);
      }
    }
    this.failedVersions = [];
    this.notifyListeners();
  }

  /**
   * Cleanup method for testing or tearing down service.
   */
  destroy(): void {
    if (this.removeLockSubscription) {
      this.removeLockSubscription();
      this.removeLockSubscription = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
    this.isActivating = false;
    this.isDownloading = false;
    this.downloadProgress = 0;
    this.currentBundleId = 'builtin';
    this.currentVersion = '1.0.0';
    this.pendingBundleId = null;
    this.pendingVersion = null;
    this.stagedBundle = null;
    this.lastError = null;
    this.failedVersions = [];
  }
}

export const otaUpdateService = new OtaUpdateService();

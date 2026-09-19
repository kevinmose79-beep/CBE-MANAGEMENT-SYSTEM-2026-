/**
 * OTA Release Authority Service (Phase 3 - Supabase Release Metadata & Storage Authority)
 *
 * Provides typed access, deterministic storage path calculation, and validation
 * for Supabase-backed OTA release records.
 *
 * CRITICAL ARCHITECTURAL BOUNDARIES (Phase 3):
 * 1. Supabase is the single source of truth for release metadata and bundle storage.
 * 2. This service does NOT automatically check for updates on startup or on timers.
 * 3. This service does NOT download, stage, or activate any OTA bundles.
 * 4. This service contains NO references to native updater plugins or Capacitor native bridge.
 * 5. Immutable Releases: Release archives in Supabase Storage are immutable; modifications
 *    require drafting a new release version.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/storage';
import type {
  AppRelease,
  ReleaseChannel,
  ReleaseStatus,
  CreateReleaseInput,
  UpdateReleaseInput,
  ReleaseValidationResult,
  OtaDiscoveryResult,
} from '../types';

export const DEFAULT_OTA_STORAGE_BUCKET = 'ota-releases';
export const ALLOWED_RELEASE_CHANNELS: ReleaseChannel[] = ['production', 'staging'];
export const ALLOWED_RELEASE_STATUSES: ReleaseStatus[] = ['DRAFT', 'TESTING', 'PUBLISHED', 'DISABLED'];

/**
 * Semantic version representation.
 */
export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

/**
 * Parses a semantic version string into structured numeric parts and prerelease identifiers.
 */
export function parseSemanticVersion(versionStr: string): SemverParts | null {
  if (!versionStr || typeof versionStr !== 'string') return null;
  const trimmed = versionStr.trim();
  const clean = trimmed.startsWith('v') || trimmed.startsWith('V') ? trimmed.slice(1) : trimmed;
  if (!clean) return null;

  const withoutBuild = clean.split('+')[0];
  const [corePart, ...prereleaseParts] = withoutBuild.split('-');
  const prerelease = prereleaseParts.join('-');

  const parts = corePart.split('.').map((p) => {
    const n = parseInt(p, 10);
    return Number.isNaN(n) ? 0 : n;
  });

  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    prerelease: prerelease ? prerelease.split('.') : [],
  };
}

/**
 * Compares two semantic version strings mathematically.
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if v1 === v2.
 * Crucial: Prevents lexical bugs like "1.0.10" < "1.0.9".
 */
export function compareSemanticVersions(v1: string, v2: string): number {
  const p1 = parseSemanticVersion(v1);
  const p2 = parseSemanticVersion(v2);

  if (!p1 && !p2) return 0;
  if (!p1) return -1;
  if (!p2) return 1;

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  // Normal release has higher precedence than pre-release when major.minor.patch are equal
  const hasPre1 = p1.prerelease.length > 0;
  const hasPre2 = p2.prerelease.length > 0;
  if (!hasPre1 && hasPre2) return 1;
  if (hasPre1 && !hasPre2) return -1;
  if (!hasPre1 && !hasPre2) return 0;

  const minLen = Math.min(p1.prerelease.length, p2.prerelease.length);
  for (let i = 0; i < minLen; i++) {
    const id1 = p1.prerelease[i];
    const id2 = p2.prerelease[i];
    const num1 = parseInt(id1, 10);
    const num2 = parseInt(id2, 10);
    const isNum1 = !Number.isNaN(num1) && String(num1) === id1;
    const isNum2 = !Number.isNaN(num2) && String(num2) === id2;

    if (isNum1 && isNum2) {
      if (num1 !== num2) return num1 > num2 ? 1 : -1;
    } else if (isNum1 && !isNum2) {
      return -1;
    } else if (!isNum1 && isNum2) {
      return 1;
    } else {
      const cmp = id1.localeCompare(id2);
      if (cmp !== 0) return cmp > 0 ? 1 : -1;
    }
  }

  if (p1.prerelease.length !== p2.prerelease.length) {
    return p1.prerelease.length > p2.prerelease.length ? 1 : -1;
  }

  return 0;
}

/**
 * Returns true if candidateVersion is semantically strictly greater than currentVersion.
 */
export function isVersionNewer(candidateVersion: string, currentVersion: string): boolean {
  return compareSemanticVersions(candidateVersion, currentVersion) > 0;
}

/**
 * Checks native container compatibility for a candidate release.
 * Rule:
 * currentNativeVersionCode >= min_native_version_code
 * AND (max_native_version_code IS NULL OR currentNativeVersionCode <= max_native_version_code)
 */
export function isReleaseNativeCompatible(
  release: Pick<AppRelease, 'min_native_version_code' | 'max_native_version_code'>,
  currentNativeVersionCode: number
): boolean {
  if (typeof currentNativeVersionCode !== 'number' || Number.isNaN(currentNativeVersionCode)) {
    return false;
  }
  const min = release.min_native_version_code ?? 1;
  if (currentNativeVersionCode < min) {
    return false;
  }
  if (release.max_native_version_code !== null && release.max_native_version_code !== undefined) {
    if (currentNativeVersionCode > release.max_native_version_code) {
      return false;
    }
  }
  return true;
}

/**
 * Selects the newest compatible release from candidate releases.
 * Validates metadata, checks native compatibility, checks semver precedence,
 * and sorts semantically descending.
 */
export function selectNewestCompatibleRelease(
  candidates: AppRelease[],
  currentNativeVersionCode: number,
  currentBundleVersion?: string
): AppRelease | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const filtered = candidates.filter((r) => {
    if (!r || r.status !== 'PUBLISHED') return false;
    const validation = validateReleaseMetadata(r);
    if (!validation.isValid) return false;
    if (!isReleaseNativeCompatible(r, currentNativeVersionCode)) return false;
    if (currentBundleVersion && !isVersionNewer(r.bundle_version, currentBundleVersion)) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) return null;

  filtered.sort((a, b) => compareSemanticVersions(b.bundle_version, a.bundle_version));
  return filtered[0];
}

/**
 * Validates that a string is a 64-character lowercase hexadecimal SHA-256 hash.
 */
export function validateChecksum(checksum: string): boolean {
  if (!checksum || typeof checksum !== 'string') return false;
  return /^[0-9a-f]{64}$/.test(checksum.trim().toLowerCase());
}

/**
 * Validates that a bundle version string is non-empty and follows semantic versioning or clean version formatting.
 * Examples: '1.0.0', '1.0.1-hotfix.1', '2.0.0-rc1'
 */
export function validateBundleVersion(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  const trimmed = version.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return false;
  // Alphanumeric with dots, dashes, and underscores
  return /^[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*$/.test(trimmed);
}

/**
 * Validates a storage path within the OTA bucket.
 * Must end in .zip and follow deterministic pathing: ota/<channel>/<version>/bundle.zip
 */
export function validateStoragePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed.endsWith('.zip')) return false;
  if (trimmed.includes('..') || trimmed.startsWith('/') || trimmed.startsWith('\\')) return false;
  return true;
}

/**
 * Computes the deterministic, canonical Supabase Storage path for an OTA bundle.
 * Convention: ota/<channel>/<bundleVersion>/bundle.zip
 */
export function buildStoragePath(channel: ReleaseChannel, bundleVersion: string): string {
  const cleanChannel = (channel || 'production').trim().toLowerCase();
  const cleanVersion = bundleVersion.trim();
  return `ota/${cleanChannel}/${cleanVersion}/bundle.zip`;
}

/**
 * Pure validator for OTA release metadata.
 * Enforces all database-level and application-level business constraints.
 */
export function validateReleaseMetadata(
  metadata: Partial<AppRelease | CreateReleaseInput>
): ReleaseValidationResult {
  const errors: string[] = [];

  // 1. Bundle Version
  if (!metadata.bundle_version || !validateBundleVersion(metadata.bundle_version)) {
    errors.push('Bundle version is required and must be valid alphanumeric/semver format (e.g. "1.0.0").');
  }

  // 2. Channel
  if (metadata.channel && !ALLOWED_RELEASE_CHANNELS.includes(metadata.channel)) {
    errors.push(`Channel must be one of: ${ALLOWED_RELEASE_CHANNELS.join(', ')}.`);
  }

  // 3. Status
  if (metadata.status && !ALLOWED_RELEASE_STATUSES.includes(metadata.status)) {
    errors.push(`Status must be one of: ${ALLOWED_RELEASE_STATUSES.join(', ')}.`);
  }

  // 4. Storage Bucket
  const bucket = metadata.storage_bucket || DEFAULT_OTA_STORAGE_BUCKET;
  if (!bucket || typeof bucket !== 'string' || bucket.trim().length === 0) {
    errors.push('Storage bucket name must be non-empty.');
  }

  // 5. Storage Path
  if (!metadata.storage_path || !validateStoragePath(metadata.storage_path)) {
    errors.push('Storage path is required, must end with .zip, and cannot contain path traversal characters.');
  }

  // 6. Checksum
  if (!metadata.checksum_sha256 || !validateChecksum(metadata.checksum_sha256)) {
    errors.push('Checksum must be a valid 64-character lowercase SHA-256 hexadecimal string.');
  }

  // 7. Bundle Size
  if (
    metadata.bundle_size_bytes === undefined ||
    metadata.bundle_size_bytes === null ||
    typeof metadata.bundle_size_bytes !== 'number' ||
    metadata.bundle_size_bytes <= 0 ||
    !Number.isFinite(metadata.bundle_size_bytes)
  ) {
    errors.push('Bundle size in bytes must be a positive number.');
  }

  // 8. Min Native Version Code
  const minCode = metadata.min_native_version_code ?? 1;
  if (typeof minCode !== 'number' || minCode < 1 || !Number.isInteger(minCode)) {
    errors.push('min_native_version_code must be an integer >= 1.');
  }

  // 9. Max Native Version Code
  if (metadata.max_native_version_code !== undefined && metadata.max_native_version_code !== null) {
    const maxCode = metadata.max_native_version_code;
    if (typeof maxCode !== 'number' || !Number.isInteger(maxCode)) {
      errors.push('max_native_version_code must be an integer when specified.');
    } else if (maxCode < minCode) {
      errors.push(`max_native_version_code (${maxCode}) cannot be less than min_native_version_code (${minCode}).`);
    }
  }

  // 10. Publication Invariants
  if (metadata.status === 'PUBLISHED') {
    if (!metadata.published_at) {
      errors.push('published_at timestamp is required when release status is PUBLISHED.');
    } else {
      const parsedDate = Date.parse(metadata.published_at);
      if (Number.isNaN(parsedDate)) {
        errors.push('published_at must be a valid ISO timestamp.');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Typed Repository for Supabase OTA Releases
 */
export class OtaReleaseRepository {
  private supabase: SupabaseClient | null;

  constructor(client?: SupabaseClient | null) {
    this.supabase = client !== undefined ? client : getSupabaseClient();
  }

  /**
   * Fetches a release record by primary key UUID.
   */
  async getReleaseById(id: string): Promise<AppRelease | null> {
    if (!this.supabase) {
      console.warn('[OtaReleaseRepository] Cannot fetch release by id: Supabase client unavailable');
      return null;
    }

    const { data, error } = await this.supabase
      .from('app_releases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[OtaReleaseRepository] Error fetching release by id:', error.message);
      return null;
    }
    return data as AppRelease | null;
  }

  /**
   * Queries release records with optional channel and status filters.
   * Default order: created_at descending.
   */
  async getReleases(filter?: {
    channel?: ReleaseChannel;
    status?: ReleaseStatus;
  }): Promise<AppRelease[]> {
    if (!this.supabase) {
      console.warn('[OtaReleaseRepository] Cannot list releases: Supabase client unavailable');
      return [];
    }

    let query = this.supabase
      .from('app_releases')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.channel) {
      query = query.eq('channel', filter.channel);
    }
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[OtaReleaseRepository] Error listing releases:', error.message);
      return [];
    }
    return (data as AppRelease[]) || [];
  }

  /**
   * Fetches the published release record for a given channel and bundle version.
   */
  async getPublishedRelease(
    channel: ReleaseChannel,
    bundleVersion: string
  ): Promise<AppRelease | null> {
    if (!this.supabase) {
      console.warn('[OtaReleaseRepository] Cannot fetch published release: Supabase client unavailable');
      return null;
    }

    const { data, error } = await this.supabase
      .from('app_releases')
      .select('*')
      .eq('channel', channel)
      .eq('bundle_version', bundleVersion)
      .eq('status', 'PUBLISHED')
      .maybeSingle();

    if (error) {
      console.error('[OtaReleaseRepository] Error fetching published release:', error.message);
      return null;
    }
    return data as AppRelease | null;
  }

  /**
   * Fetches the latest PUBLISHED release for a channel, matching native version constraints.
   * Note: This merely retrieves metadata. It does NOT initiate downloads or update staging.
   */
  async getLatestPublishedRelease(
    channel: ReleaseChannel,
    nativeVersionCode?: number
  ): Promise<AppRelease | null> {
    if (!this.supabase) {
      console.warn('[OtaReleaseRepository] Cannot fetch latest published release: Supabase client unavailable');
      return null;
    }

    let query = this.supabase
      .from('app_releases')
      .select('*')
      .eq('channel', channel)
      .eq('status', 'PUBLISHED')
      .order('created_at', { ascending: false });

    if (nativeVersionCode !== undefined) {
      query = query.lte('min_native_version_code', nativeVersionCode);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[OtaReleaseRepository] Error fetching latest published release:', error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    // If nativeVersionCode provided, ensure max_native_version_code is either null or >= versionCode
    if (nativeVersionCode !== undefined) {
      const compatible = data.find((r: AppRelease) => {
        return r.max_native_version_code === null || r.max_native_version_code >= nativeVersionCode;
      });
      return (compatible as AppRelease) || null;
    }

    return (data[0] as AppRelease) || null;
  }

  /**
   * Creates a new release metadata record in Supabase.
   * Performs client-side validation before issuing the database INSERT.
   * Note: Only administrators or service_role can perform this operation under RLS.
   */
  async createRelease(
    input: CreateReleaseInput
  ): Promise<{ data: AppRelease | null; error: string | null }> {
    if (!this.supabase) {
      return { data: null, error: 'Supabase client is unavailable or unconfigured' };
    }

    const validation = validateReleaseMetadata(input);
    if (!validation.isValid) {
      return { data: null, error: validation.errors.join(' ') };
    }

    const payload = {
      bundle_version: input.bundle_version.trim(),
      channel: input.channel || 'production',
      status: input.status || 'DRAFT',
      storage_bucket: input.storage_bucket || DEFAULT_OTA_STORAGE_BUCKET,
      storage_path: input.storage_path.trim(),
      checksum_sha256: input.checksum_sha256.trim().toLowerCase(),
      bundle_size_bytes: input.bundle_size_bytes,
      min_native_version_code: input.min_native_version_code ?? 1,
      max_native_version_code: input.max_native_version_code ?? null,
      is_mandatory: input.is_mandatory ?? false,
      release_notes: input.release_notes ?? null,
      published_at: input.status === 'PUBLISHED' ? input.published_at || new Date().toISOString() : null,
      created_by: input.created_by ?? null,
    };

    const { data, error } = await this.supabase
      .from('app_releases')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as AppRelease, error: null };
  }

  /**
   * Updates an existing release status (e.g. promoting from DRAFT to PUBLISHED, or to DISABLED).
   * Note: Only administrators or service_role can perform this operation under RLS.
   */
  async updateReleaseStatus(
    id: string,
    status: ReleaseStatus
  ): Promise<{ data: AppRelease | null; error: string | null }> {
    if (!this.supabase) {
      return { data: null, error: 'Supabase client is unavailable or unconfigured' };
    }

    if (!ALLOWED_RELEASE_STATUSES.includes(status)) {
      return { data: null, error: `Invalid status: ${status}` };
    }

    const updates: Partial<AppRelease> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'PUBLISHED') {
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('app_releases')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as AppRelease, error: null };
  }

  /**
   * Promotes an existing release by updating both its channel and status.
   * Note: Only administrators or service_role can perform this operation under RLS.
   */
  async promoteRelease(
    id: string,
    channel: ReleaseChannel,
    status: ReleaseStatus
  ): Promise<{ data: AppRelease | null; error: string | null }> {
    if (!this.supabase) {
      return { data: null, error: 'Supabase client is unavailable or unconfigured' };
    }

    if (!ALLOWED_RELEASE_CHANNELS.includes(channel)) {
      return { data: null, error: `Invalid channel: ${channel}` };
    }

    if (!ALLOWED_RELEASE_STATUSES.includes(status)) {
      return { data: null, error: `Invalid status: ${status}` };
    }

    const updates: Partial<AppRelease> = {
      channel,
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'PUBLISHED') {
      updates.published_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('app_releases')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return { data: data as AppRelease, error: null };
  }

  /**
   * Deletes a release record from Supabase app_releases table.
   * Note: Only administrators or service_role can perform this operation under RLS.
   */
  async deleteRelease(id: string): Promise<{ success: boolean; error: string | null }> {
    if (!this.supabase) {
      return { success: false, error: 'Supabase client is unavailable or unconfigured' };
    }

    const { error } = await this.supabase
      .from('app_releases')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  }

  /**
   * Generates a short-lived signed download URL for an authorized release artifact.
   * Access requires appropriate permissions on the private ota-releases bucket.
   */
  async getReleaseSignedDownloadUrl(
    storageBucket: string,
    storagePath: string,
    expiresInSeconds = 300
  ): Promise<{ signedUrl: string | null; error: string | null }> {
    if (!this.supabase) {
      return { signedUrl: null, error: 'Supabase client is unavailable or unconfigured' };
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(storageBucket)
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error) {
        return { signedUrl: null, error: error.message };
      }
      return { signedUrl: data?.signedUrl || null, error: null };
    } catch (err: any) {
      return { signedUrl: null, error: err?.message || 'Failed to create signed URL' };
    }
  }

  /**
   * Fetches all published releases for a given channel.
   * Returns data array and explicit error message if query failed.
   */
  async getPublishedReleases(
    channel: ReleaseChannel
  ): Promise<{ data: AppRelease[]; error: string | null }> {
    if (!this.supabase) {
      return { data: [], error: 'Supabase client is unavailable or unconfigured' };
    }

    const { data, error } = await this.supabase
      .from('app_releases')
      .select('*')
      .eq('channel', channel)
      .eq('status', 'PUBLISHED')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OtaReleaseRepository] Error listing published releases:', error.message);
      return { data: [], error: error.message };
    }
    return { data: (data as AppRelease[]) || [], error: null };
  }

  /**
   * Discovers whether a newer, native-compatible published release exists.
   * Enforces:
   * 1. Querying only PUBLISHED releases in the requested channel
   * 2. Semantic version comparison (candidate > currentBundleVersion)
   * 3. Native container compatibility (current >= min AND (max IS NULL OR current <= max))
   * 4. Safe failure modes (offline, invalid data, incompatible native)
   *
   * CRITICAL: This method only discovers and returns release metadata.
   * It does NOT initiate downloads, stage bundles, or activate updates.
   */
  async discoverNewestRelease(
    channel: ReleaseChannel,
    currentNativeVersionCode: number,
    currentBundleVersion: string
  ): Promise<OtaDiscoveryResult> {
    if (!this.supabase) {
      return {
        status: 'NO_UPDATE',
        currentBundleVersion,
        channel,
        nativeVersionCode: currentNativeVersionCode,
        nativeVersionCompatible: true,
        error: 'Supabase client is unavailable or unconfigured',
      };
    }

    try {
      const { data: published, error: queryError } = await this.getPublishedReleases(channel);

      if (queryError) {
        return {
          status: 'NO_UPDATE',
          currentBundleVersion,
          channel,
          nativeVersionCode: currentNativeVersionCode,
          nativeVersionCompatible: true,
          error: `Database query error: ${queryError}`,
        };
      }

      if (!published || published.length === 0) {
        return {
          status: 'NO_UPDATE',
          currentBundleVersion,
          channel,
          nativeVersionCode: currentNativeVersionCode,
          nativeVersionCompatible: true,
        };
      }

      // Validate candidates
      const validCandidates: AppRelease[] = [];
      for (const release of published) {
        const validation = validateReleaseMetadata(release);
        if (validation.isValid) {
          validCandidates.push(release);
        } else {
          console.warn(`[OtaReleaseRepository] Discarding invalid published release ${release.bundle_version}: ${validation.errors.join(', ')}`);
        }
      }

      if (validCandidates.length === 0) {
        return {
          status: 'INVALID_RELEASE',
          currentBundleVersion,
          channel,
          nativeVersionCode: currentNativeVersionCode,
          nativeVersionCompatible: false,
          error: 'All published releases failed metadata validation',
        };
      }

      // Filter only releases that are semantically newer than currentBundleVersion
      const newerCandidates = validCandidates.filter((r) =>
        isVersionNewer(r.bundle_version, currentBundleVersion)
      );

      if (newerCandidates.length === 0) {
        return {
          status: 'NO_UPDATE',
          currentBundleVersion,
          channel,
          nativeVersionCode: currentNativeVersionCode,
          nativeVersionCompatible: true,
        };
      }

      // Check native compatibility among newer candidates
      const compatibleNewer = newerCandidates.filter((r) =>
        isReleaseNativeCompatible(r, currentNativeVersionCode)
      );

      if (compatibleNewer.length === 0) {
        // A newer release exists, but the user's native container cannot run it!
        return {
          status: 'INCOMPATIBLE',
          currentBundleVersion,
          channel,
          nativeVersionCode: currentNativeVersionCode,
          nativeVersionCompatible: false,
          error: 'Newer release exists but is incompatible with the current native container version',
        };
      }

      // Sort by semantic version descending to get the newest compatible release
      compatibleNewer.sort((a, b) => compareSemanticVersions(b.bundle_version, a.bundle_version));
      const newestRelease = compatibleNewer[0];

      return {
        status: 'UPDATE_AVAILABLE',
        releaseId: newestRelease.id,
        bundleVersion: newestRelease.bundle_version,
        currentBundleVersion,
        channel,
        nativeVersionCode: currentNativeVersionCode,
        nativeVersionCompatible: true,
        isMandatory: newestRelease.is_mandatory,
        releaseNotes: newestRelease.release_notes,
        bundleSizeBytes: newestRelease.bundle_size_bytes,
        expectedChecksum: newestRelease.checksum_sha256,
      };
    } catch (err: any) {
      console.error('[OtaReleaseRepository] Discovery error:', err?.message || err);
      return {
        status: 'NO_UPDATE',
        currentBundleVersion,
        channel,
        nativeVersionCode: currentNativeVersionCode,
        nativeVersionCompatible: true,
        error: err?.message || 'Discovery network or query failed',
      };
    }
  }
}

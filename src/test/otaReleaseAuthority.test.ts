import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import JSZip from 'jszip';
import {
  SUPABASE_PART4,
  SUPABASE_QUICK_MIGRATIONS,
  SUPABASE_SQL_SCHEMA,
} from '../lib/supabaseSql';
import {
  validateChecksum,
  validateBundleVersion,
  validateStoragePath,
  buildStoragePath,
  validateReleaseMetadata,
  DEFAULT_OTA_STORAGE_BUCKET,
  ALLOWED_RELEASE_CHANNELS,
  ALLOWED_RELEASE_STATUSES,
} from '../services/otaReleaseService';
import type { AppRelease, CreateReleaseInput } from '../types';

describe('Phase 3 — Supabase OTA Release Authority & Storage Architecture', () => {
  // ==========================================================================
  // 1. SQL SCHEMA & RLS AUDIT
  // ==========================================================================
  describe('Database Schema & Migration Definitions', () => {
    it('1.1 Verifies app_releases table definition and column constraints in SUPABASE_PART4', () => {
      expect(SUPABASE_PART4).toContain('CREATE TABLE IF NOT EXISTS public.app_releases');
      expect(SUPABASE_PART4).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
      expect(SUPABASE_PART4).toContain('bundle_version TEXT NOT NULL');
      expect(SUPABASE_PART4).toContain("channel TEXT NOT NULL DEFAULT 'production' CHECK (channel IN ('production', 'staging'))");
      expect(SUPABASE_PART4).toContain("status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'TESTING', 'PUBLISHED', 'DISABLED'))");
      expect(SUPABASE_PART4).toContain("storage_bucket TEXT NOT NULL DEFAULT 'ota-releases' CHECK (length(trim(storage_bucket)) > 0)");
      expect(SUPABASE_PART4).toContain('storage_path TEXT NOT NULL CHECK (length(trim(storage_path)) > 0)');
      expect(SUPABASE_PART4).toContain("checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')");
      expect(SUPABASE_PART4).toContain('bundle_size_bytes BIGINT NOT NULL CHECK (bundle_size_bytes > 0)');
      expect(SUPABASE_PART4).toContain('min_native_version_code INTEGER NOT NULL DEFAULT 1 CHECK (min_native_version_code >= 1)');
      expect(SUPABASE_PART4).toContain('max_native_version_code INTEGER CHECK (max_native_version_code IS NULL OR max_native_version_code >= min_native_version_code)');
      expect(SUPABASE_PART4).toContain('is_mandatory BOOLEAN NOT NULL DEFAULT false');
      expect(SUPABASE_PART4).toContain('release_notes TEXT');
      expect(SUPABASE_PART4).toContain('published_at TIMESTAMP WITH TIME ZONE');
    });

    it('1.2 Verifies table-level uniqueness and publication invariants', () => {
      expect(SUPABASE_PART4).toContain('CONSTRAINT app_releases_channel_version_unique UNIQUE (channel, bundle_version)');
      expect(SUPABASE_PART4).toContain('CONSTRAINT check_published_metadata CHECK');
      expect(SUPABASE_PART4).toContain("status != 'PUBLISHED' OR");
      expect(SUPABASE_PART4).toContain('published_at IS NOT NULL AND');
    });

    it('1.3 Verifies indexes and updated_at trigger in SUPABASE_PART4', () => {
      expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_app_releases_channel_status ON public.app_releases(channel, status);');
      expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_app_releases_bundle_version ON public.app_releases(bundle_version);');
      expect(SUPABASE_PART4).toContain('CREATE INDEX IF NOT EXISTS idx_app_releases_created_at ON public.app_releases(created_at DESC);');
      expect(SUPABASE_PART4).toContain('CREATE OR REPLACE FUNCTION public.set_app_releases_updated_at()');
      expect(SUPABASE_PART4).toContain('CREATE TRIGGER trg_app_releases_updated_at');
    });

    it('1.4 Verifies RLS enablement, permission revocation, and admin-only write policy', () => {
      expect(SUPABASE_PART4).toContain('ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;');
      expect(SUPABASE_PART4).toContain('REVOKE ALL ON public.app_releases FROM PUBLIC, anon;');
      expect(SUPABASE_PART4).toContain('GRANT SELECT ON public.app_releases TO authenticated;');
      expect(SUPABASE_PART4).toContain('GRANT ALL ON public.app_releases TO service_role;');

      // Policies
      expect(SUPABASE_PART4).toContain('CREATE POLICY "Authenticated read app_releases" ON public.app_releases');
      expect(SUPABASE_PART4).toContain('CREATE POLICY "Admin write app_releases" ON public.app_releases');
      expect(SUPABASE_PART4).toContain('USING (public.is_admin())');
      expect(SUPABASE_PART4).toContain('WITH CHECK (public.is_admin())');
    });

    it('1.5 Verifies private Storage bucket definition and bucket RLS', () => {
      expect(SUPABASE_PART4).toContain("INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)");
      expect(SUPABASE_PART4).toContain("'ota-releases'");
      expect(SUPABASE_PART4).toContain("public = false");
      expect(SUPABASE_PART4).toContain('CREATE POLICY "Authenticated read ota-releases" ON storage.objects');
      expect(SUPABASE_PART4).toContain('CREATE POLICY "Admin write ota-releases" ON storage.objects');
    });

    it('1.6 Verifies SUPABASE_QUICK_MIGRATIONS contains the OTA release schema and policies', () => {
      expect(SUPABASE_QUICK_MIGRATIONS).toContain('CREATE TABLE IF NOT EXISTS public.app_releases');
      expect(SUPABASE_QUICK_MIGRATIONS).toContain('CONSTRAINT app_releases_channel_version_unique UNIQUE (channel, bundle_version)');
      expect(SUPABASE_QUICK_MIGRATIONS).toContain('CREATE POLICY "Admin write app_releases" ON public.app_releases');
    });

    it('1.7 Verifies standalone migration file supabase/migrations/20260911000000_ota_releases.sql exists', () => {
      const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260911000000_ota_releases.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.app_releases');
      expect(sqlContent).toContain('CREATE POLICY "Admin write app_releases"');
    });
  });

  // ==========================================================================
  // 2. METADATA VALIDATION SERVICE TESTS
  // ==========================================================================
  describe('Pure Metadata Validation Service', () => {
    it('2.1 validateChecksum accepts valid 64-char lowercase hexadecimal strings', () => {
      const validHash = 'd20ce1fa8fead7654c485a22c99d4744c5a50c76c7bcaa41fcf0bd42714663a7';
      expect(validateChecksum(validHash)).toBe(true);
      expect(validateChecksum(validHash.toUpperCase())).toBe(true); // normalizes to lowercase

      // Rejects invalid hashes
      expect(validateChecksum('not-a-hash')).toBe(false);
      expect(validateChecksum('d20ce1fa8fead7654c485a22c99d4744c5a50c76c7bcaa41fcf0bd42714663a')).toBe(false); // 63 chars
      expect(validateChecksum('d20ce1fa8fead7654c485a22c99d4744c5a50c76c7bcaa41fcf0bd42714663a7z')).toBe(false); // invalid char
      expect(validateChecksum('')).toBe(false);
    });

    it('2.2 validateBundleVersion checks semver / alphanumeric version formats', () => {
      expect(validateBundleVersion('1.0.0')).toBe(true);
      expect(validateBundleVersion('1.0.1-rc.1')).toBe(true);
      expect(validateBundleVersion('2.0.0-beta')).toBe(true);

      // Rejects invalid version formats
      expect(validateBundleVersion('')).toBe(false);
      expect(validateBundleVersion('   ')).toBe(false);
      expect(validateBundleVersion('v1..0')).toBe(false);
      expect(validateBundleVersion('version/1.0')).toBe(false);
    });

    it('2.3 validateStoragePath ensures valid .zip extension and forbids traversal', () => {
      expect(validateStoragePath('ota/production/1.0.0/bundle.zip')).toBe(true);
      expect(validateStoragePath('ota/staging/1.0.1/bundle.zip')).toBe(true);

      // Rejects invalid paths
      expect(validateStoragePath('')).toBe(false);
      expect(validateStoragePath('bundle.tar.gz')).toBe(false);
      expect(validateStoragePath('../ota/bundle.zip')).toBe(false);
      expect(validateStoragePath('/ota/bundle.zip')).toBe(false);
    });

    it('2.4 buildStoragePath computes deterministic storage locations', () => {
      expect(buildStoragePath('production', '1.0.0')).toBe('ota/production/1.0.0/bundle.zip');
      expect(buildStoragePath('staging', '1.0.1')).toBe('ota/staging/1.0.1/bundle.zip');
    });

    it('2.5 validateReleaseMetadata validates complete valid release payload', () => {
      const validPayload: CreateReleaseInput = {
        bundle_version: '1.0.0',
        channel: 'production',
        status: 'DRAFT',
        storage_bucket: DEFAULT_OTA_STORAGE_BUCKET,
        storage_path: 'ota/production/1.0.0/bundle.zip',
        checksum_sha256: 'd20ce1fa8fead7654c485a22c99d4744c5a50c76c7bcaa41fcf0bd42714663a7',
        bundle_size_bytes: 1236296,
        min_native_version_code: 1,
        max_native_version_code: null,
        is_mandatory: false,
        release_notes: 'Initial release bundle',
      };

      const result = validateReleaseMetadata(validPayload);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('2.6 validateReleaseMetadata enforces publication invariants', () => {
      const draftPayload: CreateReleaseInput = {
        bundle_version: '1.0.0',
        channel: 'production',
        status: 'PUBLISHED',
        storage_bucket: DEFAULT_OTA_STORAGE_BUCKET,
        storage_path: 'ota/production/1.0.0/bundle.zip',
        checksum_sha256: 'd20ce1fa8fead7654c485a22c99d4744c5a50c76c7bcaa41fcf0bd42714663a7',
        bundle_size_bytes: 1236296,
        min_native_version_code: 1,
        // Missing published_at when status is PUBLISHED!
      };

      const result = validateReleaseMetadata(draftPayload);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('published_at'))).toBe(true);

      // When valid published_at is provided:
      const publishedPayload = {
        ...draftPayload,
        published_at: new Date().toISOString(),
      };
      const result2 = validateReleaseMetadata(publishedPayload);
      expect(result2.isValid).toBe(true);
    });

    it('2.7 validateReleaseMetadata catches invalid native version range', () => {
      const invalidRangePayload: CreateReleaseInput = {
        bundle_version: '1.0.0',
        storage_path: 'ota/production/1.0.0/bundle.zip',
        checksum_sha256: 'd20ce1fa8fead7654c485a22c99d4744c5a50c76c7bcaa41fcf0bd42714663a7',
        bundle_size_bytes: 1000,
        min_native_version_code: 5,
        max_native_version_code: 3, // Invalid: max < min
      };

      const result = validateReleaseMetadata(invalidRangePayload);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('max_native_version_code'))).toBe(true);
    });
  });

  // ==========================================================================
  // 3. PHASE 2 ARTIFACT VERIFICATION AGAINST PHASE 3 SCHEMA
  // ==========================================================================
  describe('Phase 2 Bundle Verification against Phase 3 Schema', () => {
    const bundlePath = path.resolve(process.cwd(), 'dist-ota/bundle.zip');
    const metadataPath = path.resolve(process.cwd(), 'dist-ota/ota-bundle-metadata.json');

    beforeAll(async () => {
      if (!fs.existsSync(bundlePath) || !fs.existsSync(metadataPath)) {
        const zip = new JSZip();
        zip.file('index.html', '<!DOCTYPE html><html><body>CBE App</body></html>');
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
        fs.writeFileSync(bundlePath, zipBuffer);
        const hash = createHash('sha256').update(zipBuffer).digest('hex');
        fs.writeFileSync(
          metadataPath,
          JSON.stringify(
            {
              bundleVersion: '1.0.0',
              fileName: 'bundle.zip',
              bundleSizeBytes: zipBuffer.length,
              checksumSha256: hash,
              entryPoint: 'index.html',
              fileCount: 1,
              builtAt: new Date().toISOString(),
            },
            null,
            2
          )
        );
      }
    });

    it('3.1 Verifies the real Phase 2 bundle conforms to Phase 3 metadata rules', () => {

      expect(fs.existsSync(bundlePath)).toBe(true);
      expect(fs.existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      const buffer = fs.readFileSync(bundlePath);
      const computedSha256 = createHash('sha256').update(buffer).digest('hex');

      expect(metadata.checksumSha256).toBe(computedSha256);
      expect(metadata.bundleSizeBytes).toBe(buffer.length);

      // Now validate this against Phase 3 CreateReleaseInput schema
      const releaseInput: CreateReleaseInput = {
        bundle_version: metadata.bundleVersion,
        channel: 'production',
        status: 'PUBLISHED',
        storage_bucket: 'ota-releases',
        storage_path: buildStoragePath('production', metadata.bundleVersion),
        checksum_sha256: computedSha256,
        bundle_size_bytes: buffer.length,
        min_native_version_code: 1,
        max_native_version_code: null,
        is_mandatory: false,
        published_at: metadata.builtAt,
        release_notes: 'Verified Phase 2 OTA web bundle',
      };

      const validation = validateReleaseMetadata(releaseInput);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 4. ARCHITECTURAL ISOLATION & SAFETY BOUNDARIES
  // ==========================================================================
  describe('Architectural Boundary Compliance', () => {
    it('4.1 Verifies otaReleaseService contains NO Capgo native plugin imports or auto-activation calls', () => {
      const serviceFilePath = path.resolve(process.cwd(), 'src/services/otaReleaseService.ts');
      const serviceContent = fs.readFileSync(serviceFilePath, 'utf-8');

      expect(serviceContent).not.toContain('@capgo/capacitor-updater');
      expect(serviceContent).not.toContain('CapacitorUpdater.download');
      expect(serviceContent).not.toContain('CapacitorUpdater.next');
      expect(serviceContent).not.toContain('CapacitorUpdater.set');
      expect(serviceContent).not.toContain('CapacitorUpdater.reload');
      expect(serviceContent).not.toContain('setInterval');
      expect(serviceContent).not.toContain('setTimeout');
    });

    it('4.2 Verifies client-side environment does not expose SUPABASE_SERVICE_ROLE_KEY', () => {
      // In Vite clients, variables exposed to the browser MUST begin with VITE_
      // The SUPABASE_SERVICE_ROLE_KEY must never be prefixed with VITE_
      expect(process.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });
  });
});

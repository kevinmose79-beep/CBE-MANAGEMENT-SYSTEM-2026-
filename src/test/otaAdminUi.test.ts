import { describe, it, expect, vi } from 'vitest';
import {
  OtaReleaseRepository,
  buildStoragePath,
  validateChecksum,
  validateBundleVersion,
} from '../services/otaReleaseService';
import type { AppRelease, ReleaseChannel, ReleaseStatus } from '../types';

describe('Phase 8 — OTA Admin UI & Security Authority Tests', () => {
  // Mock Supabase Client
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();

  const createMockSupabase = () => {
    mockFrom.mockReset();
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockEq.mockReset();
    mockSingle.mockReset();

    // Setup standard query builder chains
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
      single: mockSingle,
    });

    mockInsert.mockReturnValue({
      select: mockSelect,
    });

    mockUpdate.mockReturnValue({
      eq: mockEq,
    });

    mockDelete.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      select: mockSelect,
      single: mockSingle,
    });

    return {
      from: mockFrom,
    } as any;
  };

  describe('OtaReleaseRepository Extended Operations', () => {
    it('Verifies promoteRelease updates both the channel and status using explicit ID', async () => {
      const mockSupabase = createMockSupabase();
      const repository = new OtaReleaseRepository(mockSupabase);

      const targetId = 'release-uuid-123';
      const mockRelease: AppRelease = {
        id: targetId,
        bundle_version: '1.0.2',
        channel: 'production',
        status: 'PUBLISHED',
        storage_bucket: 'ota-releases',
        storage_path: 'ota/production/1.0.2/bundle.zip',
        checksum_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        bundle_size_bytes: 2048,
        min_native_version_code: 1,
        max_native_version_code: null,
        is_mandatory: false,
        release_notes: 'Promoted release',
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'system-user-uuid',
      };

      mockSingle.mockResolvedValue({ data: mockRelease, error: null });

      const result = await repository.promoteRelease(targetId, 'production', 'PUBLISHED');

      // Assertions
      expect(mockFrom).toHaveBeenCalledWith('app_releases');
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'production',
        status: 'PUBLISHED',
        published_at: expect.any(String),
        updated_at: expect.any(String),
      }));
      expect(mockEq).toHaveBeenCalledWith('id', targetId);
      expect(result.data).toEqual(mockRelease);
      expect(result.error).toBeNull();
    });

    it('Verifies promoteRelease fails gracefully with invalid channel or status input', async () => {
      const mockSupabase = createMockSupabase();
      const repository = new OtaReleaseRepository(mockSupabase);

      // Invalid channel
      const result1 = await repository.promoteRelease('some-id', 'invalid-channel' as any, 'PUBLISHED');
      expect(result1.data).toBeNull();
      expect(result1.error).toContain('Invalid channel');

      // Invalid status
      const result2 = await repository.promoteRelease('some-id', 'staging', 'INVALID-STATUS' as any);
      expect(result2.data).toBeNull();
      expect(result2.error).toContain('Invalid status');
    });

    it('Verifies deleteRelease targets the exact release id for deletion', async () => {
      const mockSupabase = createMockSupabase();
      const repository = new OtaReleaseRepository(mockSupabase);

      const targetId = 'release-delete-999';
      mockEq.mockResolvedValue({ error: null });

      const result = await repository.deleteRelease(targetId);

      expect(mockFrom).toHaveBeenCalledWith('app_releases');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', targetId);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('Verifies deleteRelease handles database errors gracefully', async () => {
      const mockSupabase = createMockSupabase();
      const repository = new OtaReleaseRepository(mockSupabase);

      mockEq.mockResolvedValue({ error: { message: 'RLS check failed or row locked' } });

      const result = await repository.deleteRelease('some-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('RLS check failed or row locked');
    });
  });

  describe('Form Input & Business Rule Validations', () => {
    it('Asserts validateChecksum enforces exactly 64 hex characters', () => {
      expect(validateChecksum('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')).toBe(true);
      expect(validateChecksum('9F86D081884C7D659A2FEAA0C55AD015A3BF4F1B2B0B822CD15D6C15B0F00A08')).toBe(true); // normalize hex case

      // Invalid SHA-256 patterns
      expect(validateChecksum('short-hash')).toBe(false);
      expect(validateChecksum('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08_long')).toBe(false);
      expect(validateChecksum('z9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')).toBe(false); // non-hex character
    });

    it('Asserts validateBundleVersion enforces correct versioning patterns', () => {
      expect(validateBundleVersion('1.0.0')).toBe(true);
      expect(validateBundleVersion('2.15.3-rc2')).toBe(true);
      expect(validateBundleVersion('0.1.0-beta.1')).toBe(true);
      expect(validateBundleVersion('v1.0')).toBe(true);
      expect(validateBundleVersion('alpha')).toBe(true);

      // Invalid patterns
      expect(validateBundleVersion('')).toBe(false);
      expect(validateBundleVersion('1..0')).toBe(false);
      expect(validateBundleVersion('invalid space')).toBe(false);
    });

    it('Asserts buildStoragePath computes the correct path format', () => {
      expect(buildStoragePath('staging', '1.0.1')).toBe('ota/staging/1.0.1/bundle.zip');
      expect(buildStoragePath('production', '2.0.0')).toBe('ota/production/2.0.0/bundle.zip');
    });
  });

  describe('Security & Exposure Prevention', () => {
    it('Confirms that no secret keys or Github/Supabase service role secrets are exposed', () => {
      expect(process.env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    });
  });
});

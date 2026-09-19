import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import JSZip from 'jszip';
import {
  createOtaBundle,
  validateOtaZip,
  calculateFileSha256,
  calculateBufferSha256,
  isForbiddenFile,
  FORBIDDEN_FILE_PATTERNS,
} from '../../scripts/buildOtaBundle';

describe('OTA Bundle Builder & Package Validator (Phase 2)', () => {
  const testRoot = path.resolve(process.cwd(), '.tmp-test-ota-builder');
  const testSourceDir = path.join(testRoot, 'source-web');
  const testOutDir = path.join(testRoot, 'dist-ota-test');

  beforeEach(() => {
    // Set up a clean test directory
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
    fs.mkdirSync(testSourceDir, { recursive: true });
    fs.mkdirSync(path.join(testSourceDir, 'assets'), { recursive: true });

    // Seed standard valid web assets
    fs.writeFileSync(
      path.join(testSourceDir, 'index.html'),
      '<!DOCTYPE html><html><head><title>CBE Test</title></head><body><div id="root"></div></body></html>',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(testSourceDir, 'assets', 'index-app.js'),
      'console.log("CBE App Web Bundle");',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(testSourceDir, 'assets', 'index-style.css'),
      'body { margin: 0; background: #fff; }',
      'utf-8'
    );
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('Test 1 — index.html: Final archive contains index.html at the expected root', async () => {
    const result = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: testOutDir,
      bundleVersion: '2.0.0-test',
    });

    expect(result.success).toBe(true);
    expect(fs.existsSync(result.zipPath)).toBe(true);

    const zipBuffer = fs.readFileSync(result.zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);

    expect(zip.file('index.html')).not.toBeNull();
    const indexContent = await zip.file('index.html')!.async('string');
    expect(indexContent).toContain('<div id="root"></div>');
  });

  it('Test 2 — assets: Final archive contains required browser assets', async () => {
    const result = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: testOutDir,
      bundleVersion: '2.0.0-test',
    });

    const zipBuffer = fs.readFileSync(result.zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);

    expect(zip.file('assets/index-app.js')).not.toBeNull();
    expect(zip.file('assets/index-style.css')).not.toBeNull();
    expect(result.validation.hasAssetsDir).toBe(true);
  });

  it('Test 3 — server artifact exclusion: Archive does NOT contain server.cjs or server.cjs.map', async () => {
    // Accidental server files placed in web folder
    fs.writeFileSync(path.join(testSourceDir, 'server.cjs'), '/* Express server */');
    fs.writeFileSync(path.join(testSourceDir, 'server.cjs.map'), '{"version":3}');
    fs.writeFileSync(path.join(testSourceDir, 'assets', 'index-app.js.map'), '{"version":3}');

    const result = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: testOutDir,
      bundleVersion: '2.0.0-test',
    });

    const zipBuffer = fs.readFileSync(result.zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);

    expect(zip.file('server.cjs')).toBeNull();
    expect(zip.file('server.cjs.map')).toBeNull();
    expect(zip.file('assets/index-app.js.map')).toBeNull();

    const allEntries = Object.keys(zip.files);
    expect(allEntries.some((e) => e.includes('server.cjs'))).toBe(false);
    expect(allEntries.some((e) => e.endsWith('.map'))).toBe(false);
  });

  it('Test 4 — repository artifact exclusion: Archive does NOT contain repo artifacts', async () => {
    // Intentionally place forbidden repo files in source directory
    fs.writeFileSync(path.join(testSourceDir, 'package.json'), '{"name":"test"}');
    fs.writeFileSync(path.join(testSourceDir, 'package-lock.json'), '{}');
    fs.mkdirSync(path.join(testSourceDir, 'node_modules', 'dummy'), { recursive: true });
    fs.writeFileSync(path.join(testSourceDir, 'node_modules', 'dummy', 'index.js'), '');
    fs.mkdirSync(path.join(testSourceDir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(testSourceDir, '.git', 'config'), '');
    fs.mkdirSync(path.join(testSourceDir, 'android'), { recursive: true });
    fs.writeFileSync(path.join(testSourceDir, 'android', 'build.gradle'), '');
    fs.mkdirSync(path.join(testSourceDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(testSourceDir, 'src', 'App.tsx'), '');
    fs.writeFileSync(path.join(testSourceDir, '.env'), 'VITE_KEY=secret');
    fs.writeFileSync(path.join(testSourceDir, '.env.local'), 'SUPABASE_KEY=secret');

    const result = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: testOutDir,
      bundleVersion: '2.0.0-test',
    });

    const zipBuffer = fs.readFileSync(result.zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);

    expect(zip.file('package.json')).toBeNull();
    expect(zip.file('package-lock.json')).toBeNull();
    expect(zip.file('.env')).toBeNull();
    expect(zip.file('.env.local')).toBeNull();

    const allEntries = Object.keys(zip.files);
    expect(allEntries.some((e) => e.startsWith('node_modules'))).toBe(false);
    expect(allEntries.some((e) => e.startsWith('.git'))).toBe(false);
    expect(allEntries.some((e) => e.startsWith('android'))).toBe(false);
    expect(allEntries.some((e) => e.startsWith('src'))).toBe(false);
  });

  it('Test 5 — checksum: Generated SHA-256 is 64 hex chars and matches independent file hash', async () => {
    const result = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: testOutDir,
      bundleVersion: '2.0.0-test',
    });

    const sha256 = result.metadata.checksumSha256;
    expect(sha256).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(sha256)).toBe(true);

    // Independently calculate hash of the written file on disk
    const diskBuffer = fs.readFileSync(result.zipPath);
    const independentHash = createHash('sha256').update(diskBuffer).digest('hex').toLowerCase();
    expect(sha256).toBe(independentHash);
    expect(calculateFileSha256(result.zipPath)).toBe(independentHash);
  });

  it('Test 6 — bundle size: Reported bundleSizeBytes exactly matches final ZIP file size', async () => {
    const result = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: testOutDir,
      bundleVersion: '2.0.0-test',
    });

    const stat = fs.statSync(result.zipPath);
    expect(result.metadata.bundleSizeBytes).toBe(stat.size);
    expect(result.metadata.bundleSizeBytes).toBeGreaterThan(0);
  });

  it('Test 7 — validation failure: Packaging fails if index.html is missing', async () => {
    // Delete index.html
    fs.unlinkSync(path.join(testSourceDir, 'index.html'));

    await expect(
      createOtaBundle({
        sourceDir: testSourceDir,
        outDir: testOutDir,
      })
    ).rejects.toThrow(/index\.html/i);
  });

  it('Test 8 — clean staging: Staging directory is cleaned after successful packaging', async () => {
    const customStaging = path.join(testRoot, 'staging-to-clean');

    await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: testOutDir,
      stagingDir: customStaging,
      keepStaging: false,
    });

    expect(fs.existsSync(customStaging)).toBe(false);
  });

  it('Test 9 — deterministic packaging: Identical files produce identical SHA-256 byte-for-byte', async () => {
    const run1Out = path.join(testRoot, 'out-run1');
    const run2Out = path.join(testRoot, 'out-run2');

    const result1 = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: run1Out,
      bundleVersion: '1.0.0',
    });

    const result2 = await createOtaBundle({
      sourceDir: testSourceDir,
      outDir: run2Out,
      bundleVersion: '1.0.0',
    });

    expect(result1.metadata.checksumSha256).toBe(result2.metadata.checksumSha256);
    expect(result1.metadata.bundleSizeBytes).toBe(result2.metadata.bundleSizeBytes);

    const b1 = fs.readFileSync(result1.zipPath);
    const b2 = fs.readFileSync(result2.zipPath);
    expect(b1.equals(b2)).toBe(true);
  });

  it('Test 10 — validation of corrupted or invalid archives', async () => {
    const invalidZip = Buffer.from('not a zip file at all');
    const validation = await validateOtaZip(invalidZip);

    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('Test 11 — pattern matcher accurately flags sensitive patterns', () => {
    expect(isForbiddenFile('server.cjs')).toBe(true);
    expect(isForbiddenFile('server.cjs.map')).toBe(true);
    expect(isForbiddenFile('assets/app.js.map')).toBe(true);
    expect(isForbiddenFile('.env')).toBe(true);
    expect(isForbiddenFile('.env.production')).toBe(true);
    expect(isForbiddenFile('secrets/key.pem')).toBe(true);
    expect(isForbiddenFile('node_modules/express/index.js')).toBe(true);
    expect(isForbiddenFile('src/main.tsx')).toBe(true);
    expect(isForbiddenFile('package.json')).toBe(true);

    // Valid web assets must not be flagged
    expect(isForbiddenFile('index.html')).toBe(false);
    expect(isForbiddenFile('assets/index-D2MDr-Ga.js')).toBe(false);
    expect(isForbiddenFile('assets/index-DfXOUQdo.css')).toBe(false);
    expect(isForbiddenFile('favicon.ico')).toBe(false);
  });
});

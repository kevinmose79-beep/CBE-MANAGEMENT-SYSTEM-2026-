import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import JSZip from 'jszip';
import { build as viteBuild } from 'vite';

export interface OtaBundleOptions {
  /**
   * Version identifier for this OTA bundle (e.g. "1.0.0").
   * Defaults to process.env.OTA_BUNDLE_VERSION or '1.0.0'.
   */
  bundleVersion?: string;

  /**
   * Source directory containing already-built web assets.
   * If not provided, Vite will build the web client into stagingDir.
   */
  sourceDir?: string;

  /**
   * Destination directory for final ZIP and metadata.
   * Defaults to 'dist-ota'.
   */
  outDir?: string;

  /**
   * Base name of the output zip file (without extension).
   * Defaults to 'bundle'.
   */
  outputFileName?: string;

  /**
   * Temporary staging directory. Cleaned up after packaging.
   */
  stagingDir?: string;

  /**
   * Keep staging directory after packaging (useful for debugging).
   * Defaults to false.
   */
  keepStaging?: boolean;
}

export interface OtaBundleMetadata {
  bundleVersion: string;
  fileName: string;
  bundleSizeBytes: number;
  checksumSha256: string;
  entryPoint: string;
  fileCount: number;
  builtAt: string;
}

export interface OtaBundleResult {
  success: boolean;
  zipPath: string;
  metadataPath: string;
  metadata: OtaBundleMetadata;
  validation: OtaZipValidationResult;
}

export interface OtaZipValidationResult {
  isValid: boolean;
  fileCount: number;
  hasIndexHtml: boolean;
  hasAssetsDir: boolean;
  totalUncompressedBytes: number;
  files: string[];
  forbiddenFilesDetected: string[];
  errors: string[];
}

/**
 * Regular expressions matching files strictly forbidden from entering the OTA archive.
 */
export const FORBIDDEN_FILE_PATTERNS: RegExp[] = [
  /^server\.cjs(\.map)?$/i,
  /\.map$/i,
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)\.git(\/|$)/i,
  /(^|\/)android(\/|$)/i,
  /(^|\/)ios(\/|$)/i,
  /(^|\/)src(\/|$)/i,
  /(^|\/)package(-lock)?\.json$/i,
  /(^|\/)Dockerfile/i,
  /(^|\/)docker-compose/i,
  /secrets?/i,
  /\.keystore$/i,
  /\.jks$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.DS_Store$/i,
  /\.(test|spec)\.[jt]sx?$/i,
];

/**
 * Fixed date used for zip file entries to ensure deterministic builds.
 */
export const DETERMINISTIC_ZIP_DATE = new Date('2026-01-01T00:00:00.000Z');

/**
 * Compute lowercase 64-character hex SHA-256 checksum of a buffer.
 */
export function calculateBufferSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').toLowerCase();
}

/**
 * Compute lowercase 64-character hex SHA-256 checksum of a file on disk.
 */
export function calculateFileSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return calculateBufferSha256(buffer);
}

/**
 * Recursively list all files in a directory, returning relative paths.
 */
export function listFilesRecursive(dir: string, baseDir: string = dir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push(relPath);
    }
  }
  return results;
}

/**
 * Validate that an entry does not match forbidden security or server patterns.
 */
export function isForbiddenFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return FORBIDDEN_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Inspects and validates a generated OTA zip file.
 * Confirms index.html at root, presence of assets, absence of forbidden files,
 * and valid structure for Capgo.
 */
export async function validateOtaZip(
  zipBufferOrPath: Buffer | string
): Promise<OtaZipValidationResult> {
  const buffer = typeof zipBufferOrPath === 'string'
    ? fs.readFileSync(zipBufferOrPath)
    : zipBufferOrPath;

  const errors: string[] = [];
  const forbiddenFilesDetected: string[] = [];
  const files: string[] = [];
  let totalUncompressedBytes = 0;

  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      fileCount: 0,
      hasIndexHtml: false,
      hasAssetsDir: false,
      totalUncompressedBytes: 0,
      files: [],
      forbiddenFilesDetected: [],
      errors: ['ZIP archive buffer is empty or missing.'],
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err: any) {
    return {
      isValid: false,
      fileCount: 0,
      hasIndexHtml: false,
      hasAssetsDir: false,
      totalUncompressedBytes: 0,
      files: [],
      forbiddenFilesDetected: [],
      errors: [`Corrupted or invalid ZIP archive: ${err?.message || err}`],
    };
  }

  const entries = Object.keys(zip.files);
  let hasIndexHtml = false;
  let hasAssetsDir = false;

  for (const entryName of entries) {
    const file = zip.files[entryName];
    if (file.dir) continue;

    const normalizedPath = entryName.replace(/\\/g, '/');
    files.push(normalizedPath);

    // Calculate uncompressed size (internal JSZip property or fallback)
    const uncompressed = (file as any)._data?.uncompressedSize || 0;
    totalUncompressedBytes += uncompressed;

    // Check entry points
    if (normalizedPath === 'index.html') {
      hasIndexHtml = true;
    }

    if (normalizedPath.startsWith('assets/') && normalizedPath.length > 7) {
      hasAssetsDir = true;
    }

    // Check forbidden files
    if (isForbiddenFile(normalizedPath)) {
      forbiddenFilesDetected.push(normalizedPath);
    }
  }

  if (files.length === 0) {
    errors.push('ZIP archive contains zero files.');
  }

  if (!hasIndexHtml) {
    errors.push('Required entrypoint "index.html" is missing at the root of the archive.');
  }

  if (!hasAssetsDir) {
    errors.push('Required "assets/" directory is missing or empty in the archive.');
  }

  if (forbiddenFilesDetected.length > 0) {
    errors.push(
      `Forbidden files detected in OTA archive: ${forbiddenFilesDetected.join(', ')}`
    );
  }

  return {
    isValid: errors.length === 0,
    fileCount: files.length,
    hasIndexHtml,
    hasAssetsDir,
    totalUncompressedBytes,
    files: files.sort(),
    forbiddenFilesDetected,
    errors,
  };
}

/**
 * Creates a deterministic, Capgo-compatible OTA bundle from web assets.
 */
export async function createOtaBundle(
  options: OtaBundleOptions = {}
): Promise<OtaBundleResult> {
  const rootDir = process.cwd();
  const bundleVersion =
    options.bundleVersion || process.env.OTA_BUNDLE_VERSION || '1.0.0';
  const outDir = path.resolve(rootDir, options.outDir || 'dist-ota');
  const baseName = options.outputFileName || 'bundle';
  const outputZipFileName = baseName.endsWith('.zip') ? baseName : `${baseName}.zip`;
  const finalZipPath = path.join(outDir, outputZipFileName);
  const metadataPath = path.join(outDir, 'ota-bundle-metadata.json');

  const stagingDir = path.resolve(
    rootDir,
    options.stagingDir ||
      (options.sourceDir
        ? path.join('.ota-staging-custom', `${Date.now()}`)
        : '.ota-staging')
  );

  let sourceDirectory = options.sourceDir;

  try {
    // 1. If no sourceDir provided, build fresh web assets into staging directory using Vite
    if (!sourceDirectory) {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
      fs.mkdirSync(stagingDir, { recursive: true });

      console.log(`[OTA Builder] Building web client into staging directory: ${stagingDir}...`);
      await viteBuild({
        configFile: path.resolve(rootDir, 'vite.config.ts'),
        build: {
          outDir: stagingDir,
          emptyOutDir: true,
        },
      });

      sourceDirectory = stagingDir;
    }

    if (!fs.existsSync(sourceDirectory)) {
      throw new Error(`Source directory does not exist: ${sourceDirectory}`);
    }

    // 2. Validate index.html exists in source
    const sourceIndexHtml = path.join(sourceDirectory, 'index.html');
    if (!fs.existsSync(sourceIndexHtml)) {
      throw new Error(
        `Pre-packaging validation failed: "index.html" not found in source directory "${sourceDirectory}".`
      );
    }

    // 3. Scan source files and filter forbidden items
    const allFiles = listFilesRecursive(sourceDirectory);
    if (allFiles.length === 0) {
      throw new Error(`Source directory "${sourceDirectory}" contains no files.`);
    }

    const filesToPackage: string[] = [];
    for (const relPath of allFiles) {
      if (isForbiddenFile(relPath)) {
        console.warn(`[OTA Builder] Excluded forbidden file from package: ${relPath}`);
        continue;
      }
      filesToPackage.push(relPath);
    }

    // Sort paths alphabetically for deterministic order
    filesToPackage.sort();

    // 4. Assemble deterministic ZIP archive
    const zip = new JSZip();
    for (const relPath of filesToPackage) {
      const fullPath = path.join(sourceDirectory, relPath);
      const fileData = fs.readFileSync(fullPath);
      zip.file(relPath, fileData, {
        date: DETERMINISTIC_ZIP_DATE,
        createFolders: true,
      });
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    // 5. Ensure output directory exists and write archive
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(finalZipPath, zipBuffer);

    // 6. Post-generation archive validation
    const validation = await validateOtaZip(finalZipPath);
    if (!validation.isValid) {
      // Remove invalid zip before throwing
      if (fs.existsSync(finalZipPath)) {
        fs.unlinkSync(finalZipPath);
      }
      throw new Error(
        `Post-packaging validation failed:\n  - ${validation.errors.join('\n  - ')}`
      );
    }

    // 7. Calculate SHA-256 checksum and bundle size of the final written ZIP
    const checksumSha256 = calculateFileSha256(finalZipPath);
    const bundleStat = fs.statSync(finalZipPath);
    const bundleSizeBytes = bundleStat.size;

    if (!checksumSha256 || checksumSha256.length !== 64 || !/^[0-9a-f]{64}$/.test(checksumSha256)) {
      throw new Error(`Invalid SHA-256 calculated for bundle: "${checksumSha256}"`);
    }

    if (bundleSizeBytes <= 0) {
      throw new Error(`Calculated bundle size is 0 bytes for: "${finalZipPath}"`);
    }

    // 8. Write machine-readable metadata file outside the ZIP
    const metadata: OtaBundleMetadata = {
      bundleVersion,
      fileName: outputZipFileName,
      bundleSizeBytes,
      checksumSha256,
      entryPoint: 'index.html',
      fileCount: validation.fileCount,
      builtAt: new Date().toISOString(),
    };

    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    return {
      success: true,
      zipPath: finalZipPath,
      metadataPath,
      metadata,
      validation,
    };
  } finally {
    // Clean up temporary staging directory if created by builder
    if (!options.keepStaging && fs.existsSync(stagingDir)) {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn(`[OTA Builder] Could not clean staging directory: ${stagingDir}`, cleanupErr);
      }
    }
  }
}

/**
 * Command line runner when invoked via `tsx scripts/buildOtaBundle.ts`
 */
export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  let version = process.env.OTA_BUNDLE_VERSION || '1.0.0';
  let outDir = 'dist-ota';
  let fromDist = false;
  let keepStaging = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--version=')) {
      version = arg.split('=')[1];
    } else if (arg === '-v' || arg === '--version') {
      version = args[++i];
    } else if (arg.startsWith('--out-dir=')) {
      outDir = arg.split('=')[1];
    } else if (arg === '--from-dist') {
      fromDist = true;
    } else if (arg === '--keep-staging') {
      keepStaging = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
CBE Management System — OTA Bundle Builder (Phase 2)

Usage:
  npm run build:ota [options]
  npx tsx scripts/buildOtaBundle.ts [options]

Options:
  -v, --version <version>   Set bundle version string (default: 1.0.0)
  --out-dir <path>          Output directory for ZIP and metadata (default: dist-ota)
  --from-dist               Package directly from existing dist/ web assets without re-running Vite
  --keep-staging            Keep temporary staging directory for inspection
  -h, --help                Show this help message
`);
      process.exit(0);
    }
  }

  console.log(`\n=== CBE Management System — OTA Package Generator ===`);
  console.log(`Target bundle version : ${version}`);
  console.log(`Output directory      : ${outDir}`);
  console.log(`Source mode           : ${fromDist ? 'Existing dist/ (filtered)' : 'Fresh Vite build into isolated staging'}\n`);

  try {
    const result = await createOtaBundle({
      bundleVersion: version,
      outDir,
      sourceDir: fromDist ? 'dist' : undefined,
      keepStaging,
    });

    console.log(`\n✔ OTA Bundle created successfully!`);
    console.log(`  Archive path : ${result.zipPath}`);
    console.log(`  File size    : ${(result.metadata.bundleSizeBytes / 1024).toFixed(2)} KB (${result.metadata.bundleSizeBytes} bytes)`);
    console.log(`  Files packed : ${result.metadata.fileCount}`);
    console.log(`  SHA-256      : ${result.metadata.checksumSha256}`);
    console.log(`  Metadata     : ${result.metadataPath}\n`);
    console.log(`✔ Validation passed: index.html at root, assets verified, 0 forbidden files.`);
  } catch (err: any) {
    console.error(`\n✖ OTA Packaging failed:`, err?.message || err);
    process.exit(1);
  }
}

// Auto-run if executed as main CLI entry point
if (process.argv[1] && process.argv[1].endsWith('buildOtaBundle.ts')) {
  runCli();
}

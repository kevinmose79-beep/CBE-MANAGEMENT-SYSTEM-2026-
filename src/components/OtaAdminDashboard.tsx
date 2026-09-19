import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  AlertCircle,
  Trash2,
  CheckCircle2,
  Plus,
  X,
  ShieldCheck,
  Download,
  Copy,
  Check,
  FileText,
  Clock,
  Settings,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  OtaReleaseRepository,
  buildStoragePath,
  validateChecksum,
  validateBundleVersion,
} from '../services/otaReleaseService';
import type { AppRelease, ReleaseChannel, ReleaseStatus } from '../types';

interface OtaAdminDashboardProps {
  onBack?: () => void;
}

export const OtaAdminDashboard: React.FC<OtaAdminDashboardProps> = ({ onBack }) => {
  const [repository] = useState(() => new OtaReleaseRepository());
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Draft state
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    bundle_version: '',
    channel: 'staging' as ReleaseChannel,
    status: 'DRAFT' as ReleaseStatus,
    checksum_sha256: '',
    bundle_size_bytes: '',
    min_native_version_code: '1',
    max_native_version_code: '',
    is_mandatory: false,
    release_notes: '',
  });

  // Action Confirmation state
  const [confirmModal, setConfirmModal] = useState<{
    type: 'promote' | 'disable' | 'delete';
    release: AppRelease;
    targetChannel?: ReleaseChannel;
    targetStatus?: ReleaseStatus;
  } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // Load releases on mount
  useEffect(() => {
    loadReleases();
  }, []);

  const loadReleases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await repository.getReleases();
      setReleases(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load OTA releases.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessMessage = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Handle Draft Input Change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // Submit New Draft
  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const errors: string[] = [];
    const version = formData.bundle_version.trim();
    const checksum = formData.checksum_sha256.trim();
    const sizeBytes = parseInt(formData.bundle_size_bytes, 10);
    const minNative = parseInt(formData.min_native_version_code, 10);
    const maxNative = formData.max_native_version_code.trim()
      ? parseInt(formData.max_native_version_code, 10)
      : null;

    if (!validateBundleVersion(version)) {
      errors.push('Bundle version must be a valid version format (e.g., 1.0.1, 2.0.0-rc1).');
    }

    if (!validateChecksum(checksum)) {
      errors.push('SHA-256 checksum must be exactly 64 hexadecimal characters.');
    }

    if (isNaN(sizeBytes) || sizeBytes <= 0) {
      errors.push('Bundle size must be a positive number of bytes.');
    }

    if (isNaN(minNative) || minNative < 1) {
      errors.push('Minimum native version code must be an integer >= 1.');
    }

    if (maxNative !== null && (isNaN(maxNative) || maxNative < minNative)) {
      errors.push('Maximum native version code must be greater than or equal to minimum native version code.');
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const path = buildStoragePath(formData.channel, version);

      const { data, error: apiErr } = await repository.createRelease({
        bundle_version: version,
        channel: formData.channel,
        status: formData.status,
        storage_bucket: 'ota-releases',
        storage_path: path,
        checksum_sha256: checksum.toLowerCase(),
        bundle_size_bytes: sizeBytes,
        min_native_version_code: minNative,
        max_native_version_code: maxNative,
        is_mandatory: formData.is_mandatory,
        release_notes: formData.release_notes.trim() || null,
        published_at: formData.status === 'PUBLISHED' ? new Date().toISOString() : undefined,
      });

      if (apiErr) {
        setFormErrors([apiErr]);
        return;
      }

      if (data) {
        showSuccessMessage(`OTA release ${data.bundle_version} drafted successfully.`);
        setShowDraftModal(false);
        // Reset form
        setFormData({
          bundle_version: '',
          channel: 'staging',
          status: 'DRAFT',
          checksum_sha256: '',
          bundle_size_bytes: '',
          min_native_version_code: '1',
          max_native_version_code: '',
          is_mandatory: false,
          release_notes: '',
        });
        loadReleases();
      }
    } catch (err: any) {
      setFormErrors([err?.message || 'An unexpected error occurred.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Confirmed Actions
  const handleExecuteAction = async () => {
    if (!confirmModal) return;
    const { type, release, targetChannel, targetStatus } = confirmModal;

    try {
      setActionInProgress(true);
      if (type === 'delete') {
        const { success: delSuccess, error: delErr } = await repository.deleteRelease(release.id);
        if (delErr) {
          setError(delErr);
        } else if (delSuccess) {
          showSuccessMessage(`Release ${release.bundle_version} successfully deleted.`);
        }
      } else if (type === 'disable') {
        const { error: updErr } = await repository.updateReleaseStatus(release.id, 'DISABLED');
        if (updErr) {
          setError(updErr);
        } else {
          showSuccessMessage(`Release ${release.bundle_version} successfully disabled.`);
        }
      } else if (type === 'promote') {
        if (!targetChannel || !targetStatus) return;
        const { error: promErr } = await repository.promoteRelease(release.id, targetChannel, targetStatus);
        if (promErr) {
          setError(promErr);
        } else {
          showSuccessMessage(`Release ${release.bundle_version} successfully promoted to ${targetChannel} (${targetStatus}).`);
        }
      }

      setConfirmModal(null);
      loadReleases();
    } catch (err: any) {
      setError(err?.message || 'Action execution failed.');
      setConfirmModal(null);
    } finally {
      setActionInProgress(false);
    }
  };

  // Helper to copy checksum
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format size in MB
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Render badge for release status
  const renderStatusBadge = (status: ReleaseStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            PUBLISHED
          </span>
        );
      case 'TESTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            TESTING
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
            <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            DRAFT
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            DISABLED
          </span>
        );
    }
  };

  const renderChannelBadge = (channel: ReleaseChannel) => {
    if (channel === 'production') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
          PROD
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        STAGING
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
         <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start space-x-3">
           <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
           <div className="flex-1">
             <span className="font-semibold">Database Error:</span> {error}
           </div>
           <button type="button" onClick={() => setError(null)} className="text-rose-600 dark:text-rose-400 hover:opacity-80">
             <X className="w-4 h-4" />
           </button>
         </div>
      )}

      {success && (
         <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-start space-x-3 animate-in fade-in">
           <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
           <div className="flex-1 font-semibold">{success}</div>
           <button type="button" onClick={() => setSuccess(null)} className="text-emerald-600 dark:text-emerald-400 hover:opacity-80">
             <X className="w-4 h-4" />
           </button>
         </div>
      )}

      {/* Header card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>OTA Distribution Security Authority</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
              CBE Over-the-Air (OTA) Releases
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage semantic native compatible update bundles and release configurations. Supabase acts as the authoritative source of release metadata.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={loadReleases}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center cursor-pointer focus:outline-none"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowDraftModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#054531] hover:bg-[#043828] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs border border-emerald-400/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 text-emerald-200" />
              <span>Draft New Release</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Release Panel */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
          <RefreshCw className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading OTA releases authority data from Supabase...</p>
        </div>
      ) : releases.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto border border-slate-200/60 dark:border-slate-700">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">No OTA Releases Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No Over-The-Air releases have been drafted or published yet. Draft your first package update to start distributing secure, verified updates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDraftModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Draft First Release</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card list / Desktop Table grid */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Authoritative App Releases List
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {releases.length} total
              </span>
            </div>

            {/* Desktop Table View (lg screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/20">
                    <th className="py-3 px-4">Bundle Version</th>
                    <th className="py-3 px-3">Scope</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Size & Compat</th>
                    <th className="py-3 px-3">Checksum</th>
                    <th className="py-3 px-3">Created / Published</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {releases.map((release) => {
                    const isCopied = copiedId === release.id;
                    return (
                      <tr key={release.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {release.bundle_version}
                            </span>
                            {release.is_mandatory && (
                              <span className="block text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">
                                Mandatory Update
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col items-start gap-1">
                            {renderChannelBadge(release.channel)}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          {renderStatusBadge(release.status)}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                          <div className="space-y-0.5">
                            <div>{formatBytes(release.bundle_size_bytes)}</div>
                            <div className="text-[10px] text-slate-400">
                              Native codes: {release.min_native_version_code}
                              {release.max_native_version_code ? ` - ${release.max_native_version_code}` : ' +'}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[10px]">
                          <button
                            type="button"
                            onClick={() => handleCopyText(release.checksum_sha256, release.id)}
                            className="flex items-center gap-1 text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-2 py-1 rounded transition-colors group cursor-pointer"
                          >
                            <span>{release.checksum_sha256.substring(0, 12)}...</span>
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-3 text-slate-500 dark:text-slate-400">
                          <div className="space-y-0.5">
                            <div>{new Date(release.created_at).toLocaleDateString()}</div>
                            {release.published_at ? (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Published {new Date(release.published_at).toLocaleDateString()}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400">Not published</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Staging & Draft / Testing -> Promote to Prod */}
                            {release.status !== 'PUBLISHED' && release.status !== 'DISABLED' && (
                              <button
                                type="button"
                                onClick={() => setConfirmModal({
                                  type: 'promote',
                                  release,
                                  targetChannel: release.channel,
                                  targetStatus: 'PUBLISHED',
                                })}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                              >
                                Publish
                              </button>
                            )}

                            {release.channel === 'staging' && release.status === 'PUBLISHED' && (
                              <button
                                type="button"
                                onClick={() => setConfirmModal({
                                  type: 'promote',
                                  release,
                                  targetChannel: 'production',
                                  targetStatus: 'PUBLISHED',
                                })}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-2xs transition cursor-pointer"
                              >
                                Promote to PROD
                              </button>
                            )}

                            {/* Active Published -> Disable */}
                            {release.status === 'PUBLISHED' && (
                              <button
                                type="button"
                                onClick={() => setConfirmModal({
                                  type: 'disable',
                                  release,
                                })}
                                className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-[11px] font-bold transition cursor-pointer"
                              >
                                Disable
                              </button>
                            )}

                            {/* Delete release (Any, but requires confirmation) */}
                            <button
                              type="button"
                              onClick={() => setConfirmModal({
                                type: 'delete',
                                release,
                              })}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Delete release record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards list (on md and smaller) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {releases.map((release) => {
                const isCopied = copiedId === release.id;
                return (
                  <div key={release.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            v{release.bundle_version}
                          </span>
                          {renderChannelBadge(release.channel)}
                        </div>
                        {release.is_mandatory && (
                          <span className="inline-block text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                            Mandatory
                          </span>
                        )}
                      </div>
                      <div>{renderStatusBadge(release.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <div className="space-y-0.5">
                        <span className="text-slate-400 block text-[10px]">Bundle Size</span>
                        <span className="text-slate-700 dark:text-slate-200 font-bold">
                          {formatBytes(release.bundle_size_bytes)}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-400 block text-[10px]">Native Compatibility</span>
                        <span className="text-slate-700 dark:text-slate-200 font-bold">
                          Min Code: {release.min_native_version_code}
                          {release.max_native_version_code ? ` (Max: ${release.max_native_version_code})` : ' +'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 block text-[10px]">SHA-256 Checksum</span>
                      <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700/80 font-mono text-[10px] text-slate-700 dark:text-slate-300">
                        <span className="truncate pr-4">{release.checksum_sha256}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(release.checksum_sha256, release.id)}
                          className="shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-600 transition"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {release.release_notes && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300">
                        <span className="font-semibold block text-[10px] text-slate-400">Release Notes</span>
                        <p className="mt-0.5 leading-normal">{release.release_notes}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-3">
                      <span className="text-[10px] text-slate-400">
                        Drafted: {new Date(release.created_at).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {release.status !== 'PUBLISHED' && release.status !== 'DISABLED' && (
                          <button
                            type="button"
                            onClick={() => setConfirmModal({
                              type: 'promote',
                              release,
                              targetChannel: release.channel,
                              targetStatus: 'PUBLISHED',
                            })}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold shadow-2xs"
                          >
                            Publish
                          </button>
                        )}

                        {release.channel === 'staging' && release.status === 'PUBLISHED' && (
                          <button
                            type="button"
                            onClick={() => setConfirmModal({
                              type: 'promote',
                              release,
                              targetChannel: 'production',
                              targetStatus: 'PUBLISHED',
                            })}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-2xs"
                          >
                            Promote PROD
                          </button>
                        )}

                        {release.status === 'PUBLISHED' && (
                          <button
                            type="button"
                            onClick={() => setConfirmModal({
                              type: 'disable',
                              release,
                            })}
                            className="px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-[11px] font-bold"
                          >
                            Disable
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setConfirmModal({
                            type: 'delete',
                            release,
                          })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DRAFT RELEASE MODAL */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100">
                  Draft New OTA Release
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateDraft} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {formErrors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Please correct the following errors:</span>
                  </div>
                  <ul className="list-disc list-inside pl-1 space-y-0.5">
                    {formErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bundle Version */}
                <div className="space-y-1">
                  <label htmlFor="bundle_version" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bundle Version *
                  </label>
                  <input
                    id="bundle_version"
                    name="bundle_version"
                    type="text"
                    required
                    value={formData.bundle_version}
                    onChange={handleInputChange}
                    placeholder="e.g. 1.0.1"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  <span className="block text-[10px] text-slate-400">Must follow clean version formatting.</span>
                </div>

                {/* Distribution Channel */}
                <div className="space-y-1">
                  <label htmlFor="channel" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Distribution Channel
                  </label>
                  <select
                    id="channel"
                    name="channel"
                    value={formData.channel}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-pointer"
                  >
                    <option value="staging">Staging (Tested by QA & Devs)</option>
                    <option value="production">Production (General Release)</option>
                  </select>
                </div>

                {/* Bundle Status */}
                <div className="space-y-1">
                  <label htmlFor="status" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Initial Release Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none cursor-pointer"
                  >
                    <option value="DRAFT">DRAFT (Unpublished metadata only)</option>
                    <option value="TESTING">TESTING (Available for debug build checks)</option>
                    <option value="PUBLISHED">PUBLISHED (Instantly discoverable in channel)</option>
                  </select>
                </div>

                {/* Bundle Size Bytes */}
                <div className="space-y-1">
                  <label htmlFor="bundle_size_bytes" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Bundle Size (Bytes) *
                  </label>
                  <input
                    id="bundle_size_bytes"
                    name="bundle_size_bytes"
                    type="number"
                    required
                    min="1"
                    value={formData.bundle_size_bytes}
                    onChange={handleInputChange}
                    placeholder="e.g. 2097152"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                  {formData.bundle_size_bytes && (
                    <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Calculated size: {formatBytes(parseInt(formData.bundle_size_bytes, 10) || 0)}
                    </span>
                  )}
                </div>

                {/* Min Native Version */}
                <div className="space-y-1">
                  <label htmlFor="min_native_version_code" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Min Native Version Code *
                  </label>
                  <input
                    id="min_native_version_code"
                    name="min_native_version_code"
                    type="number"
                    required
                    min="1"
                    value={formData.min_native_version_code}
                    onChange={handleInputChange}
                    placeholder="e.g. 1"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>

                {/* Max Native Version */}
                <div className="space-y-1">
                  <label htmlFor="max_native_version_code" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Max Native Version Code (Optional)
                  </label>
                  <input
                    id="max_native_version_code"
                    name="max_native_version_code"
                    type="number"
                    min="1"
                    value={formData.max_native_version_code}
                    onChange={handleInputChange}
                    placeholder="Leave empty for all future codes"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* SHA-256 Checksum */}
              <div className="space-y-1">
                <label htmlFor="checksum_sha256" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  SHA-256 Checksum *
                </label>
                <input
                  id="checksum_sha256"
                  name="checksum_sha256"
                  type="text"
                  required
                  value={formData.checksum_sha256}
                  onChange={handleInputChange}
                  placeholder="e.g. 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
                <span className="block text-[10px] text-slate-400">Must be exactly 64-character lowercase hexadecimal hash.</span>
              </div>

              {/* Automatic Path Preview */}
              {formData.bundle_version && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <span className="font-bold block text-slate-400 text-[10px]">Deterministic Canonical Storage Path:</span>
                  <code className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 block break-all">
                    ota-releases/{buildStoragePath(formData.channel, formData.bundle_version)}
                  </code>
                </div>
              )}

              {/* Is Mandatory Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  id="is_mandatory"
                  name="is_mandatory"
                  type="checkbox"
                  checked={formData.is_mandatory}
                  onChange={handleCheckboxChange}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">Enforce Mandatory Activation</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">When enabled, the native app container will immediately block usage until this update is successfully loaded.</span>
                </div>
              </label>

              {/* Release Notes */}
              <div className="space-y-1">
                <label htmlFor="release_notes" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Release Notes
                </label>
                <textarea
                  id="release_notes"
                  name="release_notes"
                  rows={2}
                  value={formData.release_notes}
                  onChange={handleInputChange}
                  placeholder="Summary of bug fixes, security patches, or features introduced in this bundle..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDraftModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSubmitting ? 'Drafting...' : 'Save Release Draft'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION ACTION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                confirmModal.type === 'delete'
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                  : confirmModal.type === 'disable'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              }`}>
                {confirmModal.type === 'delete' ? (
                  <Trash2 className="w-5 h-5" />
                ) : confirmModal.type === 'disable' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {confirmModal.type === 'delete' && 'Delete Release Record'}
                  {confirmModal.type === 'disable' && 'Disable Active Release'}
                  {confirmModal.type === 'promote' && 'Publish / Promote Release'}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-normal space-y-2">
                  <p>
                    Are you sure you want to {confirmModal.type} the release{' '}
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      v{confirmModal.release.bundle_version}
                    </span>
                    ?
                  </p>

                  {confirmModal.type === 'promote' && confirmModal.targetChannel && (
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 font-semibold text-slate-700 dark:text-slate-300">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-normal">CURRENT</span>
                        {renderChannelBadge(confirmModal.release.channel)}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 mt-3" />
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-normal">TARGET</span>
                        {renderChannelBadge(confirmModal.targetChannel)}
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 uppercase mt-0.5 font-bold">
                          {confirmModal.targetStatus}
                        </span>
                      </div>
                    </div>
                  )}

                  {confirmModal.type === 'delete' && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-800 dark:text-rose-300 border border-rose-100 dark:border-rose-900/60 font-semibold flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>
                        CRITICAL: Deleting this release from the database metadata is permanent. Native clients seeking this release ID will experience discovery fallbacks.
                      </span>
                    </div>
                  )}

                  {confirmModal.type === 'disable' && (
                    <p className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 text-[11px]">
                      Disabling a published release halts any further installations of this bundle in the respective channel immediately.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={actionInProgress}
                className={`px-3.5 py-2 text-xs font-semibold text-white rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5 ${
                  confirmModal.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {actionInProgress && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  Confirm {confirmModal.type === 'delete' ? 'Delete' : 'Execution'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

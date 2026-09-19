import React from 'react';

interface LoadingIndicatorProps {
  className?: string;
  minHeight?: string;
}

/**
 * Reusable Workflow Loading Indicator
 * Soft pulse / ripple-water animation for workflow-specific lazy-loaded data requests.
 */
export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  className = '',
  minHeight = 'min-h-[220px]',
}) => {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center p-6 ${minHeight} ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Please wait, loading data"
    >
      {/* Soft Ripple-Water Visual Indicator */}
      <div className="relative w-16 h-16 flex items-center justify-center mb-4">
        {/* Expanding Water Ripple Rings */}
        <div className="absolute inset-0 rounded-full border-2 border-[#176B45]/60 dark:border-emerald-400/60 animate-ripple-1 pointer-events-none" />
        <div className="absolute inset-0 rounded-full border-2 border-[#176B45]/40 dark:border-emerald-400/40 animate-ripple-2 pointer-events-none" />
        <div className="absolute inset-0 rounded-full border border-[#176B45]/25 dark:border-emerald-400/25 animate-ripple-3 pointer-events-none" />

        {/* Central Core Pulsing Element */}
        <div className="w-3.5 h-3.5 rounded-full bg-[#176B45] dark:bg-emerald-400 shadow-sm shadow-[#176B45]/30 z-10 motion-safe:animate-pulse" />
      </div>

      {/* Loading Text */}
      <span className="text-xs font-bold tracking-wider text-slate-700 dark:text-slate-200 uppercase select-none">
        Please wait
      </span>
    </div>
  );
};

export default LoadingIndicator;

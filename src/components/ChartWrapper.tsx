import React, { useRef, useState, useEffect } from 'react';

interface ChartWrapperProps {
  children: React.ReactNode;
  hasData?: boolean;
  loading?: boolean;
  className?: string;
  emptyTitle?: string;
  emptySubtext?: string;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({ 
  children, 
  hasData = true, 
  loading = false,
  className = "w-full h-full min-h-[250px]",
  emptyTitle = "No Assessment Data Available",
  emptySubtext = "Enter and approve assessment marks to generate the grade distribution."
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const observeTarget = containerRef.current;
    if (!observeTarget) return;

    // Check initial layout dimensions immediately on mount
    const rect = observeTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
    }

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      });

      observer.observe(observeTarget);
      return () => observer.disconnect();
    }
  }, []);

  const isVisible = dimensions.width > 0 && dimensions.height > 0;

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 ${className}`}>
        <div className="flex flex-col items-center text-slate-400 dark:text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-emerald-500 rounded-full animate-spin"></div>
          <span className="text-xs font-semibold">Loading chart data...</span>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className={`flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 ${className}`}>
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3 border border-transparent dark:border-slate-700/60">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{emptyTitle}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {emptySubtext}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {isVisible ? children : null}
    </div>
  );
};

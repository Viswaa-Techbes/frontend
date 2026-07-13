import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export default function LoadingSpinner({ size = 'md', fullPage = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const spinner = (
    <div
      className={`${sizeClasses[size]} border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          {spinner}
          <p className="text-slate-400 text-sm font-medium animate-pulse">Loading TechBes Billing...</p>
        </div>
      </div>
    );
  }

  return spinner;
}

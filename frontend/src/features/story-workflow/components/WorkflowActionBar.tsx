import React from 'react';

interface WorkflowActionBarProps {
  children: React.ReactNode;
}

export function WorkflowActionBar({ children }: WorkflowActionBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-katha-surface/95 backdrop-blur-xl shadow-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        {children}
      </div>
    </div>
  );
}

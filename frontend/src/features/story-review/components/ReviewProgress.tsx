import React from 'react';
import type { ReviewProgress as ProgressType } from '../types';

interface ReviewProgressProps {
  progress: ProgressType;
}

export function ReviewProgress({ progress }: ReviewProgressProps) {
  const isComplete = progress.approved === progress.total && progress.total > 0;

  return (
    <div className="flex items-center space-x-4 bg-katha-surface-light border border-white/10 rounded-xl px-4 py-3">
      <div className="flex-1 flex items-center space-x-3">
        <div className="w-full bg-white/10 rounded-full h-1.5 max-w-[120px]">
          <div
            className={`h-1.5 rounded-full ${isComplete ? 'bg-katha-success' : 'bg-katha-primary'}`}
            style={{ width: `${progress.total > 0 ? (progress.approved / progress.total) * 100 : 0}%` }}
          ></div>
        </div>
        <span className="text-sm font-medium text-white">
          {progress.approved}/{progress.total} trang đã duyệt
        </span>
      </div>

      <div className="flex items-center space-x-3 text-xs">
        {progress.pending > 0 && (
          <div className="flex items-center text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5 animate-pulse"></span>
            {progress.pending} chờ duyệt
          </div>
        )}
        {progress.rejected > 0 && (
          <div className="flex items-center text-red-300">
            <span className="w-2 h-2 rounded-full bg-red-400 mr-1.5"></span>
            {progress.rejected} từ chối
          </div>
        )}
        {progress.pending === 0 && progress.rejected === 0 && progress.total > 0 && (
          <div className="flex items-center text-emerald-300">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Hoàn tất
          </div>
        )}
      </div>
    </div>
  );
}

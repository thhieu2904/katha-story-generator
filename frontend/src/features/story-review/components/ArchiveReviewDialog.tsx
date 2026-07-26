import React from 'react';

interface ArchiveReviewDialogProps {
  open: boolean;
  storyTitle: string | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function ArchiveReviewDialog({
  open,
  storyTitle,
  onClose,
  onConfirm,
  isSubmitting,
}: ArchiveReviewDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-katha-surface shadow-2xl p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-katha-error/10 mb-4">
          <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>

        <h3 className="text-xl font-bold mb-2 text-white">Lưu trữ truyện</h3>
        
        <p className="text-sm text-gray-300 mb-6">
          Bạn có chắc chắn muốn lưu trữ truyện <span className="font-semibold text-white">“{storyTitle || 'Truyện chưa đặt tên'}”</span>? Truyện sẽ bị ẩn.
        </p>

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-xl bg-katha-error px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu trữ...' : 'Lưu trữ'}
          </button>
        </div>
      </div>
    </div>
  );
}

import type { ReviewProgress } from '../types';

interface CompleteReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  progress: ReviewProgress;
}

export function CompleteReviewDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
  progress,
}: CompleteReviewDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-katha-surface shadow-2xl p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-katha-success/10 mb-4">
          <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-white mb-2">
          Hoàn tất duyệt truyện?
        </h3>
        
        <p className="text-sm text-gray-300 mb-6">
          Bạn đã duyệt tất cả {progress.total} trang. Truyện sẽ được chuyển sang trạng thái "Đã duyệt" và sẵn sàng để xuất bản.
        </p>

        <div className="flex justify-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-katha-success/20 text-emerald-300 hover:bg-katha-success/30 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Hoàn tất duyệt'}
          </button>
        </div>
      </div>
    </div>
  );
}

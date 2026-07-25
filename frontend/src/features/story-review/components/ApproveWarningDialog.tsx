import { useState } from 'react';

interface ApproveWarningDialogProps {
  open: boolean;
  pageNo: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
}

export function ApproveWarningDialog({
  open,
  pageNo,
  onClose,
  onConfirm,
  isSubmitting,
}: ApproveWarningDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (!acknowledged) return;
    await onConfirm();
    setAcknowledged(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-katha-surface p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Xác nhận duyệt trang {pageNo}</h2>
        </div>

        <p className="text-sm text-gray-300">
          Trang {pageNo} có cảnh báo kiểm tra chính tả tiếng Khmer hoặc chưa được xác thực chính thức.
        </p>

        <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-amber-500 focus:ring-amber-500"
          />
          <span className="text-xs text-gray-200">
            Tôi xác nhận đã kiểm tra văn bản tiếng Khmer và đồng ý bỏ qua các cảnh báo để duyệt trang này.
          </span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !acknowledged}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Đang duyệt...' : 'Đồng ý duyệt'}
          </button>
        </div>
      </div>
    </div>
  );
}

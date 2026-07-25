interface RegenerateImageDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  pageNo: number;
}

export function RegenerateImageDialog({
  open,
  onClose,
  onConfirm,
  isSubmitting,
  pageNo,
}: RegenerateImageDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-katha-surface p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-white">Tạo lại ảnh minh họa</h2>
        </div>

        <div className="space-y-3 text-sm text-gray-300 mb-6">
          <p>Tạo lại 1 ảnh cho trang {pageNo} dựa trên prompt gốc và lý do từ chối.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Ảnh cũ sẽ được giữ cho tới khi ảnh mới hoàn tất.</li>
            <li>Nhân vật và phong cách được giữ nguyên.</li>
            <li>Có thể phát sinh chi phí tạo ảnh.</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3">
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
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/20 transition-colors disabled:opacity-50"
          >
            {isSubmitting && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Tạo lại ảnh
          </button>
        </div>
      </div>
    </div>
  );
}

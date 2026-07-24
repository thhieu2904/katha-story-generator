import type { ImageGenerationDialogMode } from '../types';

interface StartImageGenerationDialogProps {
  mode: ImageGenerationDialogMode;
  pageCount: number;
  finalizationOnly: boolean;
  pending: boolean;
  error: string | null;
  blocked: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReconcile: () => void;
}

function dialogCopy(mode: ImageGenerationDialogMode, finalizationOnly: boolean) {
  if (finalizationOnly) {
    return {
      title: 'Đồng bộ kết quả',
      action: 'Đồng bộ kết quả',
    };
  }
  if (mode === 'retry') {
    return {
      title: 'Thử lại các trang còn thiếu',
      action: 'Thử lại sinh ảnh',
    };
  }
  if (mode === 'resume') {
    return {
      title: 'Tiếp tục sinh ảnh',
      action: 'Tiếp tục sinh ảnh',
    };
  }
  return {
    title: 'Bắt đầu sinh ảnh',
    action: 'Bắt đầu sinh ảnh',
  };
}

export function StartImageGenerationDialog({
  mode,
  pageCount,
  finalizationOnly,
  pending,
  error,
  blocked,
  onClose,
  onConfirm,
  onReconcile,
}: StartImageGenerationDialogProps) {
  const isFinalizationOnly = mode === 'resume' && finalizationOnly;
  const copy = dialogCopy(mode, isFinalizationOnly);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-image-generation-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-katha-surface p-6 shadow-2xl space-y-4">
        <h2 id="start-image-generation-title" className="text-xl font-semibold text-white">
          {copy.title}
        </h2>
        <p className="text-sm leading-6 text-white/65">
          {isFinalizationOnly
            ? 'Tất cả ảnh nội dung đã được lưu. Xác nhận để đồng bộ kết quả; không tạo ảnh mới hoặc ảnh bìa.'
            : `Sẽ tạo ${pageCount} ảnh nội dung. Không tạo ảnh bìa trong bước này.`}
        </p>
        <p className="rounded-xl border border-katha-primary/20 bg-katha-primary/10 p-3 text-xs leading-5 text-katha-primary-light">
          {isFinalizationOnly
            ? 'Thao tác này chỉ đồng bộ kết quả quá trình tạo ảnh đã bị gián đoạn.'
            : 'Ảnh đã hoàn tất sẽ được giữ lại nếu một trang sau đó gặp lỗi.'}
        </p>
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-3 text-sm leading-5 text-rose-200"
          >
            <p>{error}</p>
            {blocked && (
              <p className="mt-1 text-xs text-rose-100/75">
                Cần tải lại trạng thái mới nhất trước khi gửi lại yêu cầu.
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white disabled:opacity-50 transition"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={pending || (!blocked && !isFinalizationOnly && pageCount <= 0)}
            onClick={blocked ? onReconcile : onConfirm}
            className="rounded-xl bg-katha-primary px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-40 hover:bg-katha-primary-light transition"
          >
            {pending ? 'Đang gửi yêu cầu…' : blocked ? 'Kiểm tra lại trạng thái' : copy.action}
          </button>
        </div>
      </div>
    </div>
  );
}

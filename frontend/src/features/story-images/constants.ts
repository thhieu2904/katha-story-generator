export const IMAGE_POLL_INTERVAL_MS = 3_000;
export const IMAGE_PLAN_TIMEOUT_MS = 185_000;
export const IMAGE_START_TIMEOUT_MS = 30_000;

export const IMAGE_PAGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Đang chờ',
  generating: 'Đang sinh ảnh',
  completed: 'Đã hoàn tất',
  failed: 'Cần thử lại',
};

export const IMAGE_PAGE_ERROR_LABELS: Record<string, string> = {
  JOB_INTERRUPTED: 'Job sinh ảnh bị gián đoạn. Trang này có thể được thử lại.',
  STALE_JOB_INTERRUPTED: 'Job sinh ảnh cũ đã hết hạn. Trang này có thể được tiếp tục.',
  PROVIDER_UNAVAILABLE: 'Dịch vụ sinh ảnh tạm thời không khả dụng.',
  PROVIDER_REJECTED: 'Yêu cầu sinh ảnh không được chấp nhận.',
  INVALID_IMAGE: 'Ảnh trả về không hợp lệ.',
  REFERENCE_UNAVAILABLE: 'Không thể tải ảnh tham chiếu của nhân vật.',
  R2_UPLOAD_FAILED: 'Không thể lưu ảnh vừa tạo.',
  INTERNAL_ERROR: 'Đã có lỗi khi xử lý ảnh.',
};

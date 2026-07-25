export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Bị từ chối',
};

export const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-katha-warning/15 text-amber-300 border-katha-warning/20',
  approved: 'bg-katha-success/15 text-emerald-300 border-katha-success/20',
  rejected: 'bg-katha-error/15 text-red-300 border-katha-error/20',
};

export const STORY_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Chờ duyệt',
  generating_images: 'Đang tạo ảnh',
  approved: 'Đã duyệt',
  published: 'Đã xuất bản',
};

export const POLL_INTERVAL_MS = 3_000;
export const REVIEW_MUTATION_TIMEOUT_MS = 20_000;

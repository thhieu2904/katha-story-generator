export const TARGET_AGE_OPTIONS = [
  { value: 'preschool', label: 'Mầm non (3–5 tuổi)' },
  { value: 'early_primary', label: 'Tiểu học đầu (6–8 tuổi)' },
  { value: 'late_primary', label: 'Tiểu học cuối (9–12 tuổi)' },
] as const;

export const LENGTH_PREF_OPTIONS = [
  { value: 'short', label: 'Ngắn (4–6 trang)' },
  { value: 'medium', label: 'Vừa (8–10 trang)' },
  { value: 'long', label: 'Dài (12–14 trang)' },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Nháp',
  text_draft: 'Bản thảo',
  text_confirmed: 'Đã duyệt text',
  generating_images: 'Đang tạo ảnh',
  pending_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  published: 'Đã xuất bản',
  archived: 'Lưu trữ',
};

export const TARGET_AGE_LABELS: Record<string, string> = {
  preschool: 'Mầm non',
  early_primary: 'Tiểu học đầu',
  late_primary: 'Tiểu học cuối',
};

export const LENGTH_LABELS: Record<string, string> = {
  short: 'Ngắn',
  medium: 'Vừa',
  long: 'Dài',
};

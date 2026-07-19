import type { QuickAction } from './types';

export const QUICK_ACTIONS: { value: QuickAction; label: string }[] = [
  { value: 'shorten', label: 'Rút gọn nội dung' },
  { value: 'lengthen', label: 'Viết chi tiết hơn' },
  { value: 'more_dramatic', label: 'Kịch tính hơn' },
  { value: 'simplify', label: 'Đơn giản hơn' },
];

export const BAND_LIMITS: Record<string, [number, number]> = {
  short: [4, 6],
  medium: [8, 10],
  long: [12, 14],
};
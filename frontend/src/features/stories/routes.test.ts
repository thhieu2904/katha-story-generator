import { describe, expect, it } from 'vitest';
import {
  getStoryWorkflowHref,
  getStoryWorkflowLabel,
  isImageWorkflowStatus,
} from './routes';

describe('story workflow routes', () => {
  it.each([
    ['draft', '/admin/stories/42/setup', 'Tiếp tục thiết lập'],
    ['generating_text', '/admin/stories/42/edit', 'Xem tiến độ nội dung'],
    ['text_draft', '/admin/stories/42/edit', 'Tiếp tục biên tập'],
    ['text_confirmed', '/admin/stories/42/images', 'Chuẩn bị minh họa'],
    ['generating_images', '/admin/stories/42/images', 'Xem tiến độ ảnh'],
    ['pending_review', '/admin/stories/42/images', 'Sẵn sàng duyệt'],
    ['approved', '/admin/stories/42/images', 'Đã duyệt'],
    ['published', '/admin/stories/42/images', 'Quản lý chia sẻ'],
    ['archived', '/admin/stories', 'Xem truyện'],
  ])('routes %s to its canonical workspace', (status, href, label) => {
    expect(getStoryWorkflowHref(42, status)).toBe(href);
    expect(getStoryWorkflowLabel(status)).toBe(label);
  });

  it('only admits the supported downstream statuses to the image workspace', () => {
    expect(isImageWorkflowStatus('text_confirmed')).toBe(true);
    expect(isImageWorkflowStatus('generating_images')).toBe(true);
    expect(isImageWorkflowStatus('pending_review')).toBe(true);
    expect(isImageWorkflowStatus('approved')).toBe(true);
    expect(isImageWorkflowStatus('published')).toBe(true);
    expect(isImageWorkflowStatus('draft')).toBe(false);
    expect(isImageWorkflowStatus('text_draft')).toBe(false);
    expect(isImageWorkflowStatus('archived')).toBe(false);
  });
});
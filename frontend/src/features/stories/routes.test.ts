import { describe, expect, it } from 'vitest';
import type { StoryRouteKey } from './types';
import {
  getStoryWorkflowHref,
  getStoryWorkflowLabel,
  isImageWorkflowStatus,
} from './routes';

const TEST_KEY = 's1_UkLWZg9D' as StoryRouteKey;

describe('story workflow routes', () => {
  it.each([
    ['draft', `/admin/stories/${TEST_KEY}/setup`, 'Tiếp tục thiết lập'],
    ['generating_text', `/admin/stories/${TEST_KEY}/edit`, 'Xem tiến độ nội dung'],
    ['text_draft', `/admin/stories/${TEST_KEY}/edit`, 'Tiếp tục biên tập'],
    ['text_confirmed', `/admin/stories/${TEST_KEY}/images`, 'Chuẩn bị minh họa'],
    ['generating_images', `/admin/stories/${TEST_KEY}/images`, 'Xem tiến độ ảnh'],
    ['pending_review', `/admin/stories/${TEST_KEY}/images`, 'Sẵn sàng duyệt'],
    ['approved', `/admin/stories/${TEST_KEY}/images`, 'Đã duyệt'],
    ['published', `/admin/stories/${TEST_KEY}/images`, 'Quản lý chia sẻ'],
    ['archived', '/admin/stories', 'Xem truyện'],
  ])('routes %s to its canonical workspace', (status, href, label) => {
    expect(getStoryWorkflowHref(TEST_KEY, status)).toBe(href);
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
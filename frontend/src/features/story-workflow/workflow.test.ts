import { describe, expect, it } from 'vitest';
import type { StoryRouteKey } from '@/features/stories/types';
import {
  getWorkflowPresentation,
  getWorkflowRouteMode,
  isImageWorkflowStatus,
} from './workflow';

const TEST_KEY = 's1_UkLWZg9D' as StoryRouteKey;

describe('workflow presentation logic', () => {
  it.each([
    ['draft', 1, 'setup', `/admin/stories/${TEST_KEY}/setup`, 'Tiếp tục thiết lập'],
    ['generating_text', 2, 'text', `/admin/stories/${TEST_KEY}/edit`, 'Xem tiến độ nội dung'],
    ['text_draft', 2, 'text', `/admin/stories/${TEST_KEY}/edit`, 'Tiếp tục biên tập'],
    ['text_confirmed', 3, 'images', `/admin/stories/${TEST_KEY}/images`, 'Chuẩn bị minh họa'],
    ['generating_images', 3, 'images', `/admin/stories/${TEST_KEY}/images`, 'Xem tiến độ ảnh'],
    ['pending_review', 4, 'review', `/admin/stories/${TEST_KEY}/images`, 'Sẵn sàng duyệt'],
    ['approved', 4, 'review', `/admin/stories/${TEST_KEY}/images`, 'Đã duyệt'],
    ['published', 4, 'review', `/admin/stories/${TEST_KEY}/images`, 'Quản lý chia sẻ'],
  ])(
    'status=%s → step=%i, key=%s, href=%s, label=%s',
    (status, expectedStep, expectedKey, expectedHref, expectedLabel) => {
      const presentation = getWorkflowPresentation(TEST_KEY, status);
      expect(presentation.currentStep).toBe(expectedStep);
      expect(presentation.currentKey).toBe(expectedKey);
      expect(presentation.canonicalHref).toBe(expectedHref);
      expect(presentation.resumeLabel).toBe(expectedLabel);
    }
  );

  it('archived → showStepper false, no workflow CTA', () => {
    const presentation = getWorkflowPresentation(TEST_KEY, 'archived');
    expect(presentation.showStepper).toBe(false);
    expect(presentation.canonicalHref).toBe('/admin/stories');
  });

  it('unknown status → fail-safe redirect /admin/stories', () => {
    const presentation = getWorkflowPresentation(TEST_KEY, 'unknown_status');
    expect(presentation.showStepper).toBe(false);
    expect(presentation.canonicalHref).toBe('/admin/stories');
    expect(presentation.resumeLabel).toBe('Xem truyện');
  });

  it('published → all 4 steps completed', () => {
    const presentation = getWorkflowPresentation(TEST_KEY, 'published');
    expect(presentation.stepStates.setup).toBe('completed');
    expect(presentation.stepStates.text).toBe('completed');
    expect(presentation.stepStates.images).toBe('completed');
    expect(presentation.stepStates.review).toBe('completed');
  });

  describe('getWorkflowRouteMode', () => {
    it('step 3 requesting /setup → historical_readonly', () => {
      const presentation = getWorkflowPresentation(TEST_KEY, 'generating_images');
      expect(getWorkflowRouteMode(presentation, `/admin/stories/${TEST_KEY}/setup`)).toBe(
        'historical_readonly'
      );
    });

    it('step 3 requesting /edit → historical_readonly', () => {
      const presentation = getWorkflowPresentation(TEST_KEY, 'generating_images');
      expect(getWorkflowRouteMode(presentation, `/admin/stories/${TEST_KEY}/edit`)).toBe(
        'historical_readonly'
      );
    });

    it('step 2 requesting /images → redirect', () => {
      const presentation = getWorkflowPresentation(TEST_KEY, 'text_draft');
      expect(getWorkflowRouteMode(presentation, `/admin/stories/${TEST_KEY}/images`)).toBe(
        'redirect'
      );
    });

    it('step 2 requesting /edit → current', () => {
      const presentation = getWorkflowPresentation(TEST_KEY, 'text_draft');
      expect(getWorkflowRouteMode(presentation, `/admin/stories/${TEST_KEY}/edit`)).toBe(
        'current'
      );
    });
  });

  it('isImageWorkflowStatus helper check', () => {
    expect(isImageWorkflowStatus('text_confirmed')).toBe(true);
    expect(isImageWorkflowStatus('generating_images')).toBe(true);
    expect(isImageWorkflowStatus('pending_review')).toBe(true);
    expect(isImageWorkflowStatus('approved')).toBe(true);
    expect(isImageWorkflowStatus('published')).toBe(true);
    expect(isImageWorkflowStatus('draft')).toBe(false);
    expect(isImageWorkflowStatus('text_draft')).toBe(false);
  });
});

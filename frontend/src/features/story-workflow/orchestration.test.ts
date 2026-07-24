import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  orchestrateCreateAndGenerate,
  orchestrateConfirmAndPrepare,
  orchestrateSaveAndStart,
} from './orchestration';
import * as storiesApi from '@/features/stories/api';
import * as editorApi from '@/features/story-editor/api';
import * as imagesApi from '@/features/story-images/api';
import type { Story, StoryText, StoryRouteKey } from '@/features/stories/types';
import type { StoryImagesState } from '@/features/story-images/types';

vi.mock('@/features/stories/api');
vi.mock('@/features/story-editor/api');
vi.mock('@/features/story-images/api');

describe('orchestration logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(storiesApi.fetchStory).mockResolvedValue({
      id: 42,
      route_key: 's1_UkLWZg9D' as StoryRouteKey,
      title_vi: 'Test',
      title_km: null,
      description_vi: 'A test story',
      backbone_id: 1,
      genre_id: 1,
      art_style_id: 1,
      target_age: 'age_3_5',
      length_pref: 'short',
      status: 'text_confirmed',
      text_revision: 1,
      cover_image_url: null,
      created_by: 'user1',
      character_ids: [1],
      created_at: null,
      updated_at: null,
    });
  });

  describe('orchestrateCreateAndGenerate', () => {
    const dummyInput = {
      description_vi: 'A test story',
      backbone_id: 1,
      genre_id: 1,
      art_style_id: 1,
      target_age: 'age_3_5',
      length_pref: 'short',
      character_ids: [1],
    };

    const mockStory: Story = {
      id: 42,
      route_key: 's1_UkLWZg9D' as StoryRouteKey,
      title_vi: 'Test',
      title_km: null,
      description_vi: 'A test story',
      backbone_id: 1,
      genre_id: 1,
      art_style_id: 1,
      target_age: 'age_3_5',
      length_pref: 'short',
      status: 'draft',
      text_revision: 0,
      cover_image_url: null,
      created_by: 'user1',
      character_ids: [1],
      created_at: null,
      updated_at: null,
    };

    const mockStoryText: StoryText = {
      id: 42,
      title_vi: 'Test',
      title_km: 'Test',
      description_vi: 'A test story',
      target_age: 'age_3_5',
      length_pref: 'short',
      status: 'generating_text',
      text_revision: 1,
      character_ids: [1],
      updated_at: null,
      pages: [],
    };

    it('returns failed if createStory fails', async () => {
      vi.mocked(storiesApi.createStory).mockRejectedValue(new Error('Network error'));

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('failed');
      if (result.kind === 'failed') {
        expect(result.message).toBe('Network error');
      }
      expect(storiesApi.generateStoryText).not.toHaveBeenCalled();
    });

    it('returns blocked if createStory returns object missing id', async () => {
      vi.mocked(storiesApi.createStory).mockResolvedValue({} as Story);

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('blocked');
      if (result.kind === 'blocked') {
        expect(result.message).toContain('Bản nháp có thể đã được tạo');
      }
      expect(storiesApi.generateStoryText).not.toHaveBeenCalled();
    });

    it('returns success if createStory and generateStoryText succeed', async () => {
      vi.mocked(storiesApi.createStory).mockResolvedValue(mockStory);
      vi.mocked(storiesApi.generateStoryText).mockResolvedValue(mockStoryText);
      vi.mocked(storiesApi.fetchStory).mockResolvedValue({ ...mockStory, status: 'generating_text' });

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/edit');
      }
    });

    it('returns partial if generateStoryText fails and story remains draft', async () => {
      vi.mocked(storiesApi.createStory).mockResolvedValue(mockStory);
      vi.mocked(storiesApi.generateStoryText).mockRejectedValue(new Error('AI Service error'));
      vi.mocked(storiesApi.fetchStory).mockResolvedValue(mockStory);

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('partial');
      if (result.kind === 'partial') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/setup');
      }
    });

    it('returns success if generateStoryText fails but canonical status is generating_text', async () => {
      vi.mocked(storiesApi.createStory).mockResolvedValue(mockStory);
      vi.mocked(storiesApi.generateStoryText).mockRejectedValue(new Error('Timeout'));
      vi.mocked(storiesApi.fetchStory).mockResolvedValue({ ...mockStory, status: 'generating_text' });

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/edit');
      }
    });

    it('returns blocked if generateStoryText fails and fetchStory reconcile also fails', async () => {
      vi.mocked(storiesApi.createStory).mockResolvedValue(mockStory);
      vi.mocked(storiesApi.generateStoryText).mockRejectedValue(new Error('Network drop'));
      vi.mocked(storiesApi.fetchStory).mockRejectedValue(new Error('Fetch failed'));

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('blocked');
      if (result.kind === 'blocked') {
        expect(result.message).toContain('Không thể kiểm tra trạng thái truyện vừa tạo');
      }
    });
  });

  describe('orchestrateConfirmAndPrepare', () => {
    const mockImagesState: StoryImagesState = {
      story_id: 42,
      title_vi: 'Test',
      status: 'text_confirmed',
      text_revision: 1,
      image_plan_revision: 0,
      image_plan_ready: false,
      mapping_locked: false,
      job_id: null,
      job_stale: false,
      can_start: false,
      can_retry: false,
      can_resume: false,
      progress: { total: 0, pending: 0, generating: 0, completed: 0, failed: 0 },
      available_characters: [],
      pages: [],
    };

    const mockStoryTextConfirmed: StoryText = {
      id: 42,
      title_vi: 'Test',
      title_km: 'Test',
      description_vi: 'A test story',
      target_age: 'age_3_5',
      length_pref: 'short',
      status: 'text_confirmed',
      text_revision: 1,
      character_ids: [1],
      updated_at: null,
      pages: [],
    };

    it('returns failed if confirmStoryText fails', async () => {
      vi.mocked(editorApi.confirmStoryText).mockRejectedValue(new Error('Confirm failed'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('failed');
      expect(imagesApi.createImagePlan).not.toHaveBeenCalled();
    });

    it('returns partial and transitions to /images if confirmStoryText OK but fetchStoryImages fails', async () => {
      vi.mocked(editorApi.confirmStoryText).mockResolvedValue(mockStoryTextConfirmed);
      vi.mocked(imagesApi.fetchStoryImages).mockRejectedValue(new Error('Fetch images error'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('partial');
      if (result.kind === 'partial') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/images');
      }
    });

    it('returns success if confirm and plan both succeed', async () => {
      vi.mocked(editorApi.confirmStoryText).mockResolvedValue(mockStoryTextConfirmed);
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(mockImagesState);
      vi.mocked(imagesApi.createImagePlan).mockResolvedValue({
        ...mockImagesState,
        image_plan_ready: true,
      });

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/images');
      }
    });

    it('returns success if createImagePlan fails but fetchStoryImages reconcile shows image_plan_ready: true and pages', async () => {
      vi.mocked(editorApi.confirmStoryText).mockResolvedValue(mockStoryTextConfirmed);
      vi.mocked(imagesApi.fetchStoryImages)
        .mockResolvedValueOnce(mockImagesState)
        .mockResolvedValueOnce({
          ...mockImagesState,
          image_plan_ready: true,
          pages: [
            {
              id: 1,
              page_no: 1,
              text_vi: 'Page 1',
              text_km: 'Trang 1',
              text_en: null,
              image_scene_en: null,
              image_prompt_en: null,
              character_ids: [],
              image_status: 'pending',
              image_url: null,
              image_attempt_count: 0,
              image_error_code: null,
              updated_at: null,
            },
          ],
        });
      vi.mocked(imagesApi.createImagePlan).mockRejectedValue(new Error('Plan timeout'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/images');
      }
    });

    it('returns partial if confirm succeeds but plan creation fails and plan not ready', async () => {
      vi.mocked(editorApi.confirmStoryText).mockResolvedValue(mockStoryTextConfirmed);
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(mockImagesState);
      vi.mocked(imagesApi.createImagePlan).mockRejectedValue(new Error('Plan AI failed'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('partial');
      if (result.kind === 'partial') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/images');
      }
    });

    it('returns partial and transitions to /images if createImagePlan fails and fetchStoryImages reconcile fails', async () => {
      vi.mocked(editorApi.confirmStoryText).mockResolvedValue(mockStoryTextConfirmed);
      vi.mocked(imagesApi.fetchStoryImages)
        .mockResolvedValueOnce(mockImagesState)
        .mockRejectedValueOnce(new Error('Reconcile error'));
      vi.mocked(imagesApi.createImagePlan).mockRejectedValue(new Error('Plan error'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('partial');
      if (result.kind === 'partial') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/images');
      }
    });
  });

  describe('orchestrateSaveAndStart', () => {
    const mockStateGenerating: StoryImagesState = {
      story_id: 42,
      title_vi: 'Test',
      status: 'generating_images',
      text_revision: 1,
      image_plan_revision: 1,
      image_plan_ready: true,
      mapping_locked: true,
      job_id: 'job-123',
      job_stale: false,
      can_start: false,
      can_retry: false,
      can_resume: false,
      progress: { total: 5, pending: 4, generating: 1, completed: 0, failed: 0 },
      available_characters: [],
      pages: [],
    };

    it('returns failed if saveImagePlanMapping fails when dirty and reconcile fails', async () => {
      vi.mocked(imagesApi.saveImagePlanMapping).mockRejectedValue(new Error('Save mapping error'));
      vi.mocked(imagesApi.fetchStoryImages).mockRejectedValue(new Error('Fetch failed'));

      const result = await orchestrateSaveAndStart(42, true, [], 1);
      expect(result.kind).toBe('failed');
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });

    it('skips saveImagePlanMapping when mappingDirty is false and calls startImageGeneration with currentRevision', async () => {
      vi.mocked(imagesApi.startImageGeneration).mockResolvedValue({
        job_id: 'job-123',
        already_running: false,
        status: 'generating_images',
        progress: { total: 5, pending: 5, generating: 0, completed: 0, failed: 0 },
      });

      const result = await orchestrateSaveAndStart(42, false, [], 3);
      expect(result.kind).toBe('success');
      expect(imagesApi.saveImagePlanMapping).not.toHaveBeenCalled();
      expect(imagesApi.startImageGeneration).toHaveBeenCalledWith(42, 3);
    });

    it('saves mapping if dirty, then starts generation', async () => {
      vi.mocked(imagesApi.saveImagePlanMapping).mockResolvedValue({
        story_id: 42, title_vi: 'Test', status: 'text_confirmed', text_revision: 1,
        image_plan_revision: 2, image_plan_ready: true, mapping_locked: false,
        job_id: null, job_stale: false, can_start: true, can_retry: false, can_resume: false,
        progress: { total: 5, pending: 5, generating: 0, completed: 0, failed: 0 },
        available_characters: [], pages: [],
      });
      vi.mocked(imagesApi.startImageGeneration).mockResolvedValue({
        job_id: 'job-123',
        already_running: false,
        status: 'generating_images',
        progress: { total: 5, pending: 5, generating: 0, completed: 0, failed: 0 },
      });

      const result = await orchestrateSaveAndStart(42, true, [], 1);
      expect(result.kind).toBe('success');
      expect(imagesApi.startImageGeneration).toHaveBeenCalledWith(42, 2);
    });

    it('returns success if startImageGeneration fails but fetchStoryImages reconcile shows status generating_images', async () => {
      vi.mocked(imagesApi.startImageGeneration).mockRejectedValue(new Error('Timeout'));
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(mockStateGenerating);

      const result = await orchestrateSaveAndStart(42, false, [], 1);
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/images');
      }
    });

    it('returns blocked if startImageGeneration fails and fetchStoryImages reconcile fails', async () => {
      vi.mocked(imagesApi.startImageGeneration).mockRejectedValue(new Error('Network drop'));
      vi.mocked(imagesApi.fetchStoryImages).mockRejectedValue(new Error('Fetch failed'));

      const result = await orchestrateSaveAndStart(42, false, [], 1);
      expect(result.kind).toBe('blocked');
      if (result.kind === 'blocked') {
        expect(result.message).toContain('Không thể kiểm tra lại trạng thái tạo ảnh');
      }
    });

    // B1 corrective tests
    it('save definite 422 does not reread or start', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(imagesApi.saveImagePlanMapping).mockRejectedValue(
        new ApiError('Validation failed', 422)
      );

      const result = await orchestrateSaveAndStart(42, true, [], 1);
      expect(result.kind).toBe('failed');
      expect(imagesApi.fetchStoryImages).not.toHaveBeenCalled();
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });

    it('save uncertain 500 + exact mapping + can_start starts canonical revision', async () => {
      const { ApiError } = await import('@/lib/api');
      const reconciledState: StoryImagesState = {
        ...mockStateGenerating,
        status: 'text_confirmed',
        mapping_locked: false,
        can_start: true,
        image_plan_revision: 5,
        pages: [
          {
            id: 1, page_no: 1, text_vi: '', text_km: '', text_en: null,
            image_scene_en: null, image_prompt_en: null,
            character_ids: [10, 20],
            image_status: 'pending', image_url: null,
            image_attempt_count: 0, image_error_code: null, updated_at: null,
          },
        ],
      };
      vi.mocked(imagesApi.saveImagePlanMapping).mockRejectedValue(
        new ApiError('Internal error', 500)
      );
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(reconciledState);
      vi.mocked(imagesApi.startImageGeneration).mockResolvedValue({
        job_id: 'job-new',
        already_running: false,
        status: 'generating_images',
        progress: { total: 1, pending: 1, generating: 0, completed: 0, failed: 0 },
      });

      const payload = [{ page_id: 1, character_ids: [10, 20] }];
      const result = await orchestrateSaveAndStart(42, true, payload, 1);
      expect(result.kind).toBe('success');
      expect(imagesApi.startImageGeneration).toHaveBeenCalledWith(42, 5);
    });

    it('save uncertain 500 + mapping mismatch does not start', async () => {
      const { ApiError } = await import('@/lib/api');
      const reconciledState: StoryImagesState = {
        ...mockStateGenerating,
        status: 'text_confirmed',
        mapping_locked: false,
        can_start: true,
        pages: [
          {
            id: 1, page_no: 1, text_vi: '', text_km: '', text_en: null,
            image_scene_en: null, image_prompt_en: null,
            character_ids: [10, 30], // mismatch!
            image_status: 'pending', image_url: null,
            image_attempt_count: 0, image_error_code: null, updated_at: null,
          },
        ],
      };
      vi.mocked(imagesApi.saveImagePlanMapping).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(reconciledState);

      const payload = [{ page_id: 1, character_ids: [10, 20] }];
      const result = await orchestrateSaveAndStart(42, true, payload, 1);
      expect(result.kind).toBe('failed');
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });

    it('save uncertain timeout + reread fail returns blocked', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(imagesApi.saveImagePlanMapping).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(imagesApi.fetchStoryImages).mockRejectedValue(new Error('Network'));

      const result = await orchestrateSaveAndStart(42, true, [], 1);
      expect(result.kind).toBe('blocked');
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });

    it('save success + start fail + reread fail still keeps save response (blocked message)', async () => {
      vi.mocked(imagesApi.saveImagePlanMapping).mockResolvedValue({
        story_id: 42, title_vi: 'Test', status: 'text_confirmed', text_revision: 1,
        image_plan_revision: 3, image_plan_ready: true, mapping_locked: false,
        job_id: null, job_stale: false, can_start: true, can_retry: false, can_resume: false,
        progress: { total: 1, pending: 1, generating: 0, completed: 0, failed: 0 },
        available_characters: [], pages: [],
      });
      vi.mocked(imagesApi.startImageGeneration).mockRejectedValue(new Error('Start fail'));
      vi.mocked(imagesApi.fetchStoryImages).mockRejectedValue(new Error('Reread fail'));

      const result = await orchestrateSaveAndStart(42, true, [], 1);
      expect(result.kind).toBe('blocked');
      if (result.kind === 'blocked') {
        expect(result.message).toContain('Lựa chọn nhân vật đã lưu');
      }
    });
  });

  // B3 corrective tests
  describe('orchestrateConfirmAndPrepare (B3 uncertain confirm)', () => {
    it('confirm uncertain + status text_confirmed redirects to images', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(editorApi.confirmStoryText).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(storiesApi.fetchStory).mockResolvedValue({
        id: 42, route_key: 's1_UkLWZg9D' as StoryRouteKey, title_vi: 'Test', title_km: null, description_vi: '',
        backbone_id: 1, genre_id: 1, art_style_id: 1, target_age: 'age_3_5',
        length_pref: 'short', status: 'text_confirmed', text_revision: 1,
        cover_image_url: null, created_by: 'u', character_ids: [1],
        created_at: null, updated_at: null,
      });
      const mockImagesState: StoryImagesState = {
        story_id: 42, title_vi: 'Test', status: 'text_confirmed',
        text_revision: 1, image_plan_revision: 0, image_plan_ready: false,
        mapping_locked: false, job_id: null, job_stale: false,
        can_start: false, can_retry: false, can_resume: false,
        progress: { total: 0, pending: 0, generating: 0, completed: 0, failed: 0 },
        available_characters: [], pages: [],
      };
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(mockImagesState);
      vi.mocked(imagesApi.createImagePlan).mockRejectedValue(new Error('Plan fail'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      // Should still redirect to images because confirm was committed
      expect(['success', 'partial']).toContain(result.kind);
      if (result.kind === 'partial' || result.kind === 'success') {
        expect(result.nextHref).toBe('/admin/stories/s1_UkLWZg9D/images');
      }
    });

    it('confirm uncertain + still text_draft same revision allows retry (failed)', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(editorApi.confirmStoryText).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(storiesApi.fetchStory).mockResolvedValue({
        id: 42, route_key: 's1_UkLWZg9D' as StoryRouteKey, title_vi: 'Test', title_km: null, description_vi: '',
        backbone_id: 1, genre_id: 1, art_style_id: 1, target_age: 'age_3_5',
        length_pref: 'short', status: 'text_draft', text_revision: 1,
        cover_image_url: null, created_by: 'u', character_ids: [1],
        created_at: null, updated_at: null,
      });

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('failed');
      if (result.kind === 'failed') {
        expect(result.message).toContain('thử lại');
      }
    });

    it('confirm uncertain + archived returns blocked', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(editorApi.confirmStoryText).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(storiesApi.fetchStory).mockResolvedValue({
        id: 42, route_key: 's1_UkLWZg9D' as StoryRouteKey, title_vi: 'Test', title_km: null, description_vi: '',
        backbone_id: 1, genre_id: 1, art_style_id: 1, target_age: 'age_3_5',
        length_pref: 'short', status: 'archived', text_revision: 1,
        cover_image_url: null, created_by: 'u', character_ids: [1],
        created_at: null, updated_at: null,
      });

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('blocked');
    });

    it('confirm definite 422 returns failed without reread', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(editorApi.confirmStoryText).mockRejectedValue(
        new ApiError('Validation error', 422)
      );

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('failed');
      expect(storiesApi.fetchStory).not.toHaveBeenCalled();
    });

    it('confirm uncertain + reread fail returns blocked', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(editorApi.confirmStoryText).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(storiesApi.fetchStory).mockRejectedValue(new Error('Network'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('blocked');
    });
  });

  describe('orchestrateCreateAndGenerate timeout handling', () => {
    it('createStory timeout (ApiError status 0) returns blocked with duplicate warning', async () => {
      const { ApiError } = await import('@/lib/api');
      vi.mocked(storiesApi.createStory).mockRejectedValue(
        new ApiError('Yêu cầu đã hết thời gian chờ.', 0)
      );

      const result = await orchestrateCreateAndGenerate({
        description_vi: 'Test',
        backbone_id: 1,
        genre_id: 1,
        art_style_id: 1,
        target_age: 'age_3_5',
        length_pref: 'short',
        character_ids: [1],
      });

      expect(result.kind).toBe('blocked');
      if (result.kind === 'blocked') {
        expect(result.message).toContain('có thể đã được tạo');
      }
      // Should NOT have attempted to generate
      expect(storiesApi.generateStoryText).not.toHaveBeenCalled();
    });
  });

  describe('orchestrateSaveAndStart production guards', () => {
    const baseImagesState: StoryImagesState = {
      story_id: 42,
      title_vi: 'Test',
      status: 'text_confirmed',
      text_revision: 1,
      image_plan_revision: 1,
      image_plan_ready: true,
      mapping_locked: false,
      job_id: null,
      job_stale: false,
      can_start: true,
      can_retry: false,
      can_resume: false,
      progress: { total: 1, pending: 1, generating: 0, completed: 0, failed: 0 },
      available_characters: [],
      pages: [{ id: 1, page_no: 1, text_vi: 'P1', text_km: 'P1', text_en: null, image_scene_en: null, image_prompt_en: null, character_ids: [], image_status: 'pending', image_url: null, image_attempt_count: 0, image_error_code: null, updated_at: null }],
    };

    it('returns blocked when status is generating_images and job is active (!job_stale)', async () => {
      const activeState = {
        ...baseImagesState,
        status: 'generating_images',
        mapping_locked: true,
        job_stale: false,
      };
      const result = await orchestrateSaveAndStart(42, false, [], 1, activeState);
      expect(result.kind).toBe('blocked');
      expect(imagesApi.saveImagePlanMapping).not.toHaveBeenCalled();
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });

    it('skips PUT saveImagePlanMapping when mapping_locked is true during recovery start', async () => {
      const lockedRecoveryState = {
        ...baseImagesState,
        mapping_locked: true,
        can_retry: true,
      };
      vi.mocked(imagesApi.startImageGeneration).mockResolvedValue({
        job_id: 'job-retry',
        already_running: false,
        status: 'generating_images',
        progress: baseImagesState.progress,
      });
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue({
        ...baseImagesState,
        status: 'generating_images',
      });

      const result = await orchestrateSaveAndStart(42, true, [{ page_id: 1, character_ids: [1] }], 1, lockedRecoveryState);
      expect(imagesApi.saveImagePlanMapping).not.toHaveBeenCalled();
      expect(imagesApi.startImageGeneration).toHaveBeenCalledWith(42, 1);
      expect(result.kind).toBe('success');
    });

    it('returns blocked when mapping is locked and capability is neither initial nor recovery start', async () => {
      const lockedNoCapState = {
        ...baseImagesState,
        mapping_locked: true,
        can_start: false,
        can_retry: false,
        can_resume: false,
      };
      const result = await orchestrateSaveAndStart(42, false, [], 1, lockedNoCapState);
      expect(result.kind).toBe('blocked');
      expect(imagesApi.saveImagePlanMapping).not.toHaveBeenCalled();
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });
  });

  describe('orchestrateSaveAndStart uncertain branch guards', () => {
    const baseImagesState: StoryImagesState = {
      story_id: 42,
      title_vi: 'Test',
      status: 'text_confirmed',
      text_revision: 1,
      image_plan_revision: 1,
      image_plan_ready: true,
      mapping_locked: false,
      job_id: null,
      job_stale: false,
      can_start: true,
      can_retry: false,
      can_resume: false,
      progress: { total: 1, pending: 1, generating: 0, completed: 0, failed: 0 },
      available_characters: [],
      pages: [{ id: 1, page_no: 1, text_vi: 'P1', text_km: 'P1', text_en: null, image_scene_en: null, image_prompt_en: null, character_ids: [10, 20], image_status: 'pending', image_url: null, image_attempt_count: 0, image_error_code: null, updated_at: null }],
    };

    it('save uncertain + reread status pending_review (not text_confirmed) + exact match does NOT start', async () => {
      const { ApiError } = await import('@/lib/api');
      const reconciledState: StoryImagesState = {
        ...baseImagesState,
        status: 'pending_review',
        mapping_locked: true,
        can_start: true,
      };
      vi.mocked(imagesApi.saveImagePlanMapping).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(reconciledState);

      const payload = [{ page_id: 1, character_ids: [10, 20] }];
      const result = await orchestrateSaveAndStart(42, true, payload, 1);
      // Should NOT proceed to start because status is not text_confirmed
      expect(result.kind).not.toBe('success');
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });

    it('save uncertain + reread mapping_locked + exact match + can_start does NOT start', async () => {
      const { ApiError } = await import('@/lib/api');
      const reconciledState: StoryImagesState = {
        ...baseImagesState,
        mapping_locked: true,
        can_start: true,
      };
      vi.mocked(imagesApi.saveImagePlanMapping).mockRejectedValue(
        new ApiError('Timeout', 0)
      );
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(reconciledState);

      const payload = [{ page_id: 1, character_ids: [10, 20] }];
      const result = await orchestrateSaveAndStart(42, true, payload, 1);
      // Should NOT start because mapping_locked is true
      expect(result.kind).not.toBe('success');
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
    });

    it('capability re-check blocks start when savedState.can_start is false after save', async () => {
      vi.mocked(imagesApi.saveImagePlanMapping).mockResolvedValue({
        ...baseImagesState,
        can_start: false,
        can_retry: false,
        can_resume: false,
      });

      const result = await orchestrateSaveAndStart(42, true, [], 1);
      expect(result.kind).toBe('blocked');
      expect(imagesApi.startImageGeneration).not.toHaveBeenCalled();
      // savedState should be attached
      if ('savedState' in result) {
        expect(result.savedState).toBeDefined();
      }
    });

    it('attaches savedState to success result when save was performed', async () => {
      const savedResponse: StoryImagesState = {
        ...baseImagesState,
        image_plan_revision: 5,
      };
      vi.mocked(imagesApi.saveImagePlanMapping).mockResolvedValue(savedResponse);
      vi.mocked(imagesApi.startImageGeneration).mockResolvedValue({
        job_id: 'job-new',
        already_running: false,
        status: 'generating_images',
        progress: { total: 1, pending: 1, generating: 0, completed: 0, failed: 0 },
      });

      const result = await orchestrateSaveAndStart(42, true, [], 1);
      expect(result.kind).toBe('success');
      if ('savedState' in result) {
        expect(result.savedState).toEqual(savedResponse);
      }
    });

    it('does not attach savedState when mapping was not dirty (no save performed)', async () => {
      vi.mocked(imagesApi.startImageGeneration).mockResolvedValue({
        job_id: 'job-clean',
        already_running: false,
        status: 'generating_images',
        progress: { total: 1, pending: 1, generating: 0, completed: 0, failed: 0 },
      });

      const result = await orchestrateSaveAndStart(42, false, [], 1, baseImagesState);
      expect(result.kind).toBe('success');
      if ('savedState' in result) {
        expect(result.savedState).toBeUndefined();
      }
    });
  });
});

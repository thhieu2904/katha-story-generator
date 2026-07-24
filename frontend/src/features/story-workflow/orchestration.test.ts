import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  orchestrateCreateAndGenerate,
  orchestrateConfirmAndPrepare,
  orchestrateSaveAndStart,
} from './orchestration';
import * as storiesApi from '@/features/stories/api';
import * as editorApi from '@/features/story-editor/api';
import * as imagesApi from '@/features/story-images/api';
import type { Story, StoryText } from '@/features/stories/types';
import type { StoryImagesState } from '@/features/story-images/types';

vi.mock('@/features/stories/api');
vi.mock('@/features/story-editor/api');
vi.mock('@/features/story-images/api');

describe('orchestration logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
        expect(result.nextHref).toBe('/admin/stories/42/edit');
      }
    });

    it('returns partial if generateStoryText fails and story remains draft', async () => {
      vi.mocked(storiesApi.createStory).mockResolvedValue(mockStory);
      vi.mocked(storiesApi.generateStoryText).mockRejectedValue(new Error('AI Service error'));
      vi.mocked(storiesApi.fetchStory).mockResolvedValue(mockStory);

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('partial');
      if (result.kind === 'partial') {
        expect(result.nextHref).toBe('/admin/stories/42/setup');
      }
    });

    it('returns success if generateStoryText fails but canonical status is generating_text', async () => {
      vi.mocked(storiesApi.createStory).mockResolvedValue(mockStory);
      vi.mocked(storiesApi.generateStoryText).mockRejectedValue(new Error('Timeout'));
      vi.mocked(storiesApi.fetchStory).mockResolvedValue({ ...mockStory, status: 'generating_text' });

      const result = await orchestrateCreateAndGenerate(dummyInput);
      expect(result.kind).toBe('success');
      if (result.kind === 'success') {
        expect(result.nextHref).toBe('/admin/stories/42/edit');
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
        expect(result.nextHref).toBe('/admin/stories/42/images');
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
        expect(result.nextHref).toBe('/admin/stories/42/images');
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
        expect(result.nextHref).toBe('/admin/stories/42/images');
      }
    });

    it('returns partial if confirm succeeds but plan creation fails and plan not ready', async () => {
      vi.mocked(editorApi.confirmStoryText).mockResolvedValue(mockStoryTextConfirmed);
      vi.mocked(imagesApi.fetchStoryImages).mockResolvedValue(mockImagesState);
      vi.mocked(imagesApi.createImagePlan).mockRejectedValue(new Error('Plan AI failed'));

      const result = await orchestrateConfirmAndPrepare(42, 1, false);
      expect(result.kind).toBe('partial');
      if (result.kind === 'partial') {
        expect(result.nextHref).toBe('/admin/stories/42/images');
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
        expect(result.nextHref).toBe('/admin/stories/42/images');
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
        image_plan_revision: 2,
      } as StoryImagesState);
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
        expect(result.nextHref).toBe('/admin/stories/42/images');
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
  });
});

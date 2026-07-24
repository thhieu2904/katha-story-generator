import type { Story, StoryCreate } from '@/features/stories/types';
import { createStory, fetchStory, generateStoryText } from '@/features/stories/api';
import { confirmStoryText } from '@/features/story-editor/api';
import {
  createImagePlan,
  fetchStoryImages,
  saveImagePlanMapping,
  startImageGeneration,
} from '@/features/story-images/api';
import type {
  StartImageGenerationResponse,
  StoryImageMappingInput,
  StoryImagesState,
} from '@/features/story-images/types';
import { ApiError } from '@/lib/api';
import type { WorkflowTransitionResult } from './types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Đã xảy ra lỗi không xác định.';
}

export async function orchestrateCreateAndGenerate(
  formData: StoryCreate
): Promise<WorkflowTransitionResult<Story>> {
  let story: Story;

  try {
    story = await createStory(formData);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 0 || error.status === 409)) {
      return {
        kind: 'blocked',
        message:
          'Bản nháp có thể đã được tạo do sự cố kết nối. Vui lòng kiểm tra danh sách truyện trước khi tạo lại.',
      };
    }
    return {
      kind: 'failed',
      message: getErrorMessage(error),
    };
  }

  if (!story || !story.id) {
    return {
      kind: 'blocked',
      message:
        'Bản nháp có thể đã được tạo. Vui lòng kiểm tra danh sách truyện.',
    };
  }

  try {
    await generateStoryText(story.id);
    const updatedStory = await fetchStory(story.id).catch(() => story);
    return {
      kind: 'success',
      canonical: updatedStory,
      nextHref: `/admin/stories/${story.id}/edit`,
    };
  } catch {
    try {
      const canonicalStory = await fetchStory(story.id);
      if (
        canonicalStory.status === 'generating_text' ||
        canonicalStory.status === 'text_draft'
      ) {
        return {
          kind: 'success',
          canonical: canonicalStory,
          nextHref: `/admin/stories/${story.id}/edit`,
        };
      }
      return {
        kind: 'partial',
        canonical: canonicalStory,
        message:
          'Bản nháp đã được lưu thành công; quá trình sinh nội dung chưa khởi chạy.',
        nextHref: `/admin/stories/${story.id}/setup`,
      };
    } catch {
      return {
        kind: 'blocked',
        message:
          'Không thể kiểm tra trạng thái truyện vừa tạo. Vui lòng kiểm tra lại danh sách.',
      };
    }
  }
}

export async function orchestrateConfirmAndPrepare(
  storyId: number,
  textRevision: number,
  acknowledge: boolean
): Promise<WorkflowTransitionResult<StoryImagesState>> {
  try {
    await confirmStoryText(storyId, textRevision, acknowledge);
  } catch (confirmErr) {
    return {
      kind: 'failed',
      message: getErrorMessage(confirmErr),
    };
  }

  let imagesState: StoryImagesState;
  try {
    imagesState = await fetchStoryImages(storyId);
  } catch {
    return {
      kind: 'partial',
      canonical: {
        story_id: storyId,
        title_vi: null,
        status: 'text_confirmed',
        text_revision: textRevision,
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
      },
      message:
        'Nội dung đã được xác nhận thành công; đang tải lại không gian minh họa.',
      nextHref: `/admin/stories/${storyId}/images`,
    };
  }

  try {
    const planState = await createImagePlan(
      storyId,
      imagesState.text_revision,
      imagesState.image_plan_revision
    );
    return {
      kind: 'success',
      canonical: planState,
      nextHref: `/admin/stories/${storyId}/images`,
    };
  } catch {
    try {
      const reconciledState = await fetchStoryImages(storyId);
      if (
        reconciledState.pages &&
        reconciledState.pages.length > 0 &&
        reconciledState.image_plan_ready
      ) {
        return {
          kind: 'success',
          canonical: reconciledState,
          nextHref: `/admin/stories/${storyId}/images`,
        };
      }
      return {
        kind: 'partial',
        canonical: reconciledState,
        message:
          'Nội dung đã được xác nhận; kế hoạch minh họa chưa tạo được.',
        nextHref: `/admin/stories/${storyId}/images`,
      };
    } catch {
      return {
        kind: 'partial',
        canonical: imagesState,
        message:
          'Nội dung đã được xác nhận; không thể kiểm tra lại trạng thái kế hoạch minh họa.',
        nextHref: `/admin/stories/${storyId}/images`,
      };
    }
  }
}

export async function orchestrateSaveAndStart(
  storyId: number,
  mappingDirty: boolean,
  mappingPayload: StoryImageMappingInput[],
  currentRevision: number
): Promise<WorkflowTransitionResult<StartImageGenerationResponse>> {
  let targetRevision = currentRevision;

  if (mappingDirty) {
    try {
      const saveRes = await saveImagePlanMapping(
        storyId,
        currentRevision,
        mappingPayload
      );
      targetRevision = saveRes.image_plan_revision;
    } catch (saveErr) {
      try {
        const reconciled = await fetchStoryImages(storyId);
        targetRevision = reconciled.image_plan_revision;
      } catch {
        return {
          kind: 'failed',
          message: getErrorMessage(saveErr),
        };
      }
    }
  }

  try {
    const startRes = await startImageGeneration(storyId, targetRevision);
    return {
      kind: 'success',
      canonical: startRes,
      nextHref: `/admin/stories/${storyId}/images`,
    };
  } catch {
    try {
      const reconciledState = await fetchStoryImages(storyId);
      if (reconciledState.status === 'generating_images') {
        const dummyStartRes: StartImageGenerationResponse = {
          job_id: reconciledState.job_id || 'reconciled',
          already_running: true,
          status: 'generating_images',
          progress: reconciledState.progress,
        };
        return {
          kind: 'success',
          canonical: dummyStartRes,
          nextHref: `/admin/stories/${storyId}/images`,
        };
      }
      const dummyStartRes: StartImageGenerationResponse = {
        job_id: reconciledState.job_id || 'unstarted',
        already_running: false,
        status: reconciledState.status,
        progress: reconciledState.progress,
      };
      return {
        kind: 'partial',
        canonical: dummyStartRes,
        message:
          'Lựa chọn nhân vật đã lưu, quá trình tạo ảnh chưa bắt đầu.',
        nextHref: `/admin/stories/${storyId}/images`,
      };
    } catch {
      return {
        kind: 'blocked',
        message: 'Không thể kiểm tra lại trạng thái tạo ảnh.',
      };
    }
  }
}

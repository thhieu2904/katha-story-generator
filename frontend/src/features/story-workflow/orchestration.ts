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
import type { WorkflowTransitionResult } from './types';
import { isDefiniteError, isUncertainError } from './mutation-helpers';
import { exactMappingMatch } from './mapping-comparator';

export type SaveAndStartResult =
  WorkflowTransitionResult<StartImageGenerationResponse> & {
    savedState?: StoryImagesState;
  };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Đã xảy ra lỗi không xác định.';
}

// ---------------------------------------------------------------------------
// B2 — Create story (duplicate prevention)
// ---------------------------------------------------------------------------

export async function orchestrateCreateAndGenerate(
  formData: StoryCreate
): Promise<WorkflowTransitionResult<Story>> {
  let story: Story;

  try {
    story = await createStory(formData);
  } catch (error) {
    // Uncertain: mutation may have committed — block to prevent duplicate.
    if (isUncertainError(error)) {
      return {
        kind: 'blocked',
        message:
          'Bản nháp có thể đã được tạo do sự cố kết nối. Vui lòng kiểm tra danh sách truyện trước khi tạo lại.',
      };
    }
    // Definite: mutation was not committed — safe to show error & allow retry.
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

  // Create succeeded — story identity is owned. Never POST create again.
  try {
    await generateStoryText(story.id);
    const updatedStory = await fetchStory(story.id).catch(() => story);
    return {
      kind: 'success',
      canonical: updatedStory,
      nextHref: `/admin/stories/${story.id}/edit`,
    };
  } catch {
    // Generate failed — but story exists. Retry should only retry generate.
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

// ---------------------------------------------------------------------------
// B3 — Confirm text (ACK safety)
// ---------------------------------------------------------------------------

/** Status values that prove text has been confirmed. */
const CONFIRMED_STATUSES = new Set([
  'text_confirmed',
  'generating_images',
  'pending_review',
  'approved',
  'published',
]);

export async function orchestrateConfirmAndPrepare(
  storyId: number,
  textRevision: number,
  acknowledge: boolean
): Promise<WorkflowTransitionResult<StoryImagesState>> {
  try {
    await confirmStoryText(storyId, textRevision, acknowledge);
  } catch (confirmErr) {
    // B3: Uncertain confirm — canonical reread before deciding.
    if (isUncertainError(confirmErr)) {
      return reconcileAfterUncertainConfirm(storyId, textRevision, confirmErr);
    }
    // Definite (e.g. 422) — safe to show error, allow retry.
    return {
      kind: 'failed',
      message: getErrorMessage(confirmErr),
    };
  }

  // Confirm succeeded — proceed to image plan.
  return prepareImagePlanAfterConfirm(storyId, textRevision);
}

async function reconcileAfterUncertainConfirm(
  storyId: number,
  textRevision: number,
  originalErr: unknown,
): Promise<WorkflowTransitionResult<StoryImagesState>> {
  let canonicalStory: Story;
  try {
    canonicalStory = await fetchStory(storyId);
  } catch {
    return {
      kind: 'blocked',
      message: 'Chưa thể đối soát trạng thái xác nhận nội dung. Hãy kiểm tra lại.',
    };
  }

  // Already confirmed or downstream — treat confirm as committed.
  if (CONFIRMED_STATUSES.has(canonicalStory.status)) {
    return prepareImagePlanAfterConfirm(storyId, textRevision);
  }

  // Still text_draft — confirm was NOT committed.
  if (canonicalStory.status === 'text_draft') {
    if (canonicalStory.text_revision === textRevision) {
      // Same revision — safe to retry.
      return {
        kind: 'failed',
        message: `${getErrorMessage(originalErr)} Nội dung chưa được xác nhận, bạn có thể thử lại.`,
      };
    }
    // Different revision — someone else edited. Install canonical, don't retry old revision.
    return {
      kind: 'failed',
      message: 'Nội dung đã được cập nhật bởi người khác. Vui lòng kiểm tra lại trước khi xác nhận.',
    };
  }

  // Archived — lock mutations.
  if (canonicalStory.status === 'archived') {
    return {
      kind: 'blocked',
      message: 'Truyện đã được lưu trữ.',
    };
  }

  // Unknown status (generating_text, draft, etc.) — blocked for safety.
  return {
    kind: 'blocked',
    message: 'Trạng thái truyện không cho phép xác nhận nội dung lúc này.',
  };
}

async function prepareImagePlanAfterConfirm(
  storyId: number,
  textRevision: number,
): Promise<WorkflowTransitionResult<StoryImagesState>> {
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

// ---------------------------------------------------------------------------
// B1 — Save mapping & start generation (safety)
// ---------------------------------------------------------------------------

export async function orchestrateSaveAndStart(
  storyId: number,
  mappingDirty: boolean,
  mappingPayload: StoryImageMappingInput[],
  currentRevision: number,
  currentState?: StoryImagesState | null,
  onSaveCommit?: (saved: StoryImagesState) => void
): Promise<SaveAndStartResult> {
  let targetRevision = currentRevision;
  let savedState: StoryImagesState | null = currentState || null;

  if (currentState) {
    // Guard 1: Active generating_images && !job_stale -> DO NOT POST
    if (currentState.status === 'generating_images' && !currentState.job_stale) {
      return {
        kind: 'blocked',
        message: 'Quá trình sinh ảnh đang diễn ra. Vui lòng chờ cập nhật tiến độ.',
      };
    }

    // Guard 2: Capability check (Initial start vs Recovery start)
    const isInitialStart = !currentState.mapping_locked && currentState.can_start;
    const isRecoveryStart = currentState.can_retry || currentState.can_resume;

    if (!isInitialStart && !isRecoveryStart) {
      return {
        kind: 'blocked',
        message: 'Không thể bắt đầu sinh ảnh ở trạng thái hiện tại.',
      };
    }

    // Guard 3: Mapping locked -> DO NOT PUT local dirty mapping
    if (currentState.mapping_locked && mappingDirty) {
      mappingDirty = false;
    }
  }

  if (mappingDirty) {
    try {
      const saveRes = await saveImagePlanMapping(
        storyId,
        currentRevision,
        mappingPayload
      );
      // B1: Install save response immediately.
      targetRevision = saveRes.image_plan_revision;
      savedState = saveRes;
      // B1: Notify caller to install canonical state between save and start.
      if (onSaveCommit) onSaveCommit(saveRes);
    } catch (saveErr) {
      // B1: Definite error or non-API error — mutation NOT committed. Stop, keep local draft.
      if (isDefiniteError(saveErr) || !isUncertainError(saveErr)) {
        return {
          kind: 'failed',
          message: getErrorMessage(saveErr),
        };
      }

      // B1: Uncertain error — canonical reread to decide.
      try {
        const reconciled = await fetchStoryImages(storyId);

        // Is canonical already generating/downstream? Don't POST start again.
        if (reconciled.status === 'generating_images') {
          return {
            kind: 'success',
            canonical: {
              job_id: reconciled.job_id || 'reconciled',
              already_running: true,
              status: 'generating_images',
              progress: reconciled.progress,
            },
            nextHref: `/admin/stories/${storyId}/images`,
          };
        }

        // Check exact mapping match + capability before allowing start.
        if (
          reconciled.status === 'text_confirmed' &&
          !reconciled.mapping_locked &&
          exactMappingMatch(reconciled, mappingPayload) &&
          reconciled.can_start
        ) {
          targetRevision = reconciled.image_plan_revision;
          savedState = reconciled;
        } else if (reconciled.can_retry || reconciled.can_resume) {
          // Recovery action — route canonical, don't start fresh.
          return {
            kind: 'partial',
            canonical: {
              job_id: reconciled.job_id || 'unstarted',
              already_running: false,
              status: reconciled.status,
              progress: reconciled.progress,
            },
            message: 'Trạng thái đã thay đổi. Hãy kiểm tra lại trước khi tiếp tục.',
            nextHref: `/admin/stories/${storyId}/images`,
          };
        } else if (reconciled.mapping_locked) {
          // Mapping locked (downstream) — don't POST.
          return {
            kind: 'partial',
            canonical: {
              job_id: reconciled.job_id || 'locked',
              already_running: false,
              status: reconciled.status,
              progress: reconciled.progress,
            },
            message: 'Lựa chọn nhân vật đã bị khóa. Hãy kiểm tra lại trạng thái.',
            nextHref: `/admin/stories/${storyId}/images`,
          };
        } else {
          // Mapping mismatch — keep local draft, show conflict.
          return {
            kind: 'failed',
            message:
              'Lựa chọn nhân vật trên máy chủ khác với bản nháp. Vui lòng kiểm tra lại.',
          };
        }
      } catch {
        return {
          kind: 'blocked',
          message: 'Không thể đối soát trạng thái sau lỗi lưu. Hãy kiểm tra lại.',
        };
      }
    }
  }

  // Start generation.
  // B1: Capability re-check after save — verify savedState allows starting.
  if (savedState) {
    const canInitial = savedState.status === 'text_confirmed' && !savedState.mapping_locked && savedState.can_start;
    const canRecovery = savedState.can_retry || savedState.can_resume;
    if (!canInitial && !canRecovery) {
      return {
        kind: 'blocked',
        message: 'Trạng thái sau khi lưu không cho phép bắt đầu sinh ảnh. Hãy kiểm tra lại.',
        savedState: savedState !== currentState ? savedState ?? undefined : undefined,
      };
    }
  }

  try {
    const startRes = await startImageGeneration(storyId, targetRevision);
    return {
      kind: 'success',
      canonical: startRes,
      nextHref: `/admin/stories/${storyId}/images`,
      savedState: savedState !== currentState ? savedState ?? undefined : undefined,
    };
  } catch {
    try {
      const reconciledState = await fetchStoryImages(storyId);
      if (reconciledState.status === 'generating_images') {
        return {
          kind: 'success',
          canonical: {
            job_id: reconciledState.job_id || 'reconciled',
            already_running: true,
            status: 'generating_images',
            progress: reconciledState.progress,
          },
          nextHref: `/admin/stories/${storyId}/images`,
          savedState: savedState !== currentState ? savedState ?? undefined : undefined,
        };
      }
      // B1: Start failed but save succeeded — keep saved mapping/revision.
      return {
        kind: 'partial',
        canonical: {
          job_id: reconciledState.job_id || 'unstarted',
          already_running: false,
          status: reconciledState.status,
          progress: reconciledState.progress,
        },
        message:
          'Lựa chọn nhân vật đã lưu, quá trình tạo ảnh chưa bắt đầu.',
        nextHref: `/admin/stories/${storyId}/images`,
        savedState: savedState !== currentState ? savedState ?? undefined : undefined,
      };
    } catch {
      // B1: Start fail + reread fail — but if save succeeded, DON'T rollback.
      if (savedState) {
        return {
          kind: 'blocked',
          message:
            'Lựa chọn nhân vật đã lưu. Không thể kiểm tra trạng thái tạo ảnh. Hãy kiểm tra lại.',
          savedState: savedState !== currentState ? savedState ?? undefined : undefined,
        };
      }
      return {
        kind: 'blocked',
        message: 'Không thể kiểm tra lại trạng thái tạo ảnh.',
      };
    }
  }
}

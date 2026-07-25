import type { StoryRouteKey } from '@/features/stories/types';
import type { WorkflowPresentation, WorkflowRouteMode } from './types';

const IMAGE_WORKFLOW_STATUSES = new Set([
  'text_confirmed',
  'generating_images',
  'pending_review',
  'approved',
  'published',
]);

export function isImageWorkflowStatus(status: string): boolean {
  return IMAGE_WORKFLOW_STATUSES.has(status);
}

export function getCanonicalHref(
  storyKey: StoryRouteKey,
  status: string,
  imageWorkflowKind?: string | null
): string {
  if (status === 'draft') {
    return `/admin/stories/${storyKey}/setup`;
  }

  if (status === 'generating_text' || status === 'text_draft') {
    return `/admin/stories/${storyKey}/edit`;
  }

  // Phase 5: review regeneration routes to /review
  if (status === 'generating_images' && imageWorkflowKind === 'review_regeneration') {
    return `/admin/stories/${storyKey}/review`;
  }
  
  // Phase 5: review/publish statuses route to /review
  if (status === 'pending_review' || status === 'approved' || status === 'published') {
    return `/admin/stories/${storyKey}/review`;
  }
  
  // Initial image generation or text_confirmed
  if (status === 'text_confirmed' || status === 'generating_images') {
    return `/admin/stories/${storyKey}/images`;
  }

  return '/admin/stories';
}

export function getResumeLabel(status: string, imageWorkflowKind?: string | null): string {
  switch (status) {
    case 'draft':
      return 'Tiếp tục thiết lập';
    case 'generating_text':
      return 'Xem tiến độ nội dung';
    case 'text_draft':
      return 'Tiếp tục biên tập';
    case 'text_confirmed':
      return 'Chuẩn bị minh họa';
    case 'generating_images':
      return imageWorkflowKind === 'review_regeneration' ? 'Xem tiến độ vẽ lại' : 'Xem tiến độ ảnh';
    case 'pending_review':
      return 'Sẵn sàng duyệt';
    case 'approved':
      return 'Đã duyệt';
    case 'published':
      return 'Quản lý chia sẻ';
    default:
      return 'Xem truyện';
  }
}

export function getWorkflowPresentation(
  storyKey: StoryRouteKey,
  status: string,
  imageWorkflowKind?: string | null
): WorkflowPresentation {
  const canonicalHref = getCanonicalHref(storyKey, status, imageWorkflowKind);
  const resumeLabel = getResumeLabel(status, imageWorkflowKind);

  if (status === 'archived') {
    return {
      currentStep: 1,
      currentKey: 'setup',
      stepStates: {
        setup: 'locked',
        text: 'future',
        images: 'future',
        review: 'future',
      },
      canonicalHref: '/admin/stories',
      allowedReadOnlyHrefs: [],
      resumeLabel: 'Xem truyện',
      showStepper: false,
    };
  }

  const setupPath = `/admin/stories/${storyKey}/setup`;
  const editPath = `/admin/stories/${storyKey}/edit`;

  switch (status) {
    case 'draft':
      return {
        currentStep: 1,
        currentKey: 'setup',
        stepStates: {
          setup: 'current',
          text: 'future',
          images: 'future',
          review: 'future',
        },
        canonicalHref,
        allowedReadOnlyHrefs: [],
        resumeLabel,
        showStepper: true,
      };

    case 'generating_text':
    case 'text_draft':
      return {
        currentStep: 2,
        currentKey: 'text',
        stepStates: {
          setup: 'completed',
          text: 'current',
          images: 'future',
          review: 'future',
        },
        canonicalHref,
        allowedReadOnlyHrefs: [setupPath],
        resumeLabel,
        showStepper: true,
      };

    case 'text_confirmed':
      return {
        currentStep: 3,
        currentKey: 'images',
        stepStates: {
          setup: 'completed',
          text: 'completed',
          images: 'current',
          review: 'future',
        },
        canonicalHref,
        allowedReadOnlyHrefs: [setupPath, editPath],
        resumeLabel,
        showStepper: true,
      };

    case 'generating_images':
      if (imageWorkflowKind === 'review_regeneration') {
        return {
          currentStep: 4,
          currentKey: 'review',
          stepStates: {
            setup: 'completed',
            text: 'completed',
            images: 'completed',
            review: 'current',
          },
          canonicalHref,
          allowedReadOnlyHrefs: [setupPath, editPath],
          resumeLabel,
          showStepper: true,
        };
      }
      return {
        currentStep: 3,
        currentKey: 'images',
        stepStates: {
          setup: 'completed',
          text: 'completed',
          images: 'current',
          review: 'future',
        },
        canonicalHref,
        allowedReadOnlyHrefs: [setupPath, editPath],
        resumeLabel,
        showStepper: true,
      };

    case 'pending_review':
    case 'approved':
      return {
        currentStep: 4,
        currentKey: 'review',
        stepStates: {
          setup: 'completed',
          text: 'completed',
          images: 'completed',
          review: 'current',
        },
        canonicalHref,
        allowedReadOnlyHrefs: [setupPath, editPath],
        resumeLabel,
        showStepper: true,
      };

    case 'published':
      return {
        currentStep: 4,
        currentKey: 'review',
        stepStates: {
          setup: 'completed',
          text: 'completed',
          images: 'completed',
          review: 'completed',
        },
        canonicalHref,
        allowedReadOnlyHrefs: [setupPath, editPath],
        resumeLabel,
        showStepper: true,
      };

    default:
      return {
        currentStep: 1,
        currentKey: 'setup',
        stepStates: {
          setup: 'current',
          text: 'future',
          images: 'future',
          review: 'future',
        },
        canonicalHref: '/admin/stories',
        allowedReadOnlyHrefs: [],
        resumeLabel: 'Xem truyện',
        showStepper: false,
      };
  }
}

export function getWorkflowRouteMode(
  presentation: WorkflowPresentation,
  requestedPath: string
): WorkflowRouteMode {
  if (requestedPath === presentation.canonicalHref) {
    return 'current';
  }
  if (presentation.allowedReadOnlyHrefs.includes(requestedPath)) {
    return 'historical_readonly';
  }
  return 'redirect';
}

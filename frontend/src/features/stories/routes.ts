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

export function getStoryWorkflowHref(storyId: number, status: string): string {
  if (status === 'draft') {
    return `/admin/stories/${storyId}/setup`;
  }

  if (status === 'generating_text' || status === 'text_draft') {
    return `/admin/stories/${storyId}/edit`;
  }

  if (isImageWorkflowStatus(status)) {
    return `/admin/stories/${storyId}/images`;
  }

  return '/admin/stories';
}

export function getStoryWorkflowLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Tiếp tục thiết lập';
    case 'generating_text':
      return 'Xem trạng thái';
    case 'text_draft':
      return 'Tiếp tục biên tập';
    case 'text_confirmed':
      return 'Chuẩn bị minh họa';
    case 'generating_images':
      return 'Xem tiến độ ảnh';
    case 'pending_review':
      return 'Xem minh họa';
    case 'approved':
    case 'published':
      return 'Xem minh họa';
    default:
      return 'Xem truyện';
  }
}

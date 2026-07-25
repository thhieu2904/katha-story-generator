'use client';

import { StoryReviewWorkspace } from '@/features/story-review/components/StoryReviewWorkspace';
import type { StoryRouteKey } from '@/features/stories/types';

export function StoryReviewPageClient({ storyKey }: { storyKey: StoryRouteKey }) {
  return <StoryReviewWorkspace storyKey={storyKey} key={storyKey} />;
}

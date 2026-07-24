'use client';

import { StoryImageWorkspace } from '@/features/story-images/components/StoryImageWorkspace';
import type { StoryRouteKey } from '@/features/stories/types';

export function StoryImageWorkspacePageClient({ storyKey }: { storyKey: StoryRouteKey }) {
  return <StoryImageWorkspace storyKey={storyKey} key={storyKey} />;
}

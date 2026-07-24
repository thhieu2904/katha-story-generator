'use client';

import { StoryTextEditor } from '@/features/story-editor/components/StoryTextEditor';
import type { StoryRouteKey } from '@/features/stories/types';

export function StoryTextEditorPageClient({ storyKey }: { storyKey: StoryRouteKey }) {
  return <StoryTextEditor storyKey={storyKey} key={storyKey} />;
}

import { notFound } from 'next/navigation';
import { StoryTextEditorPageClient } from './StoryTextEditorPageClient';
import type { StoryRouteKey } from '@/features/stories/types';

const STORY_ROUTE_KEY_REGEX = /^s1_[A-Za-z0-9]{8,32}$/;

export default async function StoryTextEditorPage({
  params,
}: {
  params: Promise<{ storyKey: string }>;
}) {
  const { storyKey } = await params;

  if (!storyKey || !STORY_ROUTE_KEY_REGEX.test(storyKey)) {
    notFound();
  }

  return <StoryTextEditorPageClient storyKey={storyKey as StoryRouteKey} />;
}
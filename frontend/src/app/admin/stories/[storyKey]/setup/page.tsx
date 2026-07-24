import { notFound } from 'next/navigation';
import { SetupPageClient } from './SetupPageClient';
import type { StoryRouteKey } from '@/features/stories/types';

const STORY_ROUTE_KEY_REGEX = /^s1_[A-Za-z0-9]{8,32}$/;

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ storyKey: string }>;
}) {
  const { storyKey } = await params;

  if (!storyKey || !STORY_ROUTE_KEY_REGEX.test(storyKey)) {
    notFound();
  }

  return <SetupPageClient storyKey={storyKey as StoryRouteKey} key={storyKey} />;
}

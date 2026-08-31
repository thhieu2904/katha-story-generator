import { notFound } from 'next/navigation';
import { PrivateStoryReaderPageClient } from './PrivateStoryReaderPageClient';
import type { StoryRouteKey } from '@/features/stories/types';

const STORY_ROUTE_KEY_REGEX = /^s1_[A-Za-z0-9]{8,32}$/;

export default async function PrivateStoryReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ storyKey: string }>;
  searchParams: Promise<{ learn?: string; source?: string; restart?: string }>;
}) {
  const { storyKey } = await params;
  const { learn, source, restart } = await searchParams;
  if (!storyKey || !STORY_ROUTE_KEY_REGEX.test(storyKey)) notFound();
  return (
    <PrivateStoryReaderPageClient
      storyKey={storyKey as StoryRouteKey}
      startLearning={learn === '1'}
      visionFlow={source === 'vision'}
      restartLearningSession={source === 'vision' && restart === '1'}
    />
  );
}

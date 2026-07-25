import { notFound } from 'next/navigation';
import { StoryReviewPageClient } from './StoryReviewPageClient';
import type { StoryRouteKey } from '@/features/stories/types';

const STORY_ROUTE_KEY_REGEX = /^s1_[A-Za-z0-9]{8,32}$/;

export default async function StoryReviewPage({
  params,
}: {
  params: Promise<{ storyKey: string }>;
}) {
  const { storyKey } = await params;
  if (!storyKey || !STORY_ROUTE_KEY_REGEX.test(storyKey)) {
    notFound();
  }
  return <StoryReviewPageClient storyKey={storyKey as StoryRouteKey} />;
}

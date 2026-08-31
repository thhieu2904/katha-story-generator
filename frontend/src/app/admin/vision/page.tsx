import { VisionLearningFlow } from '@/features/learning/components/VisionLearningFlow';
import type { StoryRouteKey } from '@/features/stories/types';

const STORY_ROUTE_KEY_REGEX = /^s1_[A-Za-z0-9]{8,32}$/;

export default async function VisionPage({
  searchParams,
}: {
  searchParams: Promise<{ story?: string | string[] }>;
}) {
  const { story } = await searchParams;
  const initialStoryKey =
    typeof story === 'string' && STORY_ROUTE_KEY_REGEX.test(story)
      ? (story as StoryRouteKey)
      : null;

  return <VisionLearningFlow initialStoryKey={initialStoryKey} />;
}

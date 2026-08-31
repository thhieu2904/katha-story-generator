import { clearAllSpeakingLearningProgress } from '@/features/speaking/progress';
import { clearAllVisionLearningProgress } from './visionLearningProgress';
import { clearVisionStoryDraft } from './visionStoryDraft';

export function resetLearningJourneyProgress() {
  clearAllVisionLearningProgress();
  clearAllSpeakingLearningProgress();
  clearVisionStoryDraft();
}

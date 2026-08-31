import { beforeEach, describe, expect, it } from 'vitest';
import { resetLearningJourneyProgress } from './resetLearningJourney';

describe('resetLearningJourneyProgress', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('clears learning state without touching unrelated browser state', () => {
    window.sessionStorage.setItem('katha-vision-learning-progress-v1:user-1', '{}');
    window.sessionStorage.setItem('katha-speaking-learning-progress-v1:story-1', '{}');
    window.sessionStorage.setItem('katha-vision-story-draft-v1', '{}');
    window.sessionStorage.setItem('unrelated-state', 'keep');

    resetLearningJourneyProgress();

    expect(window.sessionStorage.getItem('katha-vision-learning-progress-v1:user-1')).toBeNull();
    expect(window.sessionStorage.getItem('katha-speaking-learning-progress-v1:story-1')).toBeNull();
    expect(window.sessionStorage.getItem('katha-vision-story-draft-v1')).toBeNull();
    expect(window.sessionStorage.getItem('unrelated-state')).toBe('keep');
  });
});

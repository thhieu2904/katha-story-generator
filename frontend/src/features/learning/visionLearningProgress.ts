import type { KhmerKnowledge, VisionResult } from '@/features/vision/api';

export interface KeywordLessonProgress {
  currentIndex: number;
  completed: boolean;
}

export interface VisionLearningProgress {
  result: VisionResult & { knowledge: KhmerKnowledge };
  keyword: KeywordLessonProgress;
}

interface StoredVisionLearningProgress extends VisionLearningProgress {
  version: 1;
}

const STORAGE_KEY_PREFIX = 'katha-vision-learning-progress-v1';

function storageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isKeyword(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.khmer === 'string' &&
    typeof value.vietnamese === 'string' &&
    (typeof value.transliteration === 'string' || value.transliteration === null)
  );
}

function isKnowledge(value: unknown): value is KhmerKnowledge {
  return (
    isRecord(value) &&
    typeof value.khmer === 'string' &&
    typeof value.vietnamese === 'string' &&
    typeof value.transliteration === 'string' &&
    typeof value.category === 'string' &&
    typeof value.cultural_explanation === 'string' &&
    typeof value.story_seed === 'string' &&
    typeof value.verified === 'boolean' &&
    Array.isArray(value.sources) &&
    Array.isArray(value.keywords) &&
    value.keywords.length >= 1 &&
    value.keywords.every(isKeyword)
  );
}

function isStoredProgress(value: unknown): value is StoredVisionLearningProgress {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.result)) return false;
  if (!isRecord(value.keyword)) return false;

  return (
    typeof value.result.class === 'string' &&
    typeof value.result.predicted_class === 'string' &&
    typeof value.result.confidence === 'number' &&
    Number.isFinite(value.result.confidence) &&
    isKnowledge(value.result.knowledge) &&
    Number.isInteger(value.keyword.currentIndex) &&
    typeof value.keyword.completed === 'boolean'
  );
}

export function loadVisionLearningProgress(userId: string): VisionLearningProgress | null {
  try {
    const rawProgress = window.sessionStorage.getItem(storageKey(userId));
    if (!rawProgress) return null;

    const parsed: unknown = JSON.parse(rawProgress);
    if (!isStoredProgress(parsed)) {
      window.sessionStorage.removeItem(storageKey(userId));
      return null;
    }

    return { result: parsed.result, keyword: parsed.keyword };
  } catch {
    return null;
  }
}

export function saveVisionLearningProgress(
  userId: string,
  progress: VisionLearningProgress,
) {
  try {
    const storedProgress: StoredVisionLearningProgress = { version: 1, ...progress };
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(storedProgress));
  } catch {
    // The lesson still works in memory when browser storage is unavailable.
  }
}

export function clearVisionLearningProgress(userId: string) {
  try {
    window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export function clearAllVisionLearningProgress() {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

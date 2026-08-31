import type { CompletedSpeakingAttempt } from './types';

export type SpeakingLearningStage = 'reader' | 'speaking' | 'results';

export interface SpeakingLearningProgress {
  stage: SpeakingLearningStage;
  attempts: CompletedSpeakingAttempt[];
  sessionId?: string;
  skippedSentenceIds?: string[];
}

interface StoredSpeakingLearningProgress extends SpeakingLearningProgress {
  version: 1;
}

const STORAGE_KEY_PREFIX = 'katha-speaking-learning-progress-v1';

function storageKey(sessionKey: string) {
  return `${STORAGE_KEY_PREFIX}:${sessionKey}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCompletedAttempt(value: unknown): value is CompletedSpeakingAttempt {
  if (!isRecord(value) || !isRecord(value.sentence) || !isRecord(value.result)) return false;
  return (
    typeof value.sentence.id === 'string' &&
    typeof value.sentence.khmer === 'string' &&
    typeof value.sentence.vietnamese === 'string' &&
    typeof value.sentence.transliteration === 'string' &&
    (typeof value.sentence.level === 'number' || typeof value.sentence.level === 'string') &&
    typeof value.result.transcript === 'string' &&
    (value.result.confidence === null || typeof value.result.confidence === 'number') &&
    typeof value.result.score === 'number' &&
    typeof value.result.character_accuracy === 'number' &&
    typeof value.result.required_term_coverage === 'number' &&
    typeof value.result.feedback_vi === 'string' &&
    Array.isArray(value.result.matched_segments) &&
    value.result.matched_segments.every((segment) => typeof segment === 'string') &&
    Array.isArray(value.result.missing_segments) &&
    value.result.missing_segments.every((segment) => typeof segment === 'string')
  );
}

export function loadSpeakingLearningProgress(
  sessionKey: string,
): SpeakingLearningProgress | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(sessionKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      (parsed.stage !== 'reader' && parsed.stage !== 'speaking' && parsed.stage !== 'results') ||
      !Array.isArray(parsed.attempts) ||
      !parsed.attempts.every(isCompletedAttempt) ||
      (typeof parsed.sessionId !== 'undefined' && typeof parsed.sessionId !== 'string') ||
      (typeof parsed.skippedSentenceIds !== 'undefined' &&
        (!Array.isArray(parsed.skippedSentenceIds) ||
          !parsed.skippedSentenceIds.every((id) => typeof id === 'string')))
    ) {
      window.sessionStorage.removeItem(storageKey(sessionKey));
      return null;
    }
    return {
      stage: parsed.stage,
      attempts: parsed.attempts,
      sessionId: parsed.sessionId,
      skippedSentenceIds: parsed.skippedSentenceIds,
    };
  } catch {
    return null;
  }
}

export function saveSpeakingLearningProgress(
  sessionKey: string,
  progress: SpeakingLearningProgress,
) {
  try {
    const stored: StoredSpeakingLearningProgress = { version: 1, ...progress };
    window.sessionStorage.setItem(storageKey(sessionKey), JSON.stringify(stored));
  } catch {
    // Keep the learning flow in memory when browser storage is unavailable.
  }
}

export function clearSpeakingLearningProgress(sessionKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey(sessionKey));
  } catch {
    // No cleanup is required when browser storage is unavailable.
  }
}

export function clearAllSpeakingLearningProgress() {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`${STORAGE_KEY_PREFIX}:`)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // No cleanup is required when browser storage is unavailable.
  }
}

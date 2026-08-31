import { ApiError, apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type {
  CompletedSpeakingAttempt,
  SpeakingAttemptResult,
  SpeakingSentence,
  SpeakingSessionProgress,
} from './types';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const SPEAKING_AUDIO_TIMEOUT_MS = 60_000;
const SPEAKING_ATTEMPT_TIMEOUT_MS = 60_000;

interface SpeakingSentencePayload {
  id: string;
  category?: string;
  category_label_vi?: string;
  difficulty?: string;
  level?: number | string;
  khmer: string;
  vietnamese: string;
  transliteration: string;
  required_terms?: string[];
  note_vi?: string | null;
}

type SpeakingSentencesResponse =
  | SpeakingSentencePayload[]
  | { sentences: SpeakingSentencePayload[] }
  | { items: SpeakingSentencePayload[] };

interface SpeakingSessionPayload extends Omit<SpeakingSessionProgress, 'id' | 'sentences'> {
  id: string;
  sentences?: SpeakingSentencePayload[];
}

interface SpeakingAttemptPayload {
  sentence?: SpeakingSentencePayload;
  transcript: string;
  confidence?: number | null;
  score?: number;
  character_accuracy?: number;
  required_term_coverage?: number;
  scores?: {
    overall: number;
    character_accuracy: number;
    required_term_coverage: number;
    recognition_confidence: number | null;
  };
  passed?: boolean;
  feedback_vi: string;
  matched_segments?: string[];
  missing_segments?: string[];
  segments?: Array<{
    expected_khmer: string;
    status: string;
  }>;
  terms?: Array<{
    term: string;
    status: string;
  }>;
  session?: SpeakingSessionPayload;
}

function normalizeSentence(sentence: SpeakingSentencePayload): SpeakingSentence {
  return {
    id: String(sentence.id),
    category: sentence.category,
    category_label_vi: sentence.category_label_vi,
    khmer: sentence.khmer,
    vietnamese: sentence.vietnamese,
    transliteration: sentence.transliteration,
    level: sentence.level ?? sentence.difficulty ?? 1,
    required_terms: sentence.required_terms,
    note_vi: sentence.note_vi,
  };
}

function normalizeSession(session: SpeakingSessionPayload): SpeakingSessionProgress {
  return {
    ...session,
    id: String(session.id),
    selected_sentence_ids: session.selected_sentence_ids.map(String),
    attempted_sentence_ids: session.attempted_sentence_ids.map(String),
    passed_sentence_ids: session.passed_sentence_ids.map(String),
    sentences: (session.sentences ?? []).map(normalizeSentence),
  };
}

function normalizeAttempt(payload: SpeakingAttemptPayload): SpeakingAttemptResult {
  const terms = payload.terms ?? [];
  const matchedFromTerms = terms
    .filter((term) => term.status === 'correct' || term.status === 'matched')
    .map((term) => term.term);
  const missingFromTerms = terms
    .filter((term) => term.status !== 'correct' && term.status !== 'matched')
    .map((term) => term.term);
  const matchedFromSegments = (payload.segments ?? [])
    .filter((segment) => segment.status === 'correct' || segment.status === 'matched')
    .map((segment) => segment.expected_khmer);
  const missingFromSegments = (payload.segments ?? [])
    .filter((segment) => segment.status !== 'correct' && segment.status !== 'matched')
    .map((segment) => segment.expected_khmer);

  return {
    transcript: payload.transcript,
    confidence: payload.scores?.recognition_confidence ?? payload.confidence ?? null,
    score: payload.scores?.overall ?? payload.score ?? 0,
    character_accuracy: payload.scores?.character_accuracy ?? payload.character_accuracy ?? 0,
    required_term_coverage:
      payload.scores?.required_term_coverage ?? payload.required_term_coverage ?? 0,
    feedback_vi: payload.feedback_vi,
    matched_segments:
      payload.matched_segments ?? (matchedFromTerms.length > 0 ? matchedFromTerms : matchedFromSegments),
    missing_segments:
      payload.missing_segments ?? (missingFromTerms.length > 0 ? missingFromTerms : missingFromSegments),
    passed: payload.passed,
    session_id: payload.session?.id,
  };
}

export async function fetchSpeakingSentences(
  options: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<SpeakingSentence[]> {
  const params = new URLSearchParams();
  if (typeof options.limit === 'number') {
    params.set('limit', String(Math.max(1, Math.floor(options.limit))));
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  const response = await apiFetch<SpeakingSentencesResponse>(
    `/api/speaking/sentences${query}`,
    { signal },
  );
  const items = Array.isArray(response)
    ? response
    : 'items' in response
      ? response.items
      : response.sentences;
  return items.map(normalizeSentence);
}

export async function createSpeakingSession(
  sentenceIds: string[] = [],
  options: { storyId?: number; restart?: boolean; limit?: number } = {},
  signal?: AbortSignal,
) {
  const response = await apiFetch<SpeakingSessionPayload>('/api/speaking/sessions', {
    method: 'POST',
    body: JSON.stringify({
      sentence_ids: sentenceIds,
      limit: options.limit ?? 5,
      ...(typeof options.storyId === 'number' ? { story_id: options.storyId } : {}),
      ...(options.restart ? { restart: true } : {}),
    }),
    signal,
  });
  return normalizeSession(response);
}

export async function fetchSpeakingSessionAttempts(
  sessionId: string,
  signal?: AbortSignal,
): Promise<CompletedSpeakingAttempt[]> {
  const response = await apiFetch<
    SpeakingAttemptPayload[] | { total?: number; items: SpeakingAttemptPayload[] }
  >(`/api/speaking/attempts?session_id=${encodeURIComponent(sessionId)}`, { signal });
  const items = Array.isArray(response) ? response : response.items;
  return items
    .filter((attempt): attempt is SpeakingAttemptPayload & { sentence: SpeakingSentencePayload } => Boolean(attempt.sentence))
    .map((attempt) => {
      const sentence = normalizeSentence(attempt.sentence);
      return { sentence, result: normalizeAttempt(attempt) };
    });
}

async function getAuthenticatedHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial);
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const accessToken = data.session?.access_token;
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  return headers;
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string') return body.detail;
  } catch {
    // The proxy may return a non-JSON error page.
  }
  return fallback;
}

export async function fetchSpeakingSentenceAudio(
  sentenceId: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const timeoutSignal = AbortSignal.timeout(SPEAKING_AUDIO_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const headers = await getAuthenticatedHeaders({ Accept: 'audio/wav,audio/*' });
  let response: Response;

  try {
    response = await fetch(
      `${API_BASE_URL}/api/speaking/sentences/${encodeURIComponent(sentenceId)}/audio`,
      { headers, signal: requestSignal },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError('Không thể tải câu đọc mẫu.', 0);
  }

  if (!response.ok) {
    throw new ApiError(
      await readApiError(response, 'Không thể tải câu đọc mẫu.'),
      response.status,
    );
  }

  const audio = await response.blob();
  if (audio.size === 0) throw new ApiError('Máy chủ trả về tệp âm thanh trống.', 0);
  return audio;
}

export function submitSpeakingAttempt(
  sentenceId: string,
  audio: Blob,
  durationMs: number,
  options: { storyId?: number; sessionId?: string } = {},
  signal?: AbortSignal,
): Promise<SpeakingAttemptResult> {
  const body = new FormData();
  const extension = audio.type.includes('ogg')
    ? 'ogg'
    : audio.type.includes('mp4')
      ? 'm4a'
      : 'webm';
  body.append('audio', audio, `speaking-attempt.${extension}`);
  body.append('duration_ms', String(Math.max(Math.round(durationMs), 1)));
  if (typeof options.storyId === 'number') body.append('story_id', String(options.storyId));
  if (options.sessionId) body.append('session_id', options.sessionId);

  return apiFetch<SpeakingAttemptPayload>(
    `/api/speaking/sentences/${encodeURIComponent(sentenceId)}/attempts`,
    {
      method: 'POST',
      body,
      signal,
      timeoutMs: SPEAKING_ATTEMPT_TIMEOUT_MS,
    },
  ).then((payload) => normalizeAttempt(payload));
}

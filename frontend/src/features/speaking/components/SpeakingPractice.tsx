'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { ReaderLanguage } from '@/features/reader/types';
import {
  createSpeakingSession,
  fetchSpeakingSentenceAudio,
  fetchSpeakingSessionAttempts,
  fetchSpeakingSentences,
  submitSpeakingAttempt,
} from '../api';
import { formatSpeakingCopy, getSpeakingCopy } from '../copy';
import type {
  CompletedSpeakingAttempt,
  SpeakingAttemptResult,
  SpeakingSentence,
} from '../types';
import { prepareRecordingWav, SilentRecordingError } from '../recordingAudio';
import { SpeakingStageHeader } from './SpeakingStageHeader';
import { LearningJourneyControls } from '@/features/learning/components/LearningJourneyControls';
import { KathaLoadingIndicator } from '@/components/feedback/KathaLoading';

const MAX_RECORDING_SECONDS = 10;
const MAX_RECORDING_MS = MAX_RECORDING_SECONDS * 1000;
const LESSON_SENTENCE_LIMIT = 5;

type RecordingState = 'idle' | 'requesting' | 'recording' | 'processing' | 'recorded' | 'submitting';
type PlaybackState = 'idle' | 'playing';
type SampleState = 'idle' | 'loading' | 'playing' | 'error';
type SessionState = 'loading' | 'ready' | 'error';

interface SpeakingPracticeProps {
  language: ReaderLanguage;
  onLanguageChange: (language: ReaderLanguage) => void;
  onBackToStory: () => void;
  onResetLearningJourney?: () => void;
  onComplete: (
    attempts: CompletedSpeakingAttempt[],
    sessionId?: string,
    skippedSentenceIds?: string[],
  ) => void;
  storyId?: number;
  initialAttempts?: CompletedSpeakingAttempt[];
  initialSessionId?: string;
  initialSkippedSentenceIds?: string[];
  restartSession?: boolean;
  onProgressChange?: (
    attempts: CompletedSpeakingAttempt[],
    sessionId?: string,
    skippedSentenceIds?: string[],
  ) => void;
}

function supportedRecordingMimeTypes() {
  if (typeof MediaRecorder === 'undefined') return [];
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
  ];
  if (typeof MediaRecorder.isTypeSupported !== 'function') return [];
  return candidates.filter((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function createRecorder(stream: MediaStream) {
  for (const mimeType of supportedRecordingMimeTypes()) {
    try {
      return new MediaRecorder(stream, { mimeType });
    } catch {
      // Some browsers report support but reject the constructor; try the next container.
    }
  }
  return new MediaRecorder(stream);
}

function percentage(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 100));
}

function scoreTone(score: number) {
  if (score >= 80) return 'border-katha-success/30 bg-katha-success/10 text-emerald-200';
  if (score >= 60) return 'border-katha-warning/30 bg-katha-warning/10 text-amber-200';
  return 'border-katha-error/30 bg-katha-error/10 text-red-200';
}

function microphoneError(copy: ReturnType<typeof getSpeakingCopy>, error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name) {
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return copy.microphoneDenied;
    }
    if (
      name === 'NotFoundError' ||
      name === 'DevicesNotFoundError' ||
      name === 'NotReadableError' ||
      name === 'TrackStartError' ||
      name === 'OverconstrainedError' ||
      name === 'AbortError'
    ) {
      return copy.microphoneUnavailable;
    }
  }
  return copy.microphoneFailed;
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message.trim()) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function indexAttempts(attempts: CompletedSpeakingAttempt[]) {
  const indexed: Record<string, CompletedSpeakingAttempt> = {};
  for (const attempt of attempts) {
    // The history endpoint is newest-first. Keep the newest result per sentence.
    if (!indexed[attempt.sentence.id]) indexed[attempt.sentence.id] = attempt;
  }
  return indexed;
}

export function SpeakingPractice({
  language,
  onLanguageChange,
  onBackToStory,
  onResetLearningJourney,
  onComplete,
  storyId,
  initialAttempts = [],
  initialSessionId,
  initialSkippedSentenceIds = [],
  restartSession = false,
  onProgressChange,
}: SpeakingPracticeProps) {
  const copy = getSpeakingCopy(language);
  const [loadVersion, setLoadVersion] = useState(0);
  const [sentences, setSentences] = useState<SpeakingSentence[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('loading');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedAttempts, setCompletedAttempts] = useState<Record<string, CompletedSpeakingAttempt>>(
    () => Object.fromEntries(initialAttempts.map((attempt) => [attempt.sentence.id, attempt])),
  );
  const [skippedSentenceIds, setSkippedSentenceIds] = useState<Set<string>>(
    () => new Set(initialSkippedSentenceIds),
  );
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [recordingPlayback, setRecordingPlayback] = useState<PlaybackState>('idle');
  const [attemptResult, setAttemptResult] = useState<SpeakingAttemptResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sampleState, setSampleState] = useState<SampleState>('idle');

  const mountedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordedUrlRef = useRef<string | null>(null);
  const recordedAudioRef = useRef<HTMLAudioElement>(null);
  const sampleAudioRef = useRef<HTMLAudioElement>(null);
  const sampleUrlRef = useRef<string | null>(null);
  const sampleAbortRef = useRef<AbortController | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);
  const submitInFlightRef = useRef(false);
  const recordingStartInFlightRef = useRef(false);
  const completionNotifiedRef = useRef(false);
  const initialAttemptsRef = useRef(initialAttempts);
  const initialSessionIdRef = useRef(initialSessionId);
  const initialSkippedSentenceIdsRef = useRef(initialSkippedSentenceIds);
  const initializationRef = useRef<{
    key: string;
    controller: AbortController;
    promise: Promise<{
      sentences: SpeakingSentence[];
      attempts: CompletedSpeakingAttempt[];
      sessionId: string;
    }>;
    abortTimer: number | null;
  } | null>(null);
  const onProgressChangeRef = useRef(onProgressChange);
  const onCompleteRef = useRef(onComplete);
  const sessionFailedCopyRef = useRef(copy.sessionFailed);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearRecordingTimers = useCallback(() => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const clearRecordedAudio = useCallback(() => {
    const audio = recordedAudioRef.current;
    audio?.pause();
    if (audio) {
      audio.removeAttribute('src');
      audio.load();
    }
    setRecordingPlayback('idle');
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    recordedUrlRef.current = null;
    setRecordedUrl(null);
    setRecordedBlob(null);
    setRecordedDurationMs(0);
  }, []);

  const clearSampleAudio = useCallback(() => {
    sampleAbortRef.current?.abort();
    sampleAbortRef.current = null;
    const audio = sampleAudioRef.current;
    audio?.pause();
    if (audio) {
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
    }
    if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    sampleUrlRef.current = null;
    setSampleState('idle');
  }, []);

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    sessionFailedCopyRef.current = copy.sessionFailed;
  }, [copy.sessionFailed]);

  useEffect(() => {
    const initializationKey = `${storyId ?? 'general'}:${restartSession ? 'restart' : 'resume'}:${loadVersion}`;
    let initialization = initializationRef.current;

    if (!initialization || initialization.key !== initializationKey) {
      const controller = new AbortController();
      const promise = (async () => {
        const session = await createSpeakingSession(
          [],
          { storyId, restart: restartSession, limit: LESSON_SENTENCE_LIMIT },
          controller.signal,
        );
        let lessonSentences = session.sentences;
        if (lessonSentences.length === 0 && session.selected_sentence_ids.length > 0) {
          const catalogSentences = await fetchSpeakingSentences({}, controller.signal);
          lessonSentences = session.selected_sentence_ids
            .map((sentenceId) => catalogSentences.find((item) => item.id === sentenceId))
            .filter((sentence): sentence is SpeakingSentence => Boolean(sentence));
        }

        let serverAttempts: CompletedSpeakingAttempt[] = [];
        try {
          serverAttempts = await fetchSpeakingSessionAttempts(session.id, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) throw error;
          // A local snapshot is still enough to resume if history is temporarily unavailable.
        }

        const merged = {
          ...indexAttempts(serverAttempts),
          ...indexAttempts(initialAttemptsRef.current),
        };
        return {
          sentences: lessonSentences,
          attempts: lessonSentences
            .map((sentence) => merged[sentence.id])
            .filter((attempt): attempt is CompletedSpeakingAttempt => Boolean(attempt)),
          sessionId: session.id,
        };
      })();
      initialization = {
        key: initializationKey,
        controller,
        promise,
        abortTimer: null,
      };
      initializationRef.current = initialization;
      setSentences(null);
      setLoadError(null);
      setSessionState('loading');
      completionNotifiedRef.current = false;
    }

    if (initialization.abortTimer !== null) {
      window.clearTimeout(initialization.abortTimer);
      initialization.abortTimer = null;
    }

    let subscribed = true;
    void initialization.promise
      .then((lesson) => {
        if (!subscribed || initialization?.controller.signal.aborted) return;
        const indexedAttempts = indexAttempts(lesson.attempts);
        setSentences(lesson.sentences);
        setSessionId(lesson.sessionId || initialSessionIdRef.current);
        setCompletedAttempts(indexedAttempts);
        const validSkippedIds = new Set(
          initialSkippedSentenceIdsRef.current.filter((id) =>
            lesson.sentences.some((sentence) => sentence.id === id),
          ),
        );
        const firstIncomplete = lesson.sentences.findIndex(
          (sentence) => !indexedAttempts[sentence.id] && !validSkippedIds.has(sentence.id),
        );
        setSkippedSentenceIds(validSkippedIds);
        setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : Math.max(lesson.sentences.length - 1, 0));
        setSessionState('ready');
        onProgressChangeRef.current?.(
          lesson.attempts,
          lesson.sessionId || initialSessionIdRef.current,
          [...validSkippedIds],
        );
      })
      .catch((error: unknown) => {
        if (!subscribed || initialization?.controller.signal.aborted) return;
        setLoadError(apiErrorMessage(error, sessionFailedCopyRef.current));
        setSentences([]);
        setSessionState('error');
      });

    return () => {
      subscribed = false;
      if (!initialization) return;
      initialization.abortTimer = window.setTimeout(() => {
        initialization?.controller.abort();
      }, 0);
    };
  }, [loadVersion, restartSession, storyId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRecordingTimers();
      submitAbortRef.current?.abort();
      submitInFlightRef.current = false;
      recordingStartInFlightRef.current = false;
      sampleAbortRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder?.state === 'recording') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      }
      stopStream();
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
      if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    };
  }, [clearRecordingTimers, stopStream]);

  const currentSentence = sentences?.[currentIndex] ?? null;
  const completedCount = Object.keys(completedAttempts).length + skippedSentenceIds.size;
  const stepProgress = sentences?.length ? completedCount / sentences.length : 0;

  useEffect(() => {
    if (
      sessionState !== 'ready' ||
      !sentences?.length ||
      attemptResult ||
      completionNotifiedRef.current
    ) return;
    const orderedAttempts = sentences
      .map((sentence) => completedAttempts[sentence.id])
      .filter((attempt): attempt is CompletedSpeakingAttempt => Boolean(attempt));
    if (orderedAttempts.length + skippedSentenceIds.size === sentences.length) {
      completionNotifiedRef.current = true;
      onCompleteRef.current(orderedAttempts, sessionId, [...skippedSentenceIds]);
    }
  }, [attemptResult, completedAttempts, sentences, sessionId, sessionState, skippedSentenceIds]);

  const resetCurrentAttempt = useCallback(() => {
    submitAbortRef.current?.abort();
    submitAbortRef.current = null;
    submitInFlightRef.current = false;
    clearRecordedAudio();
    setAttemptResult(null);
    setActionError(null);
    setRecordingSeconds(0);
    setRecordingState('idle');
  }, [clearRecordedAudio]);

  const retryCurrentAttempt = useCallback(() => {
    if (!currentSentence) return;
    if (!completedAttempts[currentSentence.id]) return;
    const next = { ...completedAttempts };
    delete next[currentSentence.id];
    const attempts = (sentences ?? [])
      .map((sentence) => next[sentence.id])
      .filter((attempt): attempt is CompletedSpeakingAttempt => Boolean(attempt));
    setCompletedAttempts(next);
    onProgressChangeRef.current?.(attempts, sessionId, [...skippedSentenceIds]);
    completionNotifiedRef.current = false;
    resetCurrentAttempt();
  }, [completedAttempts, currentSentence, resetCurrentAttempt, sentences, sessionId, skippedSentenceIds]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    clearRecordingTimers();
    recorder.stop();
  }, [clearRecordingTimers]);

  const startRecording = useCallback(async () => {
    if (recordingStartInFlightRef.current || sessionState !== 'ready') return;
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setActionError(copy.microphoneInsecure);
      return;
    }
    if (
      typeof MediaRecorder === 'undefined' ||
      typeof navigator.mediaDevices?.getUserMedia !== 'function'
    ) {
      setActionError(copy.microphoneUnsupported);
      return;
    }

    recordingStartInFlightRef.current = true;
    stopStream();
    clearRecordedAudio();
    setAttemptResult(null);
    setActionError(null);
    setRecordingSeconds(0);
    setRecordingState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const recorder = createRecorder(stream);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearRecordingTimers();
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state === 'recording') recorder.stop();
        recorderRef.current = null;
        recordingChunksRef.current = [];
        stopStream();
        if (!mountedRef.current) return;
        setActionError(copy.microphoneFailed);
        setRecordingState('idle');
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        stopStream();
        recorderRef.current = null;
        if (!mountedRef.current) return;

        const rawBlob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        recordingChunksRef.current = [];
        if (rawBlob.size === 0) {
          setActionError(copy.emptyRecording);
          setRecordingState('idle');
          return;
        }
        setRecordingState('processing');
        void prepareRecordingWav(rawBlob)
          .then(({ blob, durationMs }) => {
            if (!mountedRef.current) return;
            const url = URL.createObjectURL(blob);
            recordedUrlRef.current = url;
            setRecordedUrl(url);
            setRecordedBlob(blob);
            setRecordedDurationMs(durationMs);
            setRecordingSeconds(Math.min(Math.ceil(durationMs / 1000), MAX_RECORDING_SECONDS));
            setRecordingState('recorded');
          })
          .catch((error: unknown) => {
            if (!mountedRef.current) return;
            setActionError(
              error instanceof SilentRecordingError
                ? copy.silentRecording
                : copy.recordingProcessingFailed,
            );
            setRecordingSeconds(0);
            setRecordingState('idle');
          });
      };

      recorder.start(250);
      setRecordingState('recording');
      recordingIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - recordingStartedAtRef.current;
        setRecordingSeconds(Math.min(Math.floor(elapsed / 1000), MAX_RECORDING_SECONDS));
      }, 250);
      recordingTimeoutRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (error) {
      clearRecordingTimers();
      stopStream();
      if (!mountedRef.current) return;
      setActionError(microphoneError(copy, error));
      setRecordingState('idle');
    } finally {
      recordingStartInFlightRef.current = false;
    }
  }, [clearRecordedAudio, clearRecordingTimers, copy, sessionState, stopRecording, stopStream]);

  const toggleSample = useCallback(async () => {
    if (!currentSentence || sampleState === 'loading') return;
    const audio = sampleAudioRef.current;
    if (!audio) return;

    if (sampleState === 'playing') {
      audio.pause();
      audio.currentTime = 0;
      setSampleState('idle');
      return;
    }

    setActionError(null);
    if (sampleUrlRef.current) {
      setSampleState('loading');
      try {
        audio.currentTime = 0;
        await audio.play();
      } catch (error) {
        setSampleState('error');
        setActionError(apiErrorMessage(error, copy.sampleFailed));
      }
      return;
    }

    const controller = new AbortController();
    sampleAbortRef.current?.abort();
    sampleAbortRef.current = controller;
    setSampleState('loading');
    try {
      const blob = await fetchSpeakingSentenceAudio(currentSentence.id, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      sampleUrlRef.current = url;
      audio.src = url;
      audio.load();
      await audio.play();
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }
      setSampleState('error');
      setActionError(apiErrorMessage(error, copy.sampleFailed));
    }
  }, [copy.sampleFailed, currentSentence, sampleState]);

  const toggleRecordingPlayback = useCallback(() => {
    const audio = recordedAudioRef.current;
    if (!audio || !recordedUrl) return;
    if (recordingPlayback === 'playing') {
      audio.pause();
      audio.currentTime = 0;
      setRecordingPlayback('idle');
      return;
    }
    void audio.play().catch(() => setActionError(copy.microphoneFailed));
  }, [copy.microphoneFailed, recordedUrl, recordingPlayback]);

  const submitAttempt = useCallback(async () => {
    if (
      !currentSentence ||
      !recordedBlob ||
      !sessionId ||
      sessionState !== 'ready' ||
      submitInFlightRef.current
    ) return;
    submitInFlightRef.current = true;
    const controller = new AbortController();
    submitAbortRef.current = controller;
    setActionError(null);
    setRecordingState('submitting');
    try {
      const result = await submitSpeakingAttempt(
        currentSentence.id,
        recordedBlob,
        recordedDurationMs,
        { storyId, sessionId },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const attempt = { sentence: currentSentence, result };
      const nextSessionId = result.session_id ?? sessionId;
      if (result.session_id) setSessionId(result.session_id);
      setAttemptResult(result);
      const next = { ...completedAttempts, [currentSentence.id]: attempt };
      const attempts = (sentences ?? [])
        .map((sentence) => next[sentence.id])
        .filter((completed): completed is CompletedSpeakingAttempt => Boolean(completed));
      setCompletedAttempts(next);
      onProgressChangeRef.current?.(attempts, nextSessionId, [...skippedSentenceIds]);
      setRecordingState('recorded');
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }
      setActionError(apiErrorMessage(error, copy.submitFailed));
      setRecordingState('recorded');
    } finally {
      if (submitAbortRef.current === controller) submitAbortRef.current = null;
      submitInFlightRef.current = false;
    }
  }, [
    copy.submitFailed,
    completedAttempts,
    currentSentence,
    recordedBlob,
    recordedDurationMs,
    sentences,
    sessionId,
    sessionState,
    skippedSentenceIds,
    storyId,
  ]);

  const skipCurrentSentence = useCallback(() => {
    if (!currentSentence || !sentences || completionNotifiedRef.current) return;
    clearSampleAudio();
    resetCurrentAttempt();

    const nextSkipped = new Set(skippedSentenceIds).add(currentSentence.id);
    const attempts = sentences
      .map((sentence) => completedAttempts[sentence.id])
      .filter((attempt): attempt is CompletedSpeakingAttempt => Boolean(attempt));
    setSkippedSentenceIds(nextSkipped);
    onProgressChangeRef.current?.(attempts, sessionId, [...nextSkipped]);

    const nextIncomplete = sentences.findIndex(
      (sentence, index) =>
        index > currentIndex &&
        !completedAttempts[sentence.id] &&
        !nextSkipped.has(sentence.id),
    );
    if (nextIncomplete >= 0) {
      setCurrentIndex(nextIncomplete);
      return;
    }

    completionNotifiedRef.current = true;
    onCompleteRef.current(attempts, sessionId, [...nextSkipped]);
  }, [
    clearSampleAudio,
    completedAttempts,
    currentIndex,
    currentSentence,
    resetCurrentAttempt,
    sentences,
    sessionId,
    skippedSentenceIds,
  ]);

  const continueLesson = useCallback(() => {
    if (!currentSentence || !attemptResult || !sentences) return;
    const finalAttempts = {
      ...completedAttempts,
      [currentSentence.id]: { sentence: currentSentence, result: attemptResult },
    };
    const nextIncomplete = sentences.findIndex(
      (sentence, index) => index > currentIndex && !finalAttempts[sentence.id],
    );
    if (nextIncomplete >= 0) {
      clearSampleAudio();
      resetCurrentAttempt();
      setCurrentIndex(nextIncomplete);
      return;
    }

    completionNotifiedRef.current = true;
    onCompleteRef.current(
      sentences
        .map((sentence) => finalAttempts[sentence.id])
        .filter((attempt): attempt is CompletedSpeakingAttempt => Boolean(attempt)),
      sessionId,
      [...skippedSentenceIds],
    );
  }, [
    attemptResult,
    clearSampleAudio,
    completedAttempts,
    currentIndex,
    currentSentence,
    resetCurrentAttempt,
    sentences,
    sessionId,
    skippedSentenceIds,
  ]);

  if (sentences === null) {
    return (
      <div className="min-h-dvh bg-katha-surface text-katha-text">
        <SpeakingStageHeader
          currentStep={4}
          stepProgress={0}
          language={language}
          onLanguageChange={onLanguageChange}
        />
        <main className="grid min-h-[55vh] place-items-center px-4">
          <KathaLoadingIndicator label={copy.preparingSession} compact />
        </main>
        {onResetLearningJourney && (
          <div className="mx-auto w-full max-w-[900px] px-4 pb-8 sm:px-6">
            <LearningJourneyControls
              language={language}
              onReset={onResetLearningJourney}
              className="border-t border-katha-text/10 pt-5"
            />
          </div>
        )}
      </div>
    );
  }

  if (sessionState === 'error' || loadError || sentences.length === 0 || !currentSentence) {
    return (
      <div className="min-h-dvh bg-katha-surface text-katha-text">
        <SpeakingStageHeader
          currentStep={4}
          stepProgress={0}
          language={language}
          onLanguageChange={onLanguageChange}
        />
        <main className="mx-auto grid min-h-[55vh] max-w-xl place-items-center px-4 text-center">
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-katha-warning/10 text-2xl" aria-hidden="true">🎙️</div>
            <h1 className="mt-4 text-xl font-bold text-katha-text">
              {loadError ? copy.sessionFailed : copy.noSentences}
            </h1>
            {loadError && (
              <p className="mt-2 text-sm leading-6 text-katha-text/55">{loadError}</p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onBackToStory} className="cursor-pointer rounded-xl border border-katha-text/15 px-4 py-2.5 text-sm font-semibold text-katha-text/75 hover:bg-katha-text/5">
                {copy.backToStory}
              </button>
              {(loadError || sessionState === 'error') && (
                <button type="button" onClick={() => setLoadVersion((version) => version + 1)} className="cursor-pointer rounded-xl bg-katha-primary px-4 py-2.5 text-sm font-bold text-katha-text hover:bg-katha-primary/85">
                  {copy.retryLoad}
                </button>
              )}
            </div>
          </div>
        </main>
        {onResetLearningJourney && (
          <div className="mx-auto w-full max-w-[900px] px-4 pb-8 sm:px-6">
            <LearningJourneyControls
              language={language}
              onReset={onResetLearningJourney}
              className="border-t border-katha-text/10 pt-5"
            />
          </div>
        )}
      </div>
    );
  }

  const isBusy = recordingState === 'requesting' || recordingState === 'processing' || recordingState === 'submitting';
  const currentScore = attemptResult ? Math.round(attemptResult.score) : null;

  return (
    <div className="min-h-dvh bg-katha-surface text-katha-text">
      <SpeakingStageHeader
        currentStep={4}
        stepProgress={stepProgress}
        language={language}
        onLanguageChange={onLanguageChange}
      />
      <audio
        ref={sampleAudioRef}
        className="hidden"
        aria-label={copy.listenSample}
        onPlaying={() => setSampleState('playing')}
        onEnded={(event) => {
          event.currentTarget.currentTime = 0;
          setSampleState('idle');
        }}
        onPause={() => setSampleState((state) => state === 'playing' ? 'idle' : state)}
        onError={() => setSampleState('error')}
      />
      <audio
        ref={recordedAudioRef}
        className="hidden"
        src={recordedUrl ?? undefined}
        aria-label={copy.playRecording}
        onPlaying={() => setRecordingPlayback('playing')}
        onEnded={() => setRecordingPlayback('idle')}
        onPause={() => setRecordingPlayback('idle')}
      />

      <main className="mx-auto w-full max-w-[900px] px-4 py-7 sm:px-6 sm:py-10">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-katha-primary-light">
            {formatSpeakingCopy(copy.sentenceProgress, { current: currentIndex + 1, total: sentences.length })}
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{copy.practiceTitle}</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-katha-text/55">{copy.practiceSubtitle}</p>
        </div>

        <div className="mb-5 flex justify-center gap-2" aria-label={copy.practiceTitle}>
          {sentences.map((sentence, index) => (
            <span
              key={sentence.id}
              aria-label={formatSpeakingCopy(copy.sentenceProgress, { current: index + 1, total: sentences.length })}
              className={`h-2 rounded-full transition-[width,background-color] ${
                index === currentIndex
                  ? 'w-8 bg-katha-primary'
                  : completedAttempts[sentence.id]
                    ? 'w-2 bg-katha-success'
                    : skippedSentenceIds.has(sentence.id)
                      ? 'w-2 bg-katha-warning'
                    : 'w-2 bg-katha-text/15'
              }`}
            />
          ))}
        </div>

        <section className="katha-card overflow-hidden rounded-[2rem] border border-katha-text/10 bg-katha-text/[0.035] shadow-2xl backdrop-blur-xl">
          <div className="border-b border-katha-text/10 bg-gradient-to-br from-katha-primary/15 via-transparent to-katha-accent/10 px-5 py-7 text-center sm:px-10 sm:py-9">
            <span className="inline-flex rounded-full border border-katha-text/10 bg-katha-surface/40 px-3 py-1 text-xs font-semibold text-katha-text/55">
              {formatSpeakingCopy(copy.level, { level: currentSentence.level })}
            </span>
            <p lang="km" className="mx-auto mt-4 max-w-3xl font-khmer text-3xl font-semibold leading-[1.8] text-katha-text sm:text-4xl">
              {currentSentence.khmer}
            </p>
            <p className="mt-3 text-sm font-medium text-katha-accent sm:text-base">
              {currentSentence.transliteration}
            </p>
            <p lang="vi" className="mt-2 text-sm leading-6 text-katha-text/60 sm:text-base">
              {currentSentence.vietnamese}
            </p>

            <button
              type="button"
              onClick={() => void toggleSample()}
              disabled={sampleState === 'loading'}
              className="mx-auto mt-5 flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-katha-primary/35 bg-katha-primary/10 px-5 text-sm font-bold text-katha-primary-light transition hover:bg-katha-primary/20 disabled:cursor-wait disabled:opacity-60"
            >
              <span aria-hidden="true">{sampleState === 'playing' ? '■' : '🔊'}</span>
              {sampleState === 'loading'
                ? copy.loadingSample
                : sampleState === 'playing'
                  ? copy.stopSample
                  : copy.listenSample}
            </button>
          </div>

          <div className="px-5 py-6 sm:px-10 sm:py-8">
            {!attemptResult && (
              <div className="text-center">
                <p className="text-sm leading-6 text-katha-text/55">
                  {recordingState === 'recording'
                    ? copy.recording
                    : recordingState === 'processing'
                      ? copy.processingRecording
                    : recordingState === 'requesting'
                      ? copy.requestingPermission
                      : recordedBlob
                        ? copy.recordingReady
                        : formatSpeakingCopy(copy.readyHint, { seconds: MAX_RECORDING_SECONDS })}
                </p>

                {recordingState === 'recording' ? (
                  <div className="mt-5">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-katha-error/30 bg-katha-error/10">
                      <span className="h-10 w-10 animate-pulse rounded-full bg-katha-error" aria-hidden="true" />
                    </div>
                    <p className="mt-3 font-mono text-lg font-bold tabular-nums text-red-200" aria-live="polite">
                      {formatSpeakingCopy(copy.seconds, { seconds: recordingSeconds })} / {MAX_RECORDING_SECONDS}
                    </p>
                    <button type="button" onClick={stopRecording} className="mt-4 min-h-11 cursor-pointer rounded-xl bg-katha-error px-6 text-sm font-bold text-white hover:bg-katha-error/85">
                      {copy.stopRecording}
                    </button>
                  </div>
                ) : recordedBlob ? (
                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button type="button" onClick={toggleRecordingPlayback} disabled={isBusy} className="min-h-11 cursor-pointer rounded-xl border border-katha-text/15 px-5 text-sm font-semibold text-katha-text hover:bg-katha-text/5 disabled:opacity-50">
                      {recordingPlayback === 'playing' ? copy.stopRecordingPlayback : copy.playRecording}
                    </button>
                    <button type="button" onClick={resetCurrentAttempt} disabled={isBusy} className="min-h-11 cursor-pointer rounded-xl border border-katha-text/15 px-5 text-sm font-semibold text-katha-text hover:bg-katha-text/5 disabled:opacity-50">
                      {copy.retryRecording}
                    </button>
                    <button type="button" onClick={() => void submitAttempt()} disabled={isBusy} className="min-h-11 cursor-pointer rounded-xl bg-katha-primary px-6 text-sm font-bold text-katha-text hover:bg-katha-primary/85 disabled:cursor-wait disabled:opacity-60">
                      {recordingState === 'submitting' ? copy.submitting : copy.submit}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={recordingState === 'requesting'}
                    className="mx-auto mt-5 flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-katha-primary px-7 text-sm font-bold text-katha-text shadow-lg shadow-katha-primary/20 transition hover:bg-katha-primary/85 disabled:cursor-wait disabled:opacity-60"
                  >
                    <span aria-hidden="true">🎤</span>
                    {recordingState === 'requesting' ? copy.requestingPermission : copy.startRecording}
                  </button>
                )}
                <button
                  type="button"
                  onClick={skipCurrentSentence}
                  disabled={isBusy}
                  className="mt-4 min-h-10 cursor-pointer rounded-xl px-4 text-xs font-semibold text-katha-text/55 underline decoration-katha-text/20 underline-offset-4 transition hover:text-katha-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copy.skipSentence} →
                </button>
              </div>
            )}

            {attemptResult && currentScore !== null && (
              <div aria-live="polite">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                  <div className={`grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 text-2xl font-black ${scoreTone(currentScore)}`}>
                    {currentScore}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-katha-text/40">{copy.heardAs}</p>
                    <p lang="km" className="mt-1 break-words font-khmer text-2xl leading-relaxed text-katha-text">
                      {attemptResult.transcript || '—'}
                    </p>
                    <p lang="vi" className="mt-2 text-sm leading-6 text-katha-text/60">{attemptResult.feedback_vi}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    [
                      copy.confidence,
                      attemptResult.confidence === null
                        ? null
                        : percentage(attemptResult.confidence),
                    ],
                    [copy.characterAccuracy, percentage(attemptResult.character_accuracy)],
                    [copy.termCoverage, percentage(attemptResult.required_term_coverage)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-xl border border-katha-text/10 bg-katha-text/[0.035] p-3">
                      <div className="flex justify-between gap-2 text-xs font-semibold text-katha-text/55"><span>{label}</span><span>{value === null ? '—' : `${value}%`}</span></div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-katha-text/10"><div className="h-full rounded-full bg-katha-primary" style={{ width: `${value ?? 0}%` }} /></div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-katha-success/20 bg-katha-success/[0.07] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-200/80">{copy.matched}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attemptResult.matched_segments.length > 0
                        ? attemptResult.matched_segments.map((segment) => <span key={segment} lang="km" className="rounded-full bg-katha-success/15 px-3 py-1 font-khmer text-sm text-emerald-100">{segment}</span>)
                        : <span className="text-sm text-katha-text/45">—</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border border-katha-warning/20 bg-katha-warning/[0.07] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-200/80">{copy.missing}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attemptResult.missing_segments.length > 0
                        ? attemptResult.missing_segments.map((segment) => <span key={segment} lang="km" className="rounded-full bg-katha-warning/15 px-3 py-1 font-khmer text-sm text-amber-100">{segment}</span>)
                        : <span className="text-sm text-emerald-200">{copy.perfectMatch}</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-end">
                  <button type="button" onClick={retryCurrentAttempt} className="min-h-11 cursor-pointer rounded-xl border border-katha-text/15 px-5 text-sm font-semibold text-katha-text hover:bg-katha-text/5">
                    {copy.retryRecording}
                  </button>
                  <button type="button" onClick={continueLesson} className="min-h-11 cursor-pointer rounded-xl bg-katha-primary px-6 text-sm font-bold text-katha-text hover:bg-katha-primary/85">
                    {currentIndex === sentences.length - 1 ? copy.viewResults : copy.nextSentence} →
                  </button>
                </div>
              </div>
            )}

            {actionError && (
              <div role="alert" className="mt-5 rounded-xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm leading-6 text-red-200">
                {actionError}
              </div>
            )}
          </div>
        </section>

        <button type="button" onClick={onBackToStory} disabled={recordingState === 'recording' || isBusy} className="mx-auto mt-5 block cursor-pointer px-4 py-2 text-sm font-semibold text-katha-text/50 hover:text-katha-text disabled:cursor-not-allowed disabled:opacity-35">
          ← {copy.backToStory}
        </button>
        {onResetLearningJourney && (
          <LearningJourneyControls
            language={language}
            onReset={onResetLearningJourney}
            disabled={recordingState === 'recording' || isBusy}
            className="mt-7 border-t border-katha-text/10 pt-5"
          />
        )}
      </main>
    </div>
  );
}

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSpeakingSession,
  fetchSpeakingSentenceAudio,
  fetchSpeakingSessionAttempts,
  fetchSpeakingSentences,
  submitSpeakingAttempt,
} from '../api';
import type {
  CompletedSpeakingAttempt,
  SpeakingSentence,
  SpeakingSessionProgress,
} from '../types';
import { prepareRecordingWav, SilentRecordingError } from '../recordingAudio';
import { SpeakingPractice } from './SpeakingPractice';

vi.mock('../api', () => ({
  createSpeakingSession: vi.fn(),
  fetchSpeakingSentenceAudio: vi.fn(),
  fetchSpeakingSessionAttempts: vi.fn(),
  fetchSpeakingSentences: vi.fn(),
  submitSpeakingAttempt: vi.fn(),
}));

vi.mock('../recordingAudio', async () => {
  const actual = await vi.importActual<typeof import('../recordingAudio')>('../recordingAudio');
  return { ...actual, prepareRecordingWav: vi.fn() };
});

vi.mock('@/components/layout/KathaLogo', () => ({
  KathaLogo: () => <div data-testid="katha-logo" />,
}));

const sentence: SpeakingSentence = {
  id: 'hello',
  category: 'greetings',
  category_label_vi: 'Chào hỏi',
  khmer: 'សួស្តី',
  vietnamese: 'Xin chào',
  transliteration: 'suostei',
  level: 'beginner',
  required_terms: ['សួស្តី'],
};

const session: SpeakingSessionProgress = {
  id: '2fc8c503-f76b-49c1-a287-3b10cab425d2',
  story_id: 42,
  status: 'active',
  selected_sentence_ids: [sentence.id],
  attempted_sentence_ids: [],
  passed_sentence_ids: [],
  attempted_count: 0,
  passed_count: 0,
  target_count: 1,
  completed: false,
  sentences: [sentence],
};

const completedAttempt: CompletedSpeakingAttempt = {
  sentence,
  result: {
    transcript: sentence.khmer,
    confidence: null,
    score: 92,
    character_accuracy: 95,
    required_term_coverage: 100,
    feedback_vi: 'Rất tốt.',
    matched_segments: [sentence.khmer],
    missing_segments: [],
    passed: true,
    session_id: session.id,
  },
};

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = vi.fn((mimeType: string) => mimeType.includes('webm'));

  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['webm-audio'], { type: this.mimeType }) });
    this.onstop?.();
  });

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || 'audio/webm';
    MockMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }
}

describe('SpeakingPractice', () => {
  const stopTrack = vi.fn();
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;

  beforeEach(() => {
    MockMediaRecorder.instances = [];
    MockMediaRecorder.isTypeSupported.mockClear();
    stopTrack.mockClear();
    vi.mocked(fetchSpeakingSentences).mockResolvedValue([sentence]);
    vi.mocked(createSpeakingSession).mockResolvedValue(session);
    vi.mocked(fetchSpeakingSessionAttempts).mockResolvedValue([]);
    vi.mocked(fetchSpeakingSentenceAudio).mockResolvedValue(
      new Blob(['RIFF-wave'], { type: 'audio/wav' }),
    );
    vi.mocked(submitSpeakingAttempt).mockResolvedValue(completedAttempt.result);
    vi.mocked(prepareRecordingWav).mockResolvedValue({
      blob: new Blob(['RIFF-normalized'], { type: 'audio/wav' }),
      durationMs: 800,
    });

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal('MediaRecorder', MockMediaRecorder as unknown as typeof MediaRecorder);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    let objectUrlIndex = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => `blob:speaking-${++objectUrlIndex}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('hydrates the server session snapshot and opens results when every sentence is done', async () => {
    vi.mocked(fetchSpeakingSessionAttempts).mockResolvedValue([completedAttempt]);
    const onComplete = vi.fn();

    render(
      <SpeakingPractice
        language="vi"
        onLanguageChange={vi.fn()}
        onBackToStory={vi.fn()}
        onComplete={onComplete}
        storyId={42}
      />,
    );

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith([completedAttempt], session.id, []);
    });
    expect(createSpeakingSession).toHaveBeenCalledWith(
      [],
      { storyId: 42, restart: false, limit: 5 },
      expect.any(AbortSignal),
    );
    expect(fetchSpeakingSentences).not.toHaveBeenCalled();
    expect(fetchSpeakingSessionAttempts).toHaveBeenCalledWith(
      session.id,
      expect.any(AbortSignal),
    );
  });

  it('stops active tracks, aborts audio work, and revokes sample URLs on unmount', async () => {
    const view = render(
      <SpeakingPractice
        language="vi"
        onLanguageChange={vi.fn()}
        onBackToStory={vi.fn()}
        onComplete={vi.fn()}
        storyId={42}
      />,
    );

    const sampleButton = await screen.findByRole('button', { name: 'Nghe câu mẫu' });
    fireEvent.click(sampleButton);
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob)));
    const sampleSignal = vi.mocked(fetchSpeakingSentenceAudio).mock.calls[0][1];

    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu ghi âm' }));
    await screen.findByRole('button', { name: 'Dừng ghi âm' });
    const recorder = MockMediaRecorder.instances[0];

    view.unmount();

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(sampleSignal?.aborted).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:speaking-1');
  });

  it('normalizes browser audio to WAV before submitting it', async () => {
    const onProgressChange = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <SpeakingPractice
        language="vi"
        onLanguageChange={vi.fn()}
        onBackToStory={vi.fn()}
        onComplete={vi.fn()}
        onProgressChange={onProgressChange}
        storyId={42}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu ghi âm' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dừng ghi âm' }));
    const submit = await screen.findByRole('button', { name: 'Gửi và chấm điểm' });
    fireEvent.click(submit);

    await waitFor(() => expect(submitSpeakingAttempt).toHaveBeenCalledOnce());
    const submittedBlob = vi.mocked(submitSpeakingAttempt).mock.calls[0][1];
    expect(submittedBlob.type).toBe('audio/wav');
    expect(vi.mocked(submitSpeakingAttempt).mock.calls[0][2]).toBe(800);
    expect(onProgressChange).toHaveBeenCalledWith([completedAttempt], session.id, []);
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('Cannot update a component'),
      ),
    ).toBe(false);
    consoleError.mockRestore();
  });

  it('asks the learner to record again when no speech signal is detected', async () => {
    vi.mocked(prepareRecordingWav).mockRejectedValueOnce(new SilentRecordingError());

    render(
      <SpeakingPractice
        language="vi"
        onLanguageChange={vi.fn()}
        onBackToStory={vi.fn()}
        onComplete={vi.fn()}
        storyId={42}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Bắt đầu ghi âm' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dừng ghi âm' }));

    expect(
      await screen.findByText('Không phát hiện giọng nói đủ rõ. Hãy nói gần micro hơn rồi ghi lại.'),
    ).toBeInTheDocument();
    expect(submitSpeakingAttempt).not.toHaveBeenCalled();
  });

  it('lets the learner skip a sentence and finish without submitting audio', async () => {
    const onComplete = vi.fn();
    const onProgressChange = vi.fn();

    render(
      <SpeakingPractice
        language="vi"
        onLanguageChange={vi.fn()}
        onBackToStory={vi.fn()}
        onComplete={onComplete}
        onProgressChange={onProgressChange}
        storyId={42}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Bỏ qua câu này/i }));

    expect(onProgressChange).toHaveBeenLastCalledWith([], session.id, [sentence.id]);
    expect(onComplete).toHaveBeenCalledWith([], session.id, [sentence.id]);
    expect(submitSpeakingAttempt).not.toHaveBeenCalled();
  });
});

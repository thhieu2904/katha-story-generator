import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CompletedSpeakingAttempt } from '../types';
import { SpeakingResults } from './SpeakingResults';

const attempts: CompletedSpeakingAttempt[] = [
  {
    sentence: {
      id: 'where-are-you-going',
      category: 'daily-life',
      category_label_vi: 'Hằng ngày',
      khmer: 'អ្នកទៅណា?',
      vietnamese: 'Bạn đi đâu?',
      transliteration: 'Neak tov na?',
      level: 'beginner',
      required_terms: ['អ្នក', 'ទៅណា'],
    },
    result: {
      transcript: 'អ្នកទៅណា?',
      confidence: 0.9,
      score: 88,
      character_accuracy: 92,
      required_term_coverage: 100,
      feedback_vi: 'Rất tốt.',
      matched_segments: ['អ្នក', 'ទៅណា'],
      missing_segments: [],
      passed: true,
    },
  },
];

describe('SpeakingResults', () => {
  it('offers the museum as a new post-results destination', () => {
    const onPracticeAgain = vi.fn();
    const onReadStoryAgain = vi.fn();
    const onResetLearningJourney = vi.fn();

    render(
      <SpeakingResults
        language="vi"
        attempts={attempts}
        skippedCount={1}
        keywords={[
          { khmer: 'បុណ្យ', vietnamese: 'Lễ hội', transliteration: 'bon' },
          { khmer: 'អកអំបុក', vietnamese: 'Ok Om Bok', transliteration: null },
          { khmer: 'ព្រះចន្ទ', vietnamese: 'Mặt Trăng', transliteration: 'preah chan' },
        ]}
        storyPageCount={4}
        onLanguageChange={vi.fn()}
        onPracticeAgain={onPracticeAgain}
        onReadStoryAgain={onReadStoryAgain}
        onResetLearningJourney={onResetLearningJourney}
      />,
    );

    expect(screen.getByRole('link', { name: /Khám phá bảo tàng 360/i })).toHaveAttribute(
      'href',
      '/admin/museum',
    );
    expect(
      screen.getByRole('heading', { name: 'Chi tiết hành trình học' }),
    ).toBeInTheDocument();
    expect(screen.getByText('3 từ khóa')).toBeInTheDocument();
    expect(screen.getByText('Lễ hội')).toBeInTheDocument();
    expect(screen.getByText('Ok Om Bok')).toBeInTheDocument();
    expect(screen.getByText('Đã đọc 4/4 trang')).toBeInTheDocument();
    expect(screen.getByText('Đã nghe 4/4 trang')).toBeInTheDocument();
    expect(screen.getByText('1/2 câu đã luyện')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Bỏ qua 1 câu')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Nhận diện mới/i })[0]).toHaveAttribute(
      'href',
      '/admin/vision',
    );

    fireEvent.click(screen.getByRole('button', { name: /Luyện lại từ đầu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Đọc lại truyện/i }));
    expect(onPracticeAgain).toHaveBeenCalledOnce();
    expect(onResetLearningJourney).not.toHaveBeenCalled();
    expect(onReadStoryAgain).toHaveBeenCalledOnce();

    fireEvent.click(screen.getAllByRole('link', { name: /Nhận diện mới/i })[0]);
    expect(onResetLearningJourney).toHaveBeenCalledOnce();
  });

  it('reports partial listening instead of marking skipped audio as complete', () => {
    render(
      <SpeakingResults
        language="vi"
        attempts={attempts}
        keywords={[]}
        storyPageCount={4}
        listenedPageCount={1}
        listeningProgress={0.375}
        onLanguageChange={vi.fn()}
        onPracticeAgain={vi.fn()}
        onReadStoryAgain={vi.fn()}
      />,
    );

    expect(screen.getByText('Đã nghe 1/4 trang')).toBeInTheDocument();
    expect(screen.getByText('38%')).toBeInTheDocument();
    expect(screen.getByText('2/3 phần đã hoàn thành')).toBeInTheDocument();
  });
});

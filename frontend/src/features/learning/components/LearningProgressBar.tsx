'use client';

import type { ContentLanguage } from '@/features/language/ContentLanguageProvider';

type LearningStep = 1 | 2 | 3 | 4 | 5;

interface LearningProgressBarProps {
  currentStep: LearningStep;
  stepProgress?: number;
  language: ContentLanguage;
}

const STEP_LABELS = {
  vi: ['Nhận diện', 'Từ khóa', 'Nghe & đọc', 'Luyện nói', 'Kết quả'],
  km: ['សម្គាល់រូប', 'ពាក្យគន្លឹះ', 'ស្តាប់ និងអាន', 'ហាត់និយាយ', 'លទ្ធផល'],
} as const;

const PROGRESS_LABELS = {
  vi: 'Tiến trình',
  km: 'ដំណើរការ',
} as const;

export function LearningProgressBar({
  currentStep,
  stepProgress = 0,
  language,
}: LearningProgressBarProps) {
  const normalizedStepProgress = Math.min(Math.max(stepProgress, 0), 1);
  const progressPercent = Math.round(
    ((currentStep - 1 + normalizedStepProgress) / STEP_LABELS[language].length) * 100,
  );

  return (
    <section aria-label={PROGRESS_LABELS[language]} className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="text-katha-text/70">{PROGRESS_LABELS[language]}</span>
        <span className="tabular-nums text-katha-primary-light">{progressPercent}%</span>
      </div>

      <div
        role="progressbar"
        aria-label={PROGRESS_LABELS[language]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className="h-2 overflow-hidden rounded-full bg-katha-text/10"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-katha-success to-katha-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className="mt-2 grid grid-cols-5 gap-1" lang={language}>
        {STEP_LABELS[language].map((label, index) => {
          const step = (index + 1) as LearningStep;
          const completed = step < currentStep;
          const active = step === currentStep;

          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={`min-w-0 text-center text-[9px] font-semibold leading-tight sm:text-[11px] ${
                completed
                  ? 'text-katha-success'
                  : active
                    ? 'text-katha-primary-light'
                    : 'text-katha-text/35'
              } ${language === 'km' ? 'font-khmer' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`mx-auto mb-1 grid h-5 w-5 place-items-center rounded-full border text-[10px] sm:h-6 sm:w-6 ${
                  completed
                    ? 'border-katha-success bg-katha-success text-white'
                    : active
                      ? 'border-katha-primary bg-katha-primary/15 text-katha-primary-light'
                      : 'border-katha-text/15 bg-katha-text/[0.03] text-katha-text/35'
                }`}
              >
                {completed ? '✓' : step}
              </span>
              <span className="block truncate sm:whitespace-normal">{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

'use client';

import type { ContentLanguage } from '@/features/language/ContentLanguageProvider';

type LearningStep = 1 | 2 | 3 | 4 | 5;

interface LearningProgressBarProps {
  currentStep: LearningStep;
  stepProgress?: number;
  language: ContentLanguage;
  compact?: boolean;
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
  compact = false,
}: LearningProgressBarProps) {
  const normalizedStepProgress = Math.min(Math.max(stepProgress, 0), 1);
  const progressPercent = Math.round(
    ((currentStep - 1 + normalizedStepProgress) / STEP_LABELS[language].length) * 100,
  );

  return (
    <section
      aria-label={PROGRESS_LABELS[language]}
      data-compact={compact}
      className="w-full"
    >
      <div className={`${compact ? 'mb-1 text-[10px]' : 'mb-2 text-xs'} flex items-center justify-between gap-3 font-semibold`}>
        <span className="text-katha-text/70">{PROGRESS_LABELS[language]}</span>
        <span className="tabular-nums text-katha-primary-light">{progressPercent}%</span>
      </div>

      <div
        role="progressbar"
        aria-label={PROGRESS_LABELS[language]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
        className={`${compact ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full bg-katha-text/10`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-katha-success to-katha-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className={`${compact ? 'mt-1' : 'mt-2'} grid grid-cols-5 gap-1`} lang={language}>
        {STEP_LABELS[language].map((label, index) => {
          const step = (index + 1) as LearningStep;
          const completed = step < currentStep;
          const active = step === currentStep;

          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={`min-w-0 text-center font-semibold leading-tight ${compact ? 'text-[8px] sm:text-[10px]' : 'text-[9px] sm:text-[11px]'} ${
                completed
                  ? 'text-katha-success'
                  : active
                    ? 'text-katha-primary-light'
                    : 'text-katha-text/35'
              } ${language === 'km' ? 'font-khmer' : ''}`}
            >
              <span
                aria-hidden="true"
                className={`mx-auto grid place-items-center rounded-full border ${compact ? 'mb-0.5 h-4 w-4 text-[8px] sm:h-5 sm:w-5 sm:text-[9px]' : 'mb-1 h-5 w-5 text-[10px] sm:h-6 sm:w-6'} ${
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

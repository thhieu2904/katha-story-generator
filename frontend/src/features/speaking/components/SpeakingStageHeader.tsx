'use client';

import { FloatingContentLanguageControl } from '@/features/language/FloatingContentLanguageToggle';
import { LearningProgressBar } from '@/features/learning/components/LearningProgressBar';
import type { ReaderLanguage } from '@/features/reader/types';

interface SpeakingStageHeaderProps {
  currentStep: 4 | 5;
  stepProgress: number;
  language: ReaderLanguage;
  onLanguageChange: (language: ReaderLanguage) => void;
}

export function SpeakingStageHeader({
  currentStep,
  stepProgress,
  language,
  onLanguageChange,
}: SpeakingStageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-katha-text/5 bg-katha-surface/95 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-3 sm:px-6">
        <LearningProgressBar
          currentStep={currentStep}
          stepProgress={stepProgress}
          language={language}
        />
      </div>
      <FloatingContentLanguageControl
        language={language}
        onLanguageChange={onLanguageChange}
      />
    </header>
  );
}

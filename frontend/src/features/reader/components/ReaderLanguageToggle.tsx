import React from 'react';
import { getUiCopy } from '@/features/language/uiCopy';
import type { ReaderLanguage } from '../types';

interface ReaderLanguageToggleProps {
  language: ReaderLanguage;
  onChange: (language: ReaderLanguage) => void;
  compact?: boolean;
}

export function ReaderLanguageToggle({
  language,
  onChange,
  compact = false,
}: ReaderLanguageToggleProps) {
  const copy = getUiCopy(language);
  const buttonClassName = compact
    ? 'min-h-9 min-w-10 px-2 text-[11px] font-bold tracking-wide'
    : 'min-h-11 px-2.5 text-[13px] font-medium sm:px-4 sm:text-sm';

  return (
    <div 
      className={`flex shrink-0 items-center rounded-full border border-katha-text/10 bg-katha-field backdrop-blur-md ${
        compact ? 'p-0.5' : 'p-1'
      }`}
      role="radiogroup"
      aria-label={copy.chooseLanguage}
    >
      <button
        type="button"
        role="radio"
        aria-checked={language === 'km'}
        onClick={() => onChange('km')}
        lang="km"
        className={`
          cursor-pointer rounded-full transition-all duration-200 motion-reduce:transition-none ${buttonClassName}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary focus-visible:ring-offset-2 focus-visible:ring-offset-katha-surface
          ${language === 'km' 
            ? 'bg-katha-primary text-katha-text shadow-sm' 
            : 'text-katha-text/55 hover:text-katha-text hover:bg-katha-text/5'
          }
        `}
      >
        {compact ? 'KH' : 'ខ្មែរ'}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={language === 'vi'}
        onClick={() => onChange('vi')}
        lang="vi"
        className={`
          cursor-pointer rounded-full transition-all duration-200 motion-reduce:transition-none ${buttonClassName}
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary focus-visible:ring-offset-2 focus-visible:ring-offset-katha-surface
          ${language === 'vi' 
            ? 'bg-katha-primary text-katha-text shadow-sm' 
            : 'text-katha-text/55 hover:text-katha-text hover:bg-katha-text/5'
          }
        `}
      >
        {compact ? 'VIE' : 'Tiếng Việt'}
      </button>
    </div>
  );
}

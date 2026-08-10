import React from 'react';
import type { ReaderLanguage } from '../types';

interface ReaderLanguageToggleProps {
  language: ReaderLanguage;
  onChange: (language: ReaderLanguage) => void;
}

export function ReaderLanguageToggle({ language, onChange }: ReaderLanguageToggleProps) {
  return (
    <div 
      className="flex shrink-0 items-center rounded-full border border-white/10 bg-black/30 p-1 backdrop-blur-md"
      role="radiogroup"
      aria-label="Chọn ngôn ngữ"
    >
      <button
        role="radio"
        aria-checked={language === 'km'}
        onClick={() => onChange('km')}
        lang="km"
        className={`
          min-h-11 rounded-full px-2.5 text-[13px] font-medium transition-all duration-200 motion-reduce:transition-none sm:px-4 sm:text-sm
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary focus-visible:ring-offset-2 focus-visible:ring-offset-katha-surface
          ${language === 'km' 
            ? 'bg-katha-primary text-white shadow-sm' 
            : 'text-gray-400 hover:text-white hover:bg-white/5'
          }
        `}
      >
        ខ្មែរ
      </button>
      <button
        role="radio"
        aria-checked={language === 'vi'}
        onClick={() => onChange('vi')}
        lang="vi"
        className={`
          min-h-11 rounded-full px-2.5 text-[13px] font-medium transition-all duration-200 motion-reduce:transition-none sm:px-4 sm:text-sm
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-primary focus-visible:ring-offset-2 focus-visible:ring-offset-katha-surface
          ${language === 'vi' 
            ? 'bg-katha-primary text-white shadow-sm' 
            : 'text-gray-400 hover:text-white hover:bg-white/5'
          }
        `}
      >
        Tiếng Việt
      </button>
    </div>
  );
}

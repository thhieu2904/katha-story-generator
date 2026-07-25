import React from 'react';
import type { ReaderLanguage } from '../types';

interface ReaderLanguageToggleProps {
  language: ReaderLanguage;
  onChange: (language: ReaderLanguage) => void;
}

export function ReaderLanguageToggle({ language, onChange }: ReaderLanguageToggleProps) {
  return (
    <div 
      className="flex items-center bg-black/30 backdrop-blur-md rounded-full p-1 border border-white/10 mx-auto max-w-fit"
      role="radiogroup"
      aria-label="Chọn ngôn ngữ"
    >
      <button
        role="radio"
        aria-checked={language === 'km'}
        onClick={() => onChange('km')}
        className={`
          px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
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
        className={`
          px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
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

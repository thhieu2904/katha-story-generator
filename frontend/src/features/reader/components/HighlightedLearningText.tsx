import type { ReactNode } from 'react';
import type { KhmerKeyword } from '@/features/vision/api';
import type { ReaderLanguage } from '../types';

interface HighlightedLearningTextProps {
  text: string;
  keywords: KhmerKeyword[];
  language: ReaderLanguage;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KHMER_IGNORABLE_CHARACTERS = /[\s\u200B-\u200D\u2060\uFEFF]/gu;
const KHMER_FLEXIBLE_SEPARATOR = '[\\s\\u200B-\\u200D\\u2060\\uFEFF]*';

function buildKhmerPattern(term: string) {
  return Array.from(
    term.normalize('NFC').replace(KHMER_IGNORABLE_CHARACTERS, ''),
  )
    .map(escapeRegExp)
    .join(KHMER_FLEXIBLE_SEPARATOR);
}

export function HighlightedLearningText({
  text,
  keywords,
  language,
}: HighlightedLearningTextProps) {
  const terms = Array.from(
    new Set(
      keywords
        .flatMap((keyword) => {
          if (language !== 'km') return [keyword.vietnamese];
          const latinTransliteration = keyword.transliteration?.trim();
          return [
            keyword.khmer,
            latinTransliteration && /\p{Script=Latin}/u.test(latinTransliteration)
              ? latinTransliteration
              : '',
          ];
        })
        .map((term) => term.normalize('NFC').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => right.length - left.length);

  if (terms.length === 0) return text;

  const sourceText = text.normalize('NFC');
  const patterns = terms
    .map((term) => (language === 'km' ? buildKhmerPattern(term) : escapeRegExp(term)))
    .filter(Boolean);
  if (patterns.length === 0) return text;

  const matcher = new RegExp(patterns.join('|'), 'giu');
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const match of sourceText.matchAll(matcher)) {
    const start = match.index;
    const matchedText = match[0];
    if (start > cursor) parts.push(sourceText.slice(cursor, start));

    parts.push(
      <mark
        key={`${start}-${matchedText}`}
        className="rounded-md bg-katha-accent/20 px-1 py-0.5 font-bold text-katha-accent ring-1 ring-inset ring-katha-accent/25"
      >
        {matchedText}
      </mark>,
    );
    cursor = start + matchedText.length;
  }

  if (parts.length === 0) return sourceText;
  if (cursor < sourceText.length) parts.push(sourceText.slice(cursor));
  return parts;
}

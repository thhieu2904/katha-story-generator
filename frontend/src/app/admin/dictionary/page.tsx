import type { Metadata } from 'next';
import { DictionaryPage } from '@/features/dictionary/components/DictionaryPage';

export const metadata: Metadata = {
  title: 'Từ điển Khmer – Việt — Katha',
  description: 'Tra cứu từ Khmer và nghĩa tiếng Việt. Nguồn: Kiêm Hạnh.',
};

export default function AdminDictionaryPage() {
  return <DictionaryPage />;
}

import type { Metadata } from 'next';
import { MuseumPage } from '@/features/museum/components/MuseumPage';

export const metadata: Metadata = {
  title: 'Bảo tàng văn hóa Khmer (Beta) — Katha',
};

export default function MuseumRoute() {
  return <MuseumPage />;
}

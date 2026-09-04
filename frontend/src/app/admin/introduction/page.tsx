import type { Metadata } from 'next';
import { CulturalIntroPage } from '@/features/landing/components/CulturalIntroPage';

export const metadata: Metadata = {
  title: 'Khám phá Katha',
  description:
    'Khám phá mục tiêu của Katha và hành trình học văn hóa, ngôn ngữ Khmer qua hình ảnh tương tác.',
};

export default function IntroductionPage() {
  return <CulturalIntroPage />;
}

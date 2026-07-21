'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StoryImageWorkspace } from '@/features/story-images/components/StoryImageWorkspace';

export default function StoryImagesPage() {
  const params = useParams<{ id: string }>();
  const storyId = Number(params.id);

  if (!Number.isInteger(storyId) || storyId <= 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-12 text-center">
          <h1 className="text-xl font-semibold text-red-100">ID truyện không hợp lệ</h1>
          <Link href="/admin/stories" className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-katha-surface">
            Quay lại danh sách
          </Link>
        </section>
      </main>
    );
  }

  return <StoryImageWorkspace storyId={storyId} />;
}

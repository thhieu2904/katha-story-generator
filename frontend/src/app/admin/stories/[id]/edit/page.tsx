'use client';

import { useParams } from 'next/navigation';
import { StoryTextEditor } from '@/features/story-editor/components/StoryTextEditor';

export default function StoryTextEditorPage() {
  const params = useParams<{ id: string }>();
  const storyId = Number(params.id);

  if (!Number.isInteger(storyId) || storyId <= 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] px-6 py-12 text-center">
          <h1 className="text-xl font-semibold">ID truyện không hợp lệ</h1>
        </section>
      </main>
    );
  }

  return <StoryTextEditor storyId={storyId} />;
}
'use client';

import { useParams } from 'next/navigation';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { StoryTextEditor } from '@/features/story-editor/components/StoryTextEditor';

export default function StoryTextEditorPage() {
  const params = useParams<{ id: string }>();
  const storyId = Number(params.id);

  if (!Number.isInteger(storyId) || storyId <= 0) {
    return (
      <StoryWorkflowShell>
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] px-6 py-12 text-center">
          <h1 className="text-xl font-semibold">ID truyện không hợp lệ</h1>
        </section>
      </StoryWorkflowShell>
    );
  }

  return <StoryTextEditor storyId={storyId} />;
}
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StorySetupForm } from '@/features/stories/components/StorySetupForm';
import { createStory } from '@/features/stories/api';
import type { StoryCreate } from '@/features/stories/types';

export default function NewStoryPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: StoryCreate) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const newStory = await createStory(data);
      // Optional: set a success message flag in state/session if needed
      router.push(`/admin/stories/${newStory.id}/setup?success=created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tạo truyện');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-8">
        <Link
          href="/admin/stories"
          className="text-sm text-white/50 hover:text-white transition inline-flex items-center gap-2 mb-4"
        >
          &larr; Quay lại danh sách
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Tạo truyện mới
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Thiết lập các thông số cơ bản cho câu chuyện của bạn.
        </p>
      </div>

      {error && (
        <div className="mb-8 rounded-xl border border-katha-error/25 bg-katha-error/8 p-4">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
        <StorySetupForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </main>
  );
}

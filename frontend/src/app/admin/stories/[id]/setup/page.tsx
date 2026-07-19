'use client';

import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { StorySetupForm } from '@/features/stories/components/StorySetupForm';
import { ArchiveStoryDialog } from '@/features/stories/components/ArchiveStoryDialog';
import { useStory } from '@/features/stories/useStory';
import { updateStory } from '@/features/stories/api';
import type { StoryCreate } from '@/features/stories/types';

export default function EditStoryPage() {
  const params = useParams<{ id: string }>();
  const storyId = Number(params.id);

  if (!Number.isInteger(storyId) || storyId <= 0) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-10 text-center">
          <h2 className="font-semibold text-red-100">ID truyện không hợp lệ</h2>
          <Link
            href="/admin/stories"
            className="mt-5 inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-white/90"
          >
            Quay lại danh sách
          </Link>
        </section>
      </main>
    );
  }

  return <EditStoryInner storyId={storyId} />;
}

function EditStoryInner({ storyId }: { storyId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { story, error: fetchError, loading, retry } = useStory(storyId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    () => searchParams.get('success') === 'created' ? 'Tạo truyện thành công!' : null
  );
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleSubmit = async (data: StoryCreate) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await updateStory(storyId, data);
      setSuccessMessage('Cập nhật thiết lập thành công!');
      retry();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi cập nhật');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveSuccess = () => {
    setIsArchiveDialogOpen(false);
    router.replace('/admin/stories');
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="h-8 w-1/4 bg-white/[0.055] rounded animate-pulse mb-8" />
        <div className="h-96 w-full bg-white/[0.055] rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (fetchError || !story) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-10 text-center">
          <h2 className="font-semibold text-red-100">Không thể tải thông tin truyện</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/50">{fetchError}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-white/90"
          >
            Thử lại
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end justify-between">
        <div>
          <Link
            href="/admin/stories"
            className="text-sm text-white/50 hover:text-white transition inline-flex items-center gap-2 mb-4"
          >
            &larr; Quay lại danh sách
          </Link>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Thiết lập truyện
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {story.title_vi || 'Truyện chưa đặt tên'}
          </p>
        </div>
        {story.status === 'draft' && (
          <button
            onClick={() => setIsArchiveDialogOpen(true)}
            className="rounded-lg border border-katha-error/50 bg-katha-error/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-katha-error/20"
          >
            Lưu trữ truyện
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-8 rounded-xl border border-katha-success/25 bg-katha-success/10 p-4">
          <p className="text-sm text-emerald-200">{successMessage}</p>
        </div>
      )}

      {submitError && (
        <div className="mb-8 rounded-xl border border-katha-error/25 bg-katha-error/8 p-4">
          <p className="text-sm text-red-200">{submitError}</p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
        <StorySetupForm
          story={story}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>

      {isArchiveDialogOpen && (
        <ArchiveStoryDialog
          storyId={story.id}
          storyTitle={story.title_vi || 'Truyện chưa đặt tên'}
          onClose={() => setIsArchiveDialogOpen(false)}
          onSuccess={handleArchiveSuccess}
        />
      )}
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchStory, fetchStoryText } from '@/features/stories/api';
import type { Story, StoryText } from '@/features/stories/types';

export default function StoryTextPage() {
  const params = useParams<{ id: string }>();
  const storyId = Number(params.id);

  if (!Number.isInteger(storyId) || storyId <= 0) {
    return <MessageCard title="ID truyện không hợp lệ" />;
  }
  return <StoryTextPreview storyId={storyId} />;
}

function StoryTextPreview({ storyId }: { storyId: number }) {
  const [requestId, setRequestId] = useState(0);
  const [story, setStory] = useState<Story | null>(null);
  const [text, setText] = useState<StoryText | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      try {
        const current = await fetchStory(storyId);
        if (!active) return;
        setStory(current);
        setError(null);

        if (current.status === 'generating_text') {
          setLoading(false);
          timer = setTimeout(load, 3000);
          return;
        }
        if (current.status === 'draft' || current.status === 'archived') {
          setText(null);
          setLoading(false);
          return;
        }

        const canonicalText = await fetchStoryText(storyId);
        if (!active) return;
        setText(canonicalText);
        setLoading(false);
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Không thể tải nội dung truyện.');
        setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [storyId, requestId]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="h-10 w-2/5 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-8 h-72 animate-pulse rounded-2xl bg-white/[0.04]" />
      </main>
    );
  }

  if (error || !story) {
    return (
      <MessageCard
        title="Không thể tải nội dung truyện"
        detail={error || undefined}
        action={
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setRequestId((value) => value + 1);
            }}
            className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-katha-surface"
          >
            Thử lại
          </button>
        }
      />
    );
  }

  if (story.status === 'generating_text') {
    return (
      <MessageCard
        title="Đang sinh nội dung song ngữ…"
        detail="Trang này tự kiểm tra trạng thái sau mỗi 3 giây. Bạn có thể rời trang an toàn."
      />
    );
  }

  if (!text) {
    return (
      <MessageCard
        title={story.status === 'draft' ? 'Truyện chưa có nội dung' : 'Nội dung không khả dụng'}
        action={story.status === 'draft' ? (
          <Link
            href={`/admin/stories/${storyId}/setup`}
            className="mt-5 inline-block rounded-xl bg-katha-primary px-4 py-2.5 text-sm font-semibold text-white"
          >
            Quay lại thiết lập
          </Link>
        ) : undefined}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/admin/stories" className="text-sm text-white/50 transition hover:text-white">
        &larr; Quay lại danh sách
      </Link>
      <div className="mt-6 rounded-2xl border border-katha-primary/20 bg-katha-primary/8 p-5">
        <p className="text-sm text-katha-primary-light">
          Bản xem trước chỉ đọc · revision {text.text_revision}. Biên tập và xác nhận thuộc Phase 3C.
        </p>
      </div>

      <header className="py-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title_vi}</h1>
        <p className="text-khmer mt-3 text-xl text-white/65">{text.title_km}</p>
      </header>

      <div className="space-y-6">
        {text.pages.map((page) => (
          <article
            key={page.id}
            className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-katha-primary-light">
              Trang {page.page_no}
            </p>
            <p className="text-base leading-8 text-white/90">{page.text_vi}</p>
            <div className="my-5 border-t border-white/10" />
            <p className="text-khmer text-base leading-8 text-white/60">{page.text_km}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

function MessageCard({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] px-6 py-12 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {detail && <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/50">{detail}</p>}
        {action}
        <div>
          <Link href="/admin/stories" className="mt-5 inline-block text-sm text-white/50 hover:text-white">
            Quay lại danh sách
          </Link>
        </div>
      </section>
    </main>
  );
}
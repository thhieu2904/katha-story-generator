'use client';

import Link from 'next/link';
import { useStories } from '@/features/stories/useStories';
import { StoryListItem } from '@/features/stories/components/StoryListItem';

function StorySkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] h-48">
      <div className="flex-1 p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="h-5 w-3/5 animate-pulse rounded bg-white/[0.07]" />
          <div className="h-4 w-16 animate-pulse rounded-full bg-white/[0.07]" />
        </div>
        <div className="h-4 w-full animate-pulse rounded bg-white/[0.05]" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.05]" />
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="h-4 w-1/3 animate-pulse rounded bg-white/[0.05]" />
      </div>
    </div>
  );
}

export default function StoriesPage() {
  const { stories, error, loading, retry } = useStories();

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-katha-primary-light">
            Story Manager
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Quản lý truyện
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
            Quản lý các bản thảo, kịch bản và xuất bản các câu chuyện Katha.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {stories && (
            <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
              {stories.length} truyện
            </span>
          )}
          <Link
            href="/admin/stories/new"
            className="rounded-lg bg-katha-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-katha-primary-light"
          >
            + Tạo truyện
          </Link>
        </div>
      </div>

      {loading && (
        <div
          aria-label="Đang tải danh sách truyện"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <StorySkeleton key={index} />
          ))}
        </div>
      )}

      {error && (
        <section className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-10 text-center">
          <h2 className="font-semibold text-red-100">Không thể tải danh sách truyện</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/50">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-white/90"
          >
            Thử lại
          </button>
        </section>
      )}

      {stories?.length === 0 && (
        <section className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center">
          <div className="text-3xl">📝</div>
          <h2 className="mt-3 font-semibold">Chưa có truyện nào</h2>
          <p className="mt-2 text-sm text-white/45">
            Bắt đầu sáng tạo bằng cách tạo câu chuyện đầu tiên.
          </p>
          <Link
            href="/admin/stories/new"
            className="mt-5 inline-block rounded-lg bg-katha-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-katha-primary-light"
          >
            Tạo truyện đầu tiên
          </Link>
        </section>
      )}

      {stories && stories.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <StoryListItem
              key={story.id}
              story={story}
              onArchiveSuccess={retry}
            />
          ))}
        </div>
      )}
    </main>
  );
}

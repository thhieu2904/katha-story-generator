'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { StorySetupForm } from '@/features/stories/components/StorySetupForm';
import { createStory } from '@/features/stories/api';
import { orchestrateCreateAndGenerate } from '@/features/story-workflow/orchestration';
import { isUncertainError } from '@/features/story-workflow/mutation-helpers';
import type { StoryCreate } from '@/features/stories/types';

export default function NewStoryPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<StoryCreate | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormChange = (data: StoryCreate, valid: boolean) => {
    setFormData(data);
    setIsValid(valid);
  };

  const handleSaveDraftOnly = async () => {
    if (!formData || !isValid || isSubmitting || isGenerating || isBlocked) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const newStory = await createStory(formData);
      router.push(`/admin/stories/${newStory.route_key}/setup?success=created`);
    } catch (err) {
      if (isUncertainError(err)) {
        setIsBlocked(true);
        setError(
          'Bản nháp có thể đã được tạo do sự cố kết nối. Vui lòng kiểm tra danh sách truyện trước khi tạo lại.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi tạo bản nháp.');
      }
      setIsSubmitting(false);
    }
  };

  const handleCreateAndGenerate = async () => {
    if (!formData || !isValid || isSubmitting || isGenerating || isBlocked) return;
    setIsGenerating(true);
    setError(null);
    const result = await orchestrateCreateAndGenerate(formData);

    if (result.kind === 'success') {
      router.push(result.nextHref);
    } else if (result.kind === 'partial') {
      setError(result.message);
      setIsGenerating(false);
      router.push(result.nextHref);
    } else if (result.kind === 'blocked') {
      setIsBlocked(true);
      setError(result.message);
      setIsGenerating(false);
    } else {
      setError(result.message);
      setIsGenerating(false);
    }
  };

  const isBusy = isSubmitting || isGenerating || isBlocked;

  const actionBar = isBlocked ? (
    <>
      <div className="text-xs text-rose-300">
        Không thể tự động khởi tạo lại để tránh trùng lặp bản nháp.
      </div>
      <Link
        href="/admin/stories"
        className="rounded-xl bg-white px-5 py-2.5 text-xs font-semibold text-katha-surface transition hover:bg-white/90"
      >
        Kiểm tra danh sách truyện →
      </Link>
    </>
  ) : (
    <>
      <div className="text-xs text-white/50 hidden sm:block">
        {isGenerating
          ? 'Đang tạo câu chuyện và khởi chạy sinh nội dung…'
          : isSubmitting
            ? 'Đang tạo bản nháp…'
            : 'Điền thông tin và bắt đầu câu chuyện của bạn'}
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={handleSaveDraftOnly}
          disabled={!isValid || isBusy}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
        >
          {isSubmitting ? 'Đang lưu…' : 'Chỉ lưu nháp'}
        </button>
        <button
          type="button"
          onClick={handleCreateAndGenerate}
          disabled={!isValid || isBusy}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {isGenerating ? 'Đang tạo & sinh nội dung…' : 'Tạo và sinh nội dung'}
        </button>
      </div>
    </>
  );

  return (
    <StoryWorkflowShell actionBar={actionBar}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
            Tạo truyện mới
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Bước 1: Thiết lập ý tưởng, nhân vật và phong cách nghệ thuật cho cuốn sách.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-4 text-sm text-rose-200 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            {isBlocked && (
              <Link
                href="/admin/stories"
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-katha-surface"
              >
                Danh sách truyện
              </Link>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <StorySetupForm
            onFormChange={handleFormChange}
            isSubmitting={isSubmitting}
            isGenerating={isGenerating}
            isBlocked={isBlocked}
            hideFooterButtons
          />
        </div>
      </div>
    </StoryWorkflowShell>
  );
}

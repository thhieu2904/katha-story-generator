'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { StorySetupSummary } from '@/features/story-workflow/components/StorySetupSummary';
import { StorySetupForm } from '@/features/stories/components/StorySetupForm';
import { ArchiveStoryDialog } from '@/features/stories/components/ArchiveStoryDialog';
import { useStory } from '@/features/stories/useStory';
import {
  fetchStory,
  generateStoryText,
  updateStory,
  fetchBackbones,
  fetchGenres,
  fetchArtStyles,
} from '@/features/stories/api';
import { fetchCharacters } from '@/features/characters/api';
import {
  getCanonicalHref,
  getWorkflowPresentation,
  getWorkflowRouteMode,
} from '@/features/story-workflow/workflow';
import type { StoryCreate } from '@/features/stories/types';

export default function EditStoryPage() {
  const params = useParams<{ id: string }>();
  const storyId = Number(params.id);

  if (!Number.isInteger(storyId) || storyId <= 0) {
    return (
      <StoryWorkflowShell>
        <section className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-10 text-center">
          <h2 className="font-semibold text-red-100">ID truyện không hợp lệ</h2>
          <Link
            href="/admin/stories"
            className="mt-5 inline-block rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-white/90"
          >
            Quay lại danh sách
          </Link>
        </section>
      </StoryWorkflowShell>
    );
  }

  return <EditStoryInner storyId={storyId} />;
}

function EditStoryInner({ storyId }: { storyId: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { story, error: fetchError, loading, retry } = useStory(storyId);

  const [formData, setFormData] = useState<StoryCreate | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    () => (searchParams.get('success') === 'created' ? 'Tạo truyện thành công!' : null)
  );
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const [configs, setConfigs] = useState<{
    backboneMap: Map<number, string>;
    genreMap: Map<number, string>;
    artStyleMap: Map<number, string>;
    characterMap: Map<number, { id: number; name: string; avatar_url?: string | null }>;
  } | null>(null);

  // Runtime Route Guard using getWorkflowRouteMode
  useEffect(() => {
    if (!story) return;
    const presentation = getWorkflowPresentation(storyId, story.status);
    const routeMode = getWorkflowRouteMode(
      presentation,
      `/admin/stories/${storyId}/setup`
    );

    if (routeMode === 'redirect') {
      router.replace(presentation.canonicalHref);
    }
  }, [story, router, storyId]);

  useEffect(() => {
    if (!story || story.status === 'draft') return;
    let active = true;

    Promise.all([
      fetchBackbones().catch(() => []),
      fetchGenres().catch(() => []),
      fetchArtStyles().catch(() => []),
      fetchCharacters().catch(() => []),
    ]).then(([backbones, genres, artStyles, characters]) => {
      if (!active) return;
      setConfigs({
        backboneMap: new Map(backbones.map((b) => [b.id, b.name_vi])),
        genreMap: new Map(genres.map((g) => [g.id, g.name_vi])),
        artStyleMap: new Map(artStyles.map((a) => [a.id, a.name_vi])),
        characterMap: new Map(
          characters.map((c) => [
            c.id,
            { id: c.id, name: c.name, avatar_url: c.ref_image_urls?.[0] },
          ])
        ),
      });
    });

    return () => {
      active = false;
    };
  }, [story]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleFormChange = (data: StoryCreate, valid: boolean) => {
    setFormData(data);
    setIsValid(valid);
  };

  const handleSaveOnly = async () => {
    if (!formData || !isValid || isSubmitting || isGenerating) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await updateStory(storyId, formData);
      setSuccessMessage('Cập nhật thiết lập thành công!');
      retry();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi cập nhật');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndGenerate = async () => {
    if (!formData || !isValid || isSubmitting || isGenerating) return;
    setIsGenerating(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await updateStory(storyId, formData);
      await generateStoryText(storyId);
      router.replace(`/admin/stories/${storyId}/edit`);
    } catch (err) {
      try {
        const current = await fetchStory(storyId);
        if (current.status === 'text_draft' || current.status === 'generating_text') {
          router.replace(`/admin/stories/${storyId}/edit`);
          return;
        }
      } catch {
        setNeedsReconcile(true);
        setSubmitError(
          'Chưa thể xác định yêu cầu đã hoàn tất hay chưa. Hãy kiểm tra lại trạng thái trước khi thử lại.'
        );
        return;
      }
      setSubmitError(
        err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi sinh nội dung'
      );
      retry();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReconcile = async () => {
    setIsGenerating(true);
    setSubmitError(null);
    try {
      const current = await fetchStory(storyId);
      if (current.status === 'draft') {
        setNeedsReconcile(false);
        retry();
        return;
      }
      router.replace(`/admin/stories/${storyId}/edit`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Chưa thể kiểm tra trạng thái truyện'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <StoryWorkflowShell storyId={storyId}>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-1/4 bg-white/[0.055] rounded mb-8" />
          <div className="h-96 w-full bg-white/[0.055] rounded-2xl" />
        </div>
      </StoryWorkflowShell>
    );
  }

  if (fetchError || !story) {
    return (
      <StoryWorkflowShell storyId={storyId}>
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
      </StoryWorkflowShell>
    );
  }

  const isDraft = story.status === 'draft';
  const isBusy = isSubmitting || isGenerating || needsReconcile;
  const canonicalHref = getCanonicalHref(story.id, story.status);

  const actionBar = isDraft ? (
    <>
      <div className="text-xs text-white/50 hidden sm:block">
        Thiết lập hiện tại sẽ được lưu trước khi tạo nội dung.
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={() => setIsArchiveDialogOpen(true)}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 mr-auto sm:mr-0"
        >
          Lưu trữ
        </button>
        <button
          type="button"
          onClick={handleSaveOnly}
          disabled={!isValid || isBusy}
          className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-40"
        >
          {isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
        <button
          type="button"
          onClick={handleSaveAndGenerate}
          disabled={!isValid || isBusy}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {isGenerating ? 'Đang sinh nội dung…' : 'Lưu và sinh nội dung'}
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="text-xs text-white/50">
        Thiết lập đã được khóa cho trạng thái hiện tại.
      </div>
      <Link
        href={canonicalHref}
        className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light"
      >
        Chuyển tới bước hiện tại →
      </Link>
    </>
  );

  const resolvedCharacters = story.character_ids
    .map((id) => configs?.characterMap.get(id))
    .filter(
      (c): c is { id: number; name: string; avatar_url?: string | null } =>
        Boolean(c)
    );

  return (
    <StoryWorkflowShell
      storyId={storyId}
      storyTitle={story.title_vi || 'Truyện chưa đặt tên'}
      status={story.status}
      actionBar={actionBar}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl">
            Thiết lập ban đầu
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {story.title_vi || 'Truyện chưa đặt tên'}
          </p>
        </div>

        {successMessage && (
          <div className="rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        {submitError && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-4 text-sm text-rose-200">
            <p>{submitError}</p>
            {needsReconcile && (
              <button
                type="button"
                onClick={handleReconcile}
                disabled={isGenerating}
                className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-katha-surface disabled:opacity-50"
              >
                Kiểm tra lại trạng thái
              </button>
            )}
          </div>
        )}

        {isDraft ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <StorySetupForm
              story={story}
              onFormChange={handleFormChange}
              isSubmitting={isSubmitting}
              isGenerating={isGenerating}
              isBlocked={needsReconcile}
              hideFooterButtons
            />
          </div>
        ) : (
          <StorySetupSummary
            story={story}
            backboneName={
              story.backbone_id
                ? configs?.backboneMap.get(story.backbone_id)
                : undefined
            }
            genreName={
              story.genre_id ? configs?.genreMap.get(story.genre_id) : undefined
            }
            artStyleName={
              story.art_style_id
                ? configs?.artStyleMap.get(story.art_style_id)
                : undefined
            }
            characters={resolvedCharacters}
          />
        )}
      </div>

      {isArchiveDialogOpen && (
        <ArchiveStoryDialog
          storyId={story.id}
          storyTitle={story.title_vi || 'Truyện chưa đặt tên'}
          onClose={() => setIsArchiveDialogOpen(false)}
          onSuccess={() => router.replace('/admin/stories')}
        />
      )}
    </StoryWorkflowShell>
  );
}

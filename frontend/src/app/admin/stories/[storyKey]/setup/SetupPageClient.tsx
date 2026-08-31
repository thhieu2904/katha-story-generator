'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { StorySetupSummary } from '@/features/story-workflow/components/StorySetupSummary';
import { StorySetupForm } from '@/features/stories/components/StorySetupForm';
import { ArchiveStoryDialog } from '@/features/stories/components/ArchiveStoryDialog';
import { useStoryByRouteKey } from '@/features/stories/useStory';
import {
  fetchStory,
  generateStoryText,
  updateStory,
  fetchBackbones,
  fetchGenres,
  fetchArtStyles,
} from '@/features/stories/api';
import { fetchCharacters } from '@/features/characters/api';
import { isUncertainError } from '@/features/story-workflow/mutation-helpers';
import {
  getCanonicalHref,
  getWorkflowPresentation,
  getWorkflowRouteMode,
} from '@/features/story-workflow/workflow';
import type { Story, StoryCreate, StoryRouteKey } from '@/features/stories/types';
import { useUiCopy } from '@/features/language/useUiCopy';

export function areStorySetupFieldsEqual(story: Story, data: StoryCreate): boolean {
  const normA = (story.description_vi || '').trim();
  const normB = (data.description_vi || '').trim();
  if (normA !== normB) return false;

  if (story.target_age !== data.target_age) return false;
  if (story.length_pref !== data.length_pref) return false;
  if (story.backbone_id !== data.backbone_id) return false;
  if (story.genre_id !== data.genre_id) return false;
  if (story.art_style_id !== data.art_style_id) return false;

  const charsA = Array.from(new Set(story.character_ids || [])).sort((x: number, y: number) => x - y);
  const charsB = Array.from(new Set(data.character_ids || [])).sort((x: number, y: number) => x - y);
  if (charsA.length !== charsB.length) return false;
  for (let i = 0; i < charsA.length; i++) {
    if (charsA[i] !== charsB[i]) return false;
  }

  return true;
}

export function SetupPageClient({ storyKey }: { storyKey: StoryRouteKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { story, error: fetchError, loading, retry } = useStoryByRouteKey(storyKey);
  const storyId = story?.id;
  const { copy, language } = useUiCopy();

  const [formData, setFormData] = useState<StoryCreate | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    () => (searchParams.get('success') === 'created' ? copy.setupCreated : null)
  );
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const [configs, setConfigs] = useState<{
    backboneMap: Map<number, string>;
    genreMap: Map<number, string>;
    artStyleMap: Map<number, string>;
    characterMap: Map<number, { id: number; name: string; avatar_url?: string | null }>;
  } | null>(null);

  useEffect(() => {
    if (!story) return;
    const presentation = getWorkflowPresentation(story.route_key, story.status, story.image_workflow_kind);
    const routeMode = getWorkflowRouteMode(
      presentation,
      `/admin/stories/${story.route_key}/setup`
    );

    if (routeMode === 'redirect') {
      router.replace(presentation.canonicalHref);
    }
  }, [story, router]);

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
    if (!formData || !isValid || isSubmitting || isGenerating || !storyId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await updateStory(storyId, formData);
      setSuccessMessage(copy.setupUpdated);
      retry();
    } catch (err) {
      if (isUncertainError(err)) {
        try {
          const current = await fetchStory(storyId);
          if (areStorySetupFieldsEqual(current, formData)) {
            setSuccessMessage(copy.setupUpdated);
            retry();
            return;
          }
        } catch {
        }
      }
      setSubmitError(
        language === 'vi' && err instanceof Error ? err.message : copy.setupUpdateFailed,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAndGenerate = async () => {
    if (!formData || !isValid || isSubmitting || isGenerating || !story || !storyId) return;
    setIsGenerating(true);
    setSubmitError(null);
    setSuccessMessage(null);
    try {
      await updateStory(storyId, formData);
      await generateStoryText(storyId);
      router.replace(`/admin/stories/${story.route_key}/edit`);
    } catch (err) {
      try {
        const current = await fetchStory(storyId);
        if (current.status === 'text_draft' || current.status === 'generating_text') {
          router.replace(`/admin/stories/${current.route_key}/edit`);
          return;
        }
      } catch {
        setNeedsReconcile(true);
        setSubmitError(
          copy.generationStateUncertain,
        );
        return;
      }
      setSubmitError(
        language === 'vi' && err instanceof Error ? err.message : copy.contentGenerationFailed,
      );
      retry();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReconcile = async () => {
    if (!storyId) return;
    setIsGenerating(true);
    setSubmitError(null);
    try {
      const current = await fetchStory(storyId);
      if (current.status === 'draft') {
        setNeedsReconcile(false);
        retry();
        return;
      }
      router.replace(`/admin/stories/${current.route_key}/edit`);
    } catch (err) {
      setSubmitError(
        language === 'vi' && err instanceof Error ? err.message : copy.storyStateCheckFailed,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 w-1/4 bg-katha-text/[0.055] rounded mb-8" />
          <div className="h-96 w-full bg-katha-text/[0.055] rounded-2xl" />
        </div>
      </StoryWorkflowShell>
    );
  }

  if (fetchError || !story) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <section className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-10 text-center">
          <h2 className="font-semibold text-red-100">{copy.storyInfoUnavailable}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-katha-text/50">
            {language === 'vi' ? fetchError : copy.storyInfoUnavailable}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-5 rounded-xl bg-katha-text px-4 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-katha-text/90"
          >
            {copy.retry}
          </button>
        </section>
      </StoryWorkflowShell>
    );
  }

  const isDraft = story.status === 'draft';
  const isBusy = isSubmitting || isGenerating || needsReconcile;
  const canonicalHref = getCanonicalHref(story.route_key, story.status, story.image_workflow_kind);

  const actionBar = isDraft ? (
    <>
      <div className="text-xs text-katha-text/50 hidden sm:block">
        {copy.setupSaveBeforeGenerate}
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={() => setIsArchiveDialogOpen(true)}
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 mr-auto sm:mr-0"
        >
          {copy.archive}
        </button>
        <button
          type="button"
          onClick={handleSaveOnly}
          disabled={!isValid || isBusy}
          className="rounded-xl border border-katha-text/15 px-4 py-2.5 text-xs font-medium text-katha-text transition hover:bg-katha-text/10 disabled:opacity-40"
        >
          {isSubmitting ? copy.saving : copy.saveChanges}
        </button>
        <button
          type="button"
          onClick={handleSaveAndGenerate}
          disabled={!isValid || isBusy}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {isGenerating ? copy.generatingContent : copy.saveAndGenerate}
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="text-xs text-katha-text/50">
        {copy.setupLockedForStatus}
      </div>
      <Link
        href={canonicalHref}
        className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light"
      >
        {copy.goToCurrentStep}
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
      storyKey={story.route_key}
      storyTitle={
        language === 'km'
          ? story.title_km || story.title_vi || copy.untitledStory
          : story.title_vi || story.title_km || copy.untitledStory
      }
      status={story.status}
      imageWorkflowKind={story.image_workflow_kind}
      actionBar={actionBar}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-katha-text tracking-tight sm:text-3xl">
            {copy.initialSetup}
          </h1>
          <p className="mt-1 text-sm text-katha-text/60">
            {language === 'km'
              ? story.title_km || story.title_vi || copy.untitledStory
              : story.title_vi || story.title_km || copy.untitledStory}
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
                className="mt-3 rounded-lg bg-katha-text px-3 py-1.5 text-xs font-semibold text-katha-surface disabled:opacity-50"
              >
                {copy.checkStateAgain}
              </button>
            )}
          </div>
        )}

        {isDraft ? (
          <div className="rounded-2xl border border-katha-text/10 bg-katha-text/[0.02] p-6 sm:p-8">
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
          storyTitle={
            language === 'km'
              ? story.title_km || story.title_vi || copy.untitledStory
              : story.title_vi || story.title_km || copy.untitledStory
          }
          onClose={() => setIsArchiveDialogOpen(false)}
          onSuccess={() => router.replace('/admin/stories')}
        />
      )}
    </StoryWorkflowShell>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { StorySetupForm } from '@/features/stories/components/StorySetupForm';
import { createStory } from '@/features/stories/api';
import { orchestrateCreateAndGenerate } from '@/features/story-workflow/orchestration';
import { isUncertainError } from '@/features/story-workflow/mutation-helpers';
import type { StoryCreate } from '@/features/stories/types';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { getUiCopy } from '@/features/language/uiCopy';
import {
  clearVisionStoryDraft,
  loadVisionStoryDraft,
  type VisionStoryDraft,
} from '@/features/learning/visionStoryDraft';
import { LearningProgressBar } from '@/features/learning/components/LearningProgressBar';
import { LearningJourneyControls } from '@/features/learning/components/LearningJourneyControls';
import { resetLearningJourneyProgress } from '@/features/learning/resetLearningJourney';

export default function NewStoryPage() {
  const router = useRouter();
  const { language } = useContentLanguage();
  const copy = getUiCopy(language);
  const [formData, setFormData] = useState<StoryCreate | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visionDraft, setVisionDraft] = useState<VisionStoryDraft | null | undefined>(
    undefined,
  );

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const isVisionSource =
        new URLSearchParams(window.location.search).get('source') === 'vision';
      setVisionDraft(isVisionSource ? loadVisionStoryDraft() : null);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

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
      clearVisionStoryDraft();
      router.push(`/admin/stories/${newStory.route_key}/setup?success=created`);
    } catch (err) {
      if (isUncertainError(err)) {
        setIsBlocked(true);
        setError(copy.uncertainDraft);
      } else {
        setError(language === 'vi' && err instanceof Error ? err.message : copy.draftFailed);
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
      clearVisionStoryDraft();
      router.push(result.nextHref);
    } else if (result.kind === 'partial') {
      clearVisionStoryDraft();
      setError(language === 'vi' ? result.message : copy.genericError);
      setIsGenerating(false);
      router.push(result.nextHref);
    } else if (result.kind === 'blocked') {
      setIsBlocked(true);
      setError(language === 'vi' ? result.message : copy.genericError);
      setIsGenerating(false);
    } else {
      setError(language === 'vi' ? result.message : copy.genericError);
      setIsGenerating(false);
    }
  };

  const isBusy = isSubmitting || isGenerating || isBlocked;

  const handleResetLearningJourney = () => {
    resetLearningJourneyProgress();
    router.replace('/admin/vision');
  };

  const actionBar = isBlocked ? (
    <>
      <div className="text-xs text-rose-300">
        {copy.duplicateDraftBlocked}
      </div>
      <Link
        href="/admin/stories"
        className="rounded-xl bg-katha-text px-5 py-2.5 text-xs font-semibold text-katha-surface transition hover:bg-katha-text/90"
      >
        {copy.checkStoryList}
      </Link>
    </>
  ) : (
    <>
      <div className="text-xs text-katha-text/50 hidden sm:block">
        {isGenerating
          ? copy.launchingGeneration
          : isSubmitting
            ? copy.creatingDraft
            : copy.fillStoryInfo}
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={handleSaveDraftOnly}
          disabled={!isValid || isBusy}
          className="rounded-xl border border-katha-text/15 px-4 py-2.5 text-xs font-medium text-katha-text transition hover:bg-katha-text/10 disabled:opacity-40"
        >
          {isSubmitting ? copy.saving : copy.saveDraftOnly}
        </button>
        <button
          type="button"
          onClick={handleCreateAndGenerate}
          disabled={!isValid || isBusy}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {isGenerating ? copy.creatingAndGenerating : copy.createAndGenerate}
        </button>
      </div>
    </>
  );

  return (
    <StoryWorkflowShell
      actionBar={actionBar}
      showWorkflowStepper={visionDraft === null}
    >
      <div className="space-y-6">
        {visionDraft && (
          <div className="katha-card rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-lg backdrop-blur-xl sm:p-5">
            <LearningProgressBar
              currentStep={3}
              stepProgress={0}
              language={language}
            />
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-katha-text tracking-tight sm:text-3xl">
            {copy.newStoryTitle}
          </h1>
          <p className="mt-1 text-sm text-katha-text/60">
            {copy.newStorySubtitle}
          </p>
        </div>

        {visionDraft && (
          <div className="rounded-xl border border-katha-success/25 bg-katha-success/10 px-4 py-3 text-sm text-katha-text/75">
            {copy.visionContentLoaded} <strong>{visionDraft.sourceLabel}</strong>.{' '}
            {copy.chooseStoryStyle}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-4 text-sm text-rose-200 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            {isBlocked && (
              <Link
                href="/admin/stories"
                className="rounded-lg bg-katha-text px-3 py-1.5 text-xs font-semibold text-katha-surface"
              >
                {copy.storyList}
              </Link>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-katha-text/10 bg-katha-text/[0.02] p-6 sm:p-8">
          {visionDraft === undefined ? (
            <div className="space-y-6 animate-pulse" aria-label={copy.loadingVisionContent}>
              <div className="h-32 w-full rounded-2xl bg-katha-text/[0.055]" />
              <div className="h-40 w-full rounded-2xl bg-katha-text/[0.055]" />
            </div>
          ) : (
            <StorySetupForm
              initialDescriptionVi={visionDraft?.descriptionVi}
              onFormChange={handleFormChange}
              isSubmitting={isSubmitting}
              isGenerating={isGenerating}
              isBlocked={isBlocked}
              hideFooterButtons
            />
          )}
        </div>

        {visionDraft && (
          <LearningJourneyControls
            language={language}
            onReset={handleResetLearningJourney}
            disabled={isBusy}
            className="border-t border-katha-text/10 pt-5"
          />
        )}
      </div>
    </StoryWorkflowShell>
  );
}

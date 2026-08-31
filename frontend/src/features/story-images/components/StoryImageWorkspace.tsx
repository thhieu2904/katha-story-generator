'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { orchestrateSaveAndStart } from '@/features/story-workflow/orchestration';
import type { SaveAndStartResult } from '@/features/story-workflow/orchestration';
import { useIsMobileCompact } from '@/features/story-workflow/useIsMobileCompact';
import { ImageGenerationProgress } from './ImageGenerationProgress';
import { ImagePageProgressGrid } from './ImagePageProgressGrid';
import { ImagePlanCard } from './ImagePlanCard';
import { ImagePlanCompactRow } from './ImagePlanCompactRow';
import { StartImageGenerationDialog } from './StartImageGenerationDialog';
import { useStoryImages } from '../useStoryImages';
import type { ImageGenerationDialogMode, StoryImagesState } from '../types';

import type { StoryRouteKey } from '@/features/stories/types';
import { useStoryByRouteKey } from '@/features/stories/useStory';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import { LearningProgressBar } from '@/features/learning/components/LearningProgressBar';
import { LearningJourneyControls } from '@/features/learning/components/LearningJourneyControls';
import { resetLearningJourneyProgress } from '@/features/learning/resetLearningJourney';
import { hasVisionLearningContextInDescription } from '@/features/learning/visionStoryDraft';

const STATUS_STYLES: Record<string, string> = {
  text_confirmed: 'border-blue-500/25 bg-blue-500/10 text-blue-200',
  generating_images: 'border-katha-primary/25 bg-katha-primary/10 text-katha-primary-light',
  pending_review: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
  approved: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
  published: 'border-katha-success/25 bg-katha-success/10 text-emerald-200',
};

function getGenerationDialogMode(
  state: Pick<StoryImagesState, 'can_resume' | 'can_retry' | 'can_start'>
): ImageGenerationDialogMode | null {
  if (state.can_resume) return 'resume';
  if (state.can_retry) return 'retry';
  if (state.can_start) return 'start';
  return null;
}

export function StoryImageWorkspace({ storyKey }: { storyKey: StoryRouteKey }) {
  const { story, loading: storyLoading, error: fetchError, retry } = useStoryByRouteKey(storyKey);
  const { copy, language } = useUiCopy();

  if (storyLoading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceSkeleton />
      </StoryWorkflowShell>
    );
  }

  if (fetchError || !story || !story.id) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage
          title={copy.imageWorkspaceUnavailable}
          detail={language === 'vi' ? fetchError || undefined : undefined}
          onRetry={retry}
        />
      </StoryWorkflowShell>
    );
  }

  return (
    <StoryImageWorkspaceInner
      storyId={story.id}
      storyKey={storyKey}
      isVisionLesson={hasVisionLearningContextInDescription(story.description_vi ?? '')}
    />
  );
}

function StoryImageWorkspaceInner({
  storyId,
  storyKey,
  isVisionLesson,
}: {
  storyId: number;
  storyKey: StoryRouteKey;
  isVisionLesson: boolean;
}) {
  const router = useRouter();
  const { copy, language } = useUiCopy();
  const images = useStoryImages(storyId);
  const isMobileCompact = useIsMobileCompact();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isStartingOrSaving, setIsStartingOrSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [useCompactView, setUseCompactView] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const resetLearningJourney = () => {
    resetLearningJourneyProgress();
    router.replace('/admin/vision');
  };

  useEffect(() => {
    if (images.redirectHref) router.replace(images.redirectHref);
  }, [images.redirectHref, router]);

  if (images.redirectHref) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage title={copy.redirectingToCurrentStep} />
      </StoryWorkflowShell>
    );
  }

  if (images.loading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceSkeleton />
      </StoryWorkflowShell>
    );
  }

  if (!images.imageState) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <WorkspaceMessage
          title={copy.imageWorkspaceUnavailable}
          detail={language === 'vi' ? images.error || undefined : undefined}
          onRetry={() => void images.refresh()}
        />
      </StoryWorkflowShell>
    );
  }

  const state = images.imageState;
  const availableGenerationMode = getGenerationDialogMode(state);
  const dialogMode = dialogOpen ? availableGenerationMode : null;
  const generationMode: ImageGenerationDialogMode =
    availableGenerationMode ?? 'start';
  const unresolvedCount = Math.max(
    state.progress.total - state.progress.completed,
    0
  );
  const finalizationOnly = state.can_resume && unresolvedCount === 0;
  const dialogPageCount =
    generationMode === 'start' ? state.progress.total : unresolvedCount;
  const hasGenerationAction = availableGenerationMode !== null;
  const actionsDisabled = Boolean(
    images.pending || images.blocked || isStartingOrSaving || isBlocked || images.mappingConflict
  );
  // B6: Mobile with dirty mapping cannot start (needs desktop to save)
  const generationDisabled = actionsDisabled || (isMobileCompact && images.mappingDirty);
  const isReadOnly = ['pending_review', 'approved', 'published'].includes(
    state.status
  );

  const hasRecoveryAction = Boolean(
    state.job_stale || state.can_resume || state.can_retry
  );
  const isGeneratingMode =
    state.status === 'generating_images' && !hasRecoveryAction;

  const confirmGeneration = async () => {
    setIsStartingOrSaving(true);
    setActionError(null);

    const mappingPayload = state.pages.map((p) => ({
      page_id: p.id,
      character_ids: images.draftMappings[p.id] || p.character_ids,
    }));

    const result: SaveAndStartResult = await orchestrateSaveAndStart(
      storyId,
      images.mappingDirty,
      mappingPayload,
      state.image_plan_revision,
      state,
      // B1: Install save response inline between save → start.
      (saved) => images.installSaveResponse(saved),
      storyKey
    );

    if (result.kind === 'success') {
      setDialogOpen(false);
      setIsStartingOrSaving(false);
      const res = await images.refresh();
      if (res?.ok) {
        setIsBlocked(false);
      } else {
        // Refresh failed after success — block to prevent stale CTA
        setIsBlocked(true);
      }
    } else if (result.kind === 'partial') {
      setDialogOpen(false);
      setActionError(result.message);
      setIsStartingOrSaving(false);
      const res = await images.refresh();
      if (res?.ok) {
        setIsBlocked(false);
      } else {
        // Refresh failed after partial — block to prevent stale CTA
        setIsBlocked(true);
      }
    } else if (result.kind === 'blocked') {
      setDialogOpen(false);
      setActionError(result.message);
      setIsStartingOrSaving(false);
      // B1: Install savedState for blocked results too (save committed but start couldn't proceed)
      if ('savedState' in result && result.savedState) {
        images.installSaveResponse(result.savedState);
      }
      setIsBlocked(true);
    } else {
      setActionError(result.message);
      setIsStartingOrSaving(false);
    }
  };

  const handleSaveMappingOnly = async () => {
    if (actionsDisabled || !images.mappingDirty) return;
    await images.saveMapping();
  };

  let actionBar: React.ReactNode = null;

  if (isBlocked || images.blocked) {
    // B4: Only clear blocked AFTER successful refresh
    const handleCheckStatus = async () => {
      const result = await images.refresh();
      if (result.ok) {
        setIsBlocked(false);
      }
    };
    actionBar = (
      <>
        <div className="text-xs text-rose-300">
          {copy.latestStateUnconfirmed}
        </div>
        <button
          type="button"
          onClick={() => void handleCheckStatus()}
          className="rounded-xl bg-katha-text px-4 py-2.5 text-xs font-semibold text-katha-surface shadow transition hover:bg-katha-text/90"
        >
          {copy.checkStateAgain}
        </button>
      </>
    );
  } else if (images.mappingConflict) {
    // B5: Mapping conflict — server data changed
    actionBar = (
      <>
        <div className="text-xs text-amber-200">
          {copy.serverDataChanged}
        </div>
        <button
          type="button"
          onClick={() => void images.discardAndReload()}
          className="rounded-xl bg-katha-text px-4 py-2.5 text-xs font-semibold text-katha-surface shadow transition hover:bg-katha-text/90"
        >
          {copy.loadLatestState}
        </button>
      </>
    );
  } else if (!state.image_plan_ready && images.canPreparePlan) {
    actionBar = (
      <>
        <div className="text-xs text-katha-text/50">{copy.contentConfirmed}</div>
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={() => void images.preparePlan()}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {images.pending === 'prepare'
            ? copy.preparingIllustrations
            : copy.prepareIllustrationsAction}
        </button>
      </>
    );
  } else if (isGeneratingMode) {
    actionBar = (
      <>
        <div className="text-xs text-katha-text/60 font-medium">
          {images.activePage
            ? formatCopy(copy.generatingImagePage, {
                page: images.activePage.page_no,
                completed: state.progress.completed,
                total: state.progress.total,
              })
            : formatCopy(copy.imageProcessing, {
                completed: state.progress.completed,
                total: state.progress.total,
              })}
        </div>
        <span className="text-xs text-katha-primary-light font-medium flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-katha-primary animate-ping" />
          {copy.autoRefreshThreeSeconds}
        </span>
      </>
    );
  } else if (hasGenerationAction) {
    const primaryLabel = state.can_resume
      ? finalizationOnly
        ? copy.syncResults
        : formatCopy(copy.continueRemainingImages, { count: unresolvedCount })
      : state.can_retry
        ? formatCopy(copy.retryRemainingImages, { count: unresolvedCount })
        : formatCopy(copy.startGeneratingImages, { count: state.progress.total });

    actionBar = (
      <>
        <div className="text-xs text-katha-text/50 hidden sm:block">
          {images.mappingDirty
            ? copy.mappingSavedBeforeStart
            : state.can_resume
              ? copy.imageGenerationInterrupted
              : state.can_retry
                ? formatCopy(copy.imagesNeedRetry, { count: unresolvedCount })
                : copy.readyToGenerateImages}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {images.canEditMapping && images.mappingDirty && !isMobileCompact && (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => void handleSaveMappingOnly()}
              className="rounded-xl border border-katha-text/15 px-4 py-2.5 text-xs font-medium text-katha-text transition hover:bg-katha-text/10 disabled:opacity-40"
            >
              {images.pending === 'save_mapping' ? copy.saving : copy.saveChanges}
            </button>
          )}
          <button
            type="button"
            disabled={generationDisabled}
            onClick={() => setDialogOpen(true)}
            className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
          >
            {isStartingOrSaving ? copy.starting : primaryLabel}
          </button>
        </div>
      </>
    );
  } else if (isReadOnly) {
    actionBar = (
      <>
        <div className="text-xs text-katha-text/50">
          {copy.allImagesCompleted}
        </div>
        <button
          type="button"
          disabled
          className="rounded-xl bg-katha-success/20 border border-katha-success/30 px-5 py-2.5 text-xs font-semibold text-emerald-200"
        >
          {copy.readyToReview}
        </button>
      </>
    );
  }

  const mappingEditable = images.canEditMapping && !isMobileCompact;

  return (
    <StoryWorkflowShell
      storyKey={storyKey}
      storyTitle={state.title_vi || copy.untitledStory}
      status={state.status}
      actionBar={actionBar}
      showWorkflowStepper={!isVisionLesson}
    >
      <div className="space-y-6">
        {isVisionLesson && (
          <div className="katha-card rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-lg backdrop-blur-xl sm:p-5">
            <LearningProgressBar currentStep={3} stepProgress={0} language={language} />
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-katha-text tracking-tight sm:text-3xl">
              {copy.storyIllustrations}
            </h1>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                STATUS_STYLES[state.status] ||
                'border-katha-text/10 bg-katha-text/[0.04] text-katha-text/60'
              }`}
            >
              {{
                text_confirmed: copy.statusTextConfirmed,
                generating_images: copy.statusGeneratingImages,
                pending_review: copy.statusPendingReview,
                approved: copy.statusApproved,
                published: copy.statusPublished,
              }[state.status] || state.status}
            </span>
          </div>
          <p className="text-sm text-katha-text/60">
            {state.title_vi || copy.untitledStory}
          </p>
        </div>

        {isMobileCompact && images.canEditMapping && (
          <div className="rounded-xl border border-katha-text/10 bg-katha-text/5 p-4 text-xs text-katha-text/60">
            💡 {copy.mobileMappingHelp}
          </div>
        )}

        {/* B6: Mobile dirty mapping warning */}
        {isMobileCompact && images.mappingDirty && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-200">
            ⚠️ {copy.unsavedMappingMobile}
          </div>
        )}

        {/* B5: Mapping conflict banner */}
        {images.mappingConflict && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-3">
            <p>{copy.localDraftMayBeStale}</p>
            <button
              type="button"
              onClick={() => void images.discardAndReload()}
              className="rounded-lg bg-katha-text px-3 py-1.5 text-xs font-semibold text-katha-surface"
            >
              {copy.loadLatestState}
            </button>
          </div>
        )}

        {images.notice && (
          <div className="rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
            {language === 'vi' ? images.notice : copy.actionCompleted}
          </div>
        )}

        {(images.error || actionError) && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-4 text-sm text-rose-200 flex flex-wrap items-center justify-between gap-3">
            <p>{language === 'vi' ? images.error || actionError : copy.genericError}</p>
            {(images.blocked || isBlocked) && (
              <button
                type="button"
                onClick={() => {
                  void images.refresh().then((result) => {
                    if (result.ok) setIsBlocked(false);
                  });
                }}
                className="rounded-lg bg-katha-text px-3 py-1.5 text-xs font-semibold text-katha-surface"
              >
                {copy.checkStateAgain}
              </button>
            )}
          </div>
        )}

        {images.pollError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-katha-warning/25 bg-katha-warning/10 p-4 text-sm text-amber-100">
            <p>
              {language === 'vi' ? `${images.pollError} ` : ''}{copy.pollErrorSuffix}
            </p>
            <button
              type="button"
              onClick={() => void images.refresh()}
              className="rounded-lg border border-amber-100/25 px-3 py-1.5 text-xs font-semibold"
            >
              {copy.checkNow}
            </button>
          </div>
        )}

        {/* Missing plan view */}
        {!state.image_plan_ready && (
          <section className="rounded-2xl border border-dashed border-katha-text/15 bg-katha-text/[0.02] p-8 text-center sm:p-12 space-y-4">
            <h2 className="text-xl font-semibold text-katha-text">
              {copy.noImagePlan}
            </h2>
            <p className="mx-auto max-w-xl text-sm text-katha-text/60 leading-relaxed">
              {copy.noImagePlanHelp}
            </p>
          </section>
        )}

        {/* Image Plan Ready */}
        {state.image_plan_ready && (
          <>
            {/* Generation Progress Bar */}
            <ImageGenerationProgress
              progress={state.progress}
              status={state.status}
              stale={state.job_stale}
              activePageNo={images.activePage?.page_no}
            />

            {/* Generating Mode: Show ImagePageProgressGrid as primary */}
            {isGeneratingMode && (
              <div className="pt-2">
                <ImagePageProgressGrid pages={state.pages} />
              </div>
            )}

            {/* Non-generating or Recovery modes: Mapping review / plan display */}
            {!isGeneratingMode && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-katha-text/10 pb-4">
                  <h2 className="text-lg font-semibold text-katha-text">
                    {copy.reviewPageCharacters}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setUseCompactView(!useCompactView)}
                    className="text-xs text-katha-primary-light hover:underline"
                  >
                    {useCompactView ? copy.fullView : copy.compactView}
                  </button>
                </div>

                <div className="space-y-6">
                  {state.pages.map((page) =>
                    useCompactView ? (
                      <ImagePlanCompactRow
                        key={page.id}
                        page={page}
                        characters={state.available_characters}
                        selectedCharacterIds={
                          images.draftMappings[page.id] || page.character_ids
                        }
                        mappingEditable={mappingEditable}
                        disabled={actionsDisabled}
                        onMappingChange={(characterIds) =>
                          images.updatePageCharacters(page.id, characterIds)
                        }
                      />
                    ) : (
                      <ImagePlanCard
                        key={page.id}
                        page={page}
                        characters={state.available_characters}
                        selectedCharacterIds={
                          images.draftMappings[page.id] || page.character_ids
                        }
                        mappingEditable={mappingEditable}
                        disabled={actionsDisabled}
                        onMappingChange={(characterIds) =>
                          images.updatePageCharacters(page.id, characterIds)
                        }
                      />
                    )
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {isVisionLesson && (
          <LearningJourneyControls
            language={language}
            onReset={resetLearningJourney}
            disabled={isStartingOrSaving || images.pending === 'start'}
            className="border-t border-katha-text/10 pt-5"
          />
        )}
      </div>

      {dialogMode && (
        <StartImageGenerationDialog
          mode={dialogMode}
          pageCount={dialogPageCount}
          finalizationOnly={finalizationOnly}
          pending={isStartingOrSaving || images.pending === 'start'}
          error={images.error || actionError}
          blocked={images.blocked || isBlocked}
          onClose={() => setDialogOpen(false)}
          onConfirm={() => void confirmGeneration()}
          onReconcile={async () => {
            const res = await images.refresh();
            if (res?.ok) {
              setIsBlocked(false);
            }
          }}
        />
      )}
    </StoryWorkflowShell>
  );
}

function WorkspaceSkeleton() {
  const { copy } = useUiCopy();

  return (
    <div className="space-y-6 animate-pulse" aria-label={copy.loadingImageWorkspace}>
      <div className="h-28 rounded-2xl bg-katha-text/[0.05]" />
      <div className="h-36 rounded-2xl bg-katha-text/[0.04]" />
      <div className="h-80 rounded-2xl bg-katha-text/[0.035]" />
    </div>
  );
}

function WorkspaceMessage({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
}) {
  const { copy } = useUiCopy();

  return (
    <section className="rounded-2xl border border-katha-text/10 bg-katha-text/[0.025] p-10 text-center">
      <h1 className="text-xl font-semibold text-katha-text">{title}</h1>
      {detail && (
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-katha-text/55">
          {detail}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg bg-katha-text px-4 py-2 text-sm font-semibold text-katha-surface"
        >
          {copy.retry}
        </button>
      )}
    </section>
  );
}

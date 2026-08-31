'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { StoryTextPage, StoryRouteKey } from '@/features/stories/types';
import { useStoryByRouteKey } from '@/features/stories/useStory';
import { StoryWorkflowShell } from '@/features/story-workflow/components/StoryWorkflowShell';
import { orchestrateConfirmAndPrepare } from '@/features/story-workflow/orchestration';
import { useIsMobileCompact } from '@/features/story-workflow/useIsMobileCompact';
import {
  getWorkflowPresentation,
  getWorkflowRouteMode,
} from '@/features/story-workflow/workflow';
import { BAND_LIMITS } from '../constants';
import { useStoryEditor } from '../useStoryEditor';
import { AddPageButton } from './AddPageButton';
import { ConfirmTextDialog } from './ConfirmTextDialog';
import { DeletePageDialog } from './DeletePageDialog';
import { InstructionBox } from './InstructionBox';
import { QuickActions } from './QuickActions';
import { SortablePageList } from './SortablePageList';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import { LearningProgressBar } from '@/features/learning/components/LearningProgressBar';
import { LearningJourneyControls } from '@/features/learning/components/LearningJourneyControls';
import { resetLearningJourneyProgress } from '@/features/learning/resetLearningJourney';
import { hasVisionLearningContextInDescription } from '@/features/learning/visionStoryDraft';

export function StoryTextEditor({ storyKey }: { storyKey: StoryRouteKey }) {
  const { story, loading: storyLoading, error: fetchError, retry } = useStoryByRouteKey(storyKey);
  const { copy, language } = useUiCopy();

  if (storyLoading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <div className="space-y-6 animate-pulse">
          <div className="h-40 rounded-2xl bg-katha-text/[0.05]" />
          <div className="h-72 rounded-2xl bg-katha-text/[0.04]" />
        </div>
      </StoryWorkflowShell>
    );
  }

  if (fetchError || !story || !story.id) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage
          title={copy.publicStoryLoadFailed}
          detail={language === 'vi' ? fetchError || undefined : undefined}
          onRetry={retry}
        />
      </StoryWorkflowShell>
    );
  }

  return (
    <StoryTextEditorInner
      storyId={story.id}
      storyKey={storyKey}
      isVisionLesson={hasVisionLearningContextInDescription(story.description_vi ?? '')}
    />
  );
}

function StoryTextEditorInner({
  storyId,
  storyKey,
  isVisionLesson,
}: {
  storyId: number;
  storyKey: StoryRouteKey;
  isVisionLesson: boolean;
}) {
  const router = useRouter();
  const { copy, language: contentLanguage } = useUiCopy();
  const editor = useStoryEditor(storyId);
  const isMobileCompact = useIsMobileCompact();
  const [deleteTarget, setDeleteTarget] = useState<StoryTextPage | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirmingAndPreparing, setIsConfirmingAndPreparing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const resetLearningJourney = () => {
    resetLearningJourneyProgress();
    router.replace('/admin/vision');
  };

  useEffect(() => {
    const status = editor.story?.status;
    if (!status) return;
    const presentation = getWorkflowPresentation(
      storyKey,
      status,
      editor.story?.image_workflow_kind,
    );
    const routeMode = getWorkflowRouteMode(
      presentation,
      `/admin/stories/${storyKey}/edit`,
    );

    if (routeMode === 'redirect') {
      router.replace(presentation.canonicalHref);
    }
  }, [editor.story?.image_workflow_kind, editor.story?.status, router, storyKey]);

  if (editor.loading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <div className="space-y-6 animate-pulse">
          <div className="h-40 rounded-2xl bg-katha-text/[0.05]" />
          <div className="h-72 rounded-2xl bg-katha-text/[0.04]" />
        </div>
      </StoryWorkflowShell>
    );
  }

  if (!editor.story) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage
          title={copy.publicStoryLoadFailed}
          detail={contentLanguage === 'vi' ? editor.error || undefined : undefined}
          onRetry={() => void editor.refresh()}
        />
      </StoryWorkflowShell>
    );
  }

  if (editor.story.status === 'generating_text') {
    return (
      <StoryWorkflowShell
        storyKey={storyKey}
        storyTitle={
          contentLanguage === 'km'
            ? editor.story.title_km || editor.story.title_vi || copy.untitledStory
            : editor.story.title_vi || editor.story.title_km || copy.untitledStory
        }
        status={editor.story.status}
        imageWorkflowKind={editor.story.image_workflow_kind}
        showWorkflowStepper={!isVisionLesson}
      >
        <div className="space-y-6">
          <VisionLearningProgress
            enabled={isVisionLesson}
            language={contentLanguage}
          />
          <EditorMessage
            title={copy.generatingBilingual}
            detail={copy.generatingBilingualDetail}
          />
          {isVisionLesson && (
            <LearningJourneyControls
              language={contentLanguage}
              onReset={resetLearningJourney}
              className="border-t border-katha-text/10 pt-5"
            />
          )}
        </div>
      </StoryWorkflowShell>
    );
  }

  if (editor.story.status === 'draft') {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <div className="h-40 animate-pulse rounded-2xl bg-katha-text/[0.05]" />
      </StoryWorkflowShell>
    );
  }

  if (editor.story.status === 'archived') {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage title={copy.storyArchivedMessage} />
      </StoryWorkflowShell>
    );
  }

  const { text } = editor;
  if (!text) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage
          title={copy.noContentToDisplay}
          detail={contentLanguage === 'vi' ? editor.error || undefined : undefined}
          onRetry={() => void editor.refresh()}
        />
      </StoryWorkflowShell>
    );
  }

  const editable = text.status === 'text_draft';
  const disabled = Boolean(
    editor.pending || editor.blocked || !editable || isConfirmingAndPreparing
  );
  const [minimum, maximum] = BAND_LIMITS[text.length_pref] || [0, 16];
  const warnings = text.pages.reduce(
    (total, page) => total + page.spellcheck_flags.length,
    0
  );
  const unvalidated = text.pages.filter(
    (page) => page.khmer_validated_at === null
  ).length;

  const handleConfirmAndPrepare = async (acknowledge: boolean) => {
    setIsConfirmingAndPreparing(true);
    setActionError(null);
    const result = await orchestrateConfirmAndPrepare(
      storyId,
      text.text_revision,
      acknowledge,
      storyKey
    );

    if (result.kind === 'success' || result.kind === 'partial') {
      setConfirmOpen(false);
      router.push(result.nextHref);
    } else {
      setActionError(result.message);
      setIsConfirmingAndPreparing(false);
    }
  };

  const actionBar = editable ? (
    <>
      <div className="text-xs text-katha-text/50 hidden sm:block">
        {formatCopy(copy.pageCount, { count: text.pages.length })} ·{' '}
        {{ short: copy.shortLength, medium: copy.mediumLength, long: copy.longLength }[
          text.length_pref
        ] || text.length_pref}
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirmOpen(true)}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-katha-text shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {isConfirmingAndPreparing
            ? copy.preparingIllustrations
            : copy.confirmAndPrepare}
        </button>
      </div>
    </>
  ) : (
    <div className="text-xs text-katha-text/50">
      {copy.contentReadOnly}
    </div>
  );

  return (
    <StoryWorkflowShell
      storyKey={storyKey}
      storyTitle={
        contentLanguage === 'km'
          ? text.title_km || text.title_vi || copy.untitledStory
          : text.title_vi || text.title_km || copy.untitledStory
      }
      status={text.status}
      imageWorkflowKind={editor.story.image_workflow_kind}
      actionBar={actionBar}
      showWorkflowStepper={!isVisionLesson}
    >
      <div className="space-y-6">
        <VisionLearningProgress
          enabled={isVisionLesson}
          language={contentLanguage}
        />

        <header className="rounded-2xl border border-katha-text/10 bg-katha-text/[0.025] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-katha-text/45">
                <span className="rounded-full border border-katha-text/10 px-2.5 py-1">
                  {{
                    draft: copy.statusDraft,
                    generating_text: copy.statusGeneratingText,
                    text_draft: copy.statusTextDraft,
                    text_confirmed: copy.statusTextConfirmed,
                    generating_images: copy.statusGeneratingImages,
                    pending_review: copy.statusPendingReview,
                    approved: copy.statusApproved,
                    published: copy.statusPublished,
                    archived: copy.statusArchived,
                  }[text.status] || text.status}
                </span>
                <span>{formatCopy(copy.pageCount, { count: text.pages.length })}</span>
                <span>·</span>
                <span>
                  {{ short: copy.shortLength, medium: copy.mediumLength, long: copy.longLength }[
                    text.length_pref
                  ] || text.length_pref}
                </span>
              </div>
              <h1
                lang={contentLanguage}
                className={`text-3xl font-bold tracking-tight sm:text-4xl ${
                  contentLanguage === 'km' ? 'font-khmer' : ''
                }`}
              >
                {contentLanguage === 'km' ? text.title_km : text.title_vi}
              </h1>
              <p
                lang={contentLanguage === 'km' ? 'vi' : 'km'}
                className={`mt-3 text-xl leading-9 text-katha-text/65 ${
                  contentLanguage === 'vi' ? 'text-khmer' : ''
                }`}
              >
                {contentLanguage === 'km' ? text.title_vi : text.title_km}
              </p>
            </div>
            {editable && !isMobileCompact && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => void editor.retranslate('title')}
                className="rounded-lg border border-katha-text/15 px-3 py-2 text-xs font-medium text-katha-text/80 hover:text-katha-text transition disabled:opacity-40"
              >
                {copy.retranslateKhmerTitle}
              </button>
            )}
          </div>

          {/* Page anchor navigator compact (P1 feature) */}
          {text.pages.length > 1 && (
            <nav
              aria-label={copy.quickPageNavigation}
              className="mt-6 flex flex-wrap items-center gap-2 border-t border-katha-text/10 pt-4"
            >
              <span className="text-xs text-katha-text/45 mr-1">{copy.jumpTo}</span>
              {text.pages.map((p) => (
                <a
                  key={p.id}
                  href={`#page-${p.page_no}`}
                  className="rounded-md border border-katha-text/10 bg-katha-text/5 px-2.5 py-1 text-xs text-katha-text/70 hover:bg-katha-text/15 hover:text-katha-text transition"
                >
                  {formatCopy(copy.pageLabel, { page: p.page_no })}
                </a>
              ))}
            </nav>
          )}
        </header>

        {!editable && (
          <div className="rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
            {copy.contentReadOnly}
          </div>
        )}

        {isMobileCompact && editable && (
          <div className="rounded-xl border border-katha-text/10 bg-katha-text/5 p-4 text-xs text-katha-text/60">
            💡 {copy.mobileEditorHelp}
          </div>
        )}

        {actionError && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-4 text-sm text-rose-200">
            {contentLanguage === 'vi' ? actionError : copy.genericError}
          </div>
        )}

        {editor.pending && (
          <div className="rounded-xl border border-katha-primary/25 bg-katha-primary/10 p-4 text-sm text-katha-primary-light">
            {{
              validate: copy.validatingKhmer,
              edit: copy.editingAndTranslating,
              add: copy.generatingNewPage,
              reorder: copy.savingPageOrder,
              delete: copy.deletingAndRenumbering,
              retranslate: copy.retranslatingKhmer,
              confirm: copy.confirmingContent,
            }[editor.pending] || copy.processing}
          </div>
        )}

        {editor.notice && (
          <div className="rounded-xl border border-katha-success/20 bg-katha-success/8 p-4 text-sm text-emerald-200">
            {contentLanguage === 'vi' ? editor.notice : copy.actionCompleted}
          </div>
        )}

        {editor.error && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/8 p-4 text-sm text-red-200">
            <p>{contentLanguage === 'vi' ? editor.error : copy.genericError}</p>
            {(editor.blocked || editor.validationFailed) && (
              <button
                type="button"
                onClick={
                  editor.blocked
                    ? () => void editor.refresh()
                    : editor.retryKhmerValidation
                }
                className="mt-3 rounded-lg bg-katha-text px-3 py-1.5 text-xs font-semibold text-katha-surface"
              >
                {editor.blocked ? copy.checkStateAgain : copy.retryKhmerValidation}
              </button>
            )}
          </div>
        )}

        {editable && !isMobileCompact && (
          <section className="grid gap-6 rounded-2xl border border-katha-text/10 bg-katha-text/[0.02] p-5 sm:p-7 lg:grid-cols-2">
            <QuickActions
              disabled={disabled}
              onAction={(action) => void editor.runQuickAction(action)}
            />
            <InstructionBox disabled={disabled} onSubmit={editor.runInstruction} />
          </section>
        )}

        <section>
          <SortablePageList
            pages={text.pages}
            disabled={disabled || isMobileCompact}
            canDelete={text.pages.length > minimum && !isMobileCompact}
            onReorder={(ids) => void editor.reorder(ids)}
            onDelete={(page) => setDeleteTarget(page)}
            onRetranslate={(pageId) => void editor.retranslate('page', pageId)}
          />
        </section>

        {editable && !isMobileCompact && (
          <div className="space-y-5">
            <AddPageButton
              disabled={disabled}
              atMaximum={text.pages.length >= maximum}
              onAdd={editor.addPage}
            />
          </div>
        )}

        {deleteTarget && (
          <DeletePageDialog
            pageNo={deleteTarget.page_no}
            pending={editor.pending === 'delete'}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
              void editor.removePage(deleteTarget.id).then((success) => {
                if (success) setDeleteTarget(null);
              });
            }}
          />
        )}

        {confirmOpen && (
          <ConfirmTextDialog
            pageCount={text.pages.length}
            warningCount={warnings}
            unvalidatedCount={unvalidated}
            pending={isConfirmingAndPreparing}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={(acknowledge) => {
              void handleConfirmAndPrepare(acknowledge);
            }}
          />
        )}

        {isVisionLesson && (
          <LearningJourneyControls
            language={contentLanguage}
            onReset={resetLearningJourney}
            disabled={Boolean(editor.pending || editor.blocked || isConfirmingAndPreparing)}
            className="border-t border-katha-text/10 pt-5"
          />
        )}
      </div>
    </StoryWorkflowShell>
  );
}

function VisionLearningProgress({
  enabled,
  language,
}: {
  enabled: boolean;
  language: 'vi' | 'km';
}) {
  if (!enabled) return null;

  return (
    <div className="katha-card rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-lg backdrop-blur-xl sm:p-5">
      <LearningProgressBar currentStep={3} stepProgress={0} language={language} />
    </div>
  );
}

function EditorMessage({
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
      {detail && <p className="mt-3 text-sm text-katha-text/50">{detail}</p>}
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

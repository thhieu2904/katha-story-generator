'use client';

import Link from 'next/link';
import { getStoryWorkflowHref } from '../routes';
import type { StoryListItem as StoryListItemType } from '../types';
import { ArchiveStoryDialog } from './ArchiveStoryDialog';
import { useState } from 'react';
import { useContentLanguage } from '@/features/language/useContentLanguage';
import { useUiCopy } from '@/features/language/useUiCopy';
import { hasVisionLearningContextInDescription } from '@/features/learning/visionStoryDraft';

interface StoryListItemProps {
  story: StoryListItemType;
  onArchiveSuccess: () => void;
}

export function StoryListItem({ story, onArchiveSuccess }: StoryListItemProps) {
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const { language: contentLanguage } = useContentLanguage();
  const { copy } = useUiCopy();

  const statusLabels: Record<string, string> = {
    draft: copy.statusDraft,
    generating_text: copy.statusGeneratingText,
    text_draft: copy.statusTextDraft,
    text_confirmed: copy.statusTextConfirmed,
    generating_images: copy.statusGeneratingImages,
    pending_review: copy.statusPendingReview,
    approved: copy.statusApproved,
    published: copy.statusPublished,
    archived: copy.statusArchived,
  };
  const ageLabels: Record<string, string> = {
    preschool: copy.preschool,
    early_primary: copy.earlyPrimary,
    late_primary: copy.latePrimary,
  };
  const lengthLabels: Record<string, string> = {
    short: copy.shortLength,
    medium: copy.mediumLength,
    long: copy.longLength,
  };

  const title =
    contentLanguage === 'km'
      ? story.title_km || story.title_vi || copy.untitledStory
      : story.title_vi || story.title_km || copy.untitledStory;
  const ageLabel = story.target_age ? ageLabels[story.target_age] : copy.unknownValue;
  const lengthLabel = story.length_pref ? lengthLabels[story.length_pref] : copy.unknownValue;
  const statusLabel = statusLabels[story.status] || story.status;
  const workflowHref = getStoryWorkflowHref(story.route_key, story.status, story.image_workflow_kind);
  const workflowLabel = (() => {
    switch (story.status) {
      case 'draft':
        return copy.resumeSetup;
      case 'generating_text':
        return copy.viewTextProgress;
      case 'text_draft':
        return copy.continueEditing;
      case 'text_confirmed':
        return copy.prepareIllustrations;
      case 'generating_images':
        return story.image_workflow_kind === 'review_regeneration'
          ? copy.viewRedrawProgress
          : copy.viewImageProgress;
      case 'pending_review':
        return copy.readyToReview;
      case 'approved':
        return copy.statusApproved;
      case 'published':
        return copy.manageSharing;
      default:
        return copy.viewStory;
    }
  })();
  const hasVisionLesson = hasVisionLearningContextInDescription(story.description_vi);
  const canOpenReader = ['pending_review', 'approved', 'published'].includes(story.status);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
      case 'generating_text':
        return 'bg-violet-500/15 text-violet-300 border-violet-500/20';
      case 'text_draft':
      case 'text_confirmed':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/20';
      case 'generating_images':
      case 'pending_review':
        return 'bg-katha-primary/15 text-katha-primary-light border-katha-primary/20';
      case 'approved':
      case 'published':
        return 'bg-katha-success/15 text-emerald-300 border-katha-success/20';
      case 'archived':
        return 'bg-slate-500/15 text-slate-300 border-slate-500/20';
      default:
        return 'bg-katha-text/10 text-katha-text/70 border-katha-text/10';
    }
  };

  const formattedDate = story.created_at
    ? new Date(story.created_at).toLocaleDateString(contentLanguage === 'km' ? 'km-KH' : 'vi-VN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <>
      <div className="katha-card flex flex-col overflow-hidden rounded-2xl border border-katha-text/10 bg-katha-text/[0.035] transition hover:-translate-y-1 hover:border-katha-text/20 hover:bg-katha-text/[0.055]">
        <div className="flex-1 p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3
              lang={contentLanguage}
              className={`text-lg font-semibold leading-tight line-clamp-1 ${
                contentLanguage === 'km' ? 'font-khmer' : ''
              }`}
            >
              {title}
            </h3>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getStatusColor(story.status)}`}>
              {statusLabel}
            </span>
          </div>

          <p className="text-sm text-katha-text/60 line-clamp-2 min-h-[2.5rem]">
            {story.description_vi || copy.noDescription}
          </p>

          <div className="flex flex-wrap gap-2 text-xs text-katha-text/45">
            <span className="rounded-md bg-katha-text/[0.06] px-2 py-1">
              {copy.age}: {ageLabel}
            </span>
            <span className="rounded-md bg-katha-text/[0.06] px-2 py-1">
              {copy.length}: {lengthLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-katha-text/10 bg-katha-field p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-xs text-katha-text/40">{formattedDate}</span>
            {hasVisionLesson && canOpenReader && (
              <Link
                href={`/admin/vision?story=${story.route_key}`}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-katha-primary/25 bg-katha-primary/10 px-3 text-xs font-semibold text-katha-primary-light transition hover:bg-katha-primary/20"
              >
                <span aria-hidden="true">↻</span>
                {copy.relearn}
              </Link>
            )}
          </div>

          <div className="flex gap-2">
            {story.status === 'draft' ? (
              <>
                <button
                  onClick={() => setIsArchiveDialogOpen(true)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-katha-text/50 transition hover:bg-katha-text/10 hover:text-katha-text"
                >
                  {copy.archive}
                </button>
                <Link
                  href={workflowHref}
                  className="rounded-lg bg-katha-primary px-3 py-1.5 text-xs font-medium text-katha-text transition hover:bg-katha-primary-light"
                >
                  {workflowLabel}
                </Link>
              </>
            ) : story.status !== 'archived' ? (
              <Link
                href={workflowHref}
                className="rounded-lg bg-katha-primary px-3 py-1.5 text-xs font-medium text-katha-text transition hover:bg-katha-primary-light"
              >
                {workflowLabel}
              </Link>
            ) : (
              <span className="text-xs text-katha-text/50">{statusLabel}</span>
            )}
          </div>
        </div>
      </div>

      {isArchiveDialogOpen && (
        <ArchiveStoryDialog
          storyId={story.id}
          storyTitle={title}
          onClose={() => setIsArchiveDialogOpen(false)}
          onSuccess={() => {
            setIsArchiveDialogOpen(false);
            onArchiveSuccess();
          }}
        />
      )}
    </>
  );
}

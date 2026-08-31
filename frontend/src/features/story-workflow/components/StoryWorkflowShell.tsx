import React from 'react';
import type { StoryRouteKey } from '@/features/stories/types';
import { getWorkflowPresentation } from '../workflow';
import { StoryWorkflowStepper } from './StoryWorkflowStepper';
import { WorkflowActionBar } from './WorkflowActionBar';
import { WorkflowHeader } from './WorkflowHeader';

interface StoryWorkflowShellProps {
  storyKey?: StoryRouteKey;
  storyTitle?: string;
  status?: string;
  imageWorkflowKind?: string | null;
  children: React.ReactNode;
  actionBar?: React.ReactNode;
  showWorkflowStepper?: boolean;
}

export function StoryWorkflowShell({
  storyKey,
  storyTitle,
  status,
  imageWorkflowKind,
  children,
  actionBar,
  showWorkflowStepper = true,
}: StoryWorkflowShellProps) {
  // Default to Step 1 'draft' presentation if no key/status provided
  const presentation = getWorkflowPresentation((storyKey || 's1_UkLWZg9D') as StoryRouteKey, status || 'draft', imageWorkflowKind);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-8 sm:px-8 sm:pt-12">
      <WorkflowHeader storyTitle={storyTitle} />

      {showWorkflowStepper && presentation && presentation.showStepper && (
        <StoryWorkflowStepper
          presentation={presentation}
          storyKey={storyKey}
        />
      )}

      <main>{children}</main>

      {actionBar && <WorkflowActionBar>{actionBar}</WorkflowActionBar>}
    </div>
  );
}

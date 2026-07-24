import React from 'react';
import { getWorkflowPresentation } from '../workflow';
import { StoryWorkflowStepper } from './StoryWorkflowStepper';
import { WorkflowActionBar } from './WorkflowActionBar';
import { WorkflowHeader } from './WorkflowHeader';

interface StoryWorkflowShellProps {
  storyId?: number;
  storyTitle?: string;
  status?: string;
  children: React.ReactNode;
  actionBar?: React.ReactNode;
}

export function StoryWorkflowShell({
  storyId,
  storyTitle,
  status,
  children,
  actionBar,
}: StoryWorkflowShellProps) {
  // If storyId/status is absent (e.g. /new), default to Step 1 'draft' presentation for /new page
  const presentation = getWorkflowPresentation(storyId || 0, status || 'draft');

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-8 sm:px-8 sm:pt-12">
      <WorkflowHeader storyTitle={storyTitle} />

      {presentation && presentation.showStepper && (
        <StoryWorkflowStepper
          presentation={presentation}
          storyId={storyId}
        />
      )}

      <main>{children}</main>

      {actionBar && <WorkflowActionBar>{actionBar}</WorkflowActionBar>}
    </div>
  );
}

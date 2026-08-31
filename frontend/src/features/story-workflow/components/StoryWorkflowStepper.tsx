'use client';

import Link from 'next/link';
import { formatCopy } from '@/features/language/uiCopy';
import { useUiCopy } from '@/features/language/useUiCopy';
import type { StoryRouteKey } from '@/features/stories/types';
import type { WorkflowPresentation } from '../types';
import { WORKFLOW_STEPS } from '../types';

interface StoryWorkflowStepperProps {
  presentation: WorkflowPresentation;
  storyKey?: StoryRouteKey;
}

export function StoryWorkflowStepper({
  presentation,
  storyKey,
}: StoryWorkflowStepperProps) {
  const { copy } = useUiCopy();
  const { currentStep, stepStates, allowedReadOnlyHrefs } = presentation;
  const allCompleted = WORKFLOW_STEPS.every((s) => stepStates[s.key] === 'completed');

  const currentStepObj = WORKFLOW_STEPS.find((s) => s.number === currentStep);

  const getStepHref = (stepKey: string, stepNumber: number) => {
    if (!storyKey) return undefined;
    if (stepNumber === currentStep) return presentation.canonicalHref;
    if (stepStates[stepKey as keyof typeof stepStates] === 'completed') {
      const candidateHref =
        stepKey === 'setup'
          ? `/admin/stories/${storyKey}/setup`
          : stepKey === 'text'
            ? `/admin/stories/${storyKey}/edit`
            : stepKey === 'images'
              ? `/admin/stories/${storyKey}/images`
              : undefined;

      if (candidateHref && allowedReadOnlyHrefs.includes(candidateHref)) {
        return candidateHref;
      }
    }
    return undefined;
  };

  const stepLabels = {
    setup: copy.stepSetup,
    text: copy.stepText,
    images: copy.stepImages,
    review: copy.stepReview,
  };

  return (
    <nav aria-label={copy.workflowProgress} className="mb-8">
      {/* Mobile compact stepper (width < 768px OR height < 600px) */}
      <div className="show-only-on-mobile-compact flex items-center justify-between rounded-xl border border-katha-text/10 bg-katha-surface/80 p-3 text-xs text-katha-text">
        <div className="flex items-center gap-2 font-medium">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-katha-primary text-xs text-katha-text">
            {currentStep}
          </span>
          <span>
            {formatCopy(copy.workflowStep, {
              step: currentStep,
              label: currentStepObj ? stepLabels[currentStepObj.key] : '',
            })}
          </span>
        </div>
      </div>

      {/* Desktop horizontal stepper (width >= 768px AND height >= 600px) */}
      <ol className="hide-on-mobile-compact flex items-center justify-between w-full relative">
        {WORKFLOW_STEPS.map((step, index) => {
          const state = stepStates[step.key];
          const isCurrent = step.number === currentStep;
          const isCompleted = state === 'completed';
          const isLocked = state === 'locked';
          const href = getStepHref(step.key, step.number);

          const StepContent = (
            <div className="flex items-center gap-3 relative z-10 bg-katha-surface px-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-katha-success text-katha-text'
                    : isCurrent
                      ? 'bg-katha-primary text-katha-text ring-4 ring-katha-primary/20'
                      : isLocked
                        ? 'bg-katha-text/10 text-katha-text/40'
                        : 'border border-katha-text/20 text-katha-text/40 bg-katha-text/5'
                }`}
              >
                {isCompleted ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isLocked ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : (
                  step.number
                )}
              </span>
              <span
                className={`text-sm font-medium ${
                  isCurrent
                    ? 'text-katha-text font-bold'
                    : isCompleted
                      ? 'text-emerald-300'
                      : 'text-katha-text/40'
                }`}
              >
                {stepLabels[step.key]}
              </span>
            </div>
          );

          return (
            <li
              key={step.key}
              aria-current={isCurrent && !allCompleted ? 'step' : undefined}
              className="flex-1 flex items-center relative"
            >
              {index > 0 && (
                <div
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 -z-0 ${
                    index < currentStep
                      ? 'bg-katha-success/60'
                      : 'bg-katha-text/10'
                  }`}
                />
              )}
              {href ? (
                <Link
                  href={href}
                  className="hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-katha-primary rounded-lg"
                >
                  {StepContent}
                </Link>
              ) : (
                StepContent
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

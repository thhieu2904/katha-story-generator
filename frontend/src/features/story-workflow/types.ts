export type WorkflowStepKey = 'setup' | 'text' | 'images' | 'review';

export interface WorkflowStep {
  key: WorkflowStepKey;
  number: 1 | 2 | 3 | 4;
  label: string;
}

export const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  { key: 'setup', number: 1, label: 'Thiết lập' },
  { key: 'text', number: 2, label: 'Nội dung' },
  { key: 'images', number: 3, label: 'Minh họa' },
  { key: 'review', number: 4, label: 'Duyệt & xuất bản' },
] as const;

export type WorkflowStepState = 'completed' | 'current' | 'locked' | 'future';

export interface WorkflowPresentation {
  currentStep: 1 | 2 | 3 | 4;
  currentKey: WorkflowStepKey;
  stepStates: Record<WorkflowStepKey, WorkflowStepState>;
  canonicalHref: string;
  allowedReadOnlyHrefs: string[];
  resumeLabel: string;
  showStepper: boolean;
}

export type WorkflowRouteMode = 'current' | 'historical_readonly' | 'redirect';

export type WorkflowTransitionResult<T> =
  | { kind: 'success'; canonical: T; nextHref: string }
  | { kind: 'partial'; canonical: T; message: string; nextHref: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'failed'; message: string };

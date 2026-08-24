import React from 'react';

interface WorkflowStateMessageProps {
  variant: 'info' | 'success' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

const variantStyles = {
  info: 'bg-katha-primary/10 border-katha-primary/30 text-katha-text',
  success: 'bg-katha-success/10 border-katha-success/30 text-emerald-200',
  warning: 'bg-katha-warning/10 border-katha-warning/30 text-amber-200',
  error: 'bg-katha-error/10 border-katha-error/30 text-rose-200',
};

export function WorkflowStateMessage({
  variant,
  message,
  action,
}: WorkflowStateMessageProps) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${variantStyles[variant]}`}
    >
      <span>{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="rounded-lg bg-katha-text/10 px-3 py-1.5 font-medium text-katha-text hover:bg-katha-text/20 disabled:opacity-50 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

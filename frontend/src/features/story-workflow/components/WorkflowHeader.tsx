import Link from 'next/link';

interface WorkflowHeaderProps {
  storyTitle?: string;
}

export function WorkflowHeader({ storyTitle }: WorkflowHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <Link
        href="/admin/stories"
        className="text-sm font-medium text-katha-text/70 hover:text-katha-text transition-colors"
      >
        ← Quay lại danh sách
      </Link>
      {storyTitle && (
        <h1 className="text-lg font-semibold text-katha-text truncate max-w-md">
          {storyTitle}
        </h1>
      )}
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { StoryTextPage, StoryRouteKey } from '@/features/stories/types';
import { useStoryByRouteKey } from '@/features/stories/useStory';
import { LENGTH_LABELS, STATUS_LABELS } from '@/features/stories/constants';
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

export function StoryTextEditor({ storyKey }: { storyKey: StoryRouteKey }) {
  const { story, loading: storyLoading, error: fetchError, retry } = useStoryByRouteKey(storyKey);

  if (storyLoading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <div className="space-y-6 animate-pulse">
          <div className="h-40 rounded-2xl bg-white/[0.05]" />
          <div className="h-72 rounded-2xl bg-white/[0.04]" />
        </div>
      </StoryWorkflowShell>
    );
  }

  if (fetchError || !story || !story.id) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage
          title="Không thể tải truyện"
          detail={fetchError || undefined}
          onRetry={retry}
        />
      </StoryWorkflowShell>
    );
  }

  return <StoryTextEditorInner storyId={story.id} storyKey={storyKey} />;
}

function StoryTextEditorInner({
  storyId,
  storyKey,
}: {
  storyId: number;
  storyKey: StoryRouteKey;
}) {
  const router = useRouter();
  const editor = useStoryEditor(storyId);
  const isMobileCompact = useIsMobileCompact();
  const [deleteTarget, setDeleteTarget] = useState<StoryTextPage | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isConfirmingAndPreparing, setIsConfirmingAndPreparing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const status = editor.story?.status;
    if (!status) return;
    const presentation = getWorkflowPresentation(storyKey, status, editor.story?.image_workflow_kind);
    const routeMode = getWorkflowRouteMode(
      presentation,
      `/admin/stories/${storyKey}/edit`
    );

    if (routeMode === 'redirect') {
      router.replace(presentation.canonicalHref);
    }
  }, [editor.story?.status, router, storyKey]);

  if (editor.loading) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <div className="space-y-6 animate-pulse">
          <div className="h-40 rounded-2xl bg-white/[0.05]" />
          <div className="h-72 rounded-2xl bg-white/[0.04]" />
        </div>
      </StoryWorkflowShell>
    );
  }

  if (!editor.story) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage
          title="Không thể tải truyện"
          detail={editor.error || undefined}
          onRetry={() => void editor.refresh()}
        />
      </StoryWorkflowShell>
    );
  }

  if (editor.story.status === 'generating_text') {
    return (
      <StoryWorkflowShell
        storyKey={storyKey}
        storyTitle={editor.story.title_vi || 'Truyện chưa đặt tên'}
        status={editor.story.status}
        imageWorkflowKind={editor.story.image_workflow_kind}
      >
        <EditorMessage
          title="Đang sinh nội dung song ngữ…"
          detail="Hệ thống đang sinh nội dung và bản dịch. Trạng thái sẽ tự động cập nhật."
        />
      </StoryWorkflowShell>
    );
  }

  if (editor.story.status === 'draft') {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" />
      </StoryWorkflowShell>
    );
  }

  if (editor.story.status === 'archived') {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage title="Truyện đã được lưu trữ" />
      </StoryWorkflowShell>
    );
  }

  const { text } = editor;
  if (!text) {
    return (
      <StoryWorkflowShell storyKey={storyKey}>
        <EditorMessage
          title="Không có nội dung để hiển thị"
          detail={editor.error || undefined}
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
      <div className="text-xs text-white/50 hidden sm:block">
        {text.pages.length} trang · {LENGTH_LABELS[text.length_pref] || text.length_pref}
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setConfirmOpen(true)}
          className="rounded-xl bg-katha-primary px-5 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-katha-primary-light disabled:opacity-40"
        >
          {isConfirmingAndPreparing
            ? 'Đang chuẩn bị minh họa…'
            : 'Xác nhận và chuẩn bị minh họa'}
        </button>
      </div>
    </>
  ) : (
    <div className="text-xs text-white/50">
      Nội dung đã được xác nhận và ở chế độ chỉ đọc.
    </div>
  );

  return (
    <StoryWorkflowShell
      storyKey={storyKey}
      storyTitle={text.title_vi || 'Truyện chưa đặt tên'}
      status={text.status}
      imageWorkflowKind={editor.story.image_workflow_kind}
      actionBar={actionBar}
    >
      <div className="space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
                <span className="rounded-full border border-white/10 px-2.5 py-1">
                  {STATUS_LABELS[text.status] || text.status}
                </span>
                <span>{text.pages.length} trang</span>
                <span>·</span>
                <span>{LENGTH_LABELS[text.length_pref] || text.length_pref}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {text.title_vi}
              </h1>
              <p className="text-khmer mt-3 text-xl leading-9 text-white/65">
                {text.title_km}
              </p>
            </div>
            {editable && !isMobileCompact && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => void editor.retranslate('title')}
                className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/80 hover:text-white transition disabled:opacity-40"
              >
                Dịch lại tiêu đề Khmer
              </button>
            )}
          </div>

          {/* Page anchor navigator compact (P1 feature) */}
          {text.pages.length > 1 && (
            <nav
              aria-label="Điều hướng nhanh trang"
              className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4"
            >
              <span className="text-xs text-white/45 mr-1">Chuyển nhanh:</span>
              {text.pages.map((p) => (
                <a
                  key={p.id}
                  href={`#page-${p.page_no}`}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/15 hover:text-white transition"
                >
                  Trang {p.page_no}
                </a>
              ))}
            </nav>
          )}
        </header>

        {!editable && (
          <div className="rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
            Nội dung đã được xác nhận và đang ở chế độ chỉ đọc.
          </div>
        )}

        {isMobileCompact && editable && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
            💡 Mở trên tablet hoặc máy tính (tối thiểu 768×600) để sử dụng các công cụ biên tập AI và sắp xếp trang chi tiết.
          </div>
        )}

        {actionError && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/10 p-4 text-sm text-rose-200">
            {actionError}
          </div>
        )}

        {editor.pending && (
          <div className="rounded-xl border border-katha-primary/25 bg-katha-primary/10 p-4 text-sm text-katha-primary-light">
            {pendingLabel(editor.pending)}
          </div>
        )}

        {editor.notice && (
          <div className="rounded-xl border border-katha-success/20 bg-katha-success/8 p-4 text-sm text-emerald-200">
            {editor.notice}
          </div>
        )}

        {editor.error && (
          <div className="rounded-xl border border-katha-error/25 bg-katha-error/8 p-4 text-sm text-red-200">
            <p>{editor.error}</p>
            {(editor.blocked || editor.validationFailed) && (
              <button
                type="button"
                onClick={
                  editor.blocked
                    ? () => void editor.refresh()
                    : editor.retryKhmerValidation
                }
                className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-katha-surface"
              >
                {editor.blocked ? 'Kiểm tra lại trạng thái' : 'Thử lại kiểm tra Khmer'}
              </button>
            )}
          </div>
        )}

        {editable && !isMobileCompact && (
          <section className="grid gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7 lg:grid-cols-2">
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
      </div>
    </StoryWorkflowShell>
  );
}

function pendingLabel(pending: string) {
  const labels: Record<string, string> = {
    validate: 'Đang kiểm tra kỹ thuật Khmer…',
    edit: 'Đang biên tập và đồng bộ bản dịch…',
    add: 'Đang sinh trang mới…',
    reorder: 'Đang lưu thứ tự trang…',
    delete: 'Đang xóa và đánh lại số trang…',
    retranslate: 'Đang dịch lại Khmer…',
    confirm: 'Đang xác nhận nội dung…',
  };
  return labels[pending] || 'Đang xử lý…';
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
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      {detail && <p className="mt-3 text-sm text-white/50">{detail}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-katha-surface"
        >
          Thử lại
        </button>
      )}
    </section>
  );
}
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { StoryTextPage } from '@/features/stories/types';
import { LENGTH_LABELS, STATUS_LABELS } from '@/features/stories/constants';
import { BAND_LIMITS } from '../constants';
import { useStoryEditor } from '../useStoryEditor';
import { AddPageButton } from './AddPageButton';
import { ConfirmTextDialog } from './ConfirmTextDialog';
import { DeletePageDialog } from './DeletePageDialog';
import { InstructionBox } from './InstructionBox';
import { QuickActions } from './QuickActions';
import { SortablePageList } from './SortablePageList';

export function StoryTextEditor({ storyId }: { storyId: number }) {
  const router = useRouter();
  const editor = useStoryEditor(storyId);
  const [deleteTarget, setDeleteTarget] = useState<StoryTextPage | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (editor.story?.status === 'draft') {
      router.replace(`/admin/stories/${storyId}/setup`);
    }
  }, [editor.story?.status, router, storyId]);

  if (editor.loading) return <EditorSkeleton />;
  if (!editor.story) {
    return <EditorMessage title="Không thể tải truyện" detail={editor.error || undefined} onRetry={() => void editor.refresh()} />;
  }
  if (editor.story.status === 'generating_text') {
    return (
      <EditorMessage
        title="Đang sinh nội dung song ngữ…"
        detail={editor.error || 'Trang tự kiểm tra trạng thái sau mỗi 3 giây.'}
      />
    );
  }
  if (editor.story.status === 'draft') return <EditorSkeleton />;
  if (editor.story.status === 'archived') {
    return <EditorMessage title="Truyện đã được lưu trữ" />;
  }
  if (!editor.text) {
    return (
      <EditorMessage
        title="Không thể tải nội dung truyện"
        detail={editor.error || undefined}
        onRetry={() => void editor.refresh()}
      />
    );
  }

  const text = editor.text;
  const editable = text.status === 'text_draft';
  const disabled = Boolean(editor.pending || editor.blocked || !editable);
  const [minimum, maximum] = BAND_LIMITS[text.length_pref] || [0, 16];
  const warnings = text.pages.reduce((total, page) => total + page.spellcheck_flags.length, 0);
  const unvalidated = text.pages.filter((page) => page.khmer_validated_at === null).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/stories" className="text-sm text-white/50 hover:text-white">&larr; Quay lại danh sách</Link>
        <Link href={`/admin/stories/${storyId}/setup`} className="text-sm text-white/50 hover:text-white">Xem thiết lập</Link>
      </div>

      <header className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
              <span className="rounded-full border border-white/10 px-2.5 py-1">{STATUS_LABELS[text.status] || text.status}</span>
              <span>{text.pages.length} trang</span>
              <span>·</span>
              <span>{LENGTH_LABELS[text.length_pref] || text.length_pref}</span>
              <span>· revision {text.text_revision}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title_vi}</h1>
            <p className="text-khmer mt-3 text-xl leading-9 text-white/65">{text.title_km}</p>
          </div>
          {editable && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void editor.retranslate('title')}
              className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40"
            >
              Dịch lại Khmer
            </button>
          )}
        </div>
      </header>

      {!editable && (
        <div className="mt-6 rounded-xl border border-katha-success/25 bg-katha-success/10 p-4 text-sm text-emerald-200">
          Nội dung đã được xác nhận và đang ở chế độ chỉ đọc. Phase này chưa sinh ảnh.
        </div>
      )}
      {editor.pending && (
        <div className="mt-6 rounded-xl border border-katha-primary/25 bg-katha-primary/10 p-4 text-sm text-katha-primary-light">
          {pendingLabel(editor.pending)}
        </div>
      )}
      {editor.notice && <div className="mt-6 rounded-xl border border-katha-success/20 bg-katha-success/8 p-4 text-sm text-emerald-200">{editor.notice}</div>}
      {editor.error && (
        <div className="mt-6 rounded-xl border border-katha-error/25 bg-katha-error/8 p-4 text-sm text-red-200">
          <p>{editor.error}</p>
          {(editor.blocked || editor.validationFailed) && (
            <button
              type="button"
              onClick={editor.blocked ? () => void editor.refresh() : editor.retryKhmerValidation}
              className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-katha-surface"
            >
              {editor.blocked ? 'Kiểm tra lại trạng thái' : 'Thử lại kiểm tra Khmer'}
            </button>
          )}
        </div>
      )}

      {editable && (
        <section className="mt-7 grid gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-7 lg:grid-cols-2">
          <QuickActions disabled={disabled} onAction={(action) => void editor.runQuickAction(action)} />
          <InstructionBox disabled={disabled} onSubmit={editor.runInstruction} />
        </section>
      )}

      <section className="mt-8">
        <SortablePageList
          pages={text.pages}
          disabled={disabled}
          canDelete={text.pages.length > minimum}
          onReorder={(ids) => void editor.reorder(ids)}
          onDelete={(page) => setDeleteTarget(page)}
          onRetranslate={(pageId) => void editor.retranslate('page', pageId)}
        />
      </section>

      {editable && (
        <div className="mt-6 space-y-5">
          <AddPageButton disabled={disabled} atMaximum={text.pages.length >= maximum} onAdd={editor.addPage} />
          <div className="flex justify-end border-t border-white/10 pt-6">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg bg-katha-primary px-5 py-3 text-sm font-semibold disabled:opacity-40"
            >
              Xác nhận nội dung
            </button>
          </div>
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
          pending={editor.pending === 'confirm'}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={(acknowledge) => {
            void editor.confirm(acknowledge).then((success) => {
              if (success) setConfirmOpen(false);
            });
          }}
        />
      )}
    </main>
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

function EditorSkeleton() {
  return <main className="mx-auto max-w-5xl px-5 py-12"><div className="h-40 animate-pulse rounded-2xl bg-white/[0.05]" /><div className="mt-6 h-72 animate-pulse rounded-2xl bg-white/[0.04]" /></main>;
}

function EditorMessage({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-10 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {detail && <p className="mt-3 text-sm text-white/50">{detail}</p>}
        {onRetry && <button type="button" onClick={onRetry} className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-katha-surface">Thử lại</button>}
        <div><Link href="/admin/stories" className="mt-5 inline-block text-sm text-white/50">Quay lại danh sách</Link></div>
      </section>
    </main>
  );
}
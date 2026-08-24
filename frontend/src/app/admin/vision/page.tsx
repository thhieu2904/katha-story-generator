'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { classifyImage, type VisionResult } from '@/features/vision/api';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export default function VisionPage() {
  const router = useRouter();
  const [result, setResult] = useState<VisionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  async function handleFile(file: File) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Ảnh vượt quá dung lượng tối đa 10 MB.');
      return;
    }

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const nextPreview = URL.createObjectURL(file);
    previewRef.current = nextPreview;
    setPreviewUrl(nextPreview);
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      setResult(await classifyImage(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể nhận diện hình ảnh.');
    } finally {
      setLoading(false);
    }
  }

  function resetImage() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setLoading(false);
  }

  function startLearning() {
    const storySeed = result?.knowledge?.story_seed;
    if (!storySeed) return;
    router.push(`/admin/stories/new?seed=${encodeURIComponent(storySeed)}`);
  }

  const confidencePercent = result ? Math.round(result.confidence * 100) : 0;

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-8 sm:px-8 lg:py-12">
      <div className="katha-vision-glow pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-katha-accent/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <p className="katha-eyebrow text-xs font-bold uppercase tracking-[0.24em] text-katha-primary-light">
            Vision AI
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-katha-text sm:text-4xl">
            Khám phá văn hóa Khmer qua hình ảnh
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-katha-text/55 sm:text-base">
            Chụp hoặc tải lên một hình ảnh. Katha sẽ nhận diện hiện vật và hiển thị kiến
            thức Khmer tương ứng.
          </p>
        </header>

        <div className={`grid gap-6 ${previewUrl ? 'lg:grid-cols-[0.9fr_1.1fr]' : ''}`}>
          <section className="katha-card rounded-[2rem] border border-katha-text/10 bg-katha-text/[0.035] p-4 shadow-2xl backdrop-blur-xl sm:p-6">
            {!previewUrl ? (
              <div
                className={`flex min-h-[420px] flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-6 text-center transition ${
                  dragActive
                    ? 'border-katha-primary bg-katha-primary/10'
                    : 'border-katha-text/15 bg-katha-field hover:border-katha-text/30'
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const file = event.dataTransfer.files[0];
                  if (file) void handleFile(file);
                }}
              >
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-katha-primary/15 text-katha-primary-light">
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>

                <h2 className="mt-6 text-xl font-semibold text-katha-text">Thêm hình ảnh</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-katha-text/45">
                  Kéo thả ảnh vào đây hoặc chọn một cách bên dưới. JPG, PNG, WEBP — tối
                  đa 10 MB.
                </p>

                <div className="mt-7 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                  <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-katha-primary px-5 text-sm font-bold text-katha-text transition hover:bg-katha-primary-light">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
                    </svg>
                    Tải ảnh lên
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      aria-label="Tải ảnh lên"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>

                  <label className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-katha-text/15 bg-katha-text/[0.04] px-5 text-sm font-semibold text-katha-text transition hover:bg-katha-text/[0.08]">
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M5 7h2l1-2h8l1 2h2a2 2 0 0 1 2 2v9H3V9a2 2 0 0 1 2-2Z" />
                    </svg>
                    Chụp ảnh
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      aria-label="Chụp ảnh"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFile(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="relative min-h-[420px] overflow-hidden rounded-[1.5rem] bg-black/25">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Ảnh đang nhận diện"
                  className="h-full min-h-[420px] w-full object-contain"
                />

                {loading && (
                  <div
                    className="absolute inset-0 grid place-items-center bg-katha-surface/75 backdrop-blur-sm"
                    role="status"
                  >
                    <div className="text-center">
                      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-katha-text/15 border-t-katha-primary" />
                      <p className="mt-4 font-semibold text-katha-text">AI đang nhận diện…</p>
                      <p className="mt-1 text-xs text-katha-text/45">
                        Phân tích hình ảnh văn hóa Khmer
                      </p>
                    </div>
                  </div>
                )}

                {!loading && (
                  <button
                    type="button"
                    onClick={resetImage}
                    className="absolute right-3 top-3 rounded-full border border-katha-text/15 bg-black/60 px-4 py-2 text-xs font-semibold text-katha-text backdrop-blur transition hover:bg-black/80"
                  >
                    Chọn ảnh khác
                  </button>
                )}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-katha-error/25 bg-katha-error/10 px-4 py-3 text-sm text-red-200"
              >
                {error}
              </div>
            )}
          </section>

          {previewUrl && (
            <section className="katha-card rounded-[2rem] border border-katha-text/10 bg-katha-text/[0.035] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              {loading && (
                <div className="space-y-5 animate-pulse" aria-hidden="true">
                  <div className="h-8 w-2/3 rounded-lg bg-katha-text/10" />
                  <div className="h-20 rounded-2xl bg-katha-text/[0.06]" />
                  <div className="h-32 rounded-2xl bg-katha-text/[0.06]" />
                  <div className="h-12 rounded-xl bg-katha-text/[0.06]" />
                </div>
              )}

              {!loading && result && (
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-katha-text/45">
                        Kết quả nhận diện
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          result.class === 'unknown'
                            ? 'bg-katha-warning/15 text-amber-200'
                            : 'bg-katha-success/15 text-emerald-200'
                        }`}
                      >
                        {result.class === 'unknown' ? 'Chưa chắc chắn' : 'Đã nhận diện'}
                      </span>
                    </div>

                    <h2 className="mt-3 text-2xl font-bold capitalize text-katha-text">
                      {result.class === 'unknown'
                        ? 'Không xác định'
                        : result.class.replaceAll('_', ' ')}
                    </h2>

                    <div className="mt-4">
                      <div className="mb-2 flex justify-between text-xs text-katha-text/50">
                        <span>Độ tin cậy</span>
                        <span className="font-semibold text-katha-text/75">
                          {confidencePercent}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-katha-text/10">
                        <div
                          className={`h-full rounded-full ${
                            confidencePercent >= 70 ? 'bg-katha-success' : 'bg-katha-warning'
                          }`}
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {result.knowledge ? (
                    <>
                      <div className="rounded-2xl border border-katha-primary/20 bg-katha-primary/10 p-5">
                        <p lang="km" className="font-khmer text-3xl leading-relaxed text-katha-text">
                          {result.knowledge.khmer}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-katha-accent">
                          {result.knowledge.vietnamese}
                        </p>
                        <p className="mt-1 text-sm text-katha-text/50">
                          Phiên âm: {result.knowledge.transliteration}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-katha-text/80">
                          Ý nghĩa văn hóa
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-katha-text/60">
                          {result.knowledge.cultural_explanation}
                        </p>
                      </div>

                      {result.knowledge.sources.length > 0 && (
                        <div className="border-t border-katha-text/10 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-katha-text/35">
                            Nguồn kiểm chứng
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {result.knowledge.sources.map((source) => (
                              <a
                                key={source.url}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-katha-text/10 bg-katha-text/[0.04] px-3 py-1.5 text-xs text-katha-text/60 transition hover:border-katha-text/20 hover:text-katha-text"
                              >
                                {source.publisher}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={startLearning}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-katha-text px-5 py-3.5 text-sm font-bold text-katha-surface transition hover:bg-katha-text/90"
                      >
                        Bắt đầu học với hình ảnh này
                        <span aria-hidden="true">→</span>
                      </button>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-katha-warning/20 bg-katha-warning/10 p-5">
                      <h3 className="font-semibold text-amber-100">Thử một ảnh rõ hơn</h3>
                      <p className="mt-2 text-sm leading-6 text-katha-text/55">
                        AI chưa đủ tự tin để gắn kiến thức đã kiểm chứng. Hãy chụp gần hơn,
                        đủ sáng và để hiện vật nằm giữa khung hình.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

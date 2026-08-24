'use client';

import { useEffect, useState } from 'react';
import type { Story, StoryCreate, Backbone, Genre, ArtStyle } from '../types';
import type { Character } from '@/features/characters/types';
import { fetchBackbones, fetchGenres, fetchArtStyles } from '../api';
import { fetchCharacters } from '@/features/characters/api';
import { TARGET_AGE_OPTIONS, LENGTH_PREF_OPTIONS, STATUS_LABELS } from '../constants';

interface StorySetupFormProps {
  story?: Story;
  onSubmit?: (data: StoryCreate) => Promise<void>;
  onGenerate?: (data: StoryCreate) => Promise<void>;
  isSubmitting?: boolean;
  isGenerating?: boolean;
  isBlocked?: boolean;
  hideFooterButtons?: boolean;
  onFormChange?: (data: StoryCreate, isValid: boolean) => void;
}

interface FormState {
  description_vi: string;
  character_ids: number[];
  backbone_id: number;
  genre_id: number;
  art_style_id: number;
  target_age: string;
  length_pref: string;
}

interface ThumbnailProps {
  src?: string | null;
  alt: string;
  kind: 'character' | 'art-style';
}

function Thumbnail({ src, alt, kind }: ThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const hasImage = Boolean(src?.trim()) && !failed;

  if (hasImage) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src as string}
        alt={alt}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return kind === 'character' ? (
    <svg
      className="h-8 w-8 text-katha-text/20"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      role="img"
      aria-label={alt}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0"
      />
    </svg>
  ) : (
    <svg
      className="h-8 w-8 text-katha-text/20"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      role="img"
      aria-label={alt}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
      />
    </svg>
  );
}

export function StorySetupForm({
  story,
  onSubmit,
  onGenerate,
  isSubmitting = false,
  isGenerating = false,
  isBlocked = false,
  hideFooterButtons = false,
  onFormChange,
}: StorySetupFormProps) {
  const [configs, setConfigs] = useState<{
    backbones: Backbone[];
    genres: Genre[];
    artStyles: ArtStyle[];
    characters: Character[];
  } | null>(null);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    description_vi: story?.description_vi || '',
    character_ids: story?.character_ids || [],
    backbone_id: story?.backbone_id || 0,
    genre_id: story?.genre_id || 0,
    art_style_id: story?.art_style_id || 0,
    target_age: story?.target_age || TARGET_AGE_OPTIONS[0].value,
    length_pref: story?.length_pref || LENGTH_PREF_OPTIONS[0].value,
  });

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let active = true;

    const doFetch = async () => {
      try {
        const [backbones, genres, artStyles, characters] = await Promise.all([
          fetchBackbones(),
          fetchGenres(),
          fetchArtStyles(),
          fetchCharacters(),
        ]);
        if (!active) return;
        setConfigs({ backbones, genres, artStyles, characters });
        setError(null);
        if (!story) {
          setForm((prev) => ({
            ...prev,
            backbone_id: prev.backbone_id || backbones[0]?.id || 0,
            genre_id: prev.genre_id || genres[0]?.id || 0,
            art_style_id: prev.art_style_id || artStyles[0]?.id || 0,
          }));
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Lỗi tải cấu hình');
        setConfigs(null);
      } finally {
        if (active) setFetched(true);
      }
    };

    doFetch();

    return () => {
      active = false;
    };
  }, [requestId, story]);

  useEffect(() => {
    if (onFormChange) {
      const isValid =
        form.description_vi.trim().length >= 10 &&
        form.character_ids.length >= 2 &&
        form.character_ids.length <= 3 &&
        form.backbone_id > 0 &&
        form.genre_id > 0 &&
        form.art_style_id > 0;
      onFormChange(form, isValid);
    }
  }, [form, onFormChange]);

  const retryLoadConfigs = () => {
    setFetched(false);
    setRequestId((n) => n + 1);
  };

  const isReadOnly = Boolean(story && story.status !== 'draft');
  const isBusy = isSubmitting || isGenerating || isBlocked;
  const controlsDisabled = isReadOnly || isBusy;

  const toggleCharacter = (id: number) => {
    if (controlsDisabled) return;
    setForm((prev) => {
      const isSelected = prev.character_ids.includes(id);
      if (isSelected) {
        return {
          ...prev,
          character_ids: prev.character_ids.filter((cId) => cId !== id),
        };
      }
      if (prev.character_ids.length >= 3) return prev;
      return { ...prev, character_ids: [...prev.character_ids, id] };
    });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (form.description_vi.trim().length < 10) {
      errors.description_vi = 'Mô tả cần ít nhất 10 ký tự';
    }
    if (form.character_ids.length < 2) {
      errors.character_ids = 'Vui lòng chọn ít nhất 2 nhân vật (tối đa 3)';
    }
    if (!form.backbone_id) errors.backbone_id = 'Vui lòng chọn cấu trúc';
    if (!form.genre_id) errors.genre_id = 'Vui lòng chọn thể loại';
    if (!form.art_style_id) errors.art_style_id = 'Vui lòng chọn phong cách ảnh';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (controlsDisabled || !onSubmit) return;
    if (validate()) {
      void onSubmit(form);
    }
  };

  if (!fetched) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-katha-text/[0.055] rounded-2xl w-full" />
        <div className="h-40 bg-katha-text/[0.055] rounded-2xl w-full" />
        <div className="h-20 bg-katha-text/[0.055] rounded-2xl w-full" />
      </div>
    );
  }

  if (error || !configs) {
    return (
      <div className="rounded-2xl border border-katha-error/25 bg-katha-error/8 px-6 py-10 text-center">
        <h2 className="font-semibold text-red-100">Không thể tải dữ liệu cấu hình</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-katha-text/50">{error}</p>
        <button
          type="button"
          onClick={retryLoadConfigs}
          className="mt-5 rounded-xl bg-katha-text px-4 py-2.5 text-sm font-semibold text-katha-surface transition hover:bg-katha-text/90"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <form id="story-setup-form" onSubmit={handleSubmit} className="space-y-10">
      {isReadOnly && (
        <div className="rounded-2xl border border-katha-primary/25 bg-katha-primary/10 p-4 text-center">
          <p className="text-katha-primary-light font-medium">
            Truyện này đang ở trạng thái{' '}
            <strong>{STATUS_LABELS[story?.status || ''] || story?.status}</strong> nên không thể chỉnh sửa thiết lập.
          </p>
        </div>
      )}

      {/* Description */}
      <section>
        <label htmlFor="description_vi" className="block text-sm font-medium mb-3">
          Chủ đề / Mô tả câu chuyện <span className="text-katha-error">*</span>
        </label>
        <textarea
          id="description_vi"
          aria-describedby={validationErrors.description_vi ? 'err-description_vi' : undefined}
          value={form.description_vi}
          onChange={(e) => setForm({ ...form, description_vi: e.target.value })}
          disabled={controlsDisabled}
          placeholder="Nhập mô tả ngắn gọn cho câu chuyện của bạn..."
          className="w-full rounded-xl border border-katha-text/10 bg-katha-text/[0.03] px-4 py-3 text-sm text-katha-text placeholder-white/30 transition focus:border-katha-primary focus:outline-none focus:ring-1 focus:ring-katha-primary disabled:opacity-50 min-h-[120px]"
        />
        {validationErrors.description_vi && (
          <p id="err-description_vi" className="mt-2 text-xs text-katha-error">
            {validationErrors.description_vi}
          </p>
        )}
      </section>

      {/* Characters */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <label className="block text-sm font-medium">
            Nhân vật <span className="text-katha-error">*</span>
          </label>
          <span className="text-xs text-katha-text/50">Đã chọn {form.character_ids.length}/3</span>
        </div>
        {configs.characters.length === 0 && (
          <p className="text-sm text-katha-text/40 italic py-8 text-center">
            Chưa có nhân vật.{' '}
            <a href="/admin/characters" className="text-katha-primary hover:underline">
              Quản lý nhân vật →
            </a>
          </p>
        )}
        {configs.characters.length > 0 && (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            aria-describedby={validationErrors.character_ids ? 'err-character_ids' : undefined}
          >
            {configs.characters.map((char) => {
              const isSelected = form.character_ids.includes(char.id);
              const isDisabled = controlsDisabled || (!isSelected && form.character_ids.length >= 3);
              return (
                <label
                  key={char.id}
                  className={`relative cursor-pointer overflow-hidden rounded-xl border transition flex flex-col focus-within:ring-2 focus-within:ring-katha-primary
                    ${
                      isSelected
                        ? 'border-katha-primary bg-katha-primary/10 ring-1 ring-katha-primary'
                        : 'border-katha-text/10 bg-katha-text/[0.02] hover:border-katha-text/20'
                    }
                    ${isDisabled && !isSelected ? 'opacity-40 cursor-not-allowed' : ''}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCharacter(char.id)}
                    disabled={isDisabled}
                    className="sr-only"
                  />
                  <div className="aspect-[3/4] w-full bg-katha-text/5 flex items-center justify-center">
                    <Thumbnail
                      key={char.ref_image_urls?.[0] || 'no-character-image'}
                      src={char.ref_image_urls?.[0]}
                      alt={char.name}
                      kind="character"
                    />
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-xs font-medium truncate">{char.name}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        {validationErrors.character_ids && (
          <p id="err-character_ids" className="mt-2 text-xs text-katha-error">
            {validationErrors.character_ids}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Backbone */}
        <section>
          <label className="block text-sm font-medium mb-3">
            Cấu trúc truyện <span className="text-katha-error">*</span>
          </label>
          {configs.backbones.length === 0 && (
            <p className="text-sm text-katha-text/40 italic py-4 text-center">
              Chưa có cấu trúc truyện.
            </p>
          )}
          {configs.backbones.length > 0 && (
            <div className="space-y-3">
              {configs.backbones.map((bb) => (
                <label
                  key={bb.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition
                    ${
                      form.backbone_id === bb.id
                        ? 'border-katha-primary bg-katha-primary/10'
                        : 'border-katha-text/10 bg-katha-text/[0.03] hover:bg-katha-text/[0.05]'
                    }
                    ${controlsDisabled ? 'opacity-70 cursor-default' : ''}
                  `}
                >
                  <input
                    type="radio"
                    name="backbone"
                    value={bb.id}
                    checked={form.backbone_id === bb.id}
                    onChange={() =>
                      !controlsDisabled && setForm({ ...form, backbone_id: bb.id })
                    }
                    disabled={controlsDisabled}
                    className="mt-1 h-4 w-4 border-katha-text/20 bg-transparent text-katha-primary focus:ring-katha-primary focus:ring-offset-katha-surface"
                  />
                  <div>
                    <p className="font-medium text-sm">{bb.name_vi}</p>
                    <p className="mt-1 text-xs text-katha-text/50">{bb.description_vi}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          {validationErrors.backbone_id && (
            <p className="mt-2 text-xs text-katha-error">{validationErrors.backbone_id}</p>
          )}
        </section>

        {/* Genre */}
        <section>
          <label className="block text-sm font-medium mb-3">
            Thể loại <span className="text-katha-error">*</span>
          </label>
          {configs.genres.length === 0 && (
            <p className="text-sm text-katha-text/40 italic py-4 text-center">
              Chưa có thể loại.
            </p>
          )}
          {configs.genres.length > 0 && (
            <div className="space-y-3">
              {configs.genres.map((genre) => (
                <label
                  key={genre.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition
                    ${
                      form.genre_id === genre.id
                        ? 'border-katha-primary bg-katha-primary/10'
                        : 'border-katha-text/10 bg-katha-text/[0.03] hover:bg-katha-text/[0.05]'
                    }
                    ${controlsDisabled ? 'opacity-70 cursor-default' : ''}
                  `}
                >
                  <input
                    type="radio"
                    name="genre"
                    value={genre.id}
                    checked={form.genre_id === genre.id}
                    onChange={() =>
                      !controlsDisabled && setForm({ ...form, genre_id: genre.id })
                    }
                    disabled={controlsDisabled}
                    className="mt-1 h-4 w-4 border-katha-text/20 bg-transparent text-katha-primary focus:ring-katha-primary focus:ring-offset-katha-surface"
                  />
                  <div>
                    <p className="font-medium text-sm">{genre.name_vi}</p>
                    <p className="mt-1 text-xs text-katha-text/50">{genre.description_vi}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
          {validationErrors.genre_id && (
            <p className="mt-2 text-xs text-katha-error">{validationErrors.genre_id}</p>
          )}
        </section>
      </div>

      {/* Art Style */}
      <section>
        <label className="block text-sm font-medium mb-3">
          Phong cách ảnh <span className="text-katha-error">*</span>
        </label>
        {configs.artStyles.length === 0 && (
          <p className="text-sm text-katha-text/40 italic py-4 text-center">
            Chưa có phong cách ảnh.
          </p>
        )}
        {configs.artStyles.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {configs.artStyles.map((style) => {
              const isSelected = form.art_style_id === style.id;
              return (
                <label
                  key={style.id}
                  className={`relative cursor-pointer overflow-hidden rounded-xl border transition flex flex-col focus-within:ring-2 focus-within:ring-katha-primary
                    ${
                      isSelected
                        ? 'border-katha-primary bg-katha-primary/10 ring-1 ring-katha-primary'
                        : 'border-katha-text/10 bg-katha-text/[0.02] hover:border-katha-text/20'
                    }
                    ${controlsDisabled ? 'opacity-70 cursor-default' : ''}
                  `}
                >
                  <input
                    type="radio"
                    name="art_style"
                    value={style.id}
                    checked={isSelected}
                    onChange={() =>
                      !controlsDisabled &&
                      setForm({ ...form, art_style_id: style.id })
                    }
                    disabled={controlsDisabled}
                    className="sr-only"
                  />
                  <div className="aspect-[4/3] w-full bg-katha-text/5 flex items-center justify-center">
                    <Thumbnail
                      key={style.sample_image_url || 'no-art-style-image'}
                      src={style.sample_image_url}
                      alt={style.name_vi}
                      kind="art-style"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium">{style.name_vi}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        {validationErrors.art_style_id && (
          <p className="mt-2 text-xs text-katha-error">{validationErrors.art_style_id}</p>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {/* Target Age */}
        <section>
          <label className="block text-sm font-medium mb-3">
            Nhóm tuổi <span className="text-katha-error">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {TARGET_AGE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="target_age"
                  value={opt.value}
                  checked={form.target_age === opt.value}
                  onChange={() =>
                    !controlsDisabled && setForm({ ...form, target_age: opt.value })
                  }
                  disabled={controlsDisabled}
                  className="h-4 w-4 border-katha-text/20 bg-transparent text-katha-primary focus:ring-katha-primary focus:ring-offset-katha-surface"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Length Preference */}
        <section>
          <label className="block text-sm font-medium mb-3">
            Độ dài <span className="text-katha-error">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {LENGTH_PREF_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="length_pref"
                  value={opt.value}
                  checked={form.length_pref === opt.value}
                  onChange={() =>
                    !controlsDisabled && setForm({ ...form, length_pref: opt.value })
                  }
                  disabled={controlsDisabled}
                  className="h-4 w-4 border-katha-text/20 bg-transparent text-katha-primary focus:ring-katha-primary focus:ring-offset-katha-surface"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {!isReadOnly && !hideFooterButtons && (
        <div className="border-t border-katha-text/10 pt-4">
          {isGenerating && (
            <p className="mb-4 text-right text-sm text-katha-primary-light">
              Đang sinh nội dung song ngữ…
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="submit"
              disabled={isBusy}
              className="rounded-lg border border-katha-text/15 px-6 py-2.5 text-sm font-medium text-katha-text transition hover:bg-katha-text/10 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Đang cập nhật...'
                : story
                  ? 'Cập nhật thiết lập'
                  : 'Lưu bản nháp'}
            </button>
            {story && onGenerate && (
              <button
                type="button"
                onClick={() => validate() && onGenerate(form)}
                disabled={isBusy}
                className="rounded-lg bg-katha-primary px-6 py-2.5 text-sm font-medium text-katha-text transition hover:bg-katha-primary-light disabled:opacity-50"
              >
                {isGenerating ? 'Đang sinh nội dung…' : 'Sinh nội dung truyện'}
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}

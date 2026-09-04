'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUiCopy } from '@/features/language/useUiCopy';
import { KHMER_HISTORY_MILESTONES } from '../data/khmerHistoryData';
import styles from './MuseumExperience.module.css';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function KhmerHistoryTimeline() {
  const { copy, language } = useUiCopy();
  const journeyRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const modalViewportScrollRef = useRef<HTMLDivElement>(null);
  const modalContentScrollRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const totalMilestones = KHMER_HISTORY_MILESTONES.length;
  const [activeStep, setActiveStep] = useState(0);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const activeMilestone = KHMER_HISTORY_MILESTONES[activeStep]!;
  const selectedMilestone = KHMER_HISTORY_MILESTONES.find(
    (milestone) => milestone.id === selectedPointId,
  );
  const selectedIndex = selectedMilestone
    ? KHMER_HISTORY_MILESTONES.findIndex((milestone) => milestone.id === selectedMilestone.id)
    : -1;
  const previousMilestone = selectedIndex > 0 ? KHMER_HISTORY_MILESTONES[selectedIndex - 1] : null;
  const nextMilestone =
    selectedIndex >= 0 && selectedIndex < totalMilestones - 1
      ? KHMER_HISTORY_MILESTONES[selectedIndex + 1]
      : null;

  const applyScrollProgress = useCallback(
    (progress: number) => {
      const normalizedProgress = clamp(progress, 0, 1);

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${normalizedProgress})`;
      }

      const step = Math.min(
        totalMilestones - 1,
        Math.floor(normalizedProgress * totalMilestones),
      );
      setActiveStep((previousStep) => (previousStep === step ? previousStep : step));
    },
    [totalMilestones],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    reducedMotionRef.current =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function computeScrollProgress() {
      animationFrameRef.current = null;
      const journey = journeyRef.current;
      if (!journey) return;

      const bounds = journey.getBoundingClientRect();
      const travelDistance = Math.max(journey.offsetHeight - window.innerHeight, 1);
      const distanceTravelled = clamp(-bounds.top, 0, travelDistance);
      applyScrollProgress(distanceTravelled / travelDistance);
    }

    function scheduleScrollProgress() {
      if (animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(computeScrollProgress);
    }

    computeScrollProgress();
    window.addEventListener('scroll', scheduleScrollProgress, { passive: true });
    window.addEventListener('resize', scheduleScrollProgress, { passive: true });
    document.addEventListener('scroll', scheduleScrollProgress, { capture: true, passive: true });

    return () => {
      window.removeEventListener('scroll', scheduleScrollProgress);
      window.removeEventListener('resize', scheduleScrollProgress);
      document.removeEventListener('scroll', scheduleScrollProgress, { capture: true });
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [applyScrollProgress]);

  const closeModal = useCallback(() => {
    if (!selectedPointId || isClosing) return;

    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setSelectedPointId(null);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, reducedMotionRef.current ? 0 : 230);
  }, [isClosing, selectedPointId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }

    if (selectedPointId) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeModal, selectedPointId]);

  useEffect(() => {
    if (!selectedPointId) return;

    if (modalViewportScrollRef.current) modalViewportScrollRef.current.scrollTop = 0;
    if (modalContentScrollRef.current) modalContentScrollRef.current.scrollTop = 0;
    closeButtonRef.current?.focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedPointId]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  function openMilestone(id: string) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setIsClosing(false);
    setSelectedPointId(id);
  }

  function scrollToMilestone(index: number) {
    const journey = journeyRef.current;
    if (!journey) return;

    const bounds = journey.getBoundingClientRect();
    const journeyTop = window.scrollY + bounds.top;
    const travelDistance = Math.max(journey.offsetHeight - window.innerHeight, 1);
    const targetProgress = index === totalMilestones - 1 ? 1 : (index + 0.12) / totalMilestones;

    window.scrollTo({
      top: journeyTop + travelDistance * targetProgress,
      behavior: reducedMotionRef.current ? 'auto' : 'smooth',
    });
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const diffX = e.clientX - pointerStartRef.current.x;
    const diffY = e.clientY - pointerStartRef.current.y;
    pointerStartRef.current = null;

    if (Math.abs(diffX) > 48 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      if (diffX < 0 && activeStep < totalMilestones - 1) {
        scrollToMilestone(activeStep + 1);
      } else if (diffX > 0 && activeStep > 0) {
        scrollToMilestone(activeStep - 1);
      }
    }
  };

  return (
    <section aria-labelledby="museum-history-timeline-title" className="relative w-full bg-katha-surface">
      <div
        ref={journeyRef}
        data-testid="museum-history-journey"
        className="relative"
        style={{ height: `${(totalMilestones + 1) * 100}vh` }}
      >
        <div className="sticky top-0 h-screen min-h-[34rem] overflow-hidden bg-katha-surface text-katha-text supports-[height:100svh]:h-[100svh]">
          <div
            key={`backdrop-${activeMilestone.id}`}
            className={`absolute inset-0 lg:hidden ${styles.stageBackdrop}`}
            aria-hidden="true"
          >
            <Image
              src={activeMilestone.image.src}
              alt=""
              fill
              priority={activeStep === 0}
              sizes="100vw"
              className="scale-[1.02] object-cover opacity-30 saturate-[0.7]"
            />
            <div className={styles.stageThemeVeil} />
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[url('/khmer-kbach-pattern.svg')] bg-[length:32rem] bg-[position:-8rem_110%] bg-no-repeat opacity-[0.035] mix-blend-screen" />

          <header className="absolute inset-x-0 top-0 z-30 border-b border-katha-gold/20 bg-katha-surface/95 px-5 py-4 sm:px-8 sm:py-5 lg:px-12">
            <div className="mx-auto flex max-w-[90rem] items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.27em] text-katha-gold">
                  {copy.museumHistoryEyebrow}
                </p>
                <h2
                  id="museum-history-timeline-title"
                  className="mt-1 max-w-3xl font-serif text-sm font-medium leading-tight text-katha-text sm:text-lg"
                >
                  {copy.museumHistoryTitle}
                </h2>
              </div>
              <p className="shrink-0 text-right text-[0.62rem] font-bold uppercase tracking-[0.2em] text-katha-gold" aria-live="polite">
                <span className="hidden sm:inline">{copy.museumHistoryCurrentStation}&nbsp; </span>
                <span className="text-sm tracking-[0.12em] text-katha-text sm:text-base">
                  {String(activeStep + 1).padStart(2, '0')} / {String(totalMilestones).padStart(2, '0')}
                </span>
              </p>
            </div>
          </header>

          <article
            key={activeMilestone.id}
            data-testid="museum-history-active-stage"
            aria-label={`${activeMilestone.period[language]}: ${activeMilestone.title[language]}`}
            className="absolute inset-0 z-10 flex items-center px-5 pb-24 pt-24 sm:px-8 sm:pb-28 sm:pt-28 lg:px-12 touch-pan-y"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <div className="mx-auto grid w-full max-w-[90rem] items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="relative z-10 lg:col-span-6 lg:pl-[7%]">
                <div className={`flex items-center gap-4 ${styles.stagePeriod}`}>
                  <span className="font-serif text-4xl leading-none text-katha-gold/80 sm:text-5xl" aria-hidden="true">
                    {String(activeStep + 1).padStart(2, '0')}
                  </span>
                  <span className="h-px w-10 bg-katha-gold/45" aria-hidden="true" />
                  <div>
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.25em] text-katha-text/65">
                      {copy.museumHistoryChapterLabel}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-katha-gold sm:text-sm">
                      {activeMilestone.period[language]}
                    </p>
                  </div>
                </div>

                <div className={`-my-[0.16em] mt-5 overflow-hidden py-[0.16em] [perspective:1100px] sm:mt-7 ${styles.titleMask}`}>
                  <h3 className={`${styles.stageTitle} max-w-[14ch] font-serif text-[clamp(2.5rem,5.2vw,5.8rem)] font-medium leading-[1.08] tracking-[-0.035em] text-katha-text`}>
                    {activeMilestone.title[language]}
                  </h3>
                </div>

                {/* Mobile Artifact Showcase Card */}
                <div className="my-3.5 block lg:hidden">
                  <div className={styles.mobileArtifactCard}>
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={activeMilestone.image.src}
                        alt={activeMilestone.image.alt}
                        fill
                        sizes="(max-width: 1024px) 100vw, 0vw"
                        priority={activeStep === 0}
                        className="object-cover saturate-[0.82]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                      <div className="absolute inset-x-3 bottom-2 flex items-center justify-between text-white">
                        <span className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-katha-gold">
                          {activeMilestone.artifacts[language][0]}
                        </span>
                        <span className="font-serif text-[0.7rem] italic text-white/75">
                          {activeMilestone.period[language]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`mt-5 max-w-2xl ${styles.stageSummary}`}>
                  <p className="text-[0.66rem] font-bold uppercase tracking-[0.22em] text-katha-gold sm:text-xs">
                    {activeMilestone.subtitle[language]}
                  </p>
                  <p className="mt-3 line-clamp-4 text-sm leading-7 text-katha-text/70 sm:text-base sm:leading-8 lg:line-clamp-none">
                    {activeMilestone.summary[language]}
                  </p>
                </div>

                <div className={`mt-6 flex flex-wrap items-center gap-5 sm:mt-8 ${styles.stageAction}`}>
                  <button
                    type="button"
                    onClick={() => openMilestone(activeMilestone.id)}
                    aria-label={`${copy.museumHistoryQuickExplore}: ${activeMilestone.title[language]}`}
                    className="group inline-flex min-h-11 items-center gap-5 border-b border-katha-gold text-[0.64rem] font-bold uppercase tracking-[0.2em] text-katha-text transition-colors hover:text-katha-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold focus-visible:ring-offset-4 focus-visible:ring-offset-katha-surface sm:min-h-12"
                  >
                    <span>{copy.museumHistoryQuickExplore}</span>
                    <span className="transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden="true">→</span>
                  </button>

                  <div className="hidden flex-wrap gap-x-5 gap-y-2 xl:flex" aria-label={copy.museumHistoryArtifactCollection}>
                    {activeMilestone.artifacts[language].slice(0, 2).map((artifact, index) => (
                      <span key={artifact} className="text-[0.62rem] uppercase tracking-[0.14em] text-katha-text/55">
                        {String(index + 1).padStart(2, '0')} · {artifact}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <figure className={`relative hidden lg:col-span-6 lg:block ${styles.stageImageReveal}`}>
                <span className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[0.58rem] font-bold uppercase tracking-[0.26em] text-katha-gold/65">
                  {copy.museumHistoryArchiveImage}
                </span>
                <div className="relative ml-auto aspect-[4/5] w-[min(100%,31rem)] border-l border-t border-katha-gold/35 p-3 sm:p-4">
                  <div className="relative h-full overflow-hidden bg-black">
                    <Image
                      src={activeMilestone.image.src}
                      alt={activeMilestone.image.alt}
                      fill
                      priority={activeStep === 0}
                      sizes="(max-width: 1024px) 0vw, 42vw"
                      className={`${styles.stageImageMedia} object-cover saturate-[0.82] transition-transform duration-700 hover:scale-[1.035]`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                    <span className="absolute right-5 top-4 font-serif text-7xl leading-none text-white/30" aria-hidden="true">
                      {String(activeStep + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <figcaption className="absolute inset-x-8 bottom-8 border-l border-katha-gold bg-black/90 px-4 py-3 text-white">
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-katha-gold">
                      {activeMilestone.artifacts[language][0]}
                    </p>
                    <p className="mt-1 line-clamp-2 font-serif text-xs italic leading-5 text-white/75">
                      {activeMilestone.image.alt}
                    </p>
                  </figcaption>
                </div>
              </figure>
            </div>
          </article>

          <div className={`absolute inset-x-0 bottom-4 z-30 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:bottom-8 sm:px-8 sm:pb-4 sm:pt-9 lg:bottom-12 lg:px-12 ${styles.timelineThemeFade}`}>

            <div className="mx-auto max-w-[90rem]">
              <div className="flex items-center justify-between text-[0.58rem] font-bold uppercase tracking-[0.22em] text-katha-gold/75 sm:text-[0.63rem]">
                <span>{copy.museumHistoryPast}</span>
                <span>{copy.museumHistoryPresent}</span>
              </div>
              <div className="relative mt-2 h-px bg-katha-gold/25">
                <div
                  ref={progressBarRef}
                  className="absolute inset-y-0 left-0 w-full origin-left scale-x-0 bg-katha-gold will-change-transform"
                />
                <nav aria-label={copy.museumHistoryTreeAriaLabel} className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
                  {KHMER_HISTORY_MILESTONES.map((milestone, index) => (
                    <button
                      key={milestone.id}
                      type="button"
                      onClick={() => scrollToMilestone(index)}
                      aria-label={`${copy.museumHistoryStagePlaceholder.replace('{stage}', String(index + 1))}: ${milestone.period[language]}`}
                      aria-current={index === activeStep ? 'step' : undefined}
                      className={`grid size-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold ${index === activeStep ? 'bg-katha-surface' : ''}`}
                    >
                      <span
                        className={`block transition-all duration-300 ${index === activeStep ? 'size-2.5 rotate-45 bg-katha-gold' : 'size-1.5 bg-katha-gold/55'}`}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedPointId && selectedMilestone && (
        <div className="fixed inset-0 z-[100] bg-katha-surface">
          <section
            role="dialog"
            data-testid="museum-history-dossier"
            aria-modal="true"
            aria-labelledby="modal-milestone-title"
            aria-describedby="modal-milestone-summary"
            className={`relative h-[100svh] max-h-none w-full max-w-none overflow-hidden bg-katha-surface-light text-katha-text ${isClosing ? `${styles.modalOut} pointer-events-none` : styles.modalIn}`}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 z-30 grid size-11 place-items-center border border-katha-text/25 bg-katha-surface/95 text-xl text-katha-text shadow-lg transition-colors hover:bg-katha-gold hover:text-katha-on-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold sm:right-6 sm:top-6"
              aria-label={copy.museumHistoryClose}
            >
              <span aria-hidden="true">×</span>
            </button>

            <div
              key={selectedMilestone.id}
              ref={modalViewportScrollRef}
              data-testid="museum-history-dossier-viewport"
              className="grid h-full overflow-y-auto overscroll-contain lg:grid-cols-[minmax(24rem,42vw)_minmax(0,1fr)] lg:overflow-hidden"
            >
              <figure className="relative aspect-[16/10] min-h-[18rem] bg-black lg:h-full lg:min-h-0 lg:aspect-auto">
                <Image
                  src={selectedMilestone.image.src}
                  alt={selectedMilestone.image.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-contain saturate-[0.82]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-black/25" />
                <figcaption className="absolute inset-x-5 bottom-5 border-t border-katha-gold/45 pt-4 text-white sm:inset-x-8 sm:bottom-8">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.23em] text-katha-gold">
                    {copy.museumHistoryArchiveImage} · {String(selectedIndex + 1).padStart(2, '0')}
                  </p>
                  <p className="mt-2 max-w-sm font-serif text-sm italic leading-6 text-white/75">
                    {selectedMilestone.image.alt}
                  </p>
                </figcaption>
              </figure>

              <div
                ref={modalContentScrollRef}
                data-testid="museum-history-dossier-content"
                className="flex min-h-full flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-14 xl:px-[clamp(3.5rem,6vw,7rem)]"
              >
                <div className="mx-auto w-full max-w-3xl">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-katha-heritage">
                    {copy.museumHistoryDossierLabel} · {selectedMilestone.period[language]}
                  </p>
                  <h3
                    id="modal-milestone-title"
                    className="mt-4 max-w-[14ch] pr-10 font-serif text-3xl font-medium leading-[1.1] tracking-[-0.03em] sm:text-5xl"
                  >
                    {selectedMilestone.title[language]}
                  </h3>
                  <p className="mt-4 max-w-xl text-xs font-bold uppercase leading-5 tracking-[0.16em] text-katha-heritage">
                    {selectedMilestone.subtitle[language]}
                  </p>

                  <div
                    id="modal-milestone-summary"
                    className="mt-7 max-w-2xl space-y-5 text-sm leading-7 text-katha-text/75 sm:text-base sm:leading-8"
                  >
                    {selectedMilestone.body[language].split('\n\n').map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  <div className="mt-8 border-t border-katha-text/20 pt-5">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-katha-heritage">
                      {copy.museumHistoryArtifactCollection}
                    </p>
                    <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      {selectedMilestone.artifacts[language].map((artifact, index) => (
                        <p key={artifact} className="flex items-start gap-3 text-sm text-katha-text/85">
                          <span className="mt-0.5 font-serif text-katha-gold">{String(index + 1).padStart(2, '0')}</span>
                          <span>{artifact}</span>
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 border-t border-katha-text/20 pt-5">
                    <div className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:gap-6">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.22em] text-katha-heritage">
                        {copy.museumHistorySources}
                      </p>
                      <p className="max-w-lg text-xs leading-5 text-katha-text/60">
                        {copy.museumHistorySourceNote}
                      </p>
                    </div>
                    <div className="mt-4 divide-y divide-katha-text/15 border-y border-katha-text/15">
                      {selectedMilestone.sources.map((source, index) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3 text-katha-text/85 transition-colors hover:text-katha-heritage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-heritage focus-visible:ring-offset-2 focus-visible:ring-offset-katha-surface-light"
                        >
                          <span className="font-serif text-xs text-katha-gold">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-5">
                              {source.title[language]}
                            </span>
                            <span className="mt-0.5 block text-[0.62rem] uppercase tracking-[0.13em] text-katha-text/55">
                              {source.publisher}
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-base transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          >
                            ↗
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                <nav className="mx-auto mt-10 grid w-full max-w-3xl grid-cols-2 gap-6 border-t border-katha-text/20 pt-5 text-xs">
                  <div>
                    {previousMilestone && (
                      <button
                        type="button"
                        onClick={() => openMilestone(previousMilestone.id)}
                        className="group text-left text-katha-text/70 transition-colors hover:text-katha-heritage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-heritage"
                      >
                        <span className="block text-[0.56rem] font-bold uppercase tracking-[0.2em] text-katha-heritage">← {copy.museumHistoryPrevStation}</span>
                        <span className="mt-1 line-clamp-2 font-serif text-sm sm:text-base">{previousMilestone.title[language]}</span>
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    {nextMilestone && (
                      <button
                        type="button"
                        onClick={() => openMilestone(nextMilestone.id)}
                        className="group text-right text-katha-text/70 transition-colors hover:text-katha-heritage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-heritage"
                      >
                        <span className="block text-[0.56rem] font-bold uppercase tracking-[0.2em] text-katha-heritage">{copy.museumHistoryNextStation} →</span>
                        <span className="mt-1 line-clamp-2 font-serif text-sm sm:text-base">{nextMilestone.title[language]}</span>
                      </button>
                    )}
                  </div>
                </nav>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

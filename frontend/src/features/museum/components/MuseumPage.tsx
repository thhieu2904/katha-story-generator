'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import Image from 'next/image';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useUiCopy } from '@/features/language/useUiCopy';
import { KhmerHistoryTimeline } from './KhmerHistoryTimeline';
import styles from './MuseumExperience.module.css';

const THINGLINK_SCENE_URL = 'https://www.thinglink.com/view/scene/2152348158749836132';
const THINGLINK_ACCESSIBLE_URL = `${THINGLINK_SCENE_URL}/accessibility`;

export function MuseumPage() {
  const { copy, language } = useUiCopy();
  const pageRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [is3DActive, setIs3DActive] = useState(false);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    gsap.registerPlugin(ScrollTrigger);

    let lenis: Lenis | null = null;
    let lenisTickerFn: ((time: number) => void) | null = null;

    // Desktop: Lenis smooth scroll synchronized with GSAP ScrollTrigger
    // Mobile/touch: native high-performance touch scrolling is preserved
    if (!isTouch && !prefersReducedMotion) {
      lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      lenisTickerFn = (time: number) => {
        lenis?.raf(time * 1000);
      };
      gsap.ticker.add(lenisTickerFn);
      gsap.ticker.lagSmoothing(0);
    }

    const context = gsap.context(() => {
      if (!prefersReducedMotion) {
        const opening = gsap.timeline({ defaults: { ease: 'power3.out' } });
        opening
          .fromTo(
            '[data-museum-hero-kicker]',
            { autoAlpha: 0, y: 18 },
            { autoAlpha: 1, y: 0, duration: 0.7 },
          )
          .fromTo(
            '[data-museum-title-line]',
            { autoAlpha: 0, yPercent: 115, rotateX: -12, scale: 0.98 },
            { autoAlpha: 1, yPercent: 0, rotateX: 0, scale: 1, duration: 1.05 },
            0.08,
          )
          .fromTo(
            '[data-museum-hero-image]',
            { clipPath: 'inset(12% 8% 16% 18%)', autoAlpha: 0, scale: 1.045 },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              autoAlpha: 1,
              scale: 1,
              duration: 1.25,
            },
            0.18,
          )
          .fromTo(
            '[data-museum-hero-detail]',
            { autoAlpha: 0, y: 24 },
            { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08 },
            0.45,
          );

        // Hero image scrubbed parallax
        gsap.to('[data-museum-hero-image-media]', {
          yPercent: 18,
          scale: 1.08,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        });

        // Hero title scrub
        gsap.to('[data-museum-hero-title]', {
          yPercent: -14,
          autoAlpha: 0.25,
          ease: 'none',
          scrollTrigger: {
            trigger: heroRef.current,
            start: '30% top',
            end: 'bottom top',
            scrub: 0.6,
          },
        });

        // Giant Roman numeral watermark parallax in transition section
        gsap.to('[data-museum-timeline-watermark]', {
          yPercent: 32,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-museum-timeline-transition]',
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.8,
          },
        });
      }
    }, pageRef);

    ScrollTrigger.refresh();

    return () => {
      context.revert();
      if (lenisTickerFn) {
        gsap.ticker.remove(lenisTickerFn);
      }
      if (lenis) {
        lenis.destroy();
      }
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  // IntersectionObserver for reveal-on-scroll animations (matching CulturalIntroPage)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const page = pageRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          } else {
            entry.target.classList.remove('is-revealed');
          }
        });
      },
      { rootMargin: '-10% 0px -10% 0px', threshold: 0.05 },
    );

    const revealElements = page
      ? page.querySelectorAll('.reveal-on-scroll')
      : document.querySelectorAll('.reveal-on-scroll');
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <main ref={pageRef} className="relative bg-katha-surface text-katha-text">
      <section
        ref={heroRef}
        aria-labelledby="museum-title"
        className={`relative min-h-[calc(100vh-4rem)] overflow-hidden bg-katha-surface supports-[height:100svh]:min-h-[calc(100svh-4rem)] ${styles.grain}`}
      >
        <div
          data-museum-hero-image
          className={`absolute inset-y-0 right-0 w-full overflow-hidden md:w-[68%] lg:w-[62%] ${styles.heroImageMask}`}
        >
          <div
            data-museum-hero-image-media
            className={`absolute -inset-[7%] ${styles.heroImageMedia}`}
          >
            <Image
              src="/vision-samples/angkor_wat.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-[58%_center] saturate-[0.72] contrast-[1.06]"
            />
          </div>
          <div className={`absolute inset-0 ${styles.heroThemeVeil}`} />
        </div>

        <div className="pointer-events-none absolute inset-0 z-[1] bg-[url('/khmer-kbach-pattern.svg')] bg-[length:38rem] bg-[position:115%_-4rem] bg-no-repeat opacity-[0.045] mix-blend-screen" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[96rem] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-12 supports-[height:100svh]:min-h-[calc(100svh-4rem)]">
          <div
            data-museum-hero-kicker
            className="flex items-center justify-between gap-5 border-t border-katha-gold/45 pt-4 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-katha-gold sm:text-[0.68rem]"
          >
            <span>{copy.museumEyebrow}</span>
            <span aria-hidden="true">Katha · 01</span>
          </div>

          <div className="flex flex-1 items-center py-12 sm:py-16 lg:py-20">
            <div className="w-full">
              <p
                data-museum-hero-detail
                className="mb-5 max-w-sm text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-katha-text/70 sm:mb-7"
              >
                {copy.museumHeroRangeLabel}
              </p>

              <div data-museum-hero-title className="relative max-w-[75rem]">
                <div className={styles.titleMask}>
                  <h1
                    id="museum-title"
                    data-museum-title-line
                    className={`${styles.titleLine} max-w-[14ch] font-serif text-[clamp(3.25rem,9.4vw,9rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-katha-text`}
                  >
                    {copy.museumTitle}
                  </h1>
                </div>
                <span
                  data-museum-hero-detail
                  aria-hidden="true"
                  className="mt-5 block font-serif text-[clamp(2rem,5vw,5rem)] italic leading-none tracking-[-0.04em] text-katha-gold sm:absolute sm:-bottom-10 sm:left-[54%] sm:mt-0"
                >
                  I — XXI
                </span>
              </div>
            </div>
          </div>

          <div className="grid items-end gap-7 border-b border-katha-text/20 pb-5 sm:grid-cols-[1fr_auto] sm:pb-7 lg:grid-cols-[minmax(0,34rem)_1fr_auto]">
            <p
              data-museum-hero-detail
              className="max-w-xl text-sm leading-7 text-katha-text/70 sm:text-base sm:leading-8"
            >
              {copy.museumHistoryPrototypeNotice}
            </p>
            <div aria-hidden="true" className="hidden h-px bg-katha-text/20 lg:block" />
            <a
              data-museum-hero-detail
              href="#museum-interactive-room"
              className="group inline-flex w-fit items-end gap-4 text-[0.66rem] font-semibold uppercase tracking-[0.26em] text-katha-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-gold focus-visible:ring-offset-4 focus-visible:ring-offset-katha-surface"
            >
              <span>{copy.museumHeroScroll}</span>
              <span className={styles.scrollLine} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section
        id="museum-interactive-room"
        aria-labelledby="museum-interactive-room-title"
        className="relative bg-katha-surface-light px-5 py-20 text-katha-text sm:px-8 sm:py-28 lg:px-12 lg:py-36"
      >
        <div className="mx-auto max-w-[90rem]">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-12">
            <div data-museum-room-copy className="reveal-on-scroll lg:col-span-3">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-katha-heritage">
                {copy.museumInteractiveRoomEyebrow}
              </p>
              <div className="mt-5 h-16 w-px bg-katha-heritage/55" aria-hidden="true" />
            </div>
            <div data-museum-room-copy className="reveal-on-scroll lg:col-span-6">
              <h2
                id="museum-interactive-room-title"
                className="max-w-[13ch] font-serif text-[clamp(2.7rem,5.6vw,6rem)] font-medium leading-[1.08] tracking-[-0.035em]"
              >
                {copy.museumInteractiveRoomTitle}
              </h2>
            </div>
            <p
              data-museum-room-copy
              className="reveal-on-scroll max-w-md text-sm leading-7 text-katha-text/70 sm:text-base sm:leading-8 lg:col-span-3"
            >
              {copy.museumInteractiveRoomBody}
            </p>
          </div>

          <div data-museum-scene-frame className="reveal-on-scroll mt-14 border-y border-katha-text/20 lg:ml-[7%] lg:mt-20">
            <div className="flex items-center justify-between gap-4 py-3 text-[0.62rem] font-bold uppercase tracking-[0.24em] text-katha-heritage sm:py-4">
              <span className="flex items-center gap-2.5">
                <span className="size-1.5 bg-katha-gold" aria-hidden="true" />
                {copy.museumInteractiveSceneLabel}
              </span>
              <span className="hidden text-katha-text/60 sm:inline">{copy.museumInteractiveSceneMeta}</span>
            </div>

            <div className="relative aspect-[16/9] min-h-[27rem] w-full overflow-hidden bg-katha-surface shadow-[0_30px_80px_color-mix(in_srgb,var(--color-katha-text)_14%,transparent)] max-sm:min-h-[30rem]">
              <iframe
                src={THINGLINK_SCENE_URL}
                title={copy.museumSceneTitle}
                data-lenis-prevent
                className="absolute inset-0 h-full w-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />

              {/* Anti-scroll-trap shield: on touch/mobile, prevents iframe from stealing swipe gestures */}
              {!is3DActive && (
                <div
                  className={styles.sceneShield}
                  onClick={() => setIs3DActive(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIs3DActive(true);
                    }
                  }}
                  aria-label={
                    language === 'km'
                      ? 'ចុចដើម្បីរុករកលំហ 3D'
                      : 'Chạm để tương tác không gian 3D'
                  }
                >
                  <div className="flex flex-col items-center gap-3 p-6 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full border border-katha-gold/60 bg-katha-surface/85 text-katha-gold shadow-lg transition-transform hover:scale-110">
                      <svg
                        className="size-7 animate-pulse"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3.6 9h16.8M3.6 15h16.8" />
                        <ellipse cx="12" cy="12" rx="4" ry="9" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.24em] text-katha-gold">
                      {language === 'km'
                        ? 'ចុចដើម្បីរុករកលំហ 3D'
                        : 'Chạm để khám phá không gian 3D'}
                    </span>
                    <span className="max-w-xs text-[0.68rem] leading-relaxed text-katha-text/70">
                      {language === 'km'
                        ? 'បង្វិល 360° · រមូរទំព័រដោយមិនមានការរំខាន'
                        : 'Xoay 360° · Cuộn trang mượt mà không bị kẹt'}
                    </span>
                  </div>
                </div>
              )}

              {is3DActive && (
                <button
                  type="button"
                  onClick={() => setIs3DActive(false)}
                  className={styles.sceneLockBtn}
                  aria-label={
                    language === 'km'
                      ? 'ចាក់សោរមូរទំព័រ'
                      : 'Khóa cuộn trang và tiếp tục'
                  }
                >
                  <span aria-hidden="true">✓</span>
                  <span>{language === 'km' ? 'ចាក់សោរមូរ' : 'Khóa cuộn'}</span>
                </button>
              )}
            </div>
            <Script src="//cdn.thinglink.me/jse/responsive.js" strategy="lazyOnload" />

            <div className="grid gap-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:py-6">
              <p className="max-w-2xl text-xs leading-6 text-katha-text/60 sm:text-sm">
                {copy.museumBetaNotice}
              </p>
              <a
                href={THINGLINK_ACCESSIBLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-11 w-fit items-center gap-4 border-b border-katha-heritage text-[0.65rem] font-bold uppercase tracking-[0.2em] text-katha-heritage transition-colors hover:text-katha-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-katha-heritage"
              >
                <span>{copy.museumAccessibleVersion}</span>
                <span className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        data-museum-timeline-transition
        className={`reveal-on-scroll relative flex min-h-[72svh] items-center overflow-hidden border-t border-katha-gold/15 bg-katha-surface px-5 py-24 sm:px-8 lg:px-12 ${styles.grain}`}
      >
        <div
          data-museum-timeline-watermark
          data-museum-timeline-intro
          className="pointer-events-none absolute inset-y-0 right-[8%] hidden items-center text-[34vw] font-serif leading-none text-katha-gold/[0.055] lg:flex"
          aria-hidden="true"
        >
          II
        </div>
        <div className="relative z-10 mx-auto grid w-full max-w-[90rem] gap-12 lg:grid-cols-12 lg:items-end">
          <div data-museum-timeline-intro className="lg:col-span-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.28em] text-katha-gold">
              {copy.museumTimelineRoomEyebrow}
            </p>
            <p className="mt-5 font-serif text-6xl leading-none text-katha-text sm:text-8xl" aria-hidden="true">
              06
            </p>
          </div>
          <p
            data-museum-timeline-intro
            className="max-w-[18ch] font-serif text-[clamp(2.4rem,4.8vw,5.2rem)] leading-[1.08] tracking-[-0.03em] text-katha-text lg:col-span-7"
          >
            {copy.museumTimelineIntro}
          </p>
          <div data-museum-timeline-intro className="hidden h-28 w-px bg-katha-gold/45 lg:col-span-2 lg:block" aria-hidden="true" />
        </div>
      </section>

      <KhmerHistoryTimeline />
    </main>
  );
}

